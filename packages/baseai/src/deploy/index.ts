import build, { buildMemory } from '@/build';
import { OLLAMA } from '@/dev/data/models';
import { dlog } from '@/dev/utils/dlog';
import { cyan, dim, dimItalic, green } from '@/utils/formatting';
import { heading } from '@/utils/heading';
import { compareDocumentLists } from '@/utils/memory/compare-docs-list';
import { MEMORYSETS } from '@/utils/memory/constants';
import {
	getMemoryFileNames,
	loadMemoryFiles,
	type MemoryDocumentI
} from '@/utils/memory/load-memory-files';
import { printDiffTable } from '@/utils/memory/print-diff-table';
import * as p from '@clack/prompts';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';
import color from 'picocolors';
import { type MemoryI } from 'types/memory';
import type { Pipe, PipeOld } from 'types/pipe';
import { getStoredAuth } from './../auth/index';
import {
	handleGitSyncMemories,
	updateDeployedCommitHash
} from '@/utils/memory/git-sync/handle-git-sync-memories';
import { handleSingleDocDeploy } from './document';

export interface Account {
	login: string;
	apiKey: string;
}

interface ErrorResponse {
	error?: { message: string };
}

type Spinner = ReturnType<typeof p.spinner>;

async function deploy({
	overwrite = false
}: {
	overwrite: boolean;
}): Promise<void> {
	const spinner = p.spinner();

	p.intro(heading({ text: 'DEPLOY', sub: 'Deploy your BaseAI project' }));

	try {
		// Build Pipes and Memory.
		await build({ calledAsCommand: false });
		const buildDir = path.join(process.cwd(), '.baseai');

		const pipesDir = path.join(buildDir, 'pipes');
		const pipes = await readPipesDirectory({ spinner, pipesDir });
		if (!pipes) {
			p.outro(
				`No pipes found. Skipping deployment. \nAdd a pipe by running: ${cyan(`npx baseai@latest pipe`)} command`
			);
			process.exit(1);
		}

		const memoryDir = path.join(buildDir, 'memory');
		const memory = await readMemoryDirectory({
			spinner,
			memoryDir
		});

		const toolsDir = path.join(buildDir, 'tools');
		const tools = await readToolsDirectory({ spinner, toolsDir });

		const account = await retrieveAuthentication({ spinner });
		if (!account) {
			p.outro(
				`No account found. Skipping deployment. \n Run: ${cyan('npx baseai@latest auth')}`
			);
			process.exit(1);
		}

		if (memory && memory.length > 0) {
			await deployMemories({
				spinner,
				memory,
				memoryDir,
				account,
				overwrite
			});
		}

		await deployPipes({ spinner, pipes, pipesDir, account });

		p.outro(
			heading({ text: 'DEPLOYED', sub: 'successfully', green: true })
		);

		p.log.warning(
			dimItalic(
				`Make sure ${cyan(`LANGBASE_API_KEY`)} exists in your production environment.`
			)
		);

		p.log.info(
			`${dim(`Successfully deployed:`)}
${dim(`- ${green(pipes?.length)} pipe${pipes.length !== 1 ? 's' : ''}
- ${green(tools?.length ?? 0)} tool${tools?.length !== 1 ? 's' : ''}
- ${green(memory?.length ?? 0)} memory${memory?.length !== 1 ? 'sets' : ''}`)}`
		);
	} catch (error) {
		handleError({
			spinner,
			message: 'An unexpected error occurred',
			error
		});
	}
}

async function readPipesDirectory({
	spinner,
	pipesDir
}: {
	spinner: Spinner;
	pipesDir: string;
}): Promise<string[] | null> {
	spinner.start('Reading pipes directory');
	try {
		const files = await fs.readdir(pipesDir);
		// Filter out non-json files
		const pipes = files.filter(file => path.extname(file) === '.json');

		spinner.stop(
			`Found ${pipes.length} pipe${pipes.length !== 1 ? 's' : ''}`
		);
		return pipes;
	} catch (error) {
		handleDirectoryReadError({ spinner, dir: pipesDir, error });
		return null;
	}
}

async function readToolsDirectory({
	spinner,
	toolsDir
}: {
	spinner: Spinner;
	toolsDir: string;
}): Promise<string[] | null> {
	spinner.start('Reading tools directory');
	try {
		const files = await fs.readdir(toolsDir);
		// Filter out non-json files
		const tools = files.filter(file => path.extname(file) === '.json');

		spinner.stop(
			`Found ${tools.length} tool${tools.length !== 1 ? 's' : ''}`
		);
		return tools;
	} catch (error) {
		handleDirectoryReadError({ spinner, dir: toolsDir, error });
		return null;
	}
}

export async function retrieveAuthentication({
	spinner
}: {
	spinner: Spinner;
}): Promise<Account | null> {
	spinner.start('Retrieving stored authentication');
	try {
		const account = await getStoredAuth();
		if (!account) {
			handleNoAccountFound({ spinner });
			return null;
		}
		spinner.stop(`Deploying as ${color.cyan(account.login)}`);
		return account;
	} catch (error) {
		handleAuthError({ spinner, error });
		return null;
	}
}

async function deployPipes({
	spinner,
	pipes,
	pipesDir,
	account
}: {
	spinner: Spinner;
	pipes: string[];
	pipesDir: string;
	account: Account;
}): Promise<void> {
	for (const pipe of pipes) {
		if (path.extname(pipe) === '.json') {
			await new Promise(resolve => setTimeout(resolve, 500)); // To avoid rate limiting
			await deployPipe({ spinner, pipe, pipesDir, account });
		}
	}
}

async function deployPipe({
	spinner,
	pipe,
	pipesDir,
	account
}: {
	spinner: Spinner;
	pipe: string;
	pipesDir: string;
	account: Account;
}): Promise<void> {
	const filePath = path.join(pipesDir, pipe);
	spinner.start(`Processing pipe: ${pipe}`);
	try {
		const pipeContent = await fs.readFile(filePath, 'utf-8');
		const pipeObject = JSON.parse(pipeContent) as Pipe;

		if (!pipeObject) {
			handleInvalidConfig({ spinner, name: pipe, type: 'pipe' });
			return;
		}

		spinner.stop(`Processed pipe: ${pipe}`);
		spinner.start(`Deploying pipe: ${pipeObject.name}`);

		if (pipeObject.model.includes(OLLAMA)) {
			spinner.stop(
				`Local Ollama model found: ${pipeObject.model}. It can not be deployed.`
			);
			spinner.start(
				`Replacing Ollama model with OpenAI gpt-4o-mini model for deployment.`
			);
			pipeObject.model = 'openai:gpt-4o-mini';
		}

		try {
			// Wait for 500 ms to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 500));
			const newPipe = await upsertPipe({
				pipe: pipeObject,
				account
			});
			spinner.stop(`Successfully deployed pipe: ${newPipe.name}`);
		} catch (error) {
			handleDeploymentError({
				spinner,
				name: pipeObject.name,
				error,
				type: 'pipe'
			});
		}
	} catch (error) {
		handleFileProcessingError({ spinner, name: pipe, error });
	}
}

function getApiUrls(pipeName: string) {
	return {
		createUrl: `https://api.langbase.com/v1/pipes`,
		updateUrl: `https://api.langbase.com/v1/pipes/${pipeName}`
	};
}

async function upsertPipe({ pipe, account }: { pipe: Pipe; account: Account }) {
	const { createUrl } = getApiUrls(pipe.name);

	try {
		const createResponse = await fetch(createUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${account.apiKey}`
			},
			body: JSON.stringify({
				...pipe,
				upsert: true
			})
		});

		if (createResponse.ok) {
			return (await createResponse.json()) as any;
		}

		const errorData = (await createResponse.json()) as ErrorResponse;

		throw new Error(
			`HTTP error! status: ${createResponse.status}, message: ${errorData.error?.message}`
		);
	} catch (error) {
		console.error('Error in createNewPipe:', error);
		throw error;
	}
}

async function updateExistingPipe({
	updateUrl,
	pipe,
	account
}: {
	updateUrl: string;
	pipe: PipeOld;
	account: Account;
}): Promise<PipeOld> {
	p.log.info(`Pipe "${pipe.name}" already exists. Updating instead.`);

	const updateResponse = await fetch(updateUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${account.apiKey}`
		},
		body: JSON.stringify(pipe)
	});

	if (!updateResponse.ok) {
		const error = await updateResponse.text();
		throw new Error(
			`HTTP error! status: ${updateResponse.status}, message: ${error}`
		);
	}

	return (await updateResponse.json()) as PipeOld;
}

export function handleError({
	spinner,
	message,
	error
}: {
	spinner: Spinner;
	message: string;
	error: unknown;
}): void {
	spinner.stop(message);
	p.log.error(`${message}: ${(error as Error).message}`);
}

function handleDirectoryReadError({
	spinner,
	dir,
	error
}: {
	spinner: Spinner;
	dir: string;
	error: unknown;
}): void {
	spinner.stop('Failed to read build directory');
	if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
		p.log.error(`BaseAI Directory not found: ${dir}`);
		p.log.info(
			`Run from the root of your project where the ${color.cyan('baseai')} directory is located.`
		);
	} else {
		p.log.error(`Error reading directory: ${(error as Error).message}`);
	}
}

function handleNoAccountFound({ spinner }: { spinner: Spinner }): void {
	spinner.stop('No account found');
	p.log.warn('No account found. Please authenticate first.');
	p.log.info(`Run: ${color.green('npx baseai auth')}`);
}

function handleAuthError({
	spinner,
	error
}: {
	spinner: Spinner;
	error: unknown;
}): void {
	spinner.stop('Failed to retrieve authentication');
	p.log.error(`Error retrieving stored auth: ${(error as Error).message}`);
}

export function handleInvalidConfig({
	spinner,
	name,
	type
}: {
	spinner: Spinner;
	name: string;
	type: 'pipe' | 'memory';
}): void {
	spinner.stop(`Failed to extract ${type} configuration from ${name}`);
	p.log.error(`Invalid ${type} configuration`);
}

export function handleDeploymentError({
	spinner,
	error,
	name,
	type
}: {
	spinner: Spinner;
	name: string;
	error: unknown;
	type: 'pipe' | 'memory';
}): void {
	spinner.stop(`Failed to deploy ${type}: ${name}`);
	p.log.error(`Deployment error: ${(error as Error).message}`);
	process.exit(0);
}

function handleFileProcessingError({
	spinner,
	name,
	error
}: {
	spinner: Spinner;
	name: string;
	error: unknown;
}): void {
	spinner.stop(`Error processing ${name}`);
	p.log.error(`File processing error: ${(error as Error).message}`);
}

export async function readMemoryDirectory({
	spinner,
	memoryDir
}: {
	spinner: Spinner;
	memoryDir: string;
}): Promise<string[] | null> {
	spinner.start('Reading memory directory');
	try {
		const memory = await fs.readdir(memoryDir);
		return memory;
	} catch (error) {
		handleDirectoryReadError({ spinner, dir: memoryDir, error });
		return null;
	}
}

async function deployMemories({
	spinner,
	memory,
	memoryDir,
	account,
	overwrite
}: {
	spinner: Spinner;
	memory: string[];
	memoryDir: string;
	account: Account;
	overwrite: boolean;
}): Promise<void> {
	for (const memoryName of memory) {
		await deployMemory({
			spinner,
			memoryName,
			memoryDir,
			account,
			overwrite
		});
	}
}

export async function deployMemory({
	spinner,
	memoryName,
	memoryDir,
	account,
	overwrite
}: {
	spinner: Spinner;
	memoryName: string;
	memoryDir: string;
	account: Account;
	overwrite: boolean;
}): Promise<void> {
	const filePath = path.join(memoryDir, memoryName);
	const memoryNameWithoutExt = memoryName.split('.')[0]; // Remove .json extension

	spinner.start(`Processing memory: ${memoryNameWithoutExt}`);
	try {
		const memoryContent = await fs.readFile(filePath, 'utf-8');
		const memoryObject = JSON.parse(memoryContent) as MemoryI;

		if (!memoryObject) {
			handleInvalidConfig({ spinner, name: memoryName, type: 'memory' });
			return;
		}

		p.log.step(`Processing documents for memory: ${memoryNameWithoutExt}`);

		let filesToDeploy: string[] = [];
		let filesToDelete: string[] = [];
		let memoryDocs: MemoryDocumentI[] = [];

		// Git sync memories
		if (memoryObject.config?.useGitRepo) {
			// Get names of files to deploy, i.e., changed or new files
			const {
				filesToDeploy: gitFilesToDeploy,
				filesToDelete: gitFilesToDelete
			} = await handleGitSyncMemories({
				memoryName: memoryNameWithoutExt,
				config: memoryObject.config,
				account
			});

			filesToDeploy = gitFilesToDeploy;
			filesToDelete = gitFilesToDelete;

			// Load all documents contents for the memory
			memoryDocs = await loadMemoryFiles(memoryNameWithoutExt);

			// Filter memoryDocs to only include documents in filesToDeploy
			// i.e., changed or new files
			memoryDocs = memoryDocs.filter(doc =>
				filesToDeploy.includes(doc.name)
			);
		} else {
			// Non-git sync memories
			memoryDocs = await loadMemoryFiles(memoryNameWithoutExt);
			filesToDeploy = memoryDocs.map(doc => doc.name);
		}

		if (filesToDeploy.length === 0) {
			spinner.stop(
				`No documents to deploy for memory: ${memoryNameWithoutExt}. Skipping.`
			);
		}

		spinner.stop(`Processed memory: ${memoryName.split('.')[0]}`);
		spinner.start(`Deploying memory: ${memoryObject.name.split('.')[0]}`);

		try {
			await upsertMemory({
				memory: memoryObject,
				documents: memoryDocs,
				account,
				overwrite,
				isGitSync: memoryObject.config?.useGitRepo,
				docsToDelete: filesToDelete
			});
			spinner.stop(`Deployment finished memory: ${memoryObject.name}`);
		} catch (error) {
			dlog('Error in upsertMemory:', error);
			throw error;
		}
	} catch (error) {
		handleDeploymentError({
			spinner,
			name: memoryName,
			error,
			type: 'memory'
		});
		spinner.stop(`Error processing memory: ${memoryName}`);
		throw error;
	}
}

export async function upsertMemory({
	memory,
	documents,
	account,
	overwrite,
	isGitSync = false,
	docsToDelete = []
}: {
	memory: MemoryI;
	documents: MemoryDocumentI[];
	account: Account;
	overwrite: boolean;
	isGitSync?: boolean;
	docsToDelete?: string[];
}): Promise<void> {
	const { createMemory } = getMemoryApiUrls({
		account,
		memoryName: memory.name
	});

	try {
		await new Promise(resolve => setTimeout(resolve, 800)); // To avoid rate limiting
		const createResponse = await fetch(createMemory, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${account.apiKey}`
			},
			body: JSON.stringify(memory)
		});

		if (!createResponse.ok) {
			const errorData = (await createResponse.json()) as ErrorResponse;

			// If memory already exists, handle it.
			if (errorData.error?.message.includes('already exists')) {
				if (!isGitSync) {
					// Show that Memory already exists
					p.log.info(
						`Memory "${memory.name}" already exists in production.`
					);
					await handleExistingMemoryDeploy({
						memory,
						account,
						documents,
						overwrite
					});
					return;
				}

				// If Git-sync memory, update the existing memory
				if (isGitSync) {
					p.log.info(
						`Memory "${memory.name}" already exists. Updating changed documents.`
					);
					await handleGitSyncMemoryDeploy({
						memory,
						account,
						documents,
						overwrite
					});

					if (docsToDelete?.length > 0) {
						await deleteDocumentsFromMemory({
							documents: docsToDelete,
							name: memory.name,
							account
						});
					}

					await updateDeployedCommitHash(memory.name);

					p.log.info(
						`Updated deployed commit hash for memory: ${memory.name}`
					);

					return;
				}
			}

			// Throw error if not already exists
			throw new Error(
				`HTTP error! status: ${createResponse.status}, message: ${errorData.error?.message}`
			);
		}

		dlog('Memory created successfully');

		// Upload documents
		const { name } = (await createResponse.json()) as MemoryI;
		await uploadDocumentsToMemory({ documents, name, account });

		if (isGitSync) {
			if (docsToDelete?.length > 0) {
				await deleteDocumentsFromMemory({
					documents: docsToDelete,
					name: memory.name,
					account
				});
			}

			await updateDeployedCommitHash(memory.name);
			p.log.info(
				`Updated deployed commit hash for memory: ${memory.name}`
			);
		}
	} catch (error) {
		dlog('Error in createNewMemory:', error);
		throw error;
	}
}

export async function uploadDocumentsToMemory({
	documents,
	name,
	account
}: {
	documents: MemoryDocumentI[];
	name: string;
	account: Account;
}) {
	for (const doc of documents) {
		try {
			p.log.message(`Uploading document: ${doc.name} ....`);
			await new Promise(resolve => setTimeout(resolve, 800)); // To avoid rate limiting
			const signedUrl = await getSignedUploadUrl({
				documentName: doc.name,
				memoryName: name,
				account
			});

			const uploadResponse = await uploadDocument(signedUrl, doc.blob);
			dlog(`Upload response status: ${uploadResponse.status}`);

			p.log.message(`Uploaded document: ${doc.name}`);
		} catch (error) {
			throw error;
		}
	}
}

export async function deleteDocumentsFromMemory({
	documents,
	name,
	account
}: {
	documents: string[];
	name: string;
	account: Account;
}) {
	p.log.info(`Deleting documents from memory: ${name}`);

	for (const doc of documents) {
		try {
			p.log.message(`Deleting document: ${doc} ....`);
			await new Promise(resolve => setTimeout(resolve, 800)); // To avoid rate limiting

			const deleteResponse = await deleteDocument({
				documentName: doc,
				memoryName: name,
				account
			});

			dlog(`Delete response status: ${deleteResponse.status}`);

			p.log.message(`Deleted document: ${doc}`);
		} catch (error) {
			throw error;
		}
	}
	p.log.info(`Deleted documents from memory: ${name}`);
}

export async function handleExistingMemoryDeploy({
	memory,
	account,
	documents,
	overwrite
}: {
	memory: MemoryI;
	account: Account;
	documents: MemoryDocumentI[];
	overwrite: boolean;
}) {
	p.log.info(`Fetching "${memory.name}" memory documents.`);

	// Fetch the existing documents and compare with the local documents
	const prodDocs = await listMemoryDocuments({
		account,
		memoryName: memory.name
	});

	// Get the list of local document names
	const localDocs = await getMemoryFileNames(memory.name);

	// Compare the documents
	const {
		areListsSame,
		isProdSubsetOfLocal,
		isProdSupersetOfLocal,
		areMutuallyExclusive,
		areOverlapping
	} = compareDocumentLists({
		localDocs,
		prodDocs
	});

	// If the user wants to overwrite, overwrite the memory.
	if (overwrite) {
		await overwriteMemory({ memory, documents, account });
		return true;
	}

	// If the lists are the same, do nothing and skip deployment.
	if (areListsSame) {
		p.log.info(
			`Documents in local and prod are the same. Skipping deployment for memory: "${memory.name}".`
		);

		return true;
	}

	// If prod is a subset of local, upload the missing documents.
	if (isProdSubsetOfLocal) {
		await uploadMissingDocumentsToMemory({
			memory,
			prodDocs,
			documents,
			account
		});
		return true;
	}

	// If prod is a superset of local or the lists are mutually exclusive, ask the user whether to overwrite.
	if (isProdSupersetOfLocal || areMutuallyExclusive || areOverlapping) {
		await handleProdSupersetOfLocal({
			memory,
			localDocs,
			prodDocs,
			documents,
			account
		});
		return true;
	}
}

async function handleProdSupersetOfLocal({
	memory,
	localDocs,
	prodDocs,
	documents,
	account
}: {
	memory: MemoryI;
	localDocs: string[];
	prodDocs: string[];
	documents: MemoryDocumentI[];
	account: Account;
}) {
	// Show the diff table.
	printDiffTable(localDocs, prodDocs);

	// Inform user, Memory deploy is currently in beta and can currently only overwrite the prod memory.
	p.log.warning(
		`Memory deploy is currently in beta. We only support overwriting the prod memory on Langbase.com.`
	);

	// Ask user to overwrite.
	const shouldOverwrite = await p.confirm({
		message:
			'Do you want to overwrite the prod memory? This will delete all prod documents.',
		initialValue: false
	});

	if (!shouldOverwrite) {
		p.log.message(`Skipping memory deployment for "${memory.name}".`);
		return;
	}

	// Overwrite the prod memory
	await overwriteMemory({ memory, documents, account });
}

async function uploadMissingDocumentsToMemory({
	memory,
	prodDocs,
	documents,
	account
}: {
	memory: MemoryI;
	prodDocs: string[];
	documents: MemoryDocumentI[];
	account: Account;
}) {
	p.log.info(
		`Prod has missing documents. Uploading new documents to ${memory.name}.`
	);
	const missingDocs = documents.filter(doc => {
		const isMissing = !prodDocs.includes(doc.name);
		if (!isMissing) {
			p.log.message(`Document "${doc.name}" already exists. Skipping.`);
		}
		return isMissing;
	});

	// wait for 500 ms to avoid rate limiting
	await new Promise(resolve => setTimeout(resolve, 500));
	await uploadDocumentsToMemory({
		documents: missingDocs,
		name: memory.name,
		account
	});
}

export async function listMemoryDocuments({
	account,
	memoryName
}: {
	account: Account;
	memoryName: string;
}) {
	const { listDocuments } = getMemoryApiUrls({
		account,
		memoryName: memoryName
	});

	// Wait 500 ms to avoid rate limiting
	await new Promise(resolve => setTimeout(resolve, 500));
	const listResponse = await fetch(listDocuments, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${account.apiKey}`
		}
	});

	if (!listResponse.ok) {
		const errorData = (await listResponse.json()) as ErrorResponse;

		const errorMsg = errorData.error?.message;

		if (errorMsg?.includes('Invalid memory name.')) {
			p.log.info(`Memory "${memoryName}" does not exist in production.`);
			return [];
		}

		throw new Error(
			`HTTP error! status: ${listResponse.status}, message: ${errorMsg}`
		);
	}

	const res = (await listResponse.json()) as { docs: { name: string }[] };
	const documents = res.docs.map((doc: { name: string }) => doc.name);
	return documents;
}

async function getSignedUploadUrl({
	documentName,
	memoryName,
	account
}: {
	documentName: string;
	memoryName: string;
	account: Account;
}): Promise<string> {
	const { uploadDocument } = getMemoryApiUrls({
		account,
		memoryName
	});

	const isOrgAccount = account.apiKey.includes(':');

	const ownerLogin = isOrgAccount
		? account.apiKey.split(':')[0]
		: account.login;
	try {
		const response = await fetch(uploadDocument, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${account.apiKey}`
			},
			body: JSON.stringify({
				memoryName,
				ownerLogin,
				fileName: documentName
			})
		});

		if (!response.ok) {
			const errorData = (await response.json()) as ErrorResponse;
			throw new Error(
				`HTTP error! status: ${response.status}, message: ${errorData.error?.message}`
			);
		}
		const { signedUrl } = (await response.json()) as { signedUrl: string };

		if (!signedUrl) {
			throw new Error('Invalid signedUrl received from API');
		}

		return signedUrl;
	} catch (error) {
		dlog('Error in getSignedUploadUrl:', error);
		throw error;
	}
}

async function deleteDocument({
	documentName,
	memoryName,
	account
}: {
	documentName: string;
	memoryName: string;
	account: Account;
}) {
	const { deleteDocument } = getMemoryApiUrls({
		account,
		memoryName,
		documentName
	});

	try {
		const response = await fetch(deleteDocument, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${account.apiKey}`
			}
		});

		if (!response.ok) {
			const errorData = (await response.json()) as ErrorResponse;
			throw new Error(
				`HTTP error! status: ${response.status}, message: ${errorData.error?.message}`
			);
		}

		return response;
	} catch (error) {
		dlog('Error in deleteDocument:', error);
		throw error;
	}
}

async function uploadDocument(signedUrl: string, document: Blob) {
	let mimeType = document.type;

	// Check if the MIME type is supported.
	const isSupportedMimeType =
		MEMORYSETS.ACCEPTED_MIME_TYPES.includes(mimeType);

	// If not, default to text/plain.
	if (!isSupportedMimeType) {
		dlog(`Unsupported MIME type ${mimeType}. Defaulting to text/plain`);
		mimeType = 'text/plain';
	}

	try {
		const response = await fetch(signedUrl, {
			method: 'PUT',
			headers: {
				'Content-Type': mimeType
			},
			body: document
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`HTTP error! status: ${response.status}, message: ${error}`
			);
		}

		return response;
	} catch (error) {
		dlog('Error in uploadDocument:', error);
		throw error;
	}
}

export function getMemoryApiUrls({
	account,
	memoryName,
	documentName
}: {
	account: Account;
	memoryName: string;
	documentName?: string;
}) {
	const isOrgAccount = account.apiKey.includes(':');
	const ownerLogin = isOrgAccount
		? account.apiKey.split(':')[0]
		: account.login;
	const baseUrl = `https://api.langbase.com/beta`;
	const baseUrlV1 = `https://api.langbase.com/v1`;

	// Create memory URL
	const createUrlOrg = `${baseUrl}/org/${ownerLogin}/memorysets`;
	const createUrlUser = `${baseUrl}/user/memorysets`;

	// Upload document URL
	const uploadDocumentOrg = `${baseUrl}/org/${ownerLogin}/memorysets/documents`;
	const uploadDocumentUser = `${baseUrl}/user/memorysets/documents`;

	// List documents URL
	const listDocuments = `${baseUrl}/memorysets/${ownerLogin}/${memoryName}/documents`;

	// Delete memory URL
	const deleteMemory = `${baseUrl}/memorysets/${ownerLogin}/${memoryName}`;

	// Delete document URL
	const deleteDocument = `${baseUrlV1}/memory/${memoryName}/documents/${documentName}`;

	return {
		listDocuments,
		deleteMemory,
		deleteDocument,
		createMemory: isOrgAccount ? createUrlOrg : createUrlUser,
		uploadDocument: isOrgAccount ? uploadDocumentOrg : uploadDocumentUser
	};
}

async function overwriteMemory({
	memory,
	documents,
	account
}: {
	memory: MemoryI;
	documents: MemoryDocumentI[];
	account: Account;
}): Promise<void> {
	p.log.message(
		`Overwriting memory "${memory.name}" in prod at Langbase.com with local documents.`
	);

	// Delete old memory.
	dlog(`Deleting old memory: ${memory.name}`);
	const { deleteMemory } = getMemoryApiUrls({
		account,
		memoryName: memory.name
	});

	// Wait 500 ms to avoid rate limiting
	await new Promise(resolve => setTimeout(resolve, 500));
	const deleteResponse = await fetch(deleteMemory, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${account.apiKey}`
		}
	});

	if (!deleteResponse.ok) {
		const error = await deleteResponse.text();
		throw new Error(
			`HTTP error! status: ${deleteResponse.status}, message: ${error}`
		);
	}

	p.log.message(`Overwriting memory: ${memory.name}`);

	// Reuse same function to create the memory.
	await new Promise(resolve => setTimeout(resolve, 1000));
	await upsertMemory({
		memory,
		documents,
		account,
		overwrite: true
	});
}

export async function handleGitSyncMemoryDeploy({
	memory,
	account,
	documents,
	overwrite
}: {
	memory: MemoryI;
	account: Account;
	documents: MemoryDocumentI[];
	overwrite: boolean;
}) {
	for (const doc in documents) {
		await new Promise(resolve => setTimeout(resolve, 800)); // To avoid rate limiting
		await handleSingleDocDeploy({
			memory,
			account,
			document: documents[doc],
			overwrite: true // TODO: Implement overwrite for git-sync memories
		});
	}
}

export async function deploySingleMemory({
	memoryName,
	overwrite
}: {
	memoryName: string;
	overwrite: boolean;
}): Promise<void> {
	const spinner = p.spinner();

	try {
		p.intro(heading({ text: 'BUILDING', sub: 'baseai...' }));

		await buildMemory({
			memoryName: memoryName
		});

		console.log('');
		p.outro(heading({ text: 'BUILD', sub: 'complete', green: true }));

		p.intro(heading({ text: 'DEPLOY', sub: 'Deploy your BaseAI Memory' }));

		const buildDir = path.join(process.cwd(), '.baseai');
		const memoryDir = path.join(buildDir, 'memory');
		const allMemory = await readMemoryDirectory({
			spinner,
			memoryDir
		});

		// Check if the memory exists
		if (!allMemory?.includes(`${memoryName}.json`)) {
			p.log.error(`Memory "${memoryName}" not found.`);
			return;
		}

		// Retrieve authentication
		const account = await retrieveAuthentication({ spinner });
		if (!account) {
			p.log.error(
				'Authentication failed. Please run "npx baseai auth" to authenticate.'
			);
			return;
		}

		// Call deployMemory function
		await deployMemory({
			spinner,
			memoryName: `${memoryName}.json`,
			memoryDir,
			account,
			overwrite
		});

		p.outro(`Successfully deployed memory: ${memoryName}`);
		process.exit(1);
	} catch (error) {
		if (error instanceof Error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				p.log.error(
					`Directory or file not found. Make sure you're in the correct project directory and the memory exists.`
				);
			} else {
				p.log.error(`Error deploying memory: ${error.message}`);
			}
		} else {
			p.log.error(`An unknown error occurred while deploying memory.`);
		}
		process.exit(1);
	}
}

export { deploy };
