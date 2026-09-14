import {describe, expect, it, vi} from 'vitest';
import {Pipe, type RunResponse} from './pipes';

describe('Pipe without tools', () => {
	it('runs when the pipe omits the optional tools array', async () => {
		const pipe = new Pipe({
			apiKey: 'test-api-key',
			model: 'openai:gpt-4o-mini',
			name: 'without-tools',
			prod: true,
			tools: undefined,
		} as any);
		const response: RunResponse = {
			completion: 'done',
			id: 'response-id',
			object: 'chat.completion',
			created: 0,
			model: 'gpt-4o-mini',
			choices: [
				{
					index: 0,
					message: {role: 'assistant', content: 'done'},
					logprobs: null,
					finish_reason: 'stop',
				},
			],
			usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
			system_fingerprint: null,
		};
		const post = vi.fn().mockResolvedValue(response);
		(pipe as any).request = {post};

		await expect(pipe.run({messages: []})).resolves.toEqual(response);
		expect(post).toHaveBeenCalledOnce();
	});
});
