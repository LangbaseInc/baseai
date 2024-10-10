import { execSync } from 'child_process';

/**
 * Retrieves the list of changed and deleted files between two Git commits within a specified directory.
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.oldCommit - The old commit reference to compare from.
 * @param {string} [params.latestCommit='HEAD'] - The latest commit reference to compare to. Defaults to 'HEAD'.
 * @param {string} params.dirToTrack - The directory to track for changes.
 * @returns {Promise<{ changedFiles: string[]; deletedFiles: string[] }>} - A promise that resolves to an object containing arrays of changed and deleted files.
 * @throws {Error} - Throws an error if the Git command execution fails or if the commit references are invalid.
 */
export async function getChangedAndDeletedFilesBetweenCommits({
	oldCommit,
	latestCommit = 'HEAD',
	dirToTrack
}: {
	oldCommit: string;
	latestCommit: string;
	dirToTrack: string;
}): Promise<{ changedFiles: string[]; deletedFiles: string[] }> {
	try {
		// Validate inputs
		if (oldCommit === '') {
			throw new Error('Invalid commit references');
		}

		const repoPath = process.cwd();

		// Construct the Git commands to get changed and deleted files in the specific directory
		const changedCommand = `git diff --diff-filter=ACMRT --name-only ${oldCommit} ${latestCommit} -- ${dirToTrack}`;
		const deletedCommand = `git diff --diff-filter=D --name-only ${oldCommit} ${latestCommit} -- ${dirToTrack}`;

		// Execute the Git commands
		const changedResult = execSync(changedCommand, {
			encoding: 'utf-8',
			cwd: repoPath
		}).trim();

		const deletedResult = execSync(deletedCommand, {
			encoding: 'utf-8',
			cwd: repoPath
		}).trim();

		// Process the results
		let changedFiles = changedResult.split('\n').filter(Boolean);
		let deletedFiles = deletedResult.split('\n').filter(Boolean);

		// Resolve full paths
		changedFiles = changedFiles.map(file => file.replace(/\//g, '-'));
		deletedFiles = deletedFiles.map(file => file.replace(/\//g, '-'));

		return { changedFiles, deletedFiles };
	} catch (error) {
		console.error('Error executing Git command:', error);
		throw error;
	}
}
