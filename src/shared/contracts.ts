import { z } from 'zod';
import type { AppearancePreferences, AssessmentAttempt, DashboardSnapshot, HabitCheckIn, HabitRecipe, LearningContract, WeeklyLearningReview, LearningGoal, LearningResource, LearningTask, MaintenanceSnapshot, MisconceptionRecord, ModelProviderConfig, PathMilestone, ProviderTestResult, ReviewItem, ReviewRating, RunEvent } from './domain';


export const AppearancePreferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  fontScale: z.number().min(0.9).max(1.2),
  density: z.enum(['comfortable', 'compact']),
  readingWidth: z.enum(['narrow', 'standard', 'wide']),
  reduceMotion: z.boolean(),
  highContrast: z.boolean()
});
export type AppearancePreferencesInput = z.infer<typeof AppearancePreferencesSchema>;

export const SendMessageInputSchema = z.object({
  workspaceId: z.string().min(1),
  content: z.string().trim().min(1).max(20_000),
  goalId: z.string().optional(),
  composition: z
    .object({
      agent: z.enum(['A1', 'A2', 'A3', 'A4', 'A5']),
      control: z.enum(['B1', 'B2', 'B3', 'B4', 'B5']),
      adaptation: z.enum(['C1', 'C2', 'C3', 'C4', 'C5']),
      governance: z.enum(['D1', 'D2', 'D3', 'D4', 'D5'])
    })
    .optional()
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const ResolveApprovalInputSchema = z.object({ approvalId: z.string().min(1), decision: z.enum(['approved', 'rejected']) });
export type ResolveApprovalInput = z.infer<typeof ResolveApprovalInputSchema>;

export const ReviewRecordInputSchema = z.object({ itemId: z.string().min(1), rating: z.enum(['again', 'hard', 'good', 'easy']) });
export type ReviewRecordInput = z.infer<typeof ReviewRecordInputSchema>;

export const CompleteSessionInputSchema = z.object({ workspaceId: z.string().min(1), summary: z.string().trim().min(1).max(4000) });
export type CompleteSessionInput = z.infer<typeof CompleteSessionInputSchema>;

export const CompleteMilestoneInputSchema = z.object({ milestoneId: z.string().min(1) });
export type CompleteMilestoneInput = z.infer<typeof CompleteMilestoneInputSchema>;

export const SubmitAssessmentInputSchema = z.object({ assessmentId: z.string().min(1), answer: z.string().trim().min(1).max(20_000) });
export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentInputSchema>;

export const EvaluateArtifactInputSchema = z.object({ artifactId: z.string().min(1) });
export type EvaluateArtifactInput = z.infer<typeof EvaluateArtifactInputSchema>;

export const RenameGoalInputSchema = z.object({ goalId: z.string().min(1), title: z.string().trim().min(1).max(120) });
export type RenameGoalInput = z.infer<typeof RenameGoalInputSchema>;

export const ArchiveGoalInputSchema = z.object({ goalId: z.string().min(1), archived: z.boolean() });
export type ArchiveGoalInput = z.infer<typeof ArchiveGoalInputSchema>;

export const PinConversationInputSchema = z.object({ conversationId: z.string().min(1), pinned: z.boolean() });
export type PinConversationInput = z.infer<typeof PinConversationInputSchema>;

export const SaveConversationDraftInputSchema = z.object({ conversationId: z.string().min(1), draft: z.string().max(20_000) });
export type SaveConversationDraftInput = z.infer<typeof SaveConversationDraftInputSchema>;

export const TouchConversationInputSchema = z.object({ conversationId: z.string().min(1) });
export type TouchConversationInput = z.infer<typeof TouchConversationInputSchema>;

export const UpdateGoalInputSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000),
  desiredOutcome: z.string().trim().max(2000),
  currentLevel: z.number().int().min(1).max(9),
  targetLevel: z.number().int().min(1).max(9),
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  targetDate: z.string().datetime().optional().or(z.literal(''))
});
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;

export const UpdateTaskInputSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(['todo', 'doing', 'blocked', 'done', 'archived']).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
  dueAt: z.string().datetime().optional().or(z.literal(''))
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const UpdateMisconceptionInputSchema = z.object({ misconceptionId: z.string().min(1), status: z.enum(['open', 'testing', 'resolved', 'recurring']) });
export type UpdateMisconceptionInput = z.infer<typeof UpdateMisconceptionInputSchema>;

export const SuspendReviewInputSchema = z.object({ itemId: z.string().min(1), suspended: z.boolean() });
export type SuspendReviewInput = z.infer<typeof SuspendReviewInputSchema>;

export const ArchiveResourceInputSchema = z.object({ resourceId: z.string().min(1), archived: z.boolean() });
export type ArchiveResourceInput = z.infer<typeof ArchiveResourceInputSchema>;

export const ArchiveAssessmentInputSchema = z.object({ assessmentId: z.string().min(1), archived: z.boolean() });
export type ArchiveAssessmentInput = z.infer<typeof ArchiveAssessmentInputSchema>;

export const ArchiveArtifactInputSchema = z.object({ artifactId: z.string().min(1), archived: z.boolean() });
export const RestoreBackupInputSchema = z.object({ name: z.string().regex(/^self-study-(daily-\d{4}-\d{2}-\d{2}|manual-\d{8}T\d{6}Z)\.db$/u) });
export type ArchiveArtifactInput = z.infer<typeof ArchiveArtifactInputSchema>;
export type RestoreBackupInput = z.infer<typeof RestoreBackupInputSchema>;


export const CreateHabitInputSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  anchor: z.string().trim().min(1).max(240),
  tinyBehavior: z.string().trim().min(1).max(240),
  expansionBehavior: z.string().trim().max(500).default(''),
  celebration: z.string().trim().min(1).max(160),
  frequency: z.enum(['daily', 'weekdays', 'weekly', 'custom']).default('daily'),
  customDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  minimumSeconds: z.number().int().min(5).max(600).default(30),
  preferredMinutes: z.number().int().min(1).max(180).default(10)
});
export type CreateHabitInput = z.infer<typeof CreateHabitInputSchema>;

export const UpdateHabitInputSchema = z.object({
  habitId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  anchor: z.string().trim().min(1).max(240).optional(),
  tinyBehavior: z.string().trim().min(1).max(240).optional(),
  expansionBehavior: z.string().trim().max(500).optional(),
  celebration: z.string().trim().min(1).max(160).optional(),
  frequency: z.enum(['daily', 'weekdays', 'weekly', 'custom']).optional(),
  customDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  minimumSeconds: z.number().int().min(5).max(600).optional(),
  preferredMinutes: z.number().int().min(1).max(180).optional(),
  status: z.enum(['active', 'paused', 'retired']).optional()
});
export type UpdateHabitInput = z.infer<typeof UpdateHabitInputSchema>;

export const HabitCheckInInputSchema = z.object({
  habitId: z.string().min(1),
  result: z.enum(['done', 'partial', 'skipped']),
  motivation: z.number().int().min(1).max(5),
  ability: z.number().int().min(1).max(5),
  promptSeen: z.boolean(),
  celebrated: z.boolean(),
  durationSeconds: z.number().int().min(0).max(21_600),
  note: z.string().trim().max(1000).default('')
});
export type HabitCheckInInput = z.infer<typeof HabitCheckInInputSchema>;


export const UpsertLearningContractInputSchema = z.object({
  goalId: z.string().min(1),
  learnerName: z.string().trim().min(1).max(80),
  whyNow: z.string().trim().min(1).max(2000),
  successDefinition: z.string().trim().min(1).max(2000),
  weeklyMinutes: z.number().int().min(15).max(10_080),
  sessionMinutes: z.number().int().min(5).max(240),
  preferredDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  preferredTime: z.string().trim().max(80).default(''),
  coachingStyle: z.enum(['socratic', 'direct', 'balanced', 'project']),
  feedbackPreference: z.enum(['gentle', 'direct', 'evidence-first']),
  challengeLevel: z.number().int().min(1).max(5),
  autonomyTarget: z.number().min(0.2).max(1),
  minimumCommitment: z.string().trim().min(1).max(500),
  reviewCadence: z.enum(['weekly', 'biweekly', 'monthly']),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('active'),
  agree: z.boolean().default(true)
});
export type UpsertLearningContractInput = z.infer<typeof UpsertLearningContractInputSchema>;

export const GenerateWeeklyReviewInputSchema = z.object({
  goalId: z.string().min(1),
  reflection: z.string().trim().max(4000).default('')
});
export type GenerateWeeklyReviewInput = z.infer<typeof GenerateWeeklyReviewInputSchema>;

export const SearchLibraryInputSchema = z.object({ query: z.string().trim().min(1).max(500), goalId: z.string().optional(), limit: z.number().int().min(1).max(20).default(8) });
export type SearchLibraryInput = z.infer<typeof SearchLibraryInputSchema>;

const providerBaseUrlSchema = z.string().max(500).refine((value: string) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(url.hostname);
  } catch {
    return false;
  }
}, 'Base URL必须使用HTTPS；本地模型仅允许localhost/127.0.0.1/::1/host.docker.internal使用HTTP。');

const documentationUrlSchema = z.string().max(500).refine((value: string) => {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}, '文档地址必须使用HTTPS。');

const environmentKeySchema = z.string().max(120).refine(
  (value: string) => !value || /^[A-Z][A-Z0-9_]*$/u.test(value),
  '环境变量名只能包含大写字母、数字和下划线。'
);

const capabilitiesSchema = z.object({
  chat: z.boolean(),
  reasoning: z.boolean(),
  toolCalling: z.boolean(),
  streaming: z.boolean(),
  vision: z.boolean(),
  longContext: z.boolean(),
  structuredOutput: z.boolean()
});

export const ProviderInputSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['mock', 'deepseek', 'minimax', 'kimi', 'qwen', 'step', 'glm', 'openai', 'anthropic', 'gemini', 'openai-compatible']),
  protocol: z.enum(['mock', 'openai-chat', 'openai-responses', 'anthropic-messages', 'gemini-native']),
  name: z.string().min(1).max(80),
  model: z.string().min(1).max(160),
  models: z.array(z.string().min(1).max(160)).max(32).default([]),
  baseUrl: providerBaseUrlSchema.default(''),
  envKey: environmentKeySchema.default(''),
  documentationUrl: documentationUrlSchema.default(''),
  capabilities: capabilitiesSchema,
  apiKey: z.string().max(20_000).optional(),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  priority: z.number().int().min(0).max(10_000).default(100),
  timeoutMs: z.number().int().min(5_000).max(600_000).default(120_000)
});
export type ProviderInput = z.infer<typeof ProviderInputSchema>;

export const ProviderToggleInputSchema = z.object({ id: z.string().min(1), enabled: z.boolean() });
export type ProviderToggleInput = z.infer<typeof ProviderToggleInputSchema>;

export interface DesktopApi {
  dashboard: { get(): Promise<DashboardSnapshot> };
  agent: {
    send(input: SendMessageInput): Promise<{ runId: string }>;
    pause(runId: string): Promise<void>;
    resume(runId: string): Promise<void>;
    cancel(runId: string): Promise<void>;
    resolveApproval(input: ResolveApprovalInput): Promise<void>;
  };
  learning: {
    recordReview(itemId: string, rating: ReviewRating): Promise<void>;
    completeTask(taskId: string): Promise<void>;
    completeSession(workspaceId: string, summary: string): Promise<void>;
    completeMilestone(milestoneId: string): Promise<PathMilestone>;
    submitAssessment(assessmentId: string, answer: string): Promise<AssessmentAttempt>;
    evaluateArtifact(artifactId: string): Promise<void>;
    updateGoal(input: UpdateGoalInput): Promise<LearningGoal>;
    updateTask(input: UpdateTaskInput): Promise<LearningTask>;
    updateMisconception(input: UpdateMisconceptionInput): Promise<MisconceptionRecord>;
    suspendReview(input: SuspendReviewInput): Promise<ReviewItem>;
    archiveResource(input: ArchiveResourceInput): Promise<LearningResource>;
    archiveAssessment(input: ArchiveAssessmentInput): Promise<void>;
    archiveArtifact(input: ArchiveArtifactInput): Promise<void>;
    createGoal(input: { title: string }): Promise<LearningGoal>;
    createHabit(input: CreateHabitInput): Promise<HabitRecipe>;
    updateHabit(input: UpdateHabitInput): Promise<HabitRecipe>;
    checkInHabit(input: HabitCheckInInput): Promise<HabitCheckIn>;
    upsertContract(input: UpsertLearningContractInput): Promise<LearningContract>;
    generateWeeklyReview(input: GenerateWeeklyReviewInput): Promise<WeeklyLearningReview>;
  };
  conversation: {
    renameGoal(goalId: string, title: string): Promise<void>;
    archiveGoal(goalId: string, archived: boolean): Promise<void>;
    pin(conversationId: string, pinned: boolean): Promise<void>;
    saveDraft(conversationId: string, draft: string): Promise<void>;
    touch(conversationId: string): Promise<void>;
  };
  library: {
    importFiles(goalId?: string): Promise<{ cancelled: boolean; imported: LearningResource[] }>;
    search(query: string, goalId?: string): Promise<Array<{ resourceId: string; resourceTitle: string; chunkId: string; content: string; score: number }>>;
  };
  provider: {
    list(): Promise<ModelProviderConfig[]>;
    save(input: ProviderInput): Promise<ModelProviderConfig>;
    remove(id: string): Promise<void>;
    test(id: string): Promise<ProviderTestResult>;
    setDefault(id: string): Promise<ModelProviderConfig>;
    toggle(input: ProviderToggleInput): Promise<ModelProviderConfig>;
  };
  appearance: { save(input: AppearancePreferences): Promise<AppearancePreferences> };
  workspace: { export(payload: { format: string; goalName?: string; goalId?: string }): Promise<{ cancelled: boolean; path?: string }> };
  maintenance: { snapshot(): Promise<MaintenanceSnapshot>; createBackup(): Promise<MaintenanceSnapshot>; restoreBackup(name: string): Promise<void> };
  events: { subscribe(listener: (event: RunEvent) => void): () => void };
}

export const IPC = {
  DASHBOARD_GET: 'dashboard:get',
  AGENT_SEND: 'agent:send',
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_CANCEL: 'agent:cancel',
  APPROVAL_RESOLVE: 'approval:resolve',
  LEARNING_REVIEW_RECORD: 'learning:review-record',
  LEARNING_TASK_COMPLETE: 'learning:task-complete',
  LEARNING_SESSION_COMPLETE: 'learning:session-complete',
  LEARNING_MILESTONE_COMPLETE: 'learning:milestone-complete',
  LEARNING_ASSESSMENT_SUBMIT: 'learning:assessment-submit',
  LEARNING_ARTIFACT_EVALUATE: 'learning:artifact-evaluate',
  LEARNING_GOAL_UPDATE: 'learning:goal-update',
  LEARNING_TASK_UPDATE: 'learning:task-update',
  LEARNING_MISCONCEPTION_UPDATE: 'learning:misconception-update',
  LEARNING_REVIEW_SUSPEND: 'learning:review-suspend',
  LEARNING_RESOURCE_ARCHIVE: 'learning:resource-archive',
  LEARNING_ASSESSMENT_ARCHIVE: 'learning:assessment-archive',
  LEARNING_ARTIFACT_ARCHIVE: 'learning:artifact-archive',
  LEARNING_GOAL_CREATE: 'learning:goal-create',
  LEARNING_HABIT_CREATE: 'learning:habit-create',
  LEARNING_HABIT_UPDATE: 'learning:habit-update',
  LEARNING_HABIT_CHECKIN: 'learning:habit-checkin',
  LEARNING_CONTRACT_UPSERT: 'learning:contract-upsert',
  LEARNING_WEEKLY_REVIEW: 'learning:weekly-review',
  CONVERSATION_RENAME_GOAL: 'conversation:rename-goal',
  CONVERSATION_ARCHIVE_GOAL: 'conversation:archive-goal',
  CONVERSATION_PIN: 'conversation:pin',
  CONVERSATION_SAVE_DRAFT: 'conversation:save-draft',
  CONVERSATION_TOUCH: 'conversation:touch',
  LIBRARY_IMPORT_FILES: 'library:import-files',
  LIBRARY_SEARCH: 'library:search',
  PROVIDER_LIST: 'provider:list',
  PROVIDER_SAVE: 'provider:save',
  PROVIDER_REMOVE: 'provider:remove',
  PROVIDER_TEST: 'provider:test',
  PROVIDER_SET_DEFAULT: 'provider:set-default',
  PROVIDER_TOGGLE: 'provider:toggle',
  APPEARANCE_SAVE: 'appearance:save',
  WORKSPACE_EXPORT: 'workspace:export',
  MAINTENANCE_SNAPSHOT: 'maintenance:snapshot',
  MAINTENANCE_BACKUP_CREATE: 'maintenance:backup-create',
  MAINTENANCE_BACKUP_RESTORE: 'maintenance:backup-restore',
  EVENT: 'self-study:event'
} as const;
