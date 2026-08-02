import type { LLMProvider, LLMRequest, LLMResponse } from './types';
import { requestJson } from './http';

export class GeminiProvider implements LLMProvider {
  readonly kind = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
    private readonly timeoutMs = 120_000
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const systemInstruction = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => ({ text: message.content }));
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      }));

    const endpoint = `${this.baseUrl.replace(/\/$/u, '')}/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const { data } = await requestJson<any>(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemInstruction.length ? { parts: systemInstruction } : undefined,
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.3,
          maxOutputTokens: request.maxTokens ?? 1800
        }
      })
    }, {
      timeoutMs: this.timeoutMs,
      signal: request.signal
    });

    const text = data.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('\n') ?? '';
    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      raw: data
    };
  }
}
