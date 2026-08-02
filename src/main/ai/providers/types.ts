import type { AgentComposition, IntentName, ModelProviderConfig } from '../../../shared/domain';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  costCny?: number;
  raw?: unknown;
}

export interface LLMProvider {
  readonly kind: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}

export interface ModelRouteContext {
  intent: IntentName;
  composition: AgentComposition;
  purpose?: 'answer' | 'verification' | 'health-check';
}

export interface ProviderAttempt {
  providerId: string;
  providerName: string;
  model: string;
  startedAt: string;
  durationMs: number;
  status: 'completed' | 'failed' | 'skipped';
  phase?: 'primary' | 'fallback' | 'd5-audit';
  error?: string;
}

export interface CrossModelVerification {
  providerId: string;
  providerName: string;
  model: string;
  text: string;
}

export interface RoutedLLMResponse extends LLMResponse {
  providerId: string;
  providerName: string;
  model: string;
  attempts: ProviderAttempt[];
  routeReason: string;
  verification?: CrossModelVerification;
}

export interface ResolvedProvider {
  config: ModelProviderConfig;
  apiKey?: string;
}
