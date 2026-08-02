import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/database';
import type { LearningService } from '../services/learning-service';
import type { TraceService } from '../services/trace-service';
import type { AppEventBus } from '../services/event-bus';
import type { ProviderRegistry } from '../ai/provider-registry';
import { ContextEngine } from '../chart/context-engine';
import { HarnessEngine } from '../chart/harness-engine';
import { AlignmentEngine } from '../chart/alignment-engine';
import { RuntimeEngine } from '../chart/runtime-engine';
import { resolveComposition } from '../chart/composition';
import { routeIntent } from './intent-router';
import { createPlan } from './planner';
import type {
  AgentComposition,
  AgentPlan,
  AgentRun,
  ApprovalRequest,
  RunStatus
} from '../../shared/domain';
import type { ResolveApprovalInput, SendMessageInput } from '../../shared/contracts';

interface RunControl {
  abort: AbortController;
  paused: boolean;
  pauseResolvers: Array<() => void>;
}

const now = () => new Date().toISOString();
const parse = <T>(value: string): T => JSON.parse(value) as T;

export function resolveRunIntent(content: string, goalId?: string): ReturnType<typeof routeIntent> {
  const intent = routeIntent(content);
  if (goalId && intent === 'create-goal') return 'general';
  if (!goalId) return 'create-goal';
  return intent;
}

export class RunManager {
  private readonly controls = new Map<string, RunControl>();
  private readonly approvalWaiters = new Map<string, (decision: 'approved' | 'rejected') => void>();
  private readonly context: ContextEngine;
  private readonly harness = new HarnessEngine();
  private readonly alignment = new AlignmentEngine();
  private readonly runtime: RuntimeEngine;

  constructor(
    private readonly database: AppDatabase,
    private readonly learning: LearningService,
    private readonly traces: TraceService,
    private readonly providers: ProviderRegistry,
    private readonly events: AppEventBus
  ) {
    this.context = new ContextEngine(learning);
    this.runtime = new RuntimeEngine(learning);
  }

  recoverInterruptedRuns(): void {
    const rows = this.database.db.prepare(`
      SELECT id, workspace_id, goal_id, conversation_id FROM agent_runs
      WHERE status IN ('queued', 'planning', 'running', 'awaiting-approval')
    `).all() as Array<{ id: string; workspace_id: string; goal_id?: string; conversation_id?: string }>;

    for (const row of rows) {
      this.updateRun(row.id, { status: 'paused', error: '应用退出后已安全暂停，可手动恢复。' });
      this.learning.createMessage({
        workspaceId: row.workspace_id,
        goalId: row.goal_id ?? undefined,
        conversationId: row.conversation_id ?? undefined,
        runId: row.id,
        role: 'system',
        content: '上一次长程任务因应用关闭而暂停。运行状态和检查点已保留。'
      });
    }
  }

  start(input: SendMessageInput): { runId: string } {
    const composition = resolveComposition(input.composition ?? {});
    const intent = resolveRunIntent(input.content, input.goalId);
    const hasGoal = Boolean(input.goalId);
    const plan = createPlan(intent, input.content, hasGoal);
    const runId = randomUUID();
    const timestamp = now();
    const conversation = this.learning.ensureConversation(input.workspaceId, input.goalId);

    this.learning.createMessage({
      workspaceId: input.workspaceId,
      goalId: input.goalId,
      conversationId: conversation.id,
      runId,
      role: 'user',
      content: input.content
    });

    this.database.db.prepare(`
      INSERT INTO agent_runs (
        id, workspace_id, goal_id, conversation_id, status, user_input, intent,
        composition_json, plan_json, current_step, cost_cny, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      input.workspaceId,
      input.goalId ?? null,
      conversation.id,
      'queued',
      input.content,
      intent,
      JSON.stringify(composition),
      JSON.stringify(plan),
      0,
      0,
      timestamp,
      timestamp
    );

    const control: RunControl = { abort: new AbortController(), paused: false, pauseResolvers: [] };
    this.controls.set(runId, control);
    this.events.emit({ type: 'dashboard.changed', runId, payload: {} });
    void this.execute(runId).finally(() => this.controls.delete(runId));
    return { runId };
  }

  pause(runId: string): void {
    const control = this.controls.get(runId);
    if (!control) {
      this.updateRun(runId, { status: 'paused' });
      return;
    }
    control.paused = true;
    this.updateRun(runId, { status: 'paused' });
    this.events.emit({ type: 'run.updated', runId, payload: { status: 'paused' } });
  }

  resume(runId: string): void {
    const control = this.controls.get(runId);
    if (!control) {
      const run = this.getRun(runId);
      if (!run || run.status !== 'paused') return;
      const nextControl: RunControl = { abort: new AbortController(), paused: false, pauseResolvers: [] };
      this.controls.set(runId, nextControl);
      void this.execute(runId).finally(() => this.controls.delete(runId));
      return;
    }
    control.paused = false;
    for (const resolve of control.pauseResolvers.splice(0)) resolve();
    this.updateRun(runId, { status: 'running' });
    this.events.emit({ type: 'run.updated', runId, payload: { status: 'running' } });
  }

  cancel(runId: string): void {
    this.controls.get(runId)?.abort.abort();
    this.updateRun(runId, { status: 'cancelled', error: '用户取消任务。' });
    this.events.emit({ type: 'run.updated', runId, payload: { status: 'cancelled' } });
    this.events.emit({ type: 'dashboard.changed', runId, payload: {} });
  }

  resolveApproval(input: ResolveApprovalInput): void {
    const approval = this.database.db.prepare('SELECT * FROM approvals WHERE id = ?').get(input.approvalId) as any;
    if (!approval) throw new Error('审批请求不存在。');
    this.database.db.prepare(`
      UPDATE approvals SET decision = ?, resolved_at = ? WHERE id = ?
    `).run(input.decision, now(), input.approvalId);
    this.approvalWaiters.get(input.approvalId)?.(input.decision);
    this.approvalWaiters.delete(input.approvalId);
    this.events.emit({ type: 'dashboard.changed', runId: approval.run_id, payload: {} });
  }

  private async execute(runId: string): Promise<void> {
    const control = this.controls.get(runId) ?? { abort: new AbortController(), paused: false, pauseResolvers: [] };
    this.controls.set(runId, control);
    const run = this.getRun(runId);
    if (!run || ['completed', 'failed', 'cancelled'].includes(run.status)) return;

    try {
      this.updateRun(runId, { status: 'planning' });
      this.events.emit({ type: 'run.updated', runId, payload: { status: 'planning', plan: run.plan } });
      this.traces.append({ runId, category: 'context', action: 'compile', status: 'started', input: { goalId: run.goalId } });
      let learningContext = this.context.compile(run.goalId, run.composition, run.intent, run.userInput);
      this.traces.append({ runId, category: 'context', action: 'compile', status: 'completed', output: learningContext.contextSummary });

      this.updateRun(runId, { status: 'running' });
      const toolSummaries: string[] = [];
      const startIndex = Math.max(run.currentStep, this.traces.latestCheckpoint(runId)?.stepIndex ?? 0);

      for (let index = startIndex; index < run.plan.steps.length; index += 1) {
        await this.waitIfPaused(runId, control);
        this.throwIfAborted(control);
        const freshRun = this.getRun(runId);
        if (!freshRun) throw new Error('运行记录不存在。');
        const step = freshRun.plan.steps[index];
        step.status = 'running';
        this.persistPlan(runId, freshRun.plan, index);

        const decision = this.harness.evaluate(step, freshRun.composition, freshRun.costCny + 0.2);
        this.traces.append({
          runId,
          category: 'harness',
          action: `evaluate:${step.title}`,
          input: { tool: step.tool, risk: step.risk },
          output: decision,
          status: decision.allowed ? 'completed' : 'blocked'
        });
        if (!decision.allowed) throw new Error(decision.reason);

        if (decision.requiresApproval) {
          step.requiresApproval = true;
          this.persistPlan(runId, freshRun.plan, index);
          const approved = await this.requestApproval(runId, step.id, decision.reason, step.risk === 'low' ? 'medium' : step.risk);
          if (!approved) throw new Error(`步骤“${step.title}”未获批准。`);
          this.updateRun(runId, { status: 'running' });
        }

        const started = Date.now();
        if (step.tool) {
          const result = this.runtime.execute(step.tool, step, {
            workspaceId: freshRun.workspaceId,
            goalId: freshRun.goalId ?? learningContext.activeGoal?.id,
            userInput: freshRun.userInput,
            intent: freshRun.intent,
            composition: freshRun.composition
          });
          if (step.tool === 'goal.create' && result.data && typeof result.data === 'object' && 'goal' in result.data) {
            const createdGoal = (result.data as { goal?: { id?: string } }).goal;
            if (createdGoal?.id) {
              const attached = this.learning.attachRunToGoal(runId, freshRun.workspaceId, createdGoal.id);
              freshRun.goalId = createdGoal.id;
              freshRun.conversationId = attached.id;
            }
          }
          toolSummaries.push(result.summary);
          this.traces.append({
            runId,
            category: 'runtime',
            action: step.tool,
            input: { title: step.title },
            output: result,
            status: 'completed',
            durationMs: Date.now() - started
          });
          learningContext = this.context.compile(freshRun.goalId ?? learningContext.activeGoal?.id, freshRun.composition, freshRun.intent, freshRun.userInput);
        } else {
          this.traces.append({
            runId,
            category: 'alignment',
            action: step.title,
            input: { description: step.description },
            output: { guidance: '由最终模型响应综合表达。' },
            status: 'completed',
            durationMs: Date.now() - started
          });
        }

        step.status = 'done';
        this.persistPlan(runId, freshRun.plan, index + 1);
        if ((index + 1) % freshRun.composition.chart.runtime.checkpointEverySteps === 0) {
          this.traces.checkpoint(runId, index + 1, { plan: freshRun.plan, toolSummaries });
        }
        this.events.emit({ type: 'run.updated', runId, payload: { status: 'running', currentStep: index + 1, plan: freshRun.plan } });
      }

      await this.waitIfPaused(runId, control);
      this.throwIfAborted(control);
      const completedRun = this.getRun(runId);
      if (!completedRun) throw new Error('运行记录不存在。');
      const system = this.alignment.buildSystemInstruction(completedRun.intent, completedRun.composition, learningContext);
      const response = await this.providers.complete({
        messages: [
          { role: 'system', content: system },
          ...learningContext.recentMessages.slice(-8).map((message) => ({
            role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: message.content
          })),
          {
            role: 'user',
            content: [
              completedRun.userInput,
              '',
              toolSummaries.length ? `系统已执行：\n- ${toolSummaries.join('\n- ')}` : '',
              '',
              '请给出自然、简洁但完整的回应，并以一个可执行的下一步收尾。'
            ].filter(Boolean).join('\n')
          }
        ],
        temperature: 0.35,
        maxTokens: 1800,
        signal: control.abort.signal
      }, {
        intent: completedRun.intent,
        composition: completedRun.composition,
        purpose: 'answer'
      });

      const assistantMessage = this.learning.createMessage({
        workspaceId: completedRun.workspaceId,
        goalId: completedRun.goalId,
        conversationId: completedRun.conversationId,
        runId,
        role: 'assistant',
        content: response.text,
        metadata: {
          provider: response.providerName,
          providerId: response.providerId,
          model: response.model,
          routeReason: response.routeReason,
          attempts: response.attempts,
          intent: completedRun.intent,
          composition: completedRun.composition
        }
      });
      const costCny = response.costCny ?? estimateCost(response.inputTokens, response.outputTokens);
      const completedAttempts = response.attempts.filter((attempt) => attempt.status === 'completed');
      this.learning.recordModelUsage({
        runId,
        providerId: response.providerId,
        model: response.model,
        purpose: completedRun.intent === 'verify' ? 'answer-and-verification' : 'answer',
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costCny,
        latencyMs: completedAttempts.reduce((sum, attempt) => sum + attempt.durationMs, 0)
      });
      this.traces.append({
        runId,
        category: 'model',
        action: 'complete-with-fallback',
        input: { routeReason: response.routeReason },
        output: {
          provider: response.providerName,
          providerId: response.providerId,
          model: response.model,
          attempts: response.attempts,
          textLength: response.text.length,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens
        },
        status: 'completed',
        costCny
      });
      this.updateRun(runId, { status: 'completed', costCny: completedRun.costCny + costCny, currentStep: completedRun.plan.steps.length });
      this.events.emit({ type: 'message.created', runId, payload: assistantMessage });
      this.events.emit({ type: 'run.updated', runId, payload: { status: 'completed' } });
      this.events.emit({ type: 'dashboard.changed', runId, payload: {} });
    } catch (error) {
      if (control.abort.signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      const failedRun = this.getRun(runId);
      if (failedRun) {
        this.updateRun(runId, { status: 'failed', error: message });
        const assistantMessage = this.learning.createMessage({
          workspaceId: failedRun.workspaceId,
          goalId: failedRun.goalId,
          conversationId: failedRun.conversationId,
          runId,
          role: 'assistant',
          content: `这次长程任务没有完成：${message}\n\n运行记录和已完成步骤已经保留。你可以修改目标后重试。`
        });
        this.traces.append({ runId, category: 'traceability', action: 'run.failed', output: { message }, status: 'failed' });
        this.events.emit({ type: 'message.created', runId, payload: assistantMessage });
        this.events.emit({ type: 'run.updated', runId, payload: { status: 'failed', error: message } });
        this.events.emit({ type: 'dashboard.changed', runId, payload: {} });
      }
    }
  }

  private requestApproval(
    runId: string,
    stepId: string,
    reason: string,
    risk: ApprovalRequest['risk']
  ): Promise<boolean> {
    const approval: ApprovalRequest = {
      id: randomUUID(),
      runId,
      stepId,
      reason,
      risk,
      requestedAt: now()
    };
    this.database.db.prepare(`
      INSERT INTO approvals (id, run_id, step_id, reason, risk, requested_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(approval.id, approval.runId, approval.stepId, approval.reason, approval.risk, approval.requestedAt);
    this.updateRun(runId, { status: 'awaiting-approval' });
    this.events.emit({ type: 'approval.created', runId, payload: approval });
    this.events.emit({ type: 'dashboard.changed', runId, payload: {} });

    return new Promise((resolve) => {
      this.approvalWaiters.set(approval.id, (decision) => resolve(decision === 'approved'));
    });
  }

  private async waitIfPaused(runId: string, control: RunControl): Promise<void> {
    if (!control.paused) return;
    await new Promise<void>((resolve) => control.pauseResolvers.push(resolve));
    this.throwIfAborted(control);
    this.updateRun(runId, { status: 'running' });
  }

  private throwIfAborted(control: RunControl): void {
    if (control.abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  }

  private getRun(runId: string): AgentRun | undefined {
    const row = this.database.db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(runId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      goalId: row.goal_id ?? undefined,
      conversationId: row.conversation_id ?? undefined,
      status: row.status,
      userInput: row.user_input,
      intent: row.intent,
      composition: parse<AgentComposition>(row.composition_json),
      plan: parse<AgentPlan>(row.plan_json),
      currentStep: row.current_step,
      costCny: row.cost_cny,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private persistPlan(runId: string, plan: AgentPlan, currentStep: number): void {
    this.database.db.prepare(`
      UPDATE agent_runs SET plan_json = ?, current_step = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(plan), currentStep, now(), runId);
  }

  private updateRun(runId: string, patch: {
    status?: RunStatus;
    currentStep?: number;
    costCny?: number;
    error?: string;
  }): void {
    const current = this.getRun(runId);
    if (!current) return;
    this.database.db.prepare(`
      UPDATE agent_runs
      SET status = ?, current_step = ?, cost_cny = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      patch.status ?? current.status,
      patch.currentStep ?? current.currentStep,
      patch.costCny ?? current.costCny,
      patch.error ?? current.error ?? null,
      now(),
      runId
    );
  }
}

function estimateCost(inputTokens = 0, outputTokens = 0): number {
  return Math.round(((inputTokens * 0.00002) + (outputTokens * 0.00006)) * 100) / 100;
}
