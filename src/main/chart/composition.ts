import type {
  AgentComposition,
  AgentLevel,
  ControlLevel,
  AdaptationLevel,
  GovernanceLevel,
  CHARTProfile,
  RuntimeToolName
} from '../../shared/domain';

export const DEFAULT_LEVELS = {
  agent: 'A5' as AgentLevel,
  control: 'B5' as ControlLevel,
  adaptation: 'C5' as AdaptationLevel,
  governance: 'D5' as GovernanceLevel
};

const allTools: RuntimeToolName[] = [
  'knowledge.search',
  'knowledge.create',
  'knowledge.link',
  'goal.create',
  'goal.update',
  'task.create',
  'task.complete',
  'session.start',
  'session.complete',
  'review.schedule',
  'review.record',
  'evidence.create',
  'artifact.create',
  'reflection.create',
  'misconception.create',
  'skill.run',
  'checkpoint.create',
  'workspace.export',
  'path.compile',
  'milestone.complete',
  'resource.search',
  'assessment.create',
  'assessment.submit',
  'artifact.evaluate',
  'behavior.diagnose',
  'habit.design',
  'habit.checkin',
  'contract.upsert',
  'review.weekly'
];

export function resolveComposition(levels: Partial<typeof DEFAULT_LEVELS> = {}): AgentComposition {
  const agent = levels.agent ?? DEFAULT_LEVELS.agent;
  const control = levels.control ?? DEFAULT_LEVELS.control;
  const adaptation = levels.adaptation ?? DEFAULT_LEVELS.adaptation;
  const governance = levels.governance ?? DEFAULT_LEVELS.governance;

  const chart: CHARTProfile = {
    context: {
      memoryDepth: adaptation === 'C5' || adaptation === 'C4' ? 'lifelong' : adaptation === 'C3' ? 'goal' : adaptation === 'C2' ? 'session' : 'session',
      includeEvidence: adaptation !== 'C1',
      includeMisconceptions: ['C3', 'C4', 'C5'].includes(adaptation),
      maxTokens: adaptation === 'C5' ? 24_000 : adaptation === 'C4' ? 16_000 : 8_000
    },
    harness: {
      approvalMode: control === 'B5' || control === 'B4' ? 'risk-based' : control === 'B3' ? 'always' : 'never',
      maxSteps: agent === 'A5' ? 16 : agent === 'A4' ? 12 : agent === 'A3' ? 8 : 4,
      maxCostCny: agent === 'A5' ? 20 : agent === 'A4' ? 10 : 3,
      allowExternalNetwork: ['B4', 'B5'].includes(control),
      allowFileWrite: !['B1'].includes(control),
      allowCodeExecution: ['B3', 'B4', 'B5'].includes(control)
    },
    alignment: {
      primaryOutcome: agent === 'A5' ? 'independence' : agent === 'A4' ? 'creation' : agent === 'A3' ? 'transfer' : 'understanding',
      requireLearnerAttempt: ['A3', 'A4', 'A5'].includes(agent),
      requireEvidence: ['A4', 'A5'].includes(agent),
      antiDependency: ['A3', 'A4', 'A5'].includes(agent)
    },
    runtime: {
      tools: control === 'B1' ? [] : control === 'B2' ? ['knowledge.search'] : allTools,
      checkpointEverySteps: ['D4', 'D5'].includes(governance) ? 1 : 3,
      timeoutMs: agent === 'A5' ? 15 * 60_000 : 5 * 60_000
    },
    traceability: {
      level: governance === 'D5' || governance === 'D4' ? 'full' : governance === 'D3' ? 'standard' : 'minimal',
      retainPrompt: governance !== 'D1',
      retainToolIO: ['D3', 'D4', 'D5'].includes(governance),
      retainModelResponse: ['D4', 'D5'].includes(governance)
    }
  };

  return { agent, control, adaptation, governance, chart };
}

export const COMPOSITION_PRESETS = {
  quickTutor: resolveComposition({ agent: 'A2', control: 'B2', adaptation: 'C2', governance: 'D2' }),
  guidedPractice: resolveComposition({ agent: 'A3', control: 'B3', adaptation: 'C3', governance: 'D3' }),
  projectCoach: resolveComposition({ agent: 'A4', control: 'B4', adaptation: 'C4', governance: 'D4' }),
  lifelongSelfStudy: resolveComposition({ agent: 'A5', control: 'B5', adaptation: 'C5', governance: 'D5' })
} as const;
