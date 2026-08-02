import type { LearningService } from '../services/learning-service';
import type { AgentComposition, DashboardSnapshot, IntentName, ResourceSearchHit } from '../../shared/domain';
import { selectSkills } from '../skills/catalog';
import { deriveLearnerState } from '../learning/adaptive-engine';

export interface CompiledLearningContext {
  workspace: DashboardSnapshot['workspace'];
  activeGoal?: DashboardSnapshot['goals'][number];
  activePath?: DashboardSnapshot['paths'][number];
  milestones: DashboardSnapshot['milestones'];
  recentTasks: DashboardSnapshot['tasks'];
  recentEvidence: DashboardSnapshot['evidence'];
  knowledgeNodes: DashboardSnapshot['knowledgeNodes'];
  misconceptions: DashboardSnapshot['misconceptions'];
  dueReviews: DashboardSnapshot['reviewItems'];
  habits: DashboardSnapshot['habits'];
  habitCheckIns: DashboardSnapshot['habitCheckIns'];
  contract?: DashboardSnapshot['contracts'][number];
  weeklyReviews: DashboardSnapshot['weeklyReviews'];
  oneToOneState?: DashboardSnapshot['oneToOneStates'][string];
  behaviorState: DashboardSnapshot['behaviorState'];
  artifacts: DashboardSnapshot['artifacts'];
  assessments: DashboardSnapshot['assessments'];
  resources: DashboardSnapshot['resources'];
  resourceHits: ResourceSearchHit[];
  activeSession?: DashboardSnapshot['sessions'][number];
  recentMessages: DashboardSnapshot['messages'];
  learnerState: DashboardSnapshot['learnerState'];
  selectedSkills: DashboardSnapshot['skills'];
  contextSummary: string;
}

export class ContextEngine {
  constructor(private readonly learning: LearningService) {}

  compile(goalId: string | undefined, composition: AgentComposition, intent: IntentName = 'general', query = ''): CompiledLearningContext {
    const dashboard = this.learning.dashboard();
    const activeGoal = goalId ? dashboard.goals.find((goal) => goal.id === goalId) : undefined;
    const goalFilter = <T extends { goalId: string }>(items: T[]) => activeGoal ? items.filter((item) => item.goalId === activeGoal.id) : [];
    const long = composition.chart.context.memoryDepth === 'lifelong';
    const recentTasks = goalFilter(dashboard.tasks).slice(0, long ? 40 : 12);
    const recentEvidence = composition.chart.context.includeEvidence ? goalFilter(dashboard.evidence).slice(0, long ? 30 : 10) : [];
    const knowledgeNodes = goalFilter(dashboard.knowledgeNodes).slice(0, long ? 60 : 15);
    const misconceptions = composition.chart.context.includeMisconceptions ? goalFilter(dashboard.misconceptions).filter((item) => item.status !== 'resolved').slice(0, 20) : [];
    const dueReviews = goalFilter(dashboard.reviewItems).filter((item) => !item.suspended && new Date(item.dueAt) <= new Date()).slice(0, 20);
    const habits = goalFilter(dashboard.habits).slice(0, 20);
    const habitCheckIns = goalFilter(dashboard.habitCheckIns).slice(0, 100);
    const behaviorState = activeGoal ? dashboard.behaviorStates[activeGoal.id] ?? dashboard.behaviorState : dashboard.behaviorState;
    const contract = activeGoal ? dashboard.contracts.find((item) => item.goalId === activeGoal.id) : undefined;
    const weeklyReviews = activeGoal ? dashboard.weeklyReviews.filter((item) => item.goalId === activeGoal.id).slice(0, 8) : [];
    const oneToOneState = activeGoal ? dashboard.oneToOneStates[activeGoal.id] : undefined;
    const artifacts = goalFilter(dashboard.artifacts).slice(0, 20);
    const assessments = goalFilter(dashboard.assessments).slice(0, 10);
    const activePath = goalFilter(dashboard.paths).find((path) => path.status === 'active');
    const milestones = activePath ? dashboard.milestones.filter((milestone) => milestone.pathId === activePath.id) : [];
    const resources = dashboard.resources.filter((resource) => activeGoal ? !resource.goalId || resource.goalId === activeGoal.id : !resource.goalId).slice(0, 30);
    const shouldRetrieve = Boolean(query.trim()) && ['search-library', 'explain', 'research', 'general', 'plan-learning', 'compile-path'].includes(intent);
    const resourceHits = shouldRetrieve ? this.learning.searchResources(dashboard.workspace.id, query, activeGoal?.id, long ? 8 : 5) : [];
    const scopedSessions = activeGoal ? dashboard.sessions.filter((session) => session.goalId === activeGoal.id) : [];
    const activeSession = scopedSessions.find((session) => session.status === 'active');
    const scopedMessages = dashboard.messages.filter((message) => activeGoal ? message.goalId === activeGoal.id : !message.goalId);
    const recentMessages = scopedMessages.slice(long ? -40 : -16);
    const selectedSkills = selectSkills(intent, composition.agent);
    const currentMilestone = milestones.find((milestone) => ['available', 'doing'].includes(milestone.status));
    const learnerState = deriveLearnerState({
      tasks: goalFilter(dashboard.tasks),
      evidence: goalFilter(dashboard.evidence),
      knowledgeNodes: goalFilter(dashboard.knowledgeNodes),
      misconceptions: goalFilter(dashboard.misconceptions),
      reviewItems: goalFilter(dashboard.reviewItems),
      sessions: scopedSessions,
      artifacts: goalFilter(dashboard.artifacts),
      paths: goalFilter(dashboard.paths),
      milestones: goalFilter(dashboard.milestones),
      assessments: goalFilter(dashboard.assessments),
      habits, habitCheckIns, behaviorState
    });

    const contextSummary = [
      `学习空间：${dashboard.workspace.name}`,
      activeGoal ? `当前目标：${activeGoal.title}（L${activeGoal.currentLevel} → L${activeGoal.targetLevel}）` : '当前没有选定目标',
      activePath ? `当前路径：${activePath.title} v${activePath.version}` : '当前尚未编译正式学习路径',
      currentMilestone ? `当前里程碑：${currentMilestone.title}——${currentMilestone.outcome}` : '',
      activeSession ? `当前会话：${activeSession.objective}（计划${activeSession.plannedMinutes}分钟）` : '当前没有进行中的专注会话',
      `进行中任务：${recentTasks.filter((task) => task.status !== 'done').length}`,
      `知识节点：${knowledgeNodes.length}`,
      `到期复习：${dueReviews.length}`,
      contract ? `一对一契约：${contract.learnerName} · 每周${contract.weeklyMinutes}分钟 · 单次${contract.sessionMinutes}分钟 · ${contract.coachingStyle}` : '一对一契约：尚未建立',
      oneToOneState ? `自主性：当前${Math.round(oneToOneState.currentAutonomy * 100)}% / 目标${Math.round(oneToOneState.autonomyTarget * 100)}%` : '',
      weeklyReviews[0] ? `最近周复盘：${weeklyReviews[0].coachSummary}` : '',
      `活跃微习惯：${habits.filter((habit) => habit.status === 'active').length}`,
      `行为条件：动机${Math.round(behaviorState.motivation * 100)}% / 能力${Math.round(behaviorState.ability * 100)}% / 提示${Math.round(behaviorState.promptReliability * 100)}%`,
      `当前最小行动：${behaviorState.suggestedTinyAction}`,
      `开放误解：${misconceptions.length}`,
      `作品：${artifacts.length}`,
      `开放评估：${assessments.filter((item) => item.status === 'ready').length}`,
      `本地资料：${resources.length}`,
      resourceHits.length ? `本轮资料命中：${resourceHits.length}` : '',
      `能力证据：${recentEvidence.length}`,
      `独立性评分：${learnerState.independenceScore}%`,
      `下一最佳行动：${learnerState.nextBestAction}`,
      selectedSkills.length ? `当前技能：${selectedSkills.map((skill) => skill.name).join('、')}` : ''
    ].filter(Boolean).join('\n');

    return {
      workspace: dashboard.workspace,
      activeGoal,
      activePath,
      milestones,
      recentTasks,
      recentEvidence,
      knowledgeNodes,
      misconceptions,
      dueReviews,
      habits,
      habitCheckIns,
      contract,
      weeklyReviews,
      oneToOneState,
      behaviorState,
      artifacts,
      assessments,
      resources,
      resourceHits,
      activeSession,
      recentMessages,
      learnerState,
      selectedSkills,
      contextSummary
    };
  }
}
