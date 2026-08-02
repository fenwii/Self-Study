import type { ModelProviderCapabilities, ProviderKind, ProviderProtocol } from '../../shared/domain';

export interface ProviderPreset {
  id: string;
  kind: ProviderKind;
  name: string;
  protocol: ProviderProtocol;
  model: string;
  models: string[];
  baseUrl?: string;
  envKey?: string;
  priority: number;
  isDefault?: boolean;
  enabled: boolean;
  timeoutMs: number;
  capabilities: ModelProviderCapabilities;
  documentationUrl?: string;
}

const full: ModelProviderCapabilities = {
  chat: true,
  reasoning: true,
  toolCalling: true,
  streaming: true,
  vision: false,
  longContext: true,
  structuredOutput: true
};

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'provider-deepseek',
    kind: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai-chat',
    model: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    baseUrl: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    priority: 10,
    isDefault: true,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: full,
    documentationUrl: 'https://api-docs.deepseek.com/'
  },
  {
    id: 'provider-minimax',
    kind: 'minimax',
    name: 'MiniMax',
    protocol: 'openai-chat',
    model: 'MiniMax-M2.7',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
    baseUrl: 'https://api.minimaxi.com/v1',
    envKey: 'MINIMAX_API_KEY',
    priority: 20,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: { ...full, vision: true },
    documentationUrl: 'https://platform.minimaxi.com/docs/api-reference/text-openai-api'
  },
  {
    id: 'provider-kimi',
    kind: 'kimi',
    name: 'Kimi',
    protocol: 'openai-chat',
    model: 'kimi-k3',
    models: ['kimi-k3', 'kimi-k2.7-code-highspeed', 'kimi-k2.6'],
    baseUrl: 'https://api.moonshot.cn/v1',
    envKey: 'MOONSHOT_API_KEY',
    priority: 30,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: { ...full, vision: true },
    documentationUrl: 'https://platform.kimi.com/docs/overview'
  },
  {
    id: 'provider-qwen',
    kind: 'qwen',
    name: 'Qwen',
    protocol: 'openai-chat',
    model: 'qwen-plus',
    models: ['qwen-plus', 'qwen-max', 'qwen-flash'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
    priority: 40,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: full,
    documentationUrl: 'https://help.aliyun.com/en/model-studio/compatibility-of-openai-with-dashscope'
  },
  {
    id: 'provider-step',
    kind: 'step',
    name: 'StepFun',
    protocol: 'openai-chat',
    model: 'step-3.7-flash',
    models: ['step-3.7-flash', 'step-3.5-flash-2603', 'step-3.5-flash'],
    baseUrl: 'https://api.stepfun.ai/v1',
    envKey: 'STEP_API_KEY',
    priority: 50,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: { ...full, vision: true },
    documentationUrl: 'https://platform.stepfun.ai/docs/en/guides/developer/openai'
  },
  {
    id: 'provider-glm',
    kind: 'glm',
    name: 'GLM',
    protocol: 'openai-chat',
    model: 'glm-5.2',
    models: ['glm-5.2', 'glm-5.1', 'glm-5-flash'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    envKey: 'ZAI_API_KEY',
    priority: 60,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: full,
    documentationUrl: 'https://docs.bigmodel.cn/cn/guide/develop/openai/introduction'
  },
  {
    id: 'provider-openai',
    kind: 'openai',
    name: 'GPT',
    protocol: 'openai-responses',
    model: 'gpt-5.5',
    models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'],
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    priority: 70,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: { ...full, vision: true },
    documentationUrl: 'https://developers.openai.com/api/docs/models'
  },
  {
    id: 'provider-gemini',
    kind: 'gemini',
    name: 'Gemini',
    protocol: 'gemini-native',
    model: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GEMINI_API_KEY',
    priority: 80,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: { ...full, vision: true },
    documentationUrl: 'https://ai.google.dev/gemini-api/docs/models'
  },
  {
    id: 'provider-anthropic',
    kind: 'anthropic',
    name: 'Claude',
    protocol: 'anthropic-messages',
    model: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5'],
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY',
    priority: 90,
    enabled: true,
    timeoutMs: 120_000,
    capabilities: { ...full, vision: true },
    documentationUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview'
  },
  {
    id: 'provider-mock',
    kind: 'mock',
    name: '本地演示模型',
    protocol: 'mock',
    model: 'self-study-mock-v2',
    models: ['self-study-mock-v2'],
    priority: 999,
    enabled: true,
    timeoutMs: 5_000,
    capabilities: {
      chat: true,
      reasoning: false,
      toolCalling: false,
      streaming: false,
      vision: false,
      longContext: false,
      structuredOutput: false
    }
  }
] as const;

export const providerPresetById = (id: string): ProviderPreset | undefined =>
  PROVIDER_PRESETS.find((preset) => preset.id === id);
