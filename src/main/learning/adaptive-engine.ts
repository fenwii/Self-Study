import type {
  BehaviorState,
  DailyBrief,
  HabitCheckIn,
  HabitRecipe,
  KnowledgeNode,
  LearnerState,
  LearningArtifact,
  LearningAssessment,
  LearningEvidence,
  LearningPath,
  LearningSession,
  LearningStage,
  LearningTask,
  MisconceptionRecord,
  PathMilestone,
  ReviewItem
} from '../../shared/domain';

export interface AdaptiveInput {
  tasks: LearningTask[];
  evidence: LearningEvidence[];
  knowledgeNodes: KnowledgeNode[];
  misconceptions: MisconceptionRecord[];
  reviewItems: ReviewItem[];
  sessions: LearningSession[];
  artifacts: LearningArtifact[];
  paths?: LearningPath[];
  milestones?: PathMilestone[];
  assessments?: LearningAssessment[];
  habits?: HabitRecipe[];
  habitCheckIns?: HabitCheckIn[];
  behaviorState?: BehaviorState;
}

export function deriveLearnerState(input: AdaptiveInput, at = new Date()): LearnerState {
  const dueReviews = input.reviewItems.filter((item) => !item.suspended && new Date(item.dueAt) <= at).length;
  const openMisconceptions = input.misconceptions.filter((item) => item.status !== 'resolved').length;
  const evidenceAverage = input.evidence.length
    ? input.evidence.reduce((sum, item) => sum + item.independence, 0) / input.evidence.length
    : 0;
  const lowMastery = input.knowledgeNodes.filter((node) => node.mastery < 0.55).length;
  const completedLast7 = input.sessions.filter((session) => session.status === 'completed' && at.getTime() - new Date(session.startedAt).getTime() <= 7 * 86_400_000).length;
  const activeSession = input.sessions.find((session) => session.status === 'active');

  const momentum: LearnerState['momentum'] = completedLast7 >= 5
    ? 'accelerating'
    : completedLast7 >= 2
      ? 'steady'
      : completedLast7 === 1
        ? 'starting'
        : 'stalled';

  const cognitiveLoad: LearnerState['cognitiveLoad'] = openMisconceptions >= 4 || lowMastery >= 8
    ? 'high'
    : dueReviews >= 5
      ? 'balanced'
      : 'low';

  const stage = inferStage(input);
  const retentionRisk = Math.min(1, (dueReviews * 0.08) + (openMisconceptions * 0.06) + (input.evidence.length === 0 ? 0.25 : 0));
  const { nextBestAction, reasons } = chooseNextAction({ ...input, dueReviews, openMisconceptions, activeSession });

  return {
    stage,
    momentum,
    cognitiveLoad,
    independenceScore: Math.round(evidenceAverage * 100),
    retentionRisk: Math.round(retentionRisk * 100),
    openMisconceptions,
    dueReviews,
    nextBestAction,
    reasons
  };
}

export function buildDailyBrief(state: LearnerState, sessions: LearningSession[]): DailyBrief {
  const active = sessions.find((session) => session.status === 'active');
  if (active) {
    return {
      headline: '继续当前专注学习',
      summary: `你正在进行“${active.objective}”，保持上下文比切换任务更重要。`,
      nextAction: '继续会话，完成一次独立输出后再结束。',
      estimatedMinutes: Math.max(5, active.plannedMinutes - active.actualMinutes),
      dueReviewCount: state.dueReviews,
      activeSessionId: active.id
    };
  }

  return {
    headline: state.dueReviews > 0 ? `今天有 ${state.dueReviews} 项需要复习` : '今天只推进一个最小成果',
    summary: state.reasons.join('；') || '当前学习状态稳定。',
    nextAction: state.nextBestAction,
    estimatedMinutes: state.dueReviews > 0 ? Math.min(30, 8 + state.dueReviews * 3) : 25,
    dueReviewCount: state.dueReviews
  };
}

function inferStage(input: AdaptiveInput): LearningStage {
  if (input.artifacts.some((item) => item.status === 'accepted')) return 'transfer';
  if (input.evidence.some((item) => item.kind === 'transfer' && item.transfer >= 0.7)) return 'creation';
  if (input.evidence.length >= 3) return 'verification';
  if (input.knowledgeNodes.length >= 4) return 'practice';
  if (input.knowledgeNodes.length > 0) return 'mapping';
  return 'curiosity';
}

function chooseNextAction(input: AdaptiveInput & { dueReviews: number; openMisconceptions: number; activeSession?: LearningSession }): { nextBestAction: string; reasons: string[] } {
  const reasons: string[] = [];
  if (input.activeSession) return { nextBestAction: `继续“${input.activeSession.objective}”并留下独立输出。`, reasons: ['存在未结束的专注会话'] };
  if (input.behaviorState && (input.behaviorState.motivation < 0.45 || input.behaviorState.ability < 0.55)) {
    reasons.push(...input.behaviorState.diagnosis.slice(0, 2));
    return { nextBestAction: input.behaviorState.suggestedTinyAction, reasons };
  }
  const dueHabit = input.habits?.find((habit) => habit.status === 'active' && !input.habitCheckIns?.some((item) => item.habitId === habit.id && item.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10) && item.result === 'done'));
  if (dueHabit) {
    reasons.push('今天的最小行动尚未完成');
    return { nextBestAction: `当“${dueHabit.anchor}”发生后，只做：${dueHabit.tinyBehavior}`, reasons };
  }
  if (input.dueReviews > 0) {
    reasons.push('存在到期复习，延迟会增加遗忘风险');
    return { nextBestAction: '开始一次无提示回忆复习，并按真实难度评分。', reasons };
  }
  if (input.openMisconceptions > 0) {
    reasons.push('仍有未关闭的误解节点');
    return { nextBestAction: '选择一个误解，用反例或变式任务验证修复。', reasons };
  }
  const activePath = input.paths?.find((path) => path.status === 'active');
  const currentMilestone = activePath ? input.milestones?.find((milestone) => milestone.pathId === activePath.id && ['available', 'doing'].includes(milestone.status)) : undefined;
  if (currentMilestone) {
    reasons.push(`当前路径处于“${currentMilestone.title}”阶段`);
    return { nextBestAction: `推进里程碑“${currentMilestone.title}”：${currentMilestone.outcome}`, reasons };
  }
  const readyAssessment = input.assessments?.find((assessment) => assessment.status === 'ready');
  if (readyAssessment) {
    reasons.push('存在尚未提交的独立能力评估');
    return { nextBestAction: `独立完成“${readyAssessment.title}”，不要让AI代写答案。`, reasons };
  }
  const todo = input.tasks.find((task) => task.status !== 'done');
  if (todo) {
    reasons.push('存在尚未完成的高优先级任务');
    return { nextBestAction: `用25分钟完成“${todo.title}”的第一次独立尝试。`, reasons };
  }
  if (input.artifacts.length === 0) {
    reasons.push('当前没有可验收作品');
    return { nextBestAction: '创建一个30—90分钟可完成的小作品，并先写验收标准。', reasons };
  }
  return { nextBestAction: '选择已有作品，设计一个陌生场景迁移任务。', reasons: ['基础任务已完成，下一步应验证迁移能力'] };
}
