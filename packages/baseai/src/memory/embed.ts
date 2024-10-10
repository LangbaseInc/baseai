import { heading } from '@/utils/heading';
import { checkMemoryExists } from '@/utils/memory/check-memory-exist';
import { deleteDocumentFromDB, loadDb } from '@/utils/memory/db/lib';
import { generateEmbeddings } from '@/utils/memory/generate-embeddings';
import {
	handleGitSyncMemories,
	updateEmbeddedCommitHash
} from '@/utils/memory/git-sync/handle-git-sync-memories';
import { validateMemoryName } from '@/utils/memory/lib';
import loadMemoryConfig from '@/utils/memory/load-memory-config';
import { loadMemoryFiles } from '@/utils/memory/load-memory-files';
import * as p from '@clack/prompts';
import color from 'picocolors';

export async function embedMemory({
	memoryName: memoryNameInput,
	overwrite,
	useLocalEmbeddings
}: {
	memoryName: string;
	overwrite?: boolean;
	useLocalEmbeddings?: boolean;
}) {
	// Spinner to show current action.
	const s = p.spinner();

	try {
		p.intro(
			heading({
				text: 'EMBED',
				sub: `Creating embeddings of ${color.cyan(memoryNameInput)}`
			})
		);

		if (!memoryNameInput) {
			p.cancel(
				'Memory name is required. Use --memory or -m flag to specify.'
			);
			process.exit(1);
		}

		// 1- Check memory exists.
		const memoryName = validateMemoryName(memoryNameInput);
		await checkMemoryExists(memoryName);

		// 2- Load memory data.
		s.start('Processing memory docs...');
		let memoryFiles = await loadMemoryFiles(memoryName);

		if (memoryFiles.length === 0) {
			p.cancel(`No valid documents found in memory '${memoryName}'.`);
			process.exit(1);
		}

		// 3- Get memory config.
		const memoryConfig = await loadMemoryConfig(memoryName);

		let filesToEmbed: string[] = [];
		let filesToDelete: string[] = [];

		if (memoryConfig?.useGitRepo) {
			const { filesToDeploy, filesToDelete: gitFilesToDelete } =
				await handleGitSyncMemories({
					memoryName: memoryName,
					config: memoryConfig
				});

			filesToEmbed = filesToDeploy;
			filesToDelete = gitFilesToDelete;

			// Filter memory files to emebed
			memoryFiles = memoryFiles.filter(doc =>
				filesToEmbed.includes(doc.name)
			);
		}

		// 4- Generate embeddings.
		let embedResult = 'Embeddings updated.';
		if (filesToEmbed && filesToEmbed.length > 0) {
			s.message('Generating embeddings...');
			const shouldOverwrite = memoryConfig?.useGitRepo ? true : overwrite;
			embedResult = await generateEmbeddings({
				memoryFiles,
				memoryName,
				overwrite: shouldOverwrite || false,
				useLocalEmbeddings
			});
		}

		if (memoryConfig?.useGitRepo) {
			if (filesToDelete.length > 0) {
				await deleteDocumentsFromDB({
					memoryName,
					filesToDelete
				});
			}
			await updateEmbeddedCommitHash(memoryName);
			p.log.info('Updated embedded commit hash.');
			p.log.success('Synced memory files with git repository.');
		}

		s.stop(embedResult);
	} catch (error: any) {
		s.stop(`Stopped!`);
		p.cancel(`FAILED: ${error.message}`);
		process.exit(1);
	}
}

export async function deleteDocumentsFromDB({
	memoryName,
	filesToDelete
}: {
	memoryName: string;
	filesToDelete: string[];
}) {
	const s = p.spinner();
	s.start('Detected files to delete. Deleting...');

	try {
		const memoryDb = await loadDb(memoryName);

		for (const docName of filesToDelete) {
			if (memoryDb.data.documents[docName]) {
				await deleteDocumentFromDB({ db: memoryDb, docName });
				p.log.info(`Deleted document: ${color.cyan(docName)}`);
			}
		}

		s.stop(`Documents deleted from memory ${memoryName}.`);
	} catch (error) {
		s.stop('Stopped!');
		if (error instanceof Error) {
			p.cancel(`Failed to delete documents: ${error.message}`);
		} else {
			p.cancel(`Failed to delete documents. An unknown error occurred.`);
		}
		process.exit(1);
	}
}
