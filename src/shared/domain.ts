export type Id = string;
export type ISODateTime = string;
export type ExportFormat = 'json' | 'markdown' | 'html' | 'text';
export interface ExportPayload { format: ExportFormat; goalName?: string }

export type AgentLevel = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
export type ControlLevel = 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
export type AdaptationLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export type GovernanceLevel = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';

export interface CHARTProfile {
  context: {
    memoryDepth: 'session' | 'goal' | 'workspace' | 'lifelong';
    includeEvidence: boolean;
    includeMisconceptions: boolean;
    maxTokens: number;
  };
  harness: {
    approvalMode: 'never' | 'risk-based' | 'always';
    maxSteps: number;
    maxCostCny: number;
    allowExternalNetwork: boolean;
    allowFileWrite: boolean;
    allowCodeExecution: boolean;
  };
  alignment: {
    primaryOutcome: 'understanding' | 'independence' | 'retention' | 'transfer' | 'creation';
    requireLearnerAttempt: boolean;
    requireEvidence: boolean;
    antiDependency: boolean;
  };
  runtime: {
    tools: RuntimeToolName[];
    checkpointEverySteps: number;
    timeoutMs: number;
  };
  traceability: {
    level: 'minimal' | 'standard' | 'full';
    retainPrompt: boolean;
    retainToolIO: boolean;
    retainModelResponse: boolean;
  };
}

export interface AgentComposition {
  agent: AgentLevel;
  control: ControlLevel;
  adaptation: AdaptationLevel;
  governance: GovernanceLevel;
  chart: CHARTProfile;
}

export type RuntimeToolName =
  | 'knowledge.search'
  | 'knowledge.create'
  | 'knowledge.link'
  | 'goal.create'
  | 'goal.update'
  | 'task.create'
  | 'task.complete'
  | 'session.start'
  | 'session.complete'
  | 'review.schedule'
  | 'review.record'
  | 'evidence.create'
  | 'artifact.create'
  | 'reflection.create'
  | 'misconception.create'
  | 'skill.run'
  | 'checkpoint.create'
  | 'workspace.export'
  | 'path.compile'
  | 'milestone.complete'
  | 'resource.search'
  | 'assessment.create'
  | 'assessment.submit'
  | 'artifact.evaluate'
  | 'behavior.diagnose'
  | 'habit.design'
  | 'habit.checkin'
  | 'contract.upsert'
  | 'review.weekly';

export type LearningStage =
  | 'curiosity'
  | 'understanding'
  | 'mapping'
  | 'practice'
  | 'transfer'
  | 'verification'
  | 'research'
  | 'creation'
  | 'system-building';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type ConversationStatus = 'active' | 'archived';
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'archived';
export type RunStatus = 'queued' | 'planning' | 'awaiting-approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type EvidenceKind = 'explanation' | 'exercise' | 'project' | 'delayed-recall' | 'transfer' | 'peer-review';
export type SessionMode = 'focus' | 'review' | 'project' | 'research' | 'reflection';
export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type ArtifactKind = 'note' | 'code' | 'essay' | 'experiment' | 'project' | 'presentation' | 'dataset' | 'other';
export type ArtifactStatus = 'draft' | 'review' | 'accepted' | 'archived';
export type MisconceptionStatus = 'open' | 'testing' | 'resolved' | 'recurring';
export type KnowledgeEdgeType = 'prerequisite' | 'related' | 'contrasts' | 'applies-to' | 'evidence-for';
export type SkillCategory = 'teach' | 'map' | 'practice' | 'verify' | 'review' | 'project' | 'research' | 'reflect' | 'path' | 'library' | 'assess' | 'habit' | 'coach';
export type LearningPathStatus = 'draft' | 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'locked' | 'available' | 'doing' | 'completed';
export type ResourceKind = 'text' | 'markdown' | 'json' | 'csv' | 'web-clipping' | 'other';
export type AssessmentKind = 'diagnostic' | 'formative' | 'summative' | 'transfer';
export type AssessmentStatus = 'draft' | 'ready' | 'completed' | 'archived';
export type CoachingStyle = 'socratic' | 'direct' | 'balanced' | 'project';
export type FeedbackPreference = 'gentle' | 'direct' | 'evidence-first';
export type ReviewCadence = 'weekly' | 'biweekly' | 'monthly';
export type LearningContractStatus = 'draft' | 'active' | 'paused' | 'completed';

export type AppearanceTheme = 'system' | 'light' | 'dark';
export type InterfaceDensity = 'comfortable' | 'compact';
export type ReadingWidth = 'narrow' | 'standard' | 'wide';

export interface AppearancePreferences {
  theme: AppearanceTheme;
  fontScale: number;
  density: InterfaceDensity;
  readingWidth: ReadingWidth;
  reduceMotion: boolean;
  highContrast: boolean;
}

export interface Workspace {
  id: Id;
  name: string;
  description: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface GoalConversation {
  id: Id;
  workspaceId: Id;
  goalId?: Id;
  title: string;
  status: ConversationStatus;
  messageCount: number;
  pinned: boolean;
  draft: string;
  draftUpdatedAt?: ISODateTime;
  lastOpenedAt?: ISODateTime;
  lastMessagePreview?: string;
  lastMessageAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LearningGoal {
  id: Id;
  workspaceId: Id;
  title: string;
  description: string;
  desiredOutcome: string;
  currentLevel: number;
  targetLevel: number;
  status: GoalStatus;
  targetDate?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LearningTask {
  id: Id;
  goalId: Id;
  title: string;
  description: string;
  status: TaskStatus;
  stage: LearningStage;
  priority: number;
  dueAt?: ISODateTime;
  estimatedMinutes: number;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
  archived: boolean;
  updatedAt: ISODateTime;
}

export interface KnowledgeNode {
  id: Id;
  goalId: Id;
  title: string;
  summary: string;
  stage: LearningStage;
  mastery: number;
  confidence: number;
  prerequisites: Id[];
  misconceptions: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface KnowledgeEdge {
  id: Id;
  goalId: Id;
  sourceNodeId: Id;
  targetNodeId: Id;
  type: KnowledgeEdgeType;
  weight: number;
  createdAt: ISODateTime;
}

export interface MisconceptionRecord {
  id: Id;
  goalId: Id;
  knowledgeNodeId?: Id;
  statement: string;
  correction: string;
  evidenceNeeded: string;
  status: MisconceptionStatus;
  recurrenceCount: number;
  nextCheckAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReviewItem {
  id: Id;
  goalId: Id;
  knowledgeNodeId?: Id;
  prompt: string;
  answer: string;
  dueAt: ISODateTime;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastRating?: ReviewRating;
  lastReviewedAt?: ISODateTime;
  suspended: boolean;
  suspendedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}


export type HabitStatus = 'active' | 'paused' | 'retired';
export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'custom';
export type HabitCheckInResult = 'done' | 'partial' | 'skipped';

export interface HabitRecipe {
  id: Id;
  goalId: Id;
  title: string;
  anchor: string;
  tinyBehavior: string;
  expansionBehavior: string;
  celebration: string;
  frequency: HabitFrequency;
  customDays: number[];
  minimumSeconds: number;
  preferredMinutes: number;
  status: HabitStatus;
  streak: number;
  bestStreak: number;
  lastCheckInAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface HabitCheckIn {
  id: Id;
  habitId: Id;
  goalId: Id;
  result: HabitCheckInResult;
  motivation: number;
  ability: number;
  promptSeen: boolean;
  celebrated: boolean;
  durationSeconds: number;
  note: string;
  localDate: string;
  timezoneOffsetMinutes: number;
  createdAt: ISODateTime;
}

export interface BehaviorState {
  motivation: number;
  ability: number;
  promptReliability: number;
  successRate: number;
  activeHabitCount: number;
  todayCompleted: number;
  suggestedTinyAction: string;
  diagnosis: string[];
}


export interface LearningContract {
  id: Id;
  goalId: Id;
  learnerName: string;
  whyNow: string;
  successDefinition: string;
  weeklyMinutes: number;
  sessionMinutes: number;
  preferredDays: number[];
  preferredTime: string;
  coachingStyle: CoachingStyle;
  feedbackPreference: FeedbackPreference;
  challengeLevel: number;
  autonomyTarget: number;
  minimumCommitment: string;
  reviewCadence: ReviewCadence;
  status: LearningContractStatus;
  version: number;
  agreedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WeeklyLearningReview {
  id: Id;
  goalId: Id;
  periodStart: string;
  periodEnd: string;
  plannedSessions: number;
  completedSessions: number;
  tinyActionsCompleted: number;
  evidenceCreated: number;
  reflection: string;
  coachSummary: string;
  nextFocus: string;
  behaviorAdjustment: string;
  createdAt: ISODateTime;
}

export interface OneToOneState {
  contractReady: boolean;
  contractStatus?: LearningContractStatus;
  weeklyCapacityMinutes: number;
  plannedSessionMinutes: number;
  autonomyTarget: number;
  currentAutonomy: number;
  latestReviewAt?: ISODateTime;
  nextReviewDue?: string;
  coachingSummary: string;
}

export interface LearningSession {
  id: Id;
  workspaceId: Id;
  goalId?: Id;
  mode: SessionMode;
  objective: string;
  status: SessionStatus;
  plannedMinutes: number;
  actualMinutes: number;
  summary: string;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LearningPath {
  id: Id;
  goalId: Id;
  title: string;
  description: string;
  status: LearningPathStatus;
  version: number;
  estimatedHours: number;
  strategy: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PathMilestone {
  id: Id;
  pathId: Id;
  goalId: Id;
  orderIndex: number;
  title: string;
  outcome: string;
  evidenceRequired: string[];
  estimatedMinutes: number;
  status: MilestoneStatus;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LearningResource {
  id: Id;
  workspaceId: Id;
  goalId?: Id;
  title: string;
  kind: ResourceKind;
  sourcePath?: string;
  sourceUrl?: string;
  checksum: string;
  byteSize: number;
  mimeType: string;
  summary: string;
  tags: string[];
  chunkCount: number;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ResourceSearchHit {
  resourceId: Id;
  resourceTitle: string;
  chunkId: Id;
  content: string;
  score: number;
}

export interface AssessmentQuestion {
  id: Id;
  prompt: string;
  expectedElements: string[];
  maxScore: number;
}

export interface LearningAssessment {
  id: Id;
  goalId: Id;
  title: string;
  kind: AssessmentKind;
  status: AssessmentStatus;
  instructions: string;
  questions: AssessmentQuestion[];
  passScore: number;
  archivedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AssessmentAttempt {
  id: Id;
  assessmentId: Id;
  goalId: Id;
  answer: string;
  score: number;
  feedback: string;
  independence: number;
  submittedAt: ISODateTime;
}

export interface ArtifactEvaluation {
  id: Id;
  artifactId: Id;
  goalId: Id;
  score: number;
  passed: boolean;
  criterionScores: Array<{ criterion: string; score: number; feedback: string }>;
  summary: string;
  evaluator: 'ai' | 'human' | 'automated';
  createdAt: ISODateTime;
}

export interface LearningArtifact {
  id: Id;
  goalId: Id;
  taskId?: Id;
  kind: ArtifactKind;
  title: string;
  description: string;
  content: string;
  filePath?: string;
  status: ArtifactStatus;
  rubric: string[];
  provenance: Record<string, unknown>;
  archivedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AgentSkill {
  id: Id;
  name: string;
  description: string;
  category: SkillCategory;
  minAgentLevel: AgentLevel;
  requiredTools: RuntimeToolName[];
  promptTemplate: string;
  enabled: boolean;
  version: string;
}

export interface LearningEvidence {
  id: Id;
  goalId: Id;
  taskId?: Id;
  kind: EvidenceKind;
  title: string;
  content: string;
  independence: number;
  retention: number;
  transfer: number;
  evaluator: 'self' | 'ai' | 'human' | 'automated';
  provenance?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface Reflection {
  id: Id;
  goalId: Id;
  content: string;
  whatWorked: string;
  whatFailed: string;
  nextAction: string;
  createdAt: ISODateTime;
}

export interface ChatMessage {
  id: Id;
  workspaceId: Id;
  goalId?: Id;
  conversationId?: Id;
  runId?: Id;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
}

export interface AgentRun {
  id: Id;
  workspaceId: Id;
  goalId?: Id;
  conversationId?: Id;
  status: RunStatus;
  userInput: string;
  intent: IntentName;
  composition: AgentComposition;
  plan: AgentPlan;
  currentStep: number;
  costCny: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  error?: string;
}

export type IntentName =
  | 'create-goal'
  | 'plan-learning'
  | 'start-session'
  | 'explain'
  | 'practice'
  | 'review'
  | 'verify'
  | 'create-artifact'
  | 'show-knowledge'
  | 'reflect'
  | 'show-progress'
  | 'compile-path'
  | 'import-resource'
  | 'search-library'
  | 'take-assessment'
  | 'evaluate-artifact'
  | 'design-habit'
  | 'habit-checkin'
  | 'behavior-diagnose'
  | 'setup-contract'
  | 'weekly-review'
  | 'general';

export interface AgentPlanStep {
  id: Id;
  title: string;
  description: string;
  tool?: RuntimeToolName;
  requiresApproval: boolean;
  risk: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
}

export interface AgentPlan {
  objective: string;
  rationale: string;
  steps: AgentPlanStep[];
  expectedEvidence: string[];
  stopConditions: string[];
}

export interface ApprovalRequest {
  id: Id;
  runId: Id;
  stepId: Id;
  reason: string;
  risk: 'medium' | 'high';
  requestedAt: ISODateTime;
  resolvedAt?: ISODateTime;
  decision?: 'approved' | 'rejected';
}

export type ProviderKind =
  | 'mock'
  | 'deepseek'
  | 'minimax'
  | 'kimi'
  | 'qwen'
  | 'step'
  | 'glm'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openai-compatible';

export type ProviderProtocol = 'mock' | 'openai-chat' | 'openai-responses' | 'anthropic-messages' | 'gemini-native';
export type ProviderHealthStatus = 'untested' | 'healthy' | 'failed';

export interface ModelProviderCapabilities {
  chat: boolean;
  reasoning: boolean;
  toolCalling: boolean;
  streaming: boolean;
  vision: boolean;
  longContext: boolean;
  structuredOutput: boolean;
}

export interface ModelProviderConfig {
  id: Id;
  kind: ProviderKind;
  name: string;
  protocol: ProviderProtocol;
  model: string;
  models: string[];
  baseUrl?: string;
  envKey?: string;
  documentationUrl?: string;
  capabilities: ModelProviderCapabilities;
  apiKeyStored: boolean;
  apiKeySource: 'none' | 'secure-storage' | 'environment' | 'not-required';
  enabled: boolean;
  isDefault: boolean;
  builtIn: boolean;
  priority: number;
  timeoutMs: number;
  lastTestStatus: ProviderHealthStatus;
  lastTestAt?: ISODateTime;
  lastLatencyMs?: number;
  lastError?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProviderTestResult {
  providerId: Id;
  status: 'healthy' | 'failed';
  latencyMs: number;
  model: string;
  message: string;
  testedAt: ISODateTime;
}

export interface LearnerState {
  stage: LearningStage;
  momentum: 'stalled' | 'starting' | 'steady' | 'accelerating';
  cognitiveLoad: 'low' | 'balanced' | 'high';
  independenceScore: number;
  retentionRisk: number;
  openMisconceptions: number;
  dueReviews: number;
  nextBestAction: string;
  reasons: string[];
}

export interface DailyBrief {
  headline: string;
  summary: string;
  nextAction: string;
  estimatedMinutes: number;
  dueReviewCount: number;
  activeSessionId?: Id;
}

export interface DashboardSnapshot {
  workspace: Workspace;
  appearance: AppearancePreferences;
  goals: LearningGoal[];
  conversations: GoalConversation[];
  tasks: LearningTask[];
  knowledgeNodes: KnowledgeNode[];
  knowledgeEdges: KnowledgeEdge[];
  misconceptions: MisconceptionRecord[];
  reviewItems: ReviewItem[];
  habits: HabitRecipe[];
  habitCheckIns: HabitCheckIn[];
  contracts: LearningContract[];
  weeklyReviews: WeeklyLearningReview[];
  oneToOneStates: Record<Id, OneToOneState>;
  behaviorState: BehaviorState;
  behaviorStates: Record<Id, BehaviorState>;
  sessions: LearningSession[];
  artifacts: LearningArtifact[];
  paths: LearningPath[];
  milestones: PathMilestone[];
  resources: LearningResource[];
  assessments: LearningAssessment[];
  assessmentAttempts: AssessmentAttempt[];
  artifactEvaluations: ArtifactEvaluation[];
  skills: AgentSkill[];
  evidence: LearningEvidence[];
  messages: ChatMessage[];
  activeRuns: AgentRun[];
  approvals: ApprovalRequest[];
  providers: ModelProviderConfig[];
  learnerState: LearnerState;
  dailyBrief: DailyBrief;
  maintenance: MaintenanceSnapshot;
  metrics: {
    activeGoals: number;
    completedTasks: number;
    evidenceCount: number;
    independenceScore: number;
    dueReviews: number;
    openMisconceptions: number;
    artifactCount: number;
    focusMinutes: number;
    modelCostCny: number;
    activePaths: number;
    completedMilestones: number;
    resourceCount: number;
    assessmentAverage: number;
    activeHabits: number;
    habitSuccessRate: number;
    activeContracts: number;
    weeklyReviews: number;
  };
}


export interface BackupEntry {
  name: string;
  sizeBytes: number;
  createdAt: ISODateTime;
  kind: 'daily' | 'manual';
}

export interface MaintenanceSnapshot {
  schemaVersion: number;
  databaseSizeBytes: number;
  integrity: 'ok' | 'warning';
  integrityMessage: string;
  backupCount: number;
  lastBackupAt?: ISODateTime;
  backups: BackupEntry[];
  tableCounts: Record<string, number>;
  generatedAt: ISODateTime;
}

export interface RunEvent {
  type: 'run.updated' | 'message.created' | 'approval.created' | 'dashboard.changed';
  runId?: Id;
  payload: unknown;
  at: ISODateTime;
}
