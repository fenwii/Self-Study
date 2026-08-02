import type { ProviderService } from '../services/provider-service';
import type {
  LLMRequest,
  LLMResponse,
  ModelRouteContext,
  ProviderAttempt,
  RoutedLLMResponse,
  ResolvedProvider
} from './providers/types';
import { createProvider } from './create-provider';

interface PrimaryCompletion {
  candidate: ResolvedProvider;
  response: LLMResponse;
}

export class ProviderRegistry {
  constructor(private readonly providers: ProviderService) {}

  async complete(request: Omit<LLMRequest, 'model'>, context: ModelRouteContext): Promise<RoutedLLMResponse> {
    const candidates = this.rank(this.providers.getCandidates(), context);
    if (!candidates.length) throw new Error('没有可用模型。请在“模型供应商”中配置至少一个API密钥。');

    const attempts: ProviderAttempt[] = [];
    const primary = await this.completePrimary(request, candidates, attempts);
    const verification = await this.maybeCrossVerify(request, context, primary, candidates, attempts);
    const auditedText = verification
      ? `${primary.response.text}\n\n---\n### D5 交叉模型审计\n${verification.text}`
      : primary.response.text;
    const routeReason = describeRoute(context, primary.candidate.config.name, Boolean(verification));

    return {
      ...primary.response,
      text: auditedText,
      inputTokens: sumOptional(primary.response.inputTokens, verification?.inputTokens),
      outputTokens: sumOptional(primary.response.outputTokens, verification?.outputTokens),
      costCny: sumOptional(primary.response.costCny, verification?.costCny),
      raw: verification
        ? { primary: primary.response.raw, d5Audit: verification.raw }
        : primary.response.raw,
      providerId: primary.candidate.config.id,
      providerName: primary.candidate.config.name,
      model: primary.candidate.config.model,
      attempts,
      routeReason,
      verification: verification
        ? {
            providerId: verification.candidate.config.id,
            providerName: verification.candidate.config.name,
            model: verification.candidate.config.model,
            text: verification.text
          }
        : undefined
    };
  }

  rank(candidates: ResolvedProvider[], context: ModelRouteContext): ResolvedProvider[] {
    const requiresReasoning = ['verify', 'reflect'].includes(context.intent)
      || ['A4', 'A5'].includes(context.composition.agent);
    const requiresLongContext = ['C4', 'C5'].includes(context.composition.adaptation);
    const requiresGovernance = ['D4', 'D5'].includes(context.composition.governance);

    return [...candidates].sort((left, right) => {
      const score = (item: ResolvedProvider): number => {
        const config = item.config;
        let value = config.priority;
        if (config.isDefault) value -= 1000;
        if (!item.apiKey && config.kind !== 'mock') value += 10_000;
        if (requiresReasoning && !config.capabilities.reasoning) value += 400;
        if (requiresLongContext && !config.capabilities.longContext) value += 350;
        if (requiresGovernance && !config.capabilities.structuredOutput) value += 200;
        if (context.purpose === 'health-check' && config.kind === 'mock') value += 20_000;
        if (config.lastTestStatus === 'failed') value += 500;
        return value;
      };
      return score(left) - score(right);
    });
  }

  private async completePrimary(
    request: Omit<LLMRequest, 'model'>,
    candidates: ResolvedProvider[],
    attempts: ProviderAttempt[]
  ): Promise<PrimaryCompletion> {
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const started = Date.now();
      const startedAt = new Date().toISOString();
      const phase = index === 0 ? 'primary' : 'fallback';
      if (candidate.config.kind !== 'mock' && !candidate.apiKey) {
        attempts.push({
          providerId: candidate.config.id,
          providerName: candidate.config.name,
          model: candidate.config.model,
          startedAt,
          durationMs: 0,
          status: 'skipped',
          phase,
          error: `未配置${candidate.config.envKey ?? 'API密钥'}`
        });
        continue;
      }

      try {
        const provider = createProvider(candidate.config, candidate.apiKey);
        const response = await provider.complete({ ...request, model: candidate.config.model });
        const durationMs = Date.now() - started;
        attempts.push({
          providerId: candidate.config.id,
          providerName: candidate.config.name,
          model: candidate.config.model,
          startedAt,
          durationMs,
          status: 'completed',
          phase
        });
        this.providers.recordSuccess(candidate.config.id, durationMs);
        return { candidate, response };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push({
          providerId: candidate.config.id,
          providerName: candidate.config.name,
          model: candidate.config.model,
          startedAt,
          durationMs: Date.now() - started,
          status: 'failed',
          phase,
          error: message
        });
        this.providers.recordFailure(candidate.config.id, message);
        if (request.signal?.aborted) throw error;
      }
    }

    const summary = attempts.map((item) => `${item.providerName}/${item.model}: ${item.error ?? item.status}`).join('；');
    throw new Error(`所有模型均不可用。${summary}`);
  }

  private async maybeCrossVerify(
    request: Omit<LLMRequest, 'model'>,
    context: ModelRouteContext,
    primary: PrimaryCompletion,
    candidates: ResolvedProvider[],
    attempts: ProviderAttempt[]
  ): Promise<(LLMResponse & { candidate: ResolvedProvider }) | undefined> {
    if (context.composition.governance !== 'D5' || context.intent !== 'verify') return undefined;
    if (primary.candidate.config.kind === 'mock') return undefined;

    const verifier = candidates.find((candidate) =>
      candidate.config.id !== primary.candidate.config.id
      && candidate.config.kind !== 'mock'
      && Boolean(candidate.apiKey)
      && candidate.config.capabilities.reasoning
    );
    if (!verifier) return undefined;

    const started = Date.now();
    const startedAt = new Date().toISOString();
    try {
      const provider = createProvider(verifier.config, verifier.apiKey);
      const originalQuestion = [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
      const response = await provider.complete({
        model: verifier.config.model,
        messages: [
          {
            role: 'system',
            content: [
              '你是CHART D5独立审计模型，不替代主模型回答。',
              '请检查主回答的事实性、逻辑性、遗漏、过度自信和学习者依赖风险。',
              '输出：结论（通过/有条件通过/不通过）、关键问题、最小修正建议。',
              '保持简洁，不重复整篇主回答。'
            ].join('\n')
          },
          {
            role: 'user',
            content: `原始任务：\n${originalQuestion}\n\n主模型回答：\n${primary.response.text}`
          }
        ],
        temperature: 0,
        maxTokens: Math.min(700, request.maxTokens ?? 700),
        signal: request.signal
      });
      const durationMs = Date.now() - started;
      attempts.push({
        providerId: verifier.config.id,
        providerName: verifier.config.name,
        model: verifier.config.model,
        startedAt,
        durationMs,
        status: 'completed',
        phase: 'd5-audit'
      });
      this.providers.recordSuccess(verifier.config.id, durationMs);
      return { ...response, candidate: verifier };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({
        providerId: verifier.config.id,
        providerName: verifier.config.name,
        model: verifier.config.model,
        startedAt,
        durationMs: Date.now() - started,
        status: 'failed',
        phase: 'd5-audit',
        error: message
      });
      this.providers.recordFailure(verifier.config.id, message);
      if (request.signal?.aborted) throw error;
      return undefined;
    }
  }
}

function describeRoute(context: ModelRouteContext, provider?: string, audited = false): string {
  const reasons = [`默认/优先级路由至${provider ?? '可用模型'}`];
  if (['A4', 'A5'].includes(context.composition.agent)) reasons.push('高自治任务偏好推理模型');
  if (['C4', 'C5'].includes(context.composition.adaptation)) reasons.push('长程Context偏好长上下文');
  if (['D4', 'D5'].includes(context.composition.governance)) reasons.push('高治理模式偏好结构化输出');
  if (audited) reasons.push('D5验证任务已完成第二模型独立审计');
  return reasons.join('；');
}

function sumOptional(left?: number, right?: number): number | undefined {
  if (left === undefined && right === undefined) return undefined;
  return (left ?? 0) + (right ?? 0);
}
