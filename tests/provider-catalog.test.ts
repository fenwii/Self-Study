import { describe, expect, it } from 'vitest';
import { PROVIDER_PRESETS } from '../src/main/ai/provider-catalog';

const expectedKinds = ['deepseek', 'minimax', 'kimi', 'qwen', 'step', 'glm', 'openai', 'gemini', 'anthropic'];

describe('provider catalog', () => {
  it('ships all nine requested cloud model providers', () => {
    const kinds = PROVIDER_PRESETS.map((item) => item.kind);
    for (const kind of expectedKinds) expect(kinds).toContain(kind);
  });

  it('uses DeepSeek as the only default provider', () => {
    const defaults = PROVIDER_PRESETS.filter((item) => item.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.kind).toBe('deepseek');
  });

  it('keeps a no-key local fallback after cloud providers', () => {
    const mock = PROVIDER_PRESETS.find((item) => item.kind === 'mock');
    expect(mock?.priority).toBeGreaterThan(Math.max(...PROVIDER_PRESETS.filter((item) => item.kind !== 'mock').map((item) => item.priority)));
  });
});
