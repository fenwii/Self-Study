import type { LLMProvider, LLMRequest, LLMResponse } from './types';
import { requestJson } from './http';

interface OpenAICompatibleOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  providerName?: string;
  omitTemperature?: boolean;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly kind = 'openai-compatible';

  constructor(private readonly options: OpenAICompatibleOptions) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const endpoint = `${this.options.baseUrl.replace(/\/$/u, '')}/chat/completions`;
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 1800
    };
    if (!this.options.omitTemperature) body.temperature = request.temperature ?? 0.3;

    const { data } = await requestJson<any>(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify(body)
    }, {
      timeoutMs: this.options.timeoutMs ?? 120_000,
      signal: request.signal
    });

    return {
      text: extractText(data),
      inputTokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens,
      outputTokens: data.usage?.completion_tokens ?? data.usage?.output_tokens,
      raw: data
    };
  }
}

function extractText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part: any) => typeof part === 'string' ? part : part?.text ?? '').join('\n');
  }
  return '';
}
