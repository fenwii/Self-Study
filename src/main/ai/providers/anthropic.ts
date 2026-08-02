import type { LLMProvider, LLMRequest, LLMResponse } from './types';
import { requestJson } from './http';

export class AnthropicProvider implements LLMProvider {
  readonly kind = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.anthropic.com',
    private readonly timeoutMs = 120_000
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
    const messages = request.messages.filter((message) => message.role !== 'system');
    const { data } = await requestJson<any>(`${this.baseUrl.replace(/\/$/u, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: request.model,
        system: system || undefined,
        messages,
        max_tokens: request.maxTokens ?? 1800
      })
    }, {
      timeoutMs: this.timeoutMs,
      signal: request.signal
    });

    const text = Array.isArray(data.content)
      ? data.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n')
      : '';
    return {
      text,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      raw: data
    };
  }
}
