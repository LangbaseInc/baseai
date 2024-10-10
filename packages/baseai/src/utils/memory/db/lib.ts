import * as p from '@clack/prompts';
import cosineSimilarity from 'compute-cosine-similarity';
import fs from 'fs/promises';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import color from 'picocolors';
import { z } from 'zod';

// Schema definitions
const ChunkSchema = z.object({
	id: z.string().uuid(),
	text: z.string().trim().min(1),
	embedding: z.array(z.number())
});

type Chunk = z.infer<typeof ChunkSchema>;

interface Document {
	name: string;
	chunkIds: string[];
}

interface Schema {
	documents: { [name: string]: Document };
	chunks: { [name: string]: Chunk };
}

const defaultData: Schema = {
	documents: {},
	chunks: {}
};

interface MemoryChunk {
	text: string;
	embedding: number[];
	attributes: {
		memoryName: string;
		docName: string;
	};
}

export interface SimilarChunk extends Omit<MemoryChunk, 'embedding'> {
	similarity: number;
}

// Utility functions

// Create a new database
// basePath. The path to
export async function createDb(memoryName: string): Promise<Low<Schema>> {
	const baseDir = path.join(process.cwd(), '.baseai', 'db');
	const dbFilePath = path.join(baseDir, `${memoryName}.json`);

	// Ensure the directory exists
	await fs.mkdir(baseDir, { recursive: true });

	// Check if the file exists, if not, create it with default data
	try {
		await fs.access(dbFilePath);
	} catch (error) {
		// File doesn't exist, create it with default data
		await fs.writeFile(dbFilePath, JSON.stringify(defaultData, null, 2));
	}

	const adapter = new JSONFile<Schema>(dbFilePath);
	const db = new Low(adapter, defaultData);

	// Read the existing data or initialize with default
	await db.read();

	// If the file was empty or invalid JSON, write the default data
	if (db.data === null) {
		db.data = defaultData;
		await db.write();
	}

	return db;
}

// Read an existing database
export async function readDb(dbPath: string): Promise<Low<Schema>> {
	const adapter = new JSONFile<Schema>(dbPath);
	const db = new Low(adapter, defaultData);
	await db.read();
	return db;
}

// Delete a database
export async function deleteDb(dbPath: string): Promise<void> {
	try {
		await fs.unlink(dbPath);
		console.log(`Database at ${dbPath} has been deleted.`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			console.log(`No database found at ${dbPath}. Nothing to delete.`);
		} else {
			throw error;
		}
	}
}

// Load a database
export async function loadDb(memoryName: string) {
	try {
		const memoryDbPath = getMemoryDbPath(memoryName);
		await fs.access(memoryDbPath);
		return await readDb(memoryDbPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return await createDb(memoryName);
		}
		throw error;
	}
}

// CRUD operations for documents
export async function addDocument({
	db,
	docName
}: {
	db: Low<Schema>;
	docName: string;
}): Promise<void> {
	if (db.data.documents[docName]) {
		p.log.info(`[SKIPPED] DOC: ${color.cyan(docName)} already exists.`);
		return;
	}
	db.data.documents[docName] = { name: docName, chunkIds: [] };
	await db.write();
}

export function getDocument(
	db: Low<Schema>,
	docName: string
): Document | undefined {
	return db.data.documents[docName];
}

export async function deleteDocumentFromDB({
	db,
	docName
}: {
	db: Low<Schema>;
	docName: string;
}): Promise<void> {
	if (!db.data.documents[docName]) {
		throw new Error(`Document with name "${docName}" does not exist`);
	}

	// Delete all chunks associated with the document
	for (const chunkId of db.data.documents[docName].chunkIds) {
		delete db.data.chunks[chunkId];
	}

	delete db.data.documents[docName];
	await db.write();
}

export async function addChunksBulk(
	{
		db,
		docName,
		chunks
	}: { db: Low<Schema>; docName: string; chunks: Omit<Chunk, 'id'>[] } // Array of chunks, each omitting the id field
): Promise<void> {
	if (!db.data.documents[docName]) {
		throw new Error(`Document with name "${docName}" does not exist`);
	}

	for (const chunk of chunks) {
		const id = crypto.randomUUID();
		const newChunk = ChunkSchema.parse({ ...chunk, id });
		db.data.chunks[id] = newChunk;
		db.data.documents[docName].chunkIds.push(id);
	}

	await db.write();
}

export async function getDocumentsFromMemory(
	memoryNames: string[]
): Promise<MemoryChunk[]> {
	const memoryChunks: MemoryChunk[] = [];

	// Load each memory and get the documents
	for (const memoryName of memoryNames) {
		// Load the memory
		const db: Low<Schema> = await loadDb(memoryName);

		// Process the documents
		for (const [docName, document] of Object.entries(db.data.documents)) {
			// Get the chunks for the document
			const chunks = document.chunkIds.map(id => {
				const chunk = db.data.chunks[id];
				return {
					text: chunk.text,
					embedding: chunk.embedding,
					attributes: {
						memoryName,
						docName
					}
				};
			});

			// Add the processed document to the list
			memoryChunks.push(...chunks);
		}
	}

	//  Return the processed documents
	return memoryChunks;
}

export function cosineSimilaritySearch({
	chunks,
	queryEmbedding,
	topK
}: {
	chunks: MemoryChunk[];
	queryEmbedding: number[];
	topK: number;
}): SimilarChunk[] {
	// Return empty array if topK is invalid or no chunks are provided
	if (topK <= 0 || chunks.length === 0) {
		return [];
	}

	// Calculate cosine similarity for each chunk
	const chunksWithCosineSimilarity: SimilarChunk[] = chunks.map(chunk => ({
		text: chunk.text,
		attributes: chunk.attributes,
		similarity: cosineSimilarity(chunk.embedding, queryEmbedding) || 0
	}));

	// Sort chunks by similarity (descending order)
	chunksWithCosineSimilarity.sort((a, b) => b.similarity - a.similarity);

	// Return top K results
	return chunksWithCosineSimilarity.slice(0, topK);
}

// Get the path of the db file for a memory
export function getMemoryDbPath(memoryName: string): string {
	// Process.cwd() returns the current working directory of the Node.js process.
	// This is the directory from which the script is run. It is always the root of the project.

	// Path is cwd()/.baseai/db/{memoryName}.json
	const projectRootPath = process.cwd();

	// Db file path
	const memoryDBPath = path.join(
		projectRootPath,
		'.baseai',
		'db',
		`${memoryName}.json`
	);

	return memoryDBPath;
}
