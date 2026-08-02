import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../src/main/ai/provider-registry';
import { resolveComposition } from '../src/main/chart/composition';
import type { ResolvedProvider } from '../src/main/ai/providers/types';
import type { ModelProviderConfig } from '../src/shared/domain';
import type { ProviderService } from '../src/main/services/provider-service';

const baseConfig: ModelProviderConfig = {
  id: 'base',
  kind: 'openai-compatible',
  name: 'Base',
  protocol: 'openai-chat',
  model: 'base-model',
  models: ['base-model'],
  capabilities: {
    chat: true,
    reasoning: false,
    toolCalling: false,
    streaming: false,
    vision: false,
    longContext: false,
    structuredOutput: false
  },
  apiKeyStored: true,
  apiKeySource: 'secure-storage',
  enabled: true,
  isDefault: false,
  builtIn: false,
  priority: 100,
  timeoutMs: 120_000,
  lastTestStatus: 'untested',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

const candidate = (patch: Partial<ModelProviderConfig>, apiKey = 'key'): ResolvedProvider => ({
  config: { ...baseConfig, ...patch },
  apiKey
});

describe('provider routing', () => {
  const registry = new ProviderRegistry({} as ProviderService);

  it('keeps a configured default DeepSeek ahead of a higher-priority-number model', () => {
    const ranked = registry.rank([
      candidate({ id: 'gpt', name: 'GPT', priority: 20 }),
      candidate({ id: 'deepseek', kind: 'deepseek', name: 'DeepSeek', isDefault: true, priority: 90 })
    ], {
      intent: 'general',
      composition: resolveComposition({}),
      purpose: 'answer'
    });
    expect(ranked[0]?.config.id).toBe('deepseek');
  });

  it('moves providers without keys behind a configured cloud model', () => {
    const ranked = registry.rank([
      candidate({ id: 'deepseek', kind: 'deepseek', name: 'DeepSeek', isDefault: true }, ''),
      candidate({ id: 'qwen', kind: 'qwen', name: 'Qwen', priority: 50 })
    ], {
      intent: 'general',
      composition: resolveComposition({}),
      purpose: 'answer'
    });
    expect(ranked[0]?.config.id).toBe('qwen');
  });

  it('prefers reasoning and long-context capability for A5/C5 verification', () => {
    const ranked = registry.rank([
      candidate({ id: 'basic', name: 'Basic', priority: 20 }),
      candidate({
        id: 'reasoning',
        name: 'Reasoning',
        priority: 80,
        capabilities: { ...baseConfig.capabilities, reasoning: true, longContext: true, structuredOutput: true }
      })
    ], {
      intent: 'verify',
      composition: resolveComposition({ agent: 'A5', adaptation: 'C5', governance: 'D5' }),
      purpose: 'verification'
    });
    expect(ranked[0]?.config.id).toBe('reasoning');
  });
});
