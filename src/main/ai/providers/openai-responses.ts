import type { LLMProvider, LLMRequest, LLMResponse } from './types';
import { requestJson } from './http';

export class OpenAIResponsesProvider implements LLMProvider {
  readonly kind = 'openai-responses';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.openai.com/v1',
    private readonly timeoutMs = 120_000
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const system = request.messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');
    const input = request.messages
      .filter((item) => item.role !== 'system')
      .map((item) => ({ role: item.role, content: item.content }));

    const { data } = await requestJson<any>(`${this.baseUrl.replace(/\/$/u, '')}/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        instructions: system || undefined,
        input,
        max_output_tokens: request.maxTokens ?? 1800
      })
    }, {
      timeoutMs: this.timeoutMs,
      signal: request.signal
    });

    return {
      text: data.output_text ?? extractOutputText(data.output),
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      raw: data
    };
  }
}

function extractOutputText(output: unknown): string {
  if (!Array.isArray(output)) return '';
  return output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((part: any) => part?.type === 'output_text' || part?.type === 'text')
    .map((part: any) => part?.text ?? '')
    .join('\n');
}
