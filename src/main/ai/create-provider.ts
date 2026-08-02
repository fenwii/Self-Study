import type { ModelProviderConfig } from '../../shared/domain';
import type { LLMProvider } from './providers/types';
import { MockProvider } from './providers/mock';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { OpenAIResponsesProvider } from './providers/openai-responses';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';

export function createProvider(config: ModelProviderConfig, apiKey?: string): LLMProvider {
  if (config.kind === 'mock' || config.protocol === 'mock') return new MockProvider();
  assertProviderEndpoint(config.baseUrl);
  if (!apiKey) throw new Error(`模型“${config.name}”尚未配置API密钥（${config.envKey ?? '可在设置中保存'}）。`);

  switch (config.protocol) {
    case 'anthropic-messages':
      return new AnthropicProvider(apiKey, config.baseUrl, config.timeoutMs);
    case 'gemini-native':
      return new GeminiProvider(apiKey, config.baseUrl, config.timeoutMs);
    case 'openai-responses':
      return new OpenAIResponsesProvider(apiKey, config.baseUrl, config.timeoutMs);
    case 'openai-chat':
    default:
      return new OpenAICompatibleProvider({
        apiKey,
        baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
        timeoutMs: config.timeoutMs,
        providerName: config.name
      });
  }
}


function assertProviderEndpoint(value?: string): void {
  if (!value) return;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('模型Base URL格式无效。'); }
  if (url.username || url.password) throw new Error('模型Base URL不能包含用户名或密码。');
  const localHttp = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error('远程模型Base URL必须使用HTTPS；本地模型可使用localhost HTTP。');
  }
}
