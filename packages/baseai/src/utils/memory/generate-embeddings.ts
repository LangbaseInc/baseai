import * as p from '@clack/prompts';
import figures from 'figures';
import color from 'picocolors';
import { RecursiveCharacterTextSplitter } from './chunker';
import { MEMORYSETS } from './constants';
import {
	addChunksBulk,
	addDocument,
	deleteDocumentFromDB,
	getDocument,
	loadDb
} from './db/lib';
import { getOpenAIEmbeddings } from './generate-openai-embeddings';
import type { MemoryDocumentI } from './load-memory-files';
import { generateLocalEmbeddings } from './generate-local-embeddings';
import { loadConfig } from '../config/config-handler';
import { dlog } from '@/dev/utils/dlog';

export async function generateEmbeddings({
	memoryFiles,
	memoryName,
	overwrite = false,
	useLocalEmbeddings
}: {
	memoryFiles: MemoryDocumentI[];
	memoryName: string;
	overwrite: boolean;
	useLocalEmbeddings?: boolean;
}): Promise<string> {
	let memoryDb;
	let totalEmbeddings = 0;
	let totalDocs = memoryFiles.length;
	let successfulDocs = 0;
	let skippedDocs = 0;
	let failedDocs = 0;

	try {
		memoryDb = await loadDb(memoryName);
	} catch (error) {
		p.cancel(`Failed to load database for memory '${memoryName}'.`);
		process.exit(1);
	}

	const splitter = new RecursiveCharacterTextSplitter({
		chunkMaxLength: MEMORYSETS.MIN_CHUNK_LENGTH,
		chunkOverlap: MEMORYSETS.MIN_CHUNK_OVERLAP
	});

	for (const { name, content } of memoryFiles) {
		const document = getDocument(memoryDb, name);

		if (document && overwrite) {
			p.log.info(
				`Removing existing embeddings for DOC: ${color.cyan(name)}`
			);
			await deleteDocumentFromDB({
				db: memoryDb,
				docName: name
			});
		}

		if (document && !overwrite) {
			p.log.info(`[SKIPPED] DOC: ${color.cyan(name)} already exists.`);
			skippedDocs++;
			continue;
		}

		p.log.info(`Embedding document: ${name}`);

		try {
			addDocument({ db: memoryDb, docName: name });

			let chunks;
			try {
				chunks = await splitter.createChunks(content);
			} catch (error) {
				p.log.error(
					`Failed to split document "${name}" into chunks. Skipping.`
				);
				failedDocs++;
				continue;
			}

			let embeddings;
			try {
				// Load the useLocalEmbedding config from the config file.
				const config = await loadConfig();
				const localEmbeddingsConfig =
					config.memory?.useLocalEmbeddings || false;

				// Read the prop. If prop is present, use it, else use the config.
				const localEmbeddingsEnabled =
					useLocalEmbeddings ?? localEmbeddingsConfig;

				if (localEmbeddingsEnabled) {
					// Use local embeddings
					dlog('Generating local embeddings');
					embeddings = await generateLocalEmbeddings(chunks);
				} else {
					// Use OpenAI embeddings
					dlog('Generating OpenAI embeddings');
					embeddings = await getOpenAIEmbeddings(chunks);
				}
			} catch (error: any) {
				p.cancel(error.message);
				p.log.error(
					`Failed to generate embeddings for document "${name}". Skipping.`
				);
				failedDocs++;
				continue;
			}

			const chunksWithEmbeddings = chunks.map((chunk, index) => ({
				text: chunk,
				embedding: embeddings[index].embedding
			}));

			try {
				await addChunksBulk({
					db: memoryDb,
					docName: name,
					chunks: chunksWithEmbeddings
				});
				totalEmbeddings += chunksWithEmbeddings.length;
				successfulDocs++;
				p.log.success(`Successfully embedded document: ${name}`);
			} catch (error) {
				p.log.error(
					`Failed to add chunks for document "${name}" to the database. Skipping.`
				);
				failedDocs++;
			}
		} catch (error) {
			p.log.error(
				`An unexpected error occurred while processing document "${name}". Skipping.`
			);
			failedDocs++;
		}
	}

	generateEmbeddingSummary({
		totalDocs,
		successfulDocs,
		skippedDocs,
		totalEmbeddings
	});

	if (successfulDocs === 0 && skippedDocs === 0) {
		p.cancel(
			'No documents were successfully embedded or skipped. Process failed.'
		);
		process.exit(1);
	}

	if (successfulDocs === 0 && skippedDocs === totalDocs) {
		return `All documents were skipped. No new embeddings were generated. \n${color.dim(
			`${figures.arrowRight} Use --overwrite, -o flag to replace existing embeddings.`
		)}`;
	}

	return `All done!`;
}

function generateEmbeddingSummary({
	totalDocs,
	successfulDocs,
	skippedDocs,
	totalEmbeddings
}: {
	totalDocs: number;
	successfulDocs: number;
	skippedDocs: number;
	totalEmbeddings: number;
}): void {
	const failedDocs = totalDocs - successfulDocs - skippedDocs;
	const maxLabelLength = 'Total embeddings generated:'.length;

	const formatLine = (
		label: string,
		value: string,
		icon: string,
		valueColor: (s: string) => string
	) => {
		const paddedLabel = label.padEnd(maxLabelLength);
		return `${icon} ${paddedLabel} ${valueColor(value)}`;
	};

	const summary = [
		color.bold(color.cyan('Embedding Generation Summary:')),
		'',
		formatLine(
			'Total documents:',
			`${totalDocs}`,
			figures.info,
			color.blue
		),
		...(skippedDocs > 0
			? [
					formatLine(
						'Skipped:',
						`${skippedDocs}/${totalDocs} docs`,
						figures.warning,
						color.yellow
					)
				]
			: []),
		formatLine(
			'Successfully embedded:',
			`${successfulDocs}/${totalDocs} docs`,
			figures.tick,
			color.green
		),
		...(failedDocs > 0
			? [
					formatLine(
						'Failed:',
						`${failedDocs}/${totalDocs} docs`,
						figures.cross,
						color.red
					)
				]
			: []),
		formatLine(
			'Total embeddings generated:',
			`${totalEmbeddings}`,
			figures.pointer,
			color.magenta
		),
		''
	].join('\n');

	p.log.info(summary);
}

export async function listLocalEmbeddedMemoryDocuments({
	memoryName
}: {
	memoryName: string;
}) {
	const memoryDb = await loadDb(memoryName);
	const documents = Object.keys(memoryDb.data.documents);
	return documents;
}
