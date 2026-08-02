import type { AgentComposition, AgentPlanStep, RuntimeToolName } from '../../shared/domain';

export interface HarnessDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

const riskByTool: Partial<Record<RuntimeToolName, 'low' | 'medium' | 'high'>> = {
  'knowledge.search': 'low',
  'knowledge.create': 'low',
  'knowledge.link': 'low',
  'goal.create': 'low',
  'goal.update': 'medium',
  'task.create': 'low',
  'task.complete': 'medium',
  'session.start': 'low',
  'session.complete': 'low',
  'review.schedule': 'low',
  'review.record': 'low',
  'evidence.create': 'low',
  'artifact.create': 'medium',
  'reflection.create': 'low',
  'misconception.create': 'medium',
  'skill.run': 'low',
  'checkpoint.create': 'low',
  'workspace.export': 'high',
  'path.compile': 'medium',
  'milestone.complete': 'medium',
  'resource.search': 'low',
  'assessment.create': 'low',
  'assessment.submit': 'medium',
  'artifact.evaluate': 'medium',
  'behavior.diagnose': 'low',
  'habit.design': 'low',
  'habit.checkin': 'low',
  'contract.upsert': 'medium',
  'review.weekly': 'low'
};

export class HarnessEngine {
  evaluate(step: AgentPlanStep, composition: AgentComposition, estimatedCostCny: number): HarnessDecision {
    if (!step.tool) return { allowed: true, requiresApproval: false, reason: '纯认知步骤，无工具副作用。' };
    if (!composition.chart.runtime.tools.includes(step.tool)) return { allowed: false, requiresApproval: false, reason: `当前 ${composition.control} 模式不允许工具 ${step.tool}。` };
    if (estimatedCostCny > composition.chart.harness.maxCostCny) return { allowed: false, requiresApproval: false, reason: `预计成本超过本次预算 ¥${composition.chart.harness.maxCostCny.toFixed(2)}。` };
    if (step.tool === 'artifact.create' && !composition.chart.harness.allowFileWrite) return { allowed: false, requiresApproval: false, reason: '当前模式禁止创建持久化作品。' };

    const risk = riskByTool[step.tool] ?? step.risk;
    const mode = composition.chart.harness.approvalMode;
    const requiresApproval = mode === 'always' || (mode === 'risk-based' && (risk === 'medium' || risk === 'high'));
    return { allowed: true, requiresApproval, reason: requiresApproval ? `工具风险为 ${risk}，需要人工批准。` : `工具风险为 ${risk}，符合自动执行策略。` };
  }
}
