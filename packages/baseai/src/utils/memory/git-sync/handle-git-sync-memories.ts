import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import { saveDeployedCommitHashInMemoryConfig } from './save-deployed-commit-in-config';
import { getChangedAndDeletedFilesBetweenCommits } from './get-changed-files-between-commits';
import type { MemoryConfigI } from 'types/memory';
import { listMemoryDocuments, type Account } from '@/deploy';
import { loadMemoryFilesFromCustomDir } from '../load-memory-files';
import { listLocalEmbeddedMemoryDocuments } from '../generate-embeddings';
import { saveEmbeddedCommitHashInMemoryConfig } from './save-embedded-commit-in-config';

export async function handleGitSyncMemories({
	memoryName,
	config,
	account
}: {
	memoryName: string;
	config: MemoryConfigI;
	account?: Account; // Undefined for local embed
}): Promise<{
	filesToDeploy: string[];
	filesToDelete: string[];
}> {
	const isEmbed = !account;

	// Check for uncommitted changes
	try {
		execSync('git diff-index --quiet HEAD --');
	} catch (error) {
		p.log.error(
			`There are uncommitted changes in the Git repository for ${isEmbed ? 'embedding' : 'deploying'} git-synced memory "${memoryName}".`
		);
		p.log.info(
			`Please commit these changes before ${isEmbed ? 'embedding' : 'deploying'}. Aborting.`
		);
		process.exit(1);
	}

	let filesToDeploy: string[] = [];
	let filesToDelete: string[] = [];

	// Step 1:
	// Fetch the uploaded documents and compare with the local documents
	// Handles new files that are not in the prodDocs due to extension and path updates
	const prodDocs = !isEmbed
		? await listMemoryDocuments({
				account,
				memoryName
			})
		: await listLocalEmbeddedMemoryDocuments({
				memoryName
			}); // For local embedded docs are prod equivalent

	const allFilesWithContent = await loadMemoryFilesFromCustomDir({
		memoryName,
		memoryConfig: config
	});

	const allFiles = allFilesWithContent.map(file => file.name);

	// Get files from allFiles that are not in the prodDocs
	const newFiles = allFiles.filter(
		file => !prodDocs.some(doc => doc === file)
	);

	// Step 2.1:
	// If there's no deployedCommitHash, user is deploying for the first time
	// Deploy all files in the directory
	const lastHashUsed = isEmbed
		? config.embeddedCommitHash
		: config.deployedCommitHash;

	if (!lastHashUsed) {
		filesToDeploy = allFiles;
		p.log.info(
			`Found no previous deployed commit. Deploying all ${filesToDeploy.length} files in memory "${memoryName}":`
		);
	}
	// Step 2.2: Otherwise, get changed files between commits
	else {
		const { changedFiles, deletedFiles } =
			await getChangedAndDeletedFilesBetweenCommits({
				oldCommit: lastHashUsed,
				latestCommit: 'HEAD',
				dirToTrack: config.dirToTrack
			});

		filesToDeploy = changedFiles;
		filesToDelete = deletedFiles;

		if (filesToDeploy.length > 0) {
			p.log.info(
				`Found ${filesToDeploy.length} changed files for memory "${memoryName}":`
			);

			// Print the changed file names TODO: Remove because it may clutter the terminal?
			filesToDeploy.forEach(file => p.log.message(file));
		} else {
			const isEmbed = !account;
			p.log.info(
				`No file changes detected for memory "${memoryName}" since last ${isEmbed ? 'embedding' : 'deployment'}.`
			);
		}

		if (filesToDelete.length > 0) {
			p.log.info(
				`Found ${filesToDelete.length} deleted files for memory "${memoryName}":`
			);

			// Print the deleted file names TODO: Remove because it may clutter the terminal?
			filesToDelete.forEach(file => p.log.message(file));
		} else {
			const isEmbed = !account;
			p.log.info(
				`No deleted file detected for memory "${memoryName}" since last ${isEmbed ? 'embedding' : 'deployment'}.`
			);
		}
	}

	// Step 3
	// Combine filesToDeploy with newFiles, avoid duplicates
	filesToDeploy = [...new Set([...filesToDeploy, ...newFiles])];
	// Filter the files to be deleted to make sure they are not in filesToDeploy
	filesToDelete = filesToDelete.filter(file => !filesToDeploy.includes(file));

	return {
		filesToDeploy,
		filesToDelete
	};
}

export async function updateDeployedCommitHash(memoryName: string) {
	const currentCommitHash = execSync('git rev-parse HEAD').toString().trim();
	await saveDeployedCommitHashInMemoryConfig({
		memoryName,
		deployedCommitHash: currentCommitHash
	});
}

export async function updateEmbeddedCommitHash(memoryName: string) {
	const currentCommitHash = execSync('git rev-parse HEAD').toString().trim();
	await saveEmbeddedCommitHashInMemoryConfig({
		memoryName,
		embeddedCommitHash: currentCommitHash
	});
}
