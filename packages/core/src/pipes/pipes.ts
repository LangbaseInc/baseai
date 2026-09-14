import type {Runner} from 'src/helpers';
import {
	Message,
	MessageRole,
	Pipe as PipeI,
	ToolCallResult,
	Tools,
} from '../../types/pipes';
import {Request} from '../common/request';
import {getLLMApiKey} from '../utils/get-llm-api-key';
import {getApiUrl, isProd} from '../utils/is-prod';
import {isLocalServerRunning} from 'src/utils/local-server-running';
import {getToolsFromStream} from 'src/helpers';
import {ANTHROPIC} from 'src/data/models';
import {getProvider} from 'src/utils/get-provider';

export interface Variable {
	name: string;
	value: string;
}

export interface RunOptions {
	messages?: Message[];
	variables?: Variable[];
	threadId?: string;
	rawResponse?: boolean;
	runTools?: boolean;
	tools?: Tools[];
	name?: string; // Pipe name for SDK,
	apiKey?: string; // pipe level key for SDK
	llmKey?: string; // LLM API key
}

export interface RunOptionsStream extends RunOptions {
	stream: boolean;
}

export interface Usage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

export interface RunResponse {
	completion: string;
	threadId?: string;
	id: string;
	object: string;
	created: number;
	model: string;
	choices: ChoiceGenerate[];
	usage: Usage;
	system_fingerprint: string | null;
	rawResponse?: {
		headers: Record<string, string>;
	};
}

export interface RunResponseStream {
	stream: ReadableStream<any>;
	threadId: string | null;
	rawResponse?: {
		headers: Record<string, string>;
	};
}

export interface PipeOptions extends PipeI {
	maxCalls?: number;
	prod?: boolean;
}

interface ChoiceGenerate {
	index: number;
	message: Message;
	logprobs: boolean | null;
	finish_reason: string;
}

interface Tool {
	run: (...args: any[]) => Promise<any>;
	function: {
		name: string;
		description: string;
		parameters: any;
	};
}

export class Pipe {
	private request: Request;
	private pipe: any;
	private tools: Record<string, (...args: any[]) => Promise<any>>;
	private maxCalls: number;
	private hasTools: boolean;
	private prod: boolean;
	private baseUrl: string;
	private entityApiKey?: string;

	constructor(options: PipeOptions) {
		this.prod = options.prod ?? isProd();
		this.baseUrl = getApiUrl(this.prod);

		this.request = new Request({
			apiKey: options.apiKey,
			baseUrl: this.baseUrl,
		});
		this.pipe = options;
		this.entityApiKey = options.apiKey;

		delete this.pipe.prod;
		delete this.pipe.apiKey;

		this.tools = this.getToolsFromPipe(this.pipe);
		this.maxCalls = options.maxCalls || 100; // TODO: Find a sane default.
		this.hasTools = Object.keys(this.tools).length > 0;
	}

	private getToolsFromPipe(
		pipe: Pipe,
	): Record<string, (...args: any[]) => Promise<any>> {
		const tools: Record<string, (...args: any[]) => Promise<any>> = {};
		if (pipe.tools && Array.isArray(pipe.tools)) {
			pipe.tools.forEach((tool: Tool) => {
				tools[tool.function.name] = tool.run;
			});
		}
		return tools;
	}

	private async runTools(toolCalls: ToolCallResult[]): Promise<Message[]> {
		const toolPromises = toolCalls.map(async (toolCall: ToolCallResult) => {
			const toolName = toolCall.function.name;
			const toolParameters = JSON.parse(toolCall.function.arguments);
			const toolFunction = this.tools[toolName];

			if (!toolFunction) {
				throw new Error(
					`Tool ${toolName} not found. If this is intentional, please set runTools to false to disable tool execution by default.`,
				);
			}

			const toolResponse = await toolFunction(toolParameters);

			return {
				tool_call_id: toolCall.id,
				role: 'tool' as MessageRole,
				name: toolName,
				content: JSON.stringify(toolResponse),
			};
		});

		return Promise.all(toolPromises);
	}

	private hasNoToolCalls(message: Message): boolean {
		return !message.tool_calls || message.tool_calls.length === 0;
	}

	private getMessagesToSend(
		messages: Message[],
		responseMessage: Message,
		toolResults: Message[],
	): Message[] {
		return this.prod
			? toolResults
			: [...messages, responseMessage, ...toolResults];
	}

	private isStreamRequested(options: RunOptions | RunOptionsStream): boolean {
		return 'stream' in options && options.stream === true;
	}

	private warnIfToolsWithStream(requestedStream: boolean): void {
		if (this.hasTools && requestedStream) {
			console.warn(
				'Warning: Streaming is not yet supported in Anthropic models when tools are present in the pipe. Falling back to non-streaming mode.',
			);
		}
	}

	private async handleStreamResponse(
		options: RunOptionsStream,
		response: RunResponseStream,
	): Promise<RunResponseStream> {
		const endpoint = '/v1/pipes/run';
		const stream = this.isStreamRequested(options);
		const body = {...options, stream};

		const [streamForToolCall, streamForReturn] = response.stream.tee();
		const tools = await getToolsFromStream(streamForToolCall);

		if (tools.length) {
			let messages = options.messages || [];

			let currentResponse: RunResponseStream = {
				stream: streamForReturn,
				threadId: response.threadId,
				rawResponse: response.rawResponse,
			};

			let callCount = 0;

			while (callCount < this.maxCalls) {
				const [streamForToolCall, streamForReturn] =
					currentResponse.stream.tee();

				const tools = await getToolsFromStream(streamForToolCall);

				if (tools.length === 0) {
					return {
						stream: streamForReturn,
						threadId: currentResponse.threadId,
						rawResponse: response.rawResponse,
					};
				}

				const toolResults = await this.runTools(tools);

				const responseMessage = {
					role: 'assistant',
					content: null,
					tool_calls: tools,
				} as Message;

				messages = this.getMessagesToSend(
					messages,
					responseMessage,
					toolResults,
				);

				currentResponse = await this.createRequest<RunResponseStream>(
					endpoint,
					{
						...body,
						messages,
						threadId: currentResponse.threadId,
					},
				);

				callCount++;
			}
		}

		return {
			...response,
			stream: streamForReturn,
		} as RunResponseStream;
	}

	public async run(options: RunOptionsStream): Promise<RunResponseStream>;
	public async run(options: RunOptions): Promise<RunResponse>;
	public async run(
		options: RunOptions | RunOptionsStream,
	): Promise<RunResponse | RunResponseStream> {
		// logger('pipe.run', this.pipe.name, 'RUN');

		const endpoint = '/v1/pipes/run';
		// logger('pipe.run.baseUrl.endpoint', getApiUrl() + endpoint);
		// logger('pipe.run.options');
		// logger(options, {depth: null, colors: true});

		const providerString = this.pipe.model.split(':')[0];
		const modelProvider = getProvider(providerString);
		const isAnthropic = modelProvider === ANTHROPIC;
    const hasTools = this.hasTools;

		// For SDK
		// Run the given pipe name
		if (options.name) {
			this.pipe = {...this.pipe, name: options.name};
		}

		// For SDK
		// Run the pipe against the given Pipe API key
		if (options.apiKey) {
			this.request = new Request({
				apiKey: options.apiKey,
				baseUrl: this.baseUrl,
				...((options.llmKey && {llmKey: options.llmKey}) || {}),
			});
		}

		if (options.llmKey && !options.apiKey) {
			this.request = new Request({
				apiKey: this.entityApiKey,
				baseUrl: this.baseUrl,
				llmKey: options.llmKey,
			});
		}

		let stream = this.isStreamRequested(options);

		// Anthropic models don't support streaming with tools.
		if (isAnthropic && hasTools && stream) {
			this.warnIfToolsWithStream(stream);
			stream = false;
		}

		let runTools = options.runTools ?? true;

		// Do not run tools if they are explicitly provided in the options.
		if (options.tools && options.tools?.length) {
			runTools = false;
		}

		delete options.runTools;

		const body = {...options, stream};

		let response = await this.createRequest<
			RunResponse | RunResponseStream
		>(endpoint, body);
		if (Object.entries(response).length === 0) {
			return {} as RunResponse | RunResponseStream;
		}

		if (!runTools) {
			if (!stream) {
				return response as RunResponse;
			}

			return response as RunResponseStream;
		}

		if (stream) {
			return await this.handleStreamResponse(
				options as RunOptionsStream,
				response as RunResponseStream,
			);
		}

		// STREAM IS OFF
		let messages = options.messages || [];
		let currentResponse = response as RunResponse;
		let callCount = 0;

		while (callCount < this.maxCalls) {
			const responseMessage = currentResponse.choices[0].message;

			if (this.hasNoToolCalls(responseMessage)) {
				// logger('No more tool calls. Returning final response.');
				return currentResponse;
			}

			// logger('\npipe.run.response.toolCalls');
			// logger(responseMessage.tool_calls, {
			// 	depth: null,
			// 	colors: true,
			// });

			const toolResults = await this.runTools(
				responseMessage.tool_calls as ToolCallResult[],
			);
			// logger('\npipe.run.toolResults');
			// logger(toolResults, {depth: null, colors: true});

			messages = this.getMessagesToSend(
				messages,
				responseMessage,
				toolResults,
			);

			// Simulate a delay
			// await new Promise(resolve => setTimeout(resolve, 1000));

			currentResponse = await this.createRequest<RunResponse>(endpoint, {
				...body,
				messages,
				stream: false,
				threadId: currentResponse.threadId,
			});

			callCount++;

			// Explicitly check if the new response has no tool calls
			if (this.hasNoToolCalls(currentResponse.choices[0].message)) {
				// logger(
				// 	'New response has no tool calls. Returning final response.',
				// );
				return currentResponse;
			}
		}

		console.warn(
			`Reached maximum number of calls (${this.maxCalls}). Returning last response.`,
		);
		return currentResponse;
	}

	private async createRequest<T>(endpoint: string, body: any): Promise<T> {
		const isProdEnv = this.prod;
		const prodOptions = {
			endpoint,
			body: {
				...body,
				name: this.pipe.name,
			},
		};

		let localOptions = {} as any;

		if (!isProdEnv) {
			const providerString = this.pipe.model.split(':')[0];
			const modelProvider = getProvider(providerString);
			localOptions = {
				endpoint,
				body: {
					...body,
					pipe: this.pipe,
					llmApiKey: getLLMApiKey(modelProvider),
				},
			};

			const isServerRunning = await isLocalServerRunning();
			if (!isServerRunning) return {} as T;
		}

		return this.request.post<T>(isProdEnv ? prodOptions : localOptions);
	}
}

/**
 * Generates text using the provided options.
 *
 * @param options - The options for generating text.
 * @returns A promise that resolves to the generated text.
 */
export const generateText = async (
	options: RunOptions & {pipe: Pipe},
): Promise<RunResponse> => {
	return options.pipe.run(options);
};

/**
 * Streams text using the provided options.
 *
 * @param options - The options for streaming text.
 * @returns A promise that resolves to the response of the stream operation.
 */
export const streamText = async (
	options: RunOptions & {pipe: Pipe},
): Promise<RunResponseStream> => {
	return options.pipe.run({...options, stream: true});
};

interface ContentChunk {
	type: 'content';
	content: string;
}

interface ToolCallChunk {
	type: 'toolCall';
	toolCall: ToolCallResult;
}

interface ChoiceStream {
	index: number;
	delta: Delta;
	logprobs: boolean | null;
	finish_reason: string;
}

interface Delta {
	role?: MessageRole;
	content?: string;
	tool_calls?: ToolCallResult[];
}

interface UnknownChunk {
	type: 'unknown';
	rawChunk: ChunkStream;
}

export interface ChunkStream {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: ChoiceStream[];
}

export interface Chunk {
	type: 'content' | 'toolCall' | 'unknown';
	content?: string;
	toolCall?: ToolCallResult;
	rawChunk?: ChunkStream;
}

/**
 * Processes a chunk and returns a Chunk object.
 *
 * ```ts
 * for await (const chunk of runner) {
 *		const processedChunk = processChunk({rawChunk: chunk});
 *		if (isContent(processedChunk)) {
 *			process.stdout.write(processedChunk.content);
 *		}
 *	}
 * ```
 *
 * @param rawChunk - The raw chunk to process.
 * @returns The processed Chunk object.
 */
export const processChunk = ({rawChunk}: {rawChunk: any}): Chunk => {
	if (rawChunk.choices[0]?.delta?.content) {
		return {type: 'content', content: rawChunk.choices[0].delta.content};
	}
	if (
		rawChunk.choices[0]?.delta?.tool_calls &&
		rawChunk.choices[0].delta.tool_calls.length > 0
	) {
		const toolCall = rawChunk.choices[0].delta.tool_calls[0];
		return {type: 'toolCall', toolCall};
	}
	return {type: 'unknown', rawChunk};
};

/**
 * Checks if the given chunk is a ContentChunk.
 *
 * @param chunk - The chunk to check.
 * @returns True if the chunk is a ContentChunk, false otherwise.
 */
export const isContent = (chunk: Chunk): chunk is ContentChunk =>
	chunk.type === 'content';

/**
 * Determines if the given chunk is a ToolCallChunk.
 *
 * @param chunk - The chunk to be evaluated.
 * @returns True if the chunk is of type 'toolCall', otherwise false.
 */
export const isToolCall = (chunk: Chunk): chunk is ToolCallChunk =>
	chunk.type === 'toolCall';

/**
 * Checks if the given chunk is of type 'unknown'.
 *
 * @param chunk - The chunk to be checked.
 * @returns True if the chunk is of type 'unknown', false otherwise.
 */
export const isUnknown = (chunk: Chunk): chunk is UnknownChunk =>
	chunk.type === 'unknown';

/**
 * Retrieves the text content from a given ChunkStream.
 *
 * @param chunk - The ChunkStream object.
 * @returns The text content from the ChunkStream.
 */
export const getTextContent = (chunk: any): string => {
	return chunk.choices[0]?.delta?.content || '';
};

/**
 * Retrieves the text delta from a given chunk.
 *
 * @param chunk - The chunk stream to extract the text delta from.
 * @returns The text delta content, or an empty string if it is not available.
 */
export const getTextDelta = (chunk: ChunkStream): string => {
	return chunk.choices[0]?.delta?.content || '';
};

/**
 * Writes the content of a TextStream to the standard output.
 *
 * @param stream - The TextStream to be printed.
 * @returns A Promise that resolves when the printing is complete.
 */
export const printStreamToStdout = async (runner: Runner): Promise<void> => {
	for await (const chunk of runner) {
		const textPart = chunk.choices[0]?.delta?.content || '';
		process.stdout.write(textPart);
	}
};
