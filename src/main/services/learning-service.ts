import { createHash, randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/database';
import type {
  AgentRun,
  AppearancePreferences,
  ApprovalRequest,
  ArtifactEvaluation,
  ArtifactKind,
  AssessmentAttempt,
  AssessmentKind,
  LearningAssessment,
  ChatMessage,
  DashboardSnapshot,
  GoalConversation,
  HabitCheckIn,
  HabitCheckInResult,
  HabitFrequency,
  HabitRecipe,
  LearningContract,
  WeeklyLearningReview,
  KnowledgeEdge,
  KnowledgeEdgeType,
  KnowledgeNode,
  LearningArtifact,
  LearningEvidence,
  LearningGoal,
  LearningPath,
  LearningResource,
  LearningSession,
  LearningTask,
  MaintenanceSnapshot,
  MisconceptionRecord,
  PathMilestone,
  Reflection,
  ResourceKind,
  ResourceSearchHit,
  ReviewItem,
  ReviewRating,
  SessionMode,
  Workspace
} from '../../shared/domain';
import type { ProviderService } from './provider-service';
import { BUILT_IN_SKILLS } from '../skills/catalog';
import { buildDailyBrief, deriveLearnerState } from '../learning/adaptive-engine';
import { deriveBehaviorState, previousScheduledDateKey } from '../learning/behavior-engine';
import { scheduleNextReview } from '../learning/spaced-repetition';
import { deriveOneToOneState } from '../learning/one-to-one-engine';

const now = () => new Date().toISOString();
const parse = <T>(value: string): T => JSON.parse(value) as T;

export class LearningService {
  constructor(
    private readonly database: AppDatabase,
    private readonly providers: ProviderService
  ) {}

  getDefaultWorkspace(): Workspace {
    const row = this.database.db.prepare('SELECT * FROM workspaces ORDER BY created_at LIMIT 1').get() as any;
    if (!row) throw new Error('学习空间尚未初始化。');
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  getAppearancePreferences(): AppearancePreferences {
    const defaults: AppearancePreferences = {
      theme: 'system',
      fontScale: 1,
      density: 'comfortable',
      readingWidth: 'standard',
      reduceMotion: false,
      highContrast: false
    };
    const row = this.database.db.prepare("SELECT value_json FROM settings WHERE key = 'appearance'").get() as { value_json: string } | undefined;
    if (!row) return defaults;
    try {
      const value = parse<Partial<AppearancePreferences>>(row.value_json);
      return {
        theme: value.theme ?? defaults.theme,
        fontScale: Math.min(1.2, Math.max(0.9, Number(value.fontScale ?? defaults.fontScale))),
        density: value.density ?? defaults.density,
        readingWidth: value.readingWidth ?? defaults.readingWidth,
        reduceMotion: Boolean(value.reduceMotion),
        highContrast: Boolean(value.highContrast)
      };
    } catch {
      return defaults;
    }
  }

  saveAppearancePreferences(preferences: AppearancePreferences): AppearancePreferences {
    const normalized: AppearancePreferences = {
      ...preferences,
      fontScale: Math.min(1.2, Math.max(0.9, Number(preferences.fontScale.toFixed(2))))
    };
    this.database.db.prepare(`
      INSERT INTO settings (key, value_json, updated_at) VALUES ('appearance', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(JSON.stringify(normalized), now());
    return normalized;
  }

  dashboard(): DashboardSnapshot {
    const workspace = this.getDefaultWorkspace();
    const appearance = this.getAppearancePreferences();
    const goals = this.listGoals(workspace.id);
    const goalIds = goals.map((goal) => goal.id);
    const conversations = this.listConversations(workspace.id);
    const tasks = goalIds.length ? this.listTasks(goalIds) : [];
    const knowledgeNodes = goalIds.length ? this.listKnowledgeNodes(goalIds) : [];
    const knowledgeEdges = goalIds.length ? this.listKnowledgeEdges(goalIds) : [];
    const misconceptions = goalIds.length ? this.listMisconceptions(goalIds) : [];
    const reviewItems = goalIds.length ? this.listReviewItems(goalIds) : [];
    const habits = goalIds.length ? this.listHabits(goalIds) : [];
    const habitCheckIns = goalIds.length ? this.listHabitCheckIns(goalIds) : [];
    const contracts = goalIds.length ? this.listLearningContracts(goalIds) : [];
    const weeklyReviews = goalIds.length ? this.listWeeklyReviews(goalIds) : [];
    const sessions = this.listSessions(workspace.id);
    const artifacts = goalIds.length ? this.listArtifacts(goalIds) : [];
    const paths = goalIds.length ? this.listPaths(goalIds) : [];
    const milestones = goalIds.length ? this.listMilestones(goalIds) : [];
    const resources = this.listResources(workspace.id, goalIds);
    const assessments = goalIds.length ? this.listAssessments(goalIds) : [];
    const assessmentAttempts = goalIds.length ? this.listAssessmentAttempts(goalIds) : [];
    const artifactEvaluations = goalIds.length ? this.listArtifactEvaluations(goalIds) : [];
    const evidence = goalIds.length ? this.listEvidence(goalIds) : [];
    const messages = this.listMessages(workspace.id);
    const activeRuns = this.listRuns(workspace.id).filter((run) => !['completed', 'failed', 'cancelled'].includes(run.status));
    const approvals = this.listApprovals().filter((approval) => !approval.decision);
    const activeTasks = tasks.filter((item) => !item.archived);
    const activeArtifacts = artifacts.filter((item) => item.status !== 'archived');
    const activeAssessments = assessments.filter((item) => item.status !== 'archived');
    const behaviorStates = Object.fromEntries(goals.map((goal) => [goal.id, deriveBehaviorState({
      goals: [goal],
      tasks: activeTasks.filter((item) => item.goalId === goal.id),
      habits: habits.filter((item) => item.goalId === goal.id),
      checkIns: habitCheckIns.filter((item) => item.goalId === goal.id)
    })]));
    const behaviorState = deriveBehaviorState({ goals, tasks: activeTasks, habits, checkIns: habitCheckIns });
    const oneToOneStates = Object.fromEntries(goals.map((goal) => [goal.id, deriveOneToOneState({
      contract: contracts.find((item) => item.goalId === goal.id),
      reviews: weeklyReviews.filter((item) => item.goalId === goal.id),
      evidence: evidence.filter((item) => item.goalId === goal.id)
    })]));
    const learnerState = deriveLearnerState({ tasks: activeTasks, evidence, knowledgeNodes, misconceptions, reviewItems, sessions, artifacts: activeArtifacts, paths, milestones, assessments: activeAssessments, habits, habitCheckIns, behaviorState });
    const dailyBrief = buildDailyBrief(learnerState, sessions);

    const completedTasks = activeTasks.filter((task) => task.status === 'done').length;
    const focusMinutes = sessions.filter((session) => session.status === 'completed').reduce((sum, session) => sum + session.actualMinutes, 0);
    const modelCostRow = this.database.db.prepare('SELECT COALESCE(SUM(cost_cny), 0) AS total FROM model_usage').get() as { total: number };

    return {
      workspace,
      appearance,
      goals,
      conversations,
      tasks,
      knowledgeNodes,
      knowledgeEdges,
      misconceptions,
      reviewItems,
      habits,
      habitCheckIns,
      contracts,
      weeklyReviews,
      oneToOneStates,
      behaviorState,
      behaviorStates,
      sessions,
      artifacts,
      paths,
      milestones,
      resources,
      assessments,
      assessmentAttempts,
      artifactEvaluations,
      skills: BUILT_IN_SKILLS,
      evidence,
      messages,
      activeRuns,
      approvals,
      providers: this.providers.list(),
      learnerState,
      dailyBrief,
      maintenance: this.database.maintenanceSnapshot(),
      metrics: {
        activeGoals: goals.filter((goal) => goal.status === 'active').length,
        completedTasks,
        evidenceCount: evidence.length,
        independenceScore: learnerState.independenceScore,
        dueReviews: learnerState.dueReviews,
        openMisconceptions: learnerState.openMisconceptions,
        artifactCount: activeArtifacts.length,
        focusMinutes,
        modelCostCny: Number(modelCostRow.total.toFixed(4)),
        activePaths: paths.filter((path) => path.status === 'active').length,
        completedMilestones: milestones.filter((milestone) => milestone.status === 'completed').length,
        resourceCount: resources.filter((item) => !item.archived).length,
        assessmentAverage: assessmentAttempts.length ? Math.round((assessmentAttempts.reduce((sum, item) => sum + item.score, 0) / assessmentAttempts.length) * 100) : 0,
        activeHabits: habits.filter((habit) => habit.status === 'active').length,
        habitSuccessRate: Math.round(behaviorState.successRate * 100),
        activeContracts: contracts.filter((item) => item.status === 'active').length,
        weeklyReviews: weeklyReviews.length
      }
    };
  }

  createMessage(input: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
    const conversation = input.conversationId
      ? this.getConversation(input.conversationId)
      : this.ensureConversation(input.workspaceId, input.goalId);
    if (conversation.workspaceId !== input.workspaceId) throw new Error('会话不属于当前学习空间。');
    if (input.goalId && conversation.goalId !== input.goalId) throw new Error('会话与目标不匹配。');
    const message: ChatMessage = {
      ...input,
      goalId: input.goalId ?? conversation.goalId,
      conversationId: conversation.id,
      id: randomUUID(),
      createdAt: now()
    };
    this.database.transaction(() => {
      this.database.db.prepare(`
        INSERT INTO messages (id, workspace_id, goal_id, conversation_id, run_id, role, content, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(message.id, message.workspaceId, message.goalId ?? null, message.conversationId ?? null, message.runId ?? null, message.role, message.content, JSON.stringify(message.metadata ?? {}), message.createdAt);
      this.database.db.prepare("UPDATE goal_conversations SET last_message_at = ?, last_opened_at = ?, draft_text = '', draft_updated_at = ?, updated_at = ? WHERE id = ?")
        .run(message.createdAt, message.createdAt, message.createdAt, message.createdAt, conversation.id);
    });
    return message;
  }

  ensureConversation(workspaceId: string, goalId?: string): GoalConversation {
    const row = goalId
      ? this.database.db.prepare('SELECT * FROM goal_conversations WHERE goal_id = ? LIMIT 1').get(goalId) as any
      : this.database.db.prepare('SELECT * FROM goal_conversations WHERE workspace_id = ? AND goal_id IS NULL LIMIT 1').get(workspaceId) as any;
    if (row) return this.mapConversation(row);
    const timestamp = now();
    const goal = goalId ? this.database.db.prepare('SELECT title FROM goals WHERE id = ? AND workspace_id = ?').get(goalId, workspaceId) as { title: string } | undefined : undefined;
    if (goalId && !goal) throw new Error('无法为不存在的学习目标创建会话。');
    const conversation: GoalConversation = {
      id: randomUUID(), workspaceId, goalId, title: goal?.title ?? '新目标与临时对话', status: 'active',
      messageCount: 0, pinned: false, draft: '', lastOpenedAt: timestamp, createdAt: timestamp, updatedAt: timestamp
    };
    this.database.db.prepare(`INSERT INTO goal_conversations (id, workspace_id, goal_id, title, status, last_opened_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(conversation.id, conversation.workspaceId, conversation.goalId ?? null, conversation.title, conversation.status, conversation.lastOpenedAt ?? conversation.createdAt, conversation.createdAt, conversation.updatedAt);
    return conversation;
  }

  attachRunToGoal(runId: string, workspaceId: string, goalId: string): GoalConversation {
    const conversation = this.ensureConversation(workspaceId, goalId);
    const previous = this.database.db.prepare('SELECT conversation_id FROM agent_runs WHERE id = ?').get(runId) as { conversation_id?: string } | undefined;
    const timestamp = now();
    this.database.transaction(() => {
      this.database.db.prepare('UPDATE agent_runs SET goal_id = ?, conversation_id = ?, updated_at = ? WHERE id = ?')
        .run(goalId, conversation.id, timestamp, runId);
      this.database.db.prepare('UPDATE messages SET goal_id = ?, conversation_id = ? WHERE run_id = ?')
        .run(goalId, conversation.id, runId);
      this.database.db.prepare('UPDATE goal_conversations SET last_message_at = COALESCE((SELECT MAX(created_at) FROM messages WHERE run_id = ?), last_message_at), updated_at = ? WHERE id = ?')
        .run(runId, timestamp, conversation.id);
      if (previous?.conversation_id && previous.conversation_id !== conversation.id) {
        this.database.db.prepare('UPDATE goal_conversations SET last_message_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = ?), updated_at = ? WHERE id = ?')
          .run(previous.conversation_id, timestamp, previous.conversation_id);
      }
    });
    return conversation;
  }

  private getConversation(id: string): GoalConversation {
    const row = this.database.db.prepare('SELECT * FROM goal_conversations WHERE id = ?').get(id) as any;
    if (!row) throw new Error('目标会话不存在。');
    return this.mapConversation(row);
  }

  renameGoal(goalId: string, title: string): void {
    const normalized = title.trim();
    if (!normalized) throw new Error('目标名称不能为空。');
    const timestamp = now();
    this.database.transaction(() => {
      const updated = this.database.db.prepare('UPDATE goals SET title = ?, updated_at = ? WHERE id = ?').run(normalized, timestamp, goalId);
      if (!updated.changes) throw new Error('学习目标不存在。');
      this.database.db.prepare('UPDATE goal_conversations SET title = ?, updated_at = ? WHERE goal_id = ?').run(normalized, timestamp, goalId);
    });
  }

  archiveGoal(goalId: string, archived: boolean): void {
    const timestamp = now();
    const goalStatus = archived ? 'archived' : 'active';
    const conversationStatus = archived ? 'archived' : 'active';
    this.database.transaction(() => {
      const updated = this.database.db.prepare('UPDATE goals SET status = ?, updated_at = ? WHERE id = ?').run(goalStatus, timestamp, goalId);
      if (!updated.changes) throw new Error('学习目标不存在。');
      this.database.db.prepare('UPDATE goal_conversations SET status = ?, pinned = CASE WHEN ? = 1 THEN 0 ELSE pinned END, updated_at = ? WHERE goal_id = ?')
        .run(conversationStatus, archived ? 1 : 0, timestamp, goalId);
    });
  }

  pinConversation(conversationId: string, pinned: boolean): void {
    const result = this.database.db.prepare('UPDATE goal_conversations SET pinned = ?, updated_at = ? WHERE id = ?').run(pinned ? 1 : 0, now(), conversationId);
    if (!result.changes) throw new Error('目标会话不存在。');
  }

  saveConversationDraft(conversationId: string, draft: string): void {
    const timestamp = now();
    const result = this.database.db.prepare("UPDATE goal_conversations SET draft_text = ?, draft_updated_at = ?, updated_at = CASE WHEN ? <> '' THEN ? ELSE updated_at END WHERE id = ?")
      .run(draft, timestamp, draft, timestamp, conversationId);
    if (!result.changes) throw new Error('目标会话不存在。');
  }

  touchConversation(conversationId: string): void {
    const timestamp = now();
    const result = this.database.db.prepare('UPDATE goal_conversations SET last_opened_at = ?, updated_at = MAX(updated_at, ?) WHERE id = ?')
      .run(timestamp, timestamp, conversationId);
    if (!result.changes) throw new Error('目标会话不存在。');
  }

  createGoal(input: {
    workspaceId: string;
    title: string;
    description: string;
    desiredOutcome: string;
    currentLevel?: number;
    targetLevel?: number;
    targetDate?: string;
  }): LearningGoal {
    const timestamp = now();
    const goal: LearningGoal = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description,
      desiredOutcome: input.desiredOutcome,
      currentLevel: input.currentLevel ?? 1,
      targetLevel: input.targetLevel ?? 4,
      status: 'active',
      targetDate: input.targetDate,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO goals (id, workspace_id, title, description, desired_outcome, current_level, target_level, status, target_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(goal.id, goal.workspaceId, goal.title, goal.description, goal.desiredOutcome, goal.currentLevel, goal.targetLevel, goal.status, goal.targetDate ?? null, goal.createdAt, goal.updatedAt);
    this.ensureConversation(goal.workspaceId, goal.id);
    this.database.db.prepare('UPDATE workspaces SET updated_at = ? WHERE id = ?').run(goal.updatedAt, goal.workspaceId);
    return goal;
  }

  createTask(input: {
    goalId: string;
    title: string;
    description: string;
    stage?: LearningTask['stage'];
    priority?: number;
    estimatedMinutes?: number;
    dueAt?: string;
  }): LearningTask {
    const timestamp = now();
    const task: LearningTask = {
      id: randomUUID(),
      goalId: input.goalId,
      title: input.title,
      description: input.description,
      status: 'todo',
      stage: input.stage ?? 'understanding',
      priority: input.priority ?? 50,
      dueAt: input.dueAt,
      estimatedMinutes: input.estimatedMinutes ?? 25,
      createdAt: timestamp,
      archived: false,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO tasks (id, goal_id, title, description, status, stage, priority, due_at, estimated_minutes, created_at, completed_at, archived, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(task.id, task.goalId, task.title, task.description, task.status, task.stage, task.priority, task.dueAt ?? null, task.estimatedMinutes, task.createdAt, null, 0, task.updatedAt);
    return task;
  }

  completeTask(taskId: string): void {
    const timestamp = now();
    const result = this.database.db.prepare("UPDATE tasks SET status = 'done', completed_at = ?, archived = 0, updated_at = ? WHERE id = ?").run(timestamp, timestamp, taskId);
    if (!result.changes) throw new Error('学习任务不存在。');
  }

  updateGoal(input: { goalId: string; title: string; description: string; desiredOutcome: string; currentLevel: number; targetLevel: number; status: LearningGoal['status']; targetDate?: string }): LearningGoal {
    const timestamp = now();
    const targetLevel = Math.max(input.currentLevel, input.targetLevel);
    this.database.transaction(() => {
      const result = this.database.db.prepare(`UPDATE goals SET title = ?, description = ?, desired_outcome = ?, current_level = ?, target_level = ?, status = ?, target_date = ?, updated_at = ? WHERE id = ?`)
        .run(input.title.trim(), input.description.trim(), input.desiredOutcome.trim(), input.currentLevel, targetLevel, input.status, input.targetDate || null, timestamp, input.goalId);
      if (!result.changes) throw new Error('学习目标不存在。');
      this.database.db.prepare('UPDATE goal_conversations SET title = ?, status = ?, updated_at = ? WHERE goal_id = ?')
        .run(input.title.trim(), input.status === 'archived' ? 'archived' : 'active', timestamp, input.goalId);
    });
    return this.listGoals(this.getDefaultWorkspace().id).find((goal) => goal.id === input.goalId)!;
  }

  updateTask(input: { taskId: string; title?: string; description?: string; status?: LearningTask['status']; priority?: number; estimatedMinutes?: number; dueAt?: string }): LearningTask {
    const row = this.database.db.prepare('SELECT * FROM tasks WHERE id = ?').get(input.taskId) as any;
    if (!row) throw new Error('学习任务不存在。');
    const status = input.status ?? row.status;
    const timestamp = now();
    this.database.db.prepare(`UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, estimated_minutes = ?, due_at = ?, completed_at = ?, archived = ?, updated_at = ? WHERE id = ?`)
      .run(input.title?.trim() ?? row.title, input.description?.trim() ?? row.description, status, input.priority ?? row.priority, input.estimatedMinutes ?? row.estimated_minutes, input.dueAt === '' ? null : input.dueAt ?? row.due_at, status === 'done' ? row.completed_at ?? timestamp : null, status === 'archived' ? 1 : 0, timestamp, input.taskId);
    return this.listTasks([row.goal_id]).find((task) => task.id === input.taskId)!;
  }

  updateMisconception(misconceptionId: string, status: MisconceptionRecord['status']): MisconceptionRecord {
    const timestamp = now();
    const row = this.database.db.prepare('SELECT goal_id FROM misconceptions WHERE id = ?').get(misconceptionId) as { goal_id: string } | undefined;
    if (!row) throw new Error('误解记录不存在。');
    this.database.db.prepare('UPDATE misconceptions SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?')
      .run(status, status === 'resolved' ? timestamp : null, timestamp, misconceptionId);
    return this.listMisconceptions([row.goal_id]).find((item) => item.id === misconceptionId)!;
  }

  suspendReview(itemId: string, suspended: boolean): ReviewItem {
    const timestamp = now();
    const row = this.database.db.prepare('SELECT goal_id FROM review_items WHERE id = ?').get(itemId) as { goal_id: string } | undefined;
    if (!row) throw new Error('复习项目不存在。');
    this.database.db.prepare('UPDATE review_items SET suspended = ?, suspended_at = ?, updated_at = ? WHERE id = ?')
      .run(suspended ? 1 : 0, suspended ? timestamp : null, timestamp, itemId);
    return this.listReviewItems([row.goal_id]).find((item) => item.id === itemId)!;
  }

  archiveResource(resourceId: string, archived: boolean): LearningResource {
    const result = this.database.db.prepare('UPDATE learning_resources SET archived = ?, updated_at = ? WHERE id = ?').run(archived ? 1 : 0, now(), resourceId);
    if (!result.changes) throw new Error('学习资料不存在。');
    const row = this.database.db.prepare('SELECT * FROM learning_resources WHERE id = ?').get(resourceId) as any;
    return this.mapResource(row);
  }

  archiveAssessment(assessmentId: string, archived: boolean): void {
    const row = this.database.db.prepare('SELECT id FROM assessments WHERE id = ?').get(assessmentId) as { id: string } | undefined;
    if (!row) throw new Error('评估不存在。');
    const attempt = this.database.db.prepare('SELECT id FROM assessment_attempts WHERE assessment_id = ? ORDER BY submitted_at DESC LIMIT 1').get(assessmentId) as { id: string } | undefined;
    const restoredStatus: LearningAssessment['status'] = attempt ? 'completed' : 'ready';
    this.database.db.prepare("UPDATE assessments SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?")
      .run(archived ? 'archived' : restoredStatus, archived ? now() : null, now(), assessmentId);
  }

  archiveArtifact(artifactId: string, archived: boolean): void {
    const row = this.database.db.prepare('SELECT id FROM artifacts WHERE id = ?').get(artifactId) as { id: string } | undefined;
    if (!row) throw new Error('作品不存在。');
    const evaluation = this.database.db.prepare('SELECT passed FROM artifact_evaluations WHERE artifact_id = ? ORDER BY created_at DESC LIMIT 1').get(artifactId) as { passed: number } | undefined;
    const restoredStatus: LearningArtifact['status'] = evaluation ? (Boolean(evaluation.passed) ? 'accepted' : 'review') : 'draft';
    this.database.db.prepare("UPDATE artifacts SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?")
      .run(archived ? 'archived' : restoredStatus, archived ? now() : null, now(), artifactId);
  }

  createHabit(input: {
    goalId: string;
    title: string;
    anchor: string;
    tinyBehavior: string;
    expansionBehavior?: string;
    celebration: string;
    frequency?: HabitFrequency;
    customDays?: number[];
    minimumSeconds?: number;
    preferredMinutes?: number;
  }): HabitRecipe {
    const timestamp = now();
    const habit: HabitRecipe = {
      id: randomUUID(), goalId: input.goalId, title: input.title, anchor: input.anchor, tinyBehavior: input.tinyBehavior,
      expansionBehavior: input.expansionBehavior ?? '', celebration: input.celebration, frequency: input.frequency ?? 'daily',
      customDays: input.customDays ?? [], minimumSeconds: input.minimumSeconds ?? 30, preferredMinutes: input.preferredMinutes ?? 10,
      status: 'active', streak: 0, bestStreak: 0, createdAt: timestamp, updatedAt: timestamp
    };
    this.database.db.prepare(`INSERT INTO habit_recipes
      (id, goal_id, title, anchor, tiny_behavior, expansion_behavior, celebration, frequency, custom_days_json, minimum_seconds, preferred_minutes, status, streak, best_streak, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`)
      .run(habit.id, habit.goalId, habit.title, habit.anchor, habit.tinyBehavior, habit.expansionBehavior, habit.celebration,
        habit.frequency, JSON.stringify(habit.customDays), habit.minimumSeconds, habit.preferredMinutes, habit.status, habit.createdAt, habit.updatedAt);
    return habit;
  }

  updateHabit(input: { habitId: string } & Partial<Omit<HabitRecipe, 'id' | 'goalId' | 'createdAt' | 'updatedAt' | 'streak' | 'bestStreak' | 'lastCheckInAt'>>): HabitRecipe {
    const existing = this.database.db.prepare('SELECT * FROM habit_recipes WHERE id = ?').get(input.habitId) as any;
    if (!existing) throw new Error('微习惯不存在。');
    const current = this.mapHabit(existing);
    const updated: HabitRecipe = {
      ...current,
      title: input.title ?? current.title,
      anchor: input.anchor ?? current.anchor,
      tinyBehavior: input.tinyBehavior ?? current.tinyBehavior,
      expansionBehavior: input.expansionBehavior ?? current.expansionBehavior,
      celebration: input.celebration ?? current.celebration,
      frequency: input.frequency ?? current.frequency,
      customDays: input.customDays ?? current.customDays,
      minimumSeconds: input.minimumSeconds ?? current.minimumSeconds,
      preferredMinutes: input.preferredMinutes ?? current.preferredMinutes,
      status: input.status ?? current.status,
      updatedAt: now()
    };
    this.database.db.prepare(`UPDATE habit_recipes SET title = ?, anchor = ?, tiny_behavior = ?, expansion_behavior = ?, celebration = ?, frequency = ?, custom_days_json = ?, minimum_seconds = ?, preferred_minutes = ?, status = ?, updated_at = ? WHERE id = ?`)
      .run(updated.title, updated.anchor, updated.tinyBehavior, updated.expansionBehavior, updated.celebration, updated.frequency,
        JSON.stringify(updated.customDays), updated.minimumSeconds, updated.preferredMinutes, updated.status, updated.updatedAt, updated.id);
    return updated;
  }

  checkInHabit(input: {
    habitId: string;
    result: HabitCheckInResult;
    motivation: number;
    ability: number;
    promptSeen: boolean;
    celebrated: boolean;
    durationSeconds: number;
    note?: string;
  }): HabitCheckIn {
    const row = this.database.db.prepare('SELECT * FROM habit_recipes WHERE id = ?').get(input.habitId) as any;
    if (!row) throw new Error('微习惯不存在。');
    const habit = this.mapHabit(row);
    if (habit.status !== 'active') throw new Error('该微习惯当前未启用。');
    const timestamp = now();
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    const localDate = localDateKey(new Date());
    const checkIn: HabitCheckIn = {
      id: randomUUID(), habitId: habit.id, goalId: habit.goalId, result: input.result,
      motivation: input.motivation, ability: input.ability, promptSeen: input.promptSeen,
      celebrated: input.celebrated, durationSeconds: input.durationSeconds, note: input.note ?? '',
      localDate, timezoneOffsetMinutes, createdAt: timestamp
    };
    const previous = this.database.db.prepare(`SELECT local_date, result FROM habit_checkins WHERE habit_id = ? ORDER BY created_at DESC LIMIT 1`).get(habit.id) as { local_date: string; result: HabitCheckInResult } | undefined;
    const previousDay = previous?.local_date;
    const today = localDate;
    const previousScheduledDay = previousScheduledDateKey(habit, new Date());
    const alreadyToday = previousDay === today;
    let streak = habit.streak;
    if (!alreadyToday) {
      if (input.result === 'done') streak = previousDay === previousScheduledDay && previous?.result === 'done' ? habit.streak + 1 : 1;
      else if (previousDay !== today) streak = 0;
    }
    const bestStreak = Math.max(habit.bestStreak, streak);
    this.database.transaction(() => {
      this.database.db.prepare(`INSERT INTO habit_checkins (id, habit_id, goal_id, result, motivation, ability, prompt_seen, celebrated, duration_seconds, note, local_date, timezone_offset_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(checkIn.id, checkIn.habitId, checkIn.goalId, checkIn.result, checkIn.motivation, checkIn.ability, checkIn.promptSeen ? 1 : 0, checkIn.celebrated ? 1 : 0, checkIn.durationSeconds, checkIn.note, checkIn.localDate, checkIn.timezoneOffsetMinutes, checkIn.createdAt);
      this.database.db.prepare('UPDATE habit_recipes SET streak = ?, best_streak = ?, last_check_in_at = ?, updated_at = ? WHERE id = ?')
        .run(streak, bestStreak, timestamp, timestamp, habit.id);
    });
    return checkIn;
  }

  upsertLearningContract(input: {
    goalId: string; learnerName: string; whyNow: string; successDefinition: string; weeklyMinutes: number; sessionMinutes: number;
    preferredDays: number[]; preferredTime: string; coachingStyle: LearningContract['coachingStyle'];
    feedbackPreference: LearningContract['feedbackPreference']; challengeLevel: number; autonomyTarget: number;
    minimumCommitment: string; reviewCadence: LearningContract['reviewCadence']; status: LearningContract['status']; agree: boolean;
  }): LearningContract {
    const goal = this.database.db.prepare('SELECT id FROM goals WHERE id = ?').get(input.goalId) as { id: string } | undefined;
    if (!goal) throw new Error('学习目标不存在。');
    const existing = this.database.db.prepare('SELECT * FROM learning_contracts WHERE goal_id = ?').get(input.goalId) as any;
    const timestamp = now();
    const contract: LearningContract = {
      id: existing?.id ?? randomUUID(), goalId: input.goalId, learnerName: input.learnerName.trim(), whyNow: input.whyNow.trim(),
      successDefinition: input.successDefinition.trim(), weeklyMinutes: input.weeklyMinutes, sessionMinutes: input.sessionMinutes,
      preferredDays: [...new Set(input.preferredDays)].sort(), preferredTime: input.preferredTime.trim(), coachingStyle: input.coachingStyle,
      feedbackPreference: input.feedbackPreference, challengeLevel: input.challengeLevel, autonomyTarget: input.autonomyTarget,
      minimumCommitment: input.minimumCommitment.trim(), reviewCadence: input.reviewCadence, status: input.status,
      version: Number(existing?.version ?? 0) + 1, agreedAt: input.agree ? timestamp : existing?.agreed_at ?? undefined,
      createdAt: existing?.created_at ?? timestamp, updatedAt: timestamp
    };
    this.database.db.prepare(`INSERT INTO learning_contracts
      (id, goal_id, learner_name, why_now, success_definition, weekly_minutes, session_minutes, preferred_days_json, preferred_time, coaching_style, feedback_preference, challenge_level, autonomy_target, minimum_commitment, review_cadence, status, version, agreed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(goal_id) DO UPDATE SET learner_name = excluded.learner_name, why_now = excluded.why_now, success_definition = excluded.success_definition, weekly_minutes = excluded.weekly_minutes, session_minutes = excluded.session_minutes, preferred_days_json = excluded.preferred_days_json, preferred_time = excluded.preferred_time, coaching_style = excluded.coaching_style, feedback_preference = excluded.feedback_preference, challenge_level = excluded.challenge_level, autonomy_target = excluded.autonomy_target, minimum_commitment = excluded.minimum_commitment, review_cadence = excluded.review_cadence, status = excluded.status, version = excluded.version, agreed_at = excluded.agreed_at, updated_at = excluded.updated_at`)
      .run(contract.id, contract.goalId, contract.learnerName, contract.whyNow, contract.successDefinition, contract.weeklyMinutes, contract.sessionMinutes, JSON.stringify(contract.preferredDays), contract.preferredTime, contract.coachingStyle, contract.feedbackPreference, contract.challengeLevel, contract.autonomyTarget, contract.minimumCommitment, contract.reviewCadence, contract.status, contract.version, contract.agreedAt ?? null, contract.createdAt, contract.updatedAt);
    return contract;
  }

  generateWeeklyReview(goalId: string, reflection = ''): WeeklyLearningReview {
    const contract = this.database.db.prepare('SELECT * FROM learning_contracts WHERE goal_id = ?').get(goalId) as any;
    if (!contract) throw new Error('请先建立一对一学习契约。');
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 86_400_000);
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);
    const sessions = this.database.db.prepare(`SELECT status FROM learning_sessions WHERE goal_id = ? AND started_at >= ? AND started_at < ?`).all(goalId, `${periodStart}T00:00:00.000Z`, `${periodEnd}T23:59:59.999Z`) as Array<{ status: string }>;
    const plannedSessions = Math.max(1, Math.ceil(Number(contract.weekly_minutes) / Math.max(5, Number(contract.session_minutes))));
    const completedSessions = sessions.filter((item) => item.status === 'completed').length;
    const tinyActionsCompleted = Number((this.database.db.prepare(`SELECT COUNT(*) AS count FROM habit_checkins WHERE goal_id = ? AND local_date BETWEEN ? AND ? AND result = 'done'`).get(goalId, periodStart, periodEnd) as { count: number }).count);
    const evidenceCreated = Number((this.database.db.prepare(`SELECT COUNT(*) AS count FROM evidence WHERE goal_id = ? AND created_at >= ? AND created_at < ?`).get(goalId, `${periodStart}T00:00:00.000Z`, `${periodEnd}T23:59:59.999Z`) as { count: number }).count);
    const completionRate = Math.min(1, completedSessions / plannedSessions);
    const coachSummary = completionRate >= 0.8
      ? '本周执行节奏稳定。下一阶段应减少AI直接解释，增加独立尝试、延迟复测与真实作品。'
      : completionRate >= 0.4
        ? '本周已经形成部分节奏，但学习计划仍偏大或锚点不够稳定。先保持最小行动，再恢复完整会话。'
        : '本周不是意志力失败。优先缩小会话、降低启动成本，并把最小行为连接到更稳定的日常锚点。';
    const nextFocus = evidenceCreated > 0 ? '把已有证据迁移到一个新的问题或作品。' : '完成一个无提示小任务，并沉淀第一条可验证能力证据。';
    const behaviorAdjustment = tinyActionsCompleted >= 3 ? '保留当前锚点与最小行为，扩展仍保持可选。' : '把最小行为再缩小一半，并检查锚点是否真的每天出现。';
    const existingReview = this.database.db.prepare('SELECT id FROM weekly_learning_reviews WHERE goal_id = ? AND period_start = ? AND period_end = ?').get(goalId, periodStart, periodEnd) as { id: string } | undefined;
    const review: WeeklyLearningReview = { id: existingReview?.id ?? randomUUID(), goalId, periodStart, periodEnd, plannedSessions, completedSessions, tinyActionsCompleted, evidenceCreated, reflection: reflection.trim(), coachSummary, nextFocus, behaviorAdjustment, createdAt: now() };
    this.database.db.prepare(`INSERT INTO weekly_learning_reviews (id, goal_id, period_start, period_end, planned_sessions, completed_sessions, tiny_actions_completed, evidence_created, reflection, coach_summary, next_focus, behavior_adjustment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(goal_id, period_start, period_end) DO UPDATE SET planned_sessions = excluded.planned_sessions, completed_sessions = excluded.completed_sessions, tiny_actions_completed = excluded.tiny_actions_completed, evidence_created = excluded.evidence_created, reflection = excluded.reflection, coach_summary = excluded.coach_summary, next_focus = excluded.next_focus, behavior_adjustment = excluded.behavior_adjustment, created_at = excluded.created_at`)
      .run(review.id, review.goalId, review.periodStart, review.periodEnd, review.plannedSessions, review.completedSessions, review.tinyActionsCompleted, review.evidenceCreated, review.reflection, review.coachSummary, review.nextFocus, review.behaviorAdjustment, review.createdAt);
    return review;
  }

  maintenanceSnapshot(): MaintenanceSnapshot { return this.database.maintenanceSnapshot(); }
  createManualBackup(): MaintenanceSnapshot { return this.database.createBackup('manual'); }
  stageBackupRestore(name: string): void { this.database.stageRestore(name); }

  createKnowledgeNode(input: {
    goalId: string;
    title: string;
    summary: string;
    stage?: KnowledgeNode['stage'];
    mastery?: number;
    confidence?: number;
  }): KnowledgeNode {
    const existing = this.database.db.prepare('SELECT * FROM knowledge_nodes WHERE goal_id = ? AND lower(title) = lower(?) LIMIT 1').get(input.goalId, input.title) as any;
    if (existing) return this.mapKnowledgeNode(existing);
    const timestamp = now();
    const node: KnowledgeNode = {
      id: randomUUID(),
      goalId: input.goalId,
      title: input.title,
      summary: input.summary,
      stage: input.stage ?? 'mapping',
      mastery: clamp(input.mastery ?? 0.2),
      confidence: clamp(input.confidence ?? 0.35),
      prerequisites: [],
      misconceptions: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO knowledge_nodes (id, goal_id, title, summary, stage, mastery, confidence, prerequisites_json, misconceptions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(node.id, node.goalId, node.title, node.summary, node.stage, node.mastery, node.confidence, '[]', '[]', node.createdAt, node.updatedAt);
    return node;
  }

  linkKnowledge(input: { goalId: string; sourceNodeId: string; targetNodeId: string; type: KnowledgeEdgeType; weight?: number }): KnowledgeEdge {
    const edge: KnowledgeEdge = {
      id: randomUUID(),
      goalId: input.goalId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      type: input.type,
      weight: clamp(input.weight ?? 1),
      createdAt: now()
    };
    this.database.db.prepare(`
      INSERT INTO knowledge_edges (id, goal_id, source_node_id, target_node_id, type, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_node_id, target_node_id, type) DO UPDATE SET weight = excluded.weight
    `).run(edge.id, edge.goalId, edge.sourceNodeId, edge.targetNodeId, edge.type, edge.weight, edge.createdAt);
    return edge;
  }

  createMisconception(input: {
    goalId: string;
    knowledgeNodeId?: string;
    statement: string;
    correction: string;
    evidenceNeeded: string;
  }): MisconceptionRecord {
    const timestamp = now();
    const misconception: MisconceptionRecord = {
      id: randomUUID(),
      goalId: input.goalId,
      knowledgeNodeId: input.knowledgeNodeId,
      statement: input.statement,
      correction: input.correction,
      evidenceNeeded: input.evidenceNeeded,
      status: 'open',
      recurrenceCount: 0,
      nextCheckAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO misconceptions (id, goal_id, knowledge_node_id, statement, correction, evidence_needed, status, recurrence_count, next_check_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      misconception.id,
      misconception.goalId,
      misconception.knowledgeNodeId ?? null,
      misconception.statement,
      misconception.correction,
      misconception.evidenceNeeded,
      misconception.status,
      misconception.recurrenceCount,
      misconception.nextCheckAt ?? null,
      misconception.createdAt,
      misconception.updatedAt
    );
    return misconception;
  }

  scheduleReview(input: { goalId: string; knowledgeNodeId?: string; prompt: string; answer: string; dueAt?: string }): ReviewItem {
    const timestamp = now();
    const item: ReviewItem = {
      id: randomUUID(),
      goalId: input.goalId,
      knowledgeNodeId: input.knowledgeNodeId,
      prompt: input.prompt,
      answer: input.answer,
      dueAt: input.dueAt ?? timestamp,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      suspended: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO review_items (id, goal_id, knowledge_node_id, prompt, answer, due_at, interval_days, ease_factor, repetitions, lapses, suspended, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.goalId, item.knowledgeNodeId ?? null, item.prompt, item.answer, item.dueAt, item.intervalDays, item.easeFactor, item.repetitions, item.lapses, 0, item.createdAt, item.updatedAt);
    return item;
  }

  recordReview(itemId: string, rating: ReviewRating): ReviewItem {
    const row = this.database.db.prepare('SELECT * FROM review_items WHERE id = ?').get(itemId) as any;
    if (!row) throw new Error('复习项目不存在。');
    const item = this.mapReviewItem(row);
    const update = scheduleNextReview(item, rating);
    this.database.db.prepare(`
      UPDATE review_items SET due_at = ?, interval_days = ?, ease_factor = ?, repetitions = ?, lapses = ?, last_rating = ?, last_reviewed_at = ?, updated_at = ? WHERE id = ?
    `).run(update.dueAt, update.intervalDays, update.easeFactor, update.repetitions, update.lapses, update.lastRating, update.lastReviewedAt, now(), itemId);
    return { ...item, ...update, updatedAt: now() };
  }

  startSession(input: { workspaceId: string; goalId?: string; mode: SessionMode; objective: string; plannedMinutes?: number }): LearningSession {
    const existing = this.database.db.prepare("SELECT * FROM learning_sessions WHERE workspace_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").get(input.workspaceId) as any;
    if (existing) return this.mapSession(existing);
    const timestamp = now();
    const session: LearningSession = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      goalId: input.goalId,
      mode: input.mode,
      objective: input.objective,
      status: 'active',
      plannedMinutes: input.plannedMinutes ?? 25,
      actualMinutes: 0,
      summary: '',
      startedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO learning_sessions (id, workspace_id, goal_id, mode, objective, status, planned_minutes, actual_minutes, summary, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(session.id, session.workspaceId, session.goalId ?? null, session.mode, session.objective, session.status, session.plannedMinutes, session.actualMinutes, session.summary, session.startedAt, session.createdAt, session.updatedAt);
    return session;
  }

  completeActiveSession(workspaceId: string, summary: string): LearningSession | undefined {
    const row = this.database.db.prepare("SELECT * FROM learning_sessions WHERE workspace_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").get(workspaceId) as any;
    if (!row) return undefined;
    const endedAt = now();
    const actualMinutes = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(row.started_at).getTime()) / 60_000));
    this.database.db.prepare(`
      UPDATE learning_sessions SET status = 'completed', actual_minutes = ?, summary = ?, ended_at = ?, updated_at = ? WHERE id = ?
    `).run(actualMinutes, summary, endedAt, endedAt, row.id);
    return { ...this.mapSession(row), status: 'completed', actualMinutes, summary, endedAt, updatedAt: endedAt };
  }

  createArtifact(input: {
    goalId: string;
    taskId?: string;
    kind?: ArtifactKind;
    title: string;
    description: string;
    content?: string;
    rubric?: string[];
    provenance?: Record<string, unknown>;
  }): LearningArtifact {
    const timestamp = now();
    const artifact: LearningArtifact = {
      id: randomUUID(),
      goalId: input.goalId,
      taskId: input.taskId,
      kind: input.kind ?? 'project',
      title: input.title,
      description: input.description,
      content: input.content ?? '',
      status: 'draft',
      rubric: input.rubric ?? ['成果可运行或可阅读', '学习者能解释关键决策', '存在明确验收证据'],
      provenance: input.provenance ?? {},
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.database.db.prepare(`
      INSERT INTO artifacts (id, goal_id, task_id, kind, title, description, content, file_path, status, rubric_json, provenance_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(artifact.id, artifact.goalId, artifact.taskId ?? null, artifact.kind, artifact.title, artifact.description, artifact.content, null, artifact.status, JSON.stringify(artifact.rubric), JSON.stringify(artifact.provenance), artifact.createdAt, artifact.updatedAt);
    return artifact;
  }

  createEvidence(input: Omit<LearningEvidence, 'id' | 'createdAt'>): LearningEvidence {
    const evidence: LearningEvidence = { ...input, id: randomUUID(), createdAt: now() };
    this.database.db.prepare(`
      INSERT INTO evidence (id, goal_id, task_id, kind, title, content, independence, retention, transfer, evaluator, provenance_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evidence.id,
      evidence.goalId,
      evidence.taskId ?? null,
      evidence.kind,
      evidence.title,
      evidence.content,
      evidence.independence,
      evidence.retention,
      evidence.transfer,
      evidence.evaluator,
      JSON.stringify(evidence.provenance ?? {}),
      evidence.createdAt
    );
    return evidence;
  }

  createReflection(input: Omit<Reflection, 'id' | 'createdAt'>): Reflection {
    const reflection: Reflection = { ...input, id: randomUUID(), createdAt: now() };
    this.database.db.prepare(`
      INSERT INTO reflections (id, goal_id, content, what_worked, what_failed, next_action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reflection.id, reflection.goalId, reflection.content, reflection.whatWorked, reflection.whatFailed, reflection.nextAction, reflection.createdAt);
    return reflection;
  }

  compileLearningPath(input: { goalId: string; title?: string; description?: string }): { path: LearningPath; milestones: PathMilestone[] } {
    const goal = this.database.db.prepare('SELECT * FROM goals WHERE id = ?').get(input.goalId) as any;
    if (!goal) throw new Error('学习目标不存在。');
    const currentVersion = this.database.db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM learning_paths WHERE goal_id = ?').get(input.goalId) as { version: number };
    const timestamp = now();
    const path: LearningPath = {
      id: randomUUID(),
      goalId: input.goalId,
      title: input.title ?? `${goal.title}·一条龙学习路径`,
      description: input.description ?? `从起点诊断到独立迁移与作品交付的动态路径。`,
      status: 'active',
      version: Number(currentVersion.version) + 1,
      estimatedHours: 12,
      strategy: '诊断→理解→建图→练习→验证→作品→迁移；每一阶段必须留下学习者自己的证据。',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const specs = [
      ['起点诊断', '不查资料写出已有理解、能力和不确定点。', ['起点诊断记录', '至少一个真实缺口'], 30],
      ['核心理解', '用万能三法掌握最小运行机制和关键边界。', ['学习者复述', '自己的准确类比'], 90],
      ['知识地图', '建立前置、核心、易错、应用和未知节点。', ['知识节点图', '前置依赖'], 60],
      ['主动练习', '在最近发展区完成标准任务并记录修正。', ['首次尝试', '纠错记录'], 180],
      ['能力验证', '完成无提示回忆、变式与迁移任务。', ['独立完成', '延迟复测', '迁移任务'], 120],
      ['作品交付', '形成可运行、可阅读或可演示的真实成果。', ['作品', '验收报告', '反思'], 240]
    ] as const;
    const milestones: PathMilestone[] = specs.map(([title, outcome, evidenceRequired, estimatedMinutes], index) => ({
      id: randomUUID(), pathId: path.id, goalId: path.goalId, orderIndex: index,
      title, outcome, evidenceRequired: [...evidenceRequired], estimatedMinutes,
      status: index === 0 ? 'available' : 'locked', createdAt: timestamp, updatedAt: timestamp
    }));
    this.database.transaction(() => {
      this.database.db.prepare("UPDATE learning_paths SET status = 'archived', updated_at = ? WHERE goal_id = ? AND status = 'active'").run(timestamp, input.goalId);
      this.database.db.prepare(`INSERT INTO learning_paths (id, goal_id, title, description, status, version, estimated_hours, strategy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(path.id, path.goalId, path.title, path.description, path.status, path.version, path.estimatedHours, path.strategy, path.createdAt, path.updatedAt);
      const insert = this.database.db.prepare(`INSERT INTO path_milestones (id, path_id, goal_id, order_index, title, outcome, evidence_required_json, estimated_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const milestone of milestones) insert.run(milestone.id, milestone.pathId, milestone.goalId, milestone.orderIndex, milestone.title, milestone.outcome, JSON.stringify(milestone.evidenceRequired), milestone.estimatedMinutes, milestone.status, milestone.createdAt, milestone.updatedAt);
    });
    return { path, milestones };
  }

  completeMilestone(milestoneId: string): PathMilestone {
    const row = this.database.db.prepare('SELECT * FROM path_milestones WHERE id = ?').get(milestoneId) as any;
    if (!row) throw new Error('里程碑不存在。');
    const timestamp = now();
    this.database.transaction(() => {
      this.database.db.prepare("UPDATE path_milestones SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, milestoneId);
      this.database.db.prepare("UPDATE path_milestones SET status = 'available', updated_at = ? WHERE path_id = ? AND order_index = ? AND status = 'locked'").run(timestamp, row.path_id, row.order_index + 1);
      const remaining = this.database.db.prepare("SELECT COUNT(*) AS count FROM path_milestones WHERE path_id = ? AND status != 'completed'").get(row.path_id) as { count: number };
      if (remaining.count === 0) this.database.db.prepare("UPDATE learning_paths SET status = 'completed', updated_at = ? WHERE id = ?").run(timestamp, row.path_id);
    });
    return { ...this.mapMilestone({ ...row, status: 'completed', completed_at: timestamp, updated_at: timestamp }) };
  }

  importResource(input: { workspaceId: string; goalId?: string; title: string; kind: ResourceKind; content: string; sourcePath?: string; sourceUrl?: string; mimeType?: string; tags?: string[] }): LearningResource {
    const bytes = Buffer.byteLength(input.content, 'utf8');
    if (bytes > 5 * 1024 * 1024) throw new Error('单个资料最大支持5MB纯文本内容。');
    const checksum = createHash('sha256').update(input.content).digest('hex');
    const existing = this.database.db.prepare('SELECT * FROM learning_resources WHERE workspace_id = ? AND checksum = ?').get(input.workspaceId, checksum) as any;
    if (existing) return this.mapResource(existing);
    const chunks = splitIntoChunks(input.content, 1600, 200);
    const timestamp = now();
    const resource: LearningResource = {
      id: randomUUID(), workspaceId: input.workspaceId, goalId: input.goalId, title: input.title, kind: input.kind,
      sourcePath: input.sourcePath, sourceUrl: input.sourceUrl, checksum, byteSize: bytes,
      mimeType: input.mimeType ?? 'text/plain', summary: summarizeText(input.content), tags: input.tags ?? [], chunkCount: chunks.length, archived: false,
      createdAt: timestamp, updatedAt: timestamp
    };
    this.database.transaction(() => {
      this.database.db.prepare(`INSERT INTO learning_resources (id, workspace_id, goal_id, title, kind, source_path, source_url, checksum, byte_size, mime_type, summary, tags_json, chunk_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(resource.id, resource.workspaceId, resource.goalId ?? null, resource.title, resource.kind, resource.sourcePath ?? null, resource.sourceUrl ?? null, resource.checksum, resource.byteSize, resource.mimeType, resource.summary, JSON.stringify(resource.tags), resource.chunkCount, resource.createdAt, resource.updatedAt);
      const insertChunk = this.database.db.prepare(`INSERT INTO resource_chunks (id, resource_id, chunk_index, content, normalized_text, token_estimate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      chunks.forEach((content, index) => insertChunk.run(randomUUID(), resource.id, index, content, normalizeSearchText(content), Math.ceil(content.length / 3), timestamp));
    });
    return resource;
  }

  searchResources(workspaceId: string, query: string, goalId?: string, limit = 8): ResourceSearchHit[] {
    const tokens = buildSearchTokens(query).slice(0, 24);
    if (tokens.length === 0) return [];
    const rows = this.database.db.prepare(`
      SELECT c.id AS chunk_id, c.content, c.normalized_text, r.id AS resource_id, r.title AS resource_title, r.goal_id
      FROM resource_chunks c JOIN learning_resources r ON r.id = c.resource_id
      WHERE r.workspace_id = ? AND r.archived = 0 AND (? IS NULL OR r.goal_id IS NULL OR r.goal_id = ?)
      ORDER BY r.updated_at DESC LIMIT 800
    `).all(workspaceId, goalId ?? null, goalId ?? null) as any[];
    return rows.map((row) => {
      const haystack = `${normalizeSearchText(row.resource_title)} ${row.normalized_text}`;
      const score = tokens.reduce((sum, token) => sum + countOccurrences(haystack, token) * (normalizeSearchText(row.resource_title).includes(token) ? 3 : 1), 0);
      return { resourceId: row.resource_id, resourceTitle: row.resource_title, chunkId: row.chunk_id, content: row.content, score } satisfies ResourceSearchHit;
    }).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  createAssessment(input: { goalId: string; title?: string; kind?: AssessmentKind; topic?: string }): LearningAssessment {
    const goal = this.database.db.prepare('SELECT title FROM goals WHERE id = ?').get(input.goalId) as { title: string } | undefined;
    if (!goal) throw new Error('学习目标不存在。');
    const topic = input.topic?.trim() || goal.title;
    const timestamp = now();
    const questions = [
      { id: randomUUID(), prompt: `不用资料，用自己的话解释“${topic}”的核心机制，并给出一个准确例子。`, expectedElements: ['核心机制', '因果关系', '独立例子'], maxScore: 40 },
      { id: randomUUID(), prompt: `把“${topic}”应用到一个不同场景，说明哪些部分可迁移、哪些不能。`, expectedElements: ['迁移场景', '可迁移结构', '边界'], maxScore: 35 },
      { id: randomUUID(), prompt: `指出关于“${topic}”最容易出现的一种误解，并设计验证它的方法。`, expectedElements: ['常见误解', '反例或实验', '判断标准'], maxScore: 25 }
    ];
    const assessment: LearningAssessment = {
      id: randomUUID(), goalId: input.goalId, title: input.title ?? `${topic}·独立掌握评估`, kind: input.kind ?? 'formative', status: 'ready',
      instructions: '请一次性回答全部问题。可以分段，但不要让AI代写。系统按完整性、独立性和迁移性评分。', questions, passScore: 0.7,
      createdAt: timestamp, updatedAt: timestamp
    };
    this.database.db.prepare(`INSERT INTO assessments (id, goal_id, title, kind, status, instructions, questions_json, pass_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(assessment.id, assessment.goalId, assessment.title, assessment.kind, assessment.status, assessment.instructions, JSON.stringify(assessment.questions), assessment.passScore, assessment.createdAt, assessment.updatedAt);
    return assessment;
  }

  submitAssessment(assessmentId: string, answer: string): AssessmentAttempt {
    const row = this.database.db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId) as any;
    if (!row) throw new Error('评估不存在。');
    const assessment = this.mapAssessment(row);
    const normalized = normalizeSearchText(answer);
    const elementMatches = assessment.questions.flatMap((question) => question.expectedElements).filter((element) => normalized.includes(normalizeSearchText(element).split(' ')[0] ?? '')).length;
    const totalElements = Math.max(1, assessment.questions.reduce((sum, question) => sum + question.expectedElements.length, 0));
    const lengthScore = Math.min(1, answer.trim().length / 650);
    const structureScore = Math.min(1, (answer.match(/\n/gu)?.length ?? 0) / 5 + 0.25);
    const score = clamp(0.45 * lengthScore + 0.2 * structureScore + 0.35 * (elementMatches / totalElements));
    const feedback = score >= assessment.passScore
      ? '达到本轮通过线。下一步应安排延迟复测或陌生场景迁移，确认不是即时记忆。'
      : '尚未达到通过线。请补充机制、边界、反例和迁移场景，再重新提交。';
    const attempt: AssessmentAttempt = { id: randomUUID(), assessmentId, goalId: assessment.goalId, answer, score, feedback, independence: 1, submittedAt: now() };
    this.database.transaction(() => {
      this.database.db.prepare(`INSERT INTO assessment_attempts (id, assessment_id, goal_id, answer, score, feedback, independence, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(attempt.id, attempt.assessmentId, attempt.goalId, attempt.answer, attempt.score, attempt.feedback, attempt.independence, attempt.submittedAt);
      if (score >= assessment.passScore) this.database.db.prepare("UPDATE assessments SET status = 'completed', updated_at = ? WHERE id = ?").run(attempt.submittedAt, assessmentId);
      this.createEvidence({ goalId: assessment.goalId, kind: 'exercise', title: assessment.title, content: answer, independence: 1, retention: 0.35, transfer: Math.min(1, score * 0.8), evaluator: 'automated', provenance: { assessmentId, score } });
    });
    return attempt;
  }

  evaluateArtifact(artifactId: string): ArtifactEvaluation {
    const row = this.database.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(artifactId) as any;
    if (!row) throw new Error('作品不存在。');
    const artifact = this.listArtifacts([row.goal_id]).find((item) => item.id === artifactId)!;
    const criterionScores = artifact.rubric.map((criterion, index) => {
      const signals = [artifact.description.length > 40, artifact.content.length > 120, Object.keys(artifact.provenance).length > 0, Boolean(artifact.filePath)];
      const score = signals[index % signals.length] ? 1 : 0.55;
      return { criterion, score, feedback: score >= 0.8 ? '已有可检查证据。' : '需要补充可运行成果、决策说明或外部验收证据。' };
    });
    const score = criterionScores.length ? criterionScores.reduce((sum, item) => sum + item.score, 0) / criterionScores.length : 0;
    const evaluation: ArtifactEvaluation = { id: randomUUID(), artifactId, goalId: artifact.goalId, score, passed: score >= 0.75, criterionScores, summary: score >= 0.75 ? '作品达到当前验收线，可进入迁移或外部评审。' : '作品仍处于草稿阶段，需要补齐证据。', evaluator: 'automated', createdAt: now() };
    this.database.transaction(() => {
      this.database.db.prepare(`INSERT INTO artifact_evaluations (id, artifact_id, goal_id, score, passed, criterion_scores_json, summary, evaluator, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(evaluation.id, evaluation.artifactId, evaluation.goalId, evaluation.score, evaluation.passed ? 1 : 0, JSON.stringify(evaluation.criterionScores), evaluation.summary, evaluation.evaluator, evaluation.createdAt);
      this.database.db.prepare('UPDATE artifacts SET status = ?, updated_at = ? WHERE id = ?').run(evaluation.passed ? 'accepted' : 'review', evaluation.createdAt, artifactId);
    });
    return evaluation;
  }

  recordModelUsage(input: {
    runId?: string;
    providerId: string;
    model: string;
    purpose: string;
    inputTokens?: number;
    outputTokens?: number;
    costCny?: number;
    latencyMs?: number;
  }): void {
    this.database.db.prepare(`
      INSERT INTO model_usage (id, run_id, provider_id, model, purpose, input_tokens, output_tokens, cost_cny, latency_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), input.runId ?? null, input.providerId, input.model, input.purpose, input.inputTokens ?? 0, input.outputTokens ?? 0, input.costCny ?? 0, input.latencyMs ?? 0, now());
  }

  listPaths(goalIds: string[]): LearningPath[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM learning_paths WHERE goal_id IN (${placeholders}) ORDER BY status = 'active' DESC, version DESC`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, goalId: row.goal_id, title: row.title, description: row.description, status: row.status, version: row.version,
      estimatedHours: row.estimated_hours, strategy: row.strategy, createdAt: row.created_at, updatedAt: row.updated_at
    }));
  }

  listMilestones(goalIds: string[]): PathMilestone[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM path_milestones WHERE goal_id IN (${placeholders}) ORDER BY path_id, order_index`).all(...goalIds) as any[]).map((row) => this.mapMilestone(row));
  }

  listResources(workspaceId: string, goalIds: string[]): LearningResource[] {
    if (goalIds.length === 0) return (this.database.db.prepare('SELECT * FROM learning_resources WHERE workspace_id = ? ORDER BY updated_at DESC').all(workspaceId) as any[]).map((row) => this.mapResource(row));
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM learning_resources WHERE workspace_id = ? AND (goal_id IS NULL OR goal_id IN (${placeholders})) ORDER BY updated_at DESC`).all(workspaceId, ...goalIds) as any[]).map((row) => this.mapResource(row));
  }

  listAssessments(goalIds: string[]): LearningAssessment[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM assessments WHERE goal_id IN (${placeholders}) ORDER BY updated_at DESC`).all(...goalIds) as any[]).map((row) => this.mapAssessment(row));
  }

  listAssessmentAttempts(goalIds: string[]): AssessmentAttempt[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM assessment_attempts WHERE goal_id IN (${placeholders}) ORDER BY submitted_at DESC LIMIT 200`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, assessmentId: row.assessment_id, goalId: row.goal_id, answer: row.answer, score: row.score, feedback: row.feedback, independence: row.independence, submittedAt: row.submitted_at
    }));
  }

  listArtifactEvaluations(goalIds: string[]): ArtifactEvaluation[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM artifact_evaluations WHERE goal_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, artifactId: row.artifact_id, goalId: row.goal_id, score: row.score, passed: Boolean(row.passed), criterionScores: parse(row.criterion_scores_json), summary: row.summary, evaluator: row.evaluator, createdAt: row.created_at
    }));
  }

  listConversations(workspaceId: string): GoalConversation[] {
    const rows = this.database.db.prepare(`
      SELECT c.*, COUNT(m.id) AS message_count,
             COALESCE(c.last_message_at, MAX(m.created_at)) AS resolved_last_message_at,
             (SELECT content FROM messages latest WHERE latest.conversation_id = c.id ORDER BY latest.created_at DESC LIMIT 1) AS last_message_preview
      FROM goal_conversations c LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.workspace_id = ?
      GROUP BY c.id
      ORDER BY CASE c.status WHEN 'active' THEN 0 ELSE 1 END, c.pinned DESC, COALESCE(c.last_opened_at, c.last_message_at, MAX(m.created_at), c.updated_at) DESC
    `).all(workspaceId) as any[];
    return rows.map((row) => this.mapConversation({ ...row, last_message_at: row.resolved_last_message_at ?? row.last_message_at }));
  }

  listMessages(workspaceId: string, perConversationLimit = 500): ChatMessage[] {
    const rows = this.database.db.prepare(`
      SELECT * FROM (
        SELECT messages.*, ROW_NUMBER() OVER (
          PARTITION BY COALESCE(conversation_id, id)
          ORDER BY created_at DESC
        ) AS conversation_rank
        FROM messages WHERE workspace_id = ?
      ) ranked
      WHERE conversation_rank <= ?
      ORDER BY created_at ASC
    `).all(workspaceId, perConversationLimit) as any[];
    return rows.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, goalId: row.goal_id ?? undefined, conversationId: row.conversation_id ?? undefined,
      runId: row.run_id ?? undefined, role: row.role, content: row.content, metadata: parse(row.metadata_json), createdAt: row.created_at
    }));
  }

  listAllMessages(workspaceId: string): ChatMessage[] {
    const rows = this.database.db.prepare('SELECT * FROM messages WHERE workspace_id = ? ORDER BY created_at ASC').all(workspaceId) as any[];
    return rows.map((row) => ({
      id: row.id, workspaceId: row.workspace_id, goalId: row.goal_id ?? undefined, conversationId: row.conversation_id ?? undefined,
      runId: row.run_id ?? undefined, role: row.role, content: row.content, metadata: parse(row.metadata_json), createdAt: row.created_at
    }));
  }

  listGoals(workspaceId: string): LearningGoal[] {
    return (this.database.db.prepare('SELECT * FROM goals WHERE workspace_id = ? ORDER BY updated_at DESC').all(workspaceId) as any[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      description: row.description,
      desiredOutcome: row.desired_outcome,
      currentLevel: row.current_level,
      targetLevel: row.target_level,
      status: row.status,
      targetDate: row.target_date ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  listTasks(goalIds: string[]): LearningTask[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM tasks WHERE goal_id IN (${placeholders}) ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END, priority DESC, created_at ASC`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, goalId: row.goal_id, title: row.title, description: row.description, status: row.status, stage: row.stage, priority: row.priority,
      dueAt: row.due_at ?? undefined, estimatedMinutes: row.estimated_minutes, createdAt: row.created_at, completedAt: row.completed_at ?? undefined, archived: Boolean(row.archived), updatedAt: row.updated_at
    }));
  }

  listKnowledgeNodes(goalIds: string[]): KnowledgeNode[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM knowledge_nodes WHERE goal_id IN (${placeholders}) ORDER BY mastery ASC, updated_at DESC`).all(...goalIds) as any[]).map((row) => this.mapKnowledgeNode(row));
  }

  listKnowledgeEdges(goalIds: string[]): KnowledgeEdge[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM knowledge_edges WHERE goal_id IN (${placeholders}) ORDER BY created_at ASC`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, goalId: row.goal_id, sourceNodeId: row.source_node_id, targetNodeId: row.target_node_id, type: row.type, weight: row.weight, createdAt: row.created_at
    }));
  }

  listMisconceptions(goalIds: string[]): MisconceptionRecord[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM misconceptions WHERE goal_id IN (${placeholders}) ORDER BY CASE status WHEN 'recurring' THEN 0 WHEN 'open' THEN 1 WHEN 'testing' THEN 2 ELSE 3 END, updated_at DESC`).all(...goalIds) as any[]).map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      knowledgeNodeId: row.knowledge_node_id ?? undefined,
      statement: row.statement,
      correction: row.correction,
      evidenceNeeded: row.evidence_needed,
      status: row.status,
      recurrenceCount: row.recurrence_count,
      nextCheckAt: row.next_check_at ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  listReviewItems(goalIds: string[]): ReviewItem[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM review_items WHERE goal_id IN (${placeholders}) ORDER BY suspended ASC, due_at ASC LIMIT 300`).all(...goalIds) as any[]).map((row) => this.mapReviewItem(row));
  }

  listHabits(goalIds: string[]): HabitRecipe[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM habit_recipes WHERE goal_id IN (${placeholders}) ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at DESC`).all(...goalIds) as any[]).map((row) => this.mapHabit(row));
  }

  listHabitCheckIns(goalIds: string[]): HabitCheckIn[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM habit_checkins WHERE goal_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 500`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, habitId: row.habit_id, goalId: row.goal_id, result: row.result,
      motivation: row.motivation, ability: row.ability, promptSeen: Boolean(row.prompt_seen), celebrated: Boolean(row.celebrated),
      durationSeconds: row.duration_seconds, note: row.note, localDate: row.local_date || row.created_at.slice(0, 10),
      timezoneOffsetMinutes: Number(row.timezone_offset_minutes ?? 0), createdAt: row.created_at
    }));
  }

  listLearningContracts(goalIds: string[]): LearningContract[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM learning_contracts WHERE goal_id IN (${placeholders}) ORDER BY updated_at DESC`).all(...goalIds) as any[]).map((row) => this.mapLearningContract(row));
  }

  listWeeklyReviews(goalIds: string[]): WeeklyLearningReview[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM weekly_learning_reviews WHERE goal_id IN (${placeholders}) ORDER BY period_end DESC, created_at DESC LIMIT 300`).all(...goalIds) as any[]).map((row) => ({
      id: row.id, goalId: row.goal_id, periodStart: row.period_start, periodEnd: row.period_end, plannedSessions: row.planned_sessions, completedSessions: row.completed_sessions, tinyActionsCompleted: row.tiny_actions_completed, evidenceCreated: row.evidence_created, reflection: row.reflection, coachSummary: row.coach_summary, nextFocus: row.next_focus, behaviorAdjustment: row.behavior_adjustment, createdAt: row.created_at
    }));
  }

  listSessions(workspaceId: string): LearningSession[] {
    return (this.database.db.prepare('SELECT * FROM learning_sessions WHERE workspace_id = ? ORDER BY started_at DESC LIMIT 100').all(workspaceId) as any[]).map((row) => this.mapSession(row));
  }

  listArtifacts(goalIds: string[]): LearningArtifact[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM artifacts WHERE goal_id IN (${placeholders}) ORDER BY updated_at DESC LIMIT 200`).all(...goalIds) as any[]).map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      taskId: row.task_id ?? undefined,
      kind: row.kind,
      title: row.title,
      description: row.description,
      content: row.content,
      filePath: row.file_path ?? undefined,
      status: row.status,
      rubric: parse(row.rubric_json),
      provenance: parse(row.provenance_json),
      archivedAt: row.archived_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  listEvidence(goalIds: string[]): LearningEvidence[] {
    const placeholders = goalIds.map(() => '?').join(',');
    return (this.database.db.prepare(`SELECT * FROM evidence WHERE goal_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`).all(...goalIds) as any[]).map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      taskId: row.task_id ?? undefined,
      kind: row.kind,
      title: row.title,
      content: row.content,
      independence: row.independence,
      retention: row.retention,
      transfer: row.transfer,
      evaluator: row.evaluator,
      provenance: parse(row.provenance_json ?? '{}'),
      createdAt: row.created_at
    }));
  }

  listRuns(workspaceId: string): AgentRun[] {
    return (this.database.db.prepare('SELECT * FROM agent_runs WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 50').all(workspaceId) as any[]).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      goalId: row.goal_id ?? undefined,
      conversationId: row.conversation_id ?? undefined,
      status: row.status,
      userInput: row.user_input,
      intent: row.intent,
      composition: parse(row.composition_json),
      plan: parse(row.plan_json),
      currentStep: row.current_step,
      costCny: row.cost_cny,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  listApprovals(): ApprovalRequest[] {
    return (this.database.db.prepare('SELECT * FROM approvals ORDER BY requested_at DESC LIMIT 50').all() as any[]).map((row) => ({
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      reason: row.reason,
      risk: row.risk,
      requestedAt: row.requested_at,
      resolvedAt: row.resolved_at ?? undefined,
      decision: row.decision ?? undefined
    }));
  }

  private mapMilestone(row: any): PathMilestone {
    return { id: row.id, pathId: row.path_id, goalId: row.goal_id, orderIndex: row.order_index, title: row.title, outcome: row.outcome,
      evidenceRequired: parse(row.evidence_required_json), estimatedMinutes: row.estimated_minutes, status: row.status,
      completedAt: row.completed_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private mapConversation(row: any): GoalConversation {
    return {
      id: row.id, workspaceId: row.workspace_id, goalId: row.goal_id ?? undefined, title: row.title, status: row.status,
      messageCount: Number(row.message_count ?? 0), pinned: Boolean(row.pinned), draft: row.draft_text ?? '',
      draftUpdatedAt: row.draft_updated_at ?? undefined, lastOpenedAt: row.last_opened_at ?? undefined,
      lastMessagePreview: row.last_message_preview ?? undefined, lastMessageAt: row.last_message_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  private mapResource(row: any): LearningResource {
    return { id: row.id, workspaceId: row.workspace_id, goalId: row.goal_id ?? undefined, title: row.title, kind: row.kind,
      sourcePath: row.source_path ?? undefined, sourceUrl: row.source_url ?? undefined, checksum: row.checksum, byteSize: row.byte_size,
      mimeType: row.mime_type, summary: row.summary, tags: parse(row.tags_json), chunkCount: row.chunk_count, archived: Boolean(row.archived), createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private mapAssessment(row: any): LearningAssessment {
    return { id: row.id, goalId: row.goal_id, title: row.title, kind: row.kind, status: row.status, instructions: row.instructions,
      questions: parse(row.questions_json), passScore: row.pass_score, archivedAt: row.archived_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private mapKnowledgeNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      goalId: row.goal_id,
      title: row.title,
      summary: row.summary,
      stage: row.stage,
      mastery: row.mastery,
      confidence: row.confidence,
      prerequisites: parse(row.prerequisites_json),
      misconceptions: parse(row.misconceptions_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapReviewItem(row: any): ReviewItem {
    return {
      id: row.id,
      goalId: row.goal_id,
      knowledgeNodeId: row.knowledge_node_id ?? undefined,
      prompt: row.prompt,
      answer: row.answer,
      dueAt: row.due_at,
      intervalDays: row.interval_days,
      easeFactor: row.ease_factor,
      repetitions: row.repetitions,
      lapses: row.lapses,
      lastRating: row.last_rating ?? undefined,
      lastReviewedAt: row.last_reviewed_at ?? undefined,
      suspended: Boolean(row.suspended),
      suspendedAt: row.suspended_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapLearningContract(row: any): LearningContract {
    return {
      id: row.id, goalId: row.goal_id, learnerName: row.learner_name, whyNow: row.why_now, successDefinition: row.success_definition,
      weeklyMinutes: row.weekly_minutes, sessionMinutes: row.session_minutes, preferredDays: parse(row.preferred_days_json ?? '[]'),
      preferredTime: row.preferred_time, coachingStyle: row.coaching_style, feedbackPreference: row.feedback_preference,
      challengeLevel: row.challenge_level, autonomyTarget: row.autonomy_target, minimumCommitment: row.minimum_commitment,
      reviewCadence: row.review_cadence, status: row.status, version: row.version, agreedAt: row.agreed_at ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  private mapHabit(row: any): HabitRecipe {
    return {
      id: row.id, goalId: row.goal_id, title: row.title, anchor: row.anchor, tinyBehavior: row.tiny_behavior,
      expansionBehavior: row.expansion_behavior, celebration: row.celebration, frequency: row.frequency,
      customDays: parse(row.custom_days_json ?? '[]'), minimumSeconds: row.minimum_seconds, preferredMinutes: row.preferred_minutes,
      status: row.status, streak: row.streak, bestStreak: row.best_streak, lastCheckInAt: row.last_check_in_at ?? undefined,
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  private mapSession(row: any): LearningSession {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      goalId: row.goal_id ?? undefined,
      mode: row.mode,
      objective: row.objective,
      status: row.status,
      plannedMinutes: row.planned_minutes,
      actualMinutes: row.actual_minutes,
      summary: row.summary,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}


function splitIntoChunks(content: string, maxChars: number, overlap: number): string[] {
  const clean = content.replace(/\r\n/gu, '\n').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const boundary = Math.max(clean.lastIndexOf('\n\n', end), clean.lastIndexOf('。', end), clean.lastIndexOf('\n', end));
      if (boundary > start + maxChars * 0.55) end = boundary + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function buildSearchTokens(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const tokens = new Set<string>();
  for (const word of normalized.split(' ')) {
    if (word.length > 1) tokens.add(word);
    const chineseRuns = word.match(/[\p{Script=Han}]+/gu) ?? [];
    for (const run of chineseRuns) {
      if (run.length <= 4) tokens.add(run);
      for (const size of [2, 3, 4]) {
        for (let index = 0; index <= run.length - size; index += 1) tokens.add(run.slice(index, index + size));
      }
    }
  }
  return [...tokens].sort((a, b) => b.length - a.length);
}

function summarizeText(value: string): string {
  const clean = value.replace(/\s+/gu, ' ').trim();
  return clean.length <= 320 ? clean : `${clean.slice(0, 317)}...`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) >= 0) { count += 1; index += needle.length; }
  return count;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
