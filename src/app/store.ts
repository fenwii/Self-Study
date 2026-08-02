import { create } from 'zustand';
import type {
  AdaptationLevel,
  AppearancePreferences,
  AgentLevel,
  ControlLevel,
  DashboardSnapshot,
  GovernanceLevel,
  LearningGoal,
  ModelProviderConfig,
  ProviderTestResult,
  ReviewRating,
  ResourceSearchHit,
  HabitCheckIn,
  HabitRecipe,
  LearningContract,
  WeeklyLearningReview
} from '../shared/domain';
import type { UpsertLearningContractInput, GenerateWeeklyReviewInput, ArchiveArtifactInput, ArchiveAssessmentInput, ArchiveResourceInput, CreateHabitInput, HabitCheckInInput, ProviderInput, SuspendReviewInput, UpdateGoalInput, UpdateHabitInput, UpdateMisconceptionInput, UpdateTaskInput } from '../shared/contracts';

interface CompositionState { agent: AgentLevel; control: ControlLevel; adaptation: AdaptationLevel; governance: GovernanceLevel }
type InspectorTab = 'contract' | 'path' | 'tasks' | 'habits' | 'focus' | 'review' | 'knowledge' | 'library' | 'assessments' | 'artifacts' | 'evidence' | 'runs';

interface AppState {
  dashboard?: DashboardSnapshot;
  selectedGoalId?: string;
  newGoalMode: boolean;
  pendingNewGoalRunId?: string;
  loading: boolean;
  sending: boolean;
  settingsOpen: boolean;
  inspectorOpen: boolean;
  focusMode: boolean;
  archiveVisible: boolean;
  inspectorTab: InspectorTab;
  composition: CompositionState;
  error?: string;
  lastSentContent?: string;
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  send(content: string): Promise<void>;
  retryLastMessage(): Promise<void>;
  clearError(): void;
  selectGoal(id?: string): void;
  setComposition(patch: Partial<CompositionState>): void;
  setInspectorTab(tab: InspectorTab): void;
  setInspectorOpen(open: boolean): void;
  setFocusMode(open: boolean): void;
  setArchiveVisible(visible: boolean): void;
  setSettingsOpen(open: boolean): void;
  saveAppearance(preferences: AppearancePreferences): Promise<void>;
  renameGoal(goalId: string, title: string): Promise<void>;
  archiveGoal(goalId: string, archived: boolean): Promise<void>;
  pinConversation(conversationId: string, pinned: boolean): Promise<void>;
  saveDraft(conversationId: string, draft: string): Promise<void>;
  pause(runId: string): Promise<void>;
  resume(runId: string): Promise<void>;
  cancel(runId: string): Promise<void>;
  resolveApproval(approvalId: string, decision: 'approved' | 'rejected'): Promise<void>;
  recordReview(itemId: string, rating: ReviewRating): Promise<void>;
  completeTask(taskId: string): Promise<void>;
  completeSession(summary: string): Promise<void>;
  completeMilestone(milestoneId: string): Promise<void>;
  submitAssessment(assessmentId: string, answer: string): Promise<void>;
  evaluateArtifact(artifactId: string): Promise<void>;
  updateGoal(input: UpdateGoalInput): Promise<void>;
  updateTask(input: UpdateTaskInput): Promise<void>;
  updateMisconception(input: UpdateMisconceptionInput): Promise<void>;
  suspendReview(input: SuspendReviewInput): Promise<void>;
  archiveResource(input: ArchiveResourceInput): Promise<void>;
  archiveAssessment(input: ArchiveAssessmentInput): Promise<void>;
  archiveArtifact(input: ArchiveArtifactInput): Promise<void>;
  createGoal(title: string): Promise<LearningGoal>;
  createHabit(input: CreateHabitInput): Promise<HabitRecipe>;
  updateHabit(input: UpdateHabitInput): Promise<HabitRecipe>;
  checkInHabit(input: HabitCheckInInput): Promise<HabitCheckIn>;
  upsertContract(input: UpsertLearningContractInput): Promise<LearningContract>;
  generateWeeklyReview(input: GenerateWeeklyReviewInput): Promise<WeeklyLearningReview>;
  createBackup(): Promise<void>;
  restoreBackup(name: string): Promise<void>;
  importResources(): Promise<void>;
  searchLibrary(query: string): Promise<ResourceSearchHit[]>;
  saveProvider(input: ProviderInput): Promise<ModelProviderConfig>;
  removeProvider(id: string): Promise<void>;
  testProvider(id: string): Promise<ProviderTestResult>;
  setDefaultProvider(id: string): Promise<void>;
  toggleProvider(id: string, enabled: boolean): Promise<void>;
  exportWorkspace(payload: { format: string; goalName?: string; goalId?: string }): Promise<void>;
}

let unsubscribeEvents: (() => void) | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>((set, get) => ({
  loading: false,
  newGoalMode: false,
  sending: false,
  settingsOpen: false,
  inspectorOpen: false,
  focusMode: false,
  archiveVisible: false,
  inspectorTab: 'contract',
  composition: { agent: 'A5', control: 'B5', adaptation: 'C5', governance: 'D5' },

  async initialize() {
    set({ loading: true, error: undefined });
    try {
      await get().refresh();
      unsubscribeEvents?.();
      unsubscribeEvents = window.selfStudy.events.subscribe(() => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void get().refresh(), 80);
      });
    } catch (error) { set({ error: toMessage(error) }); }
    finally { set({ loading: false }); }
  },

  async refresh() {
    const dashboard = await window.selfStudy.dashboard.get();
    const state = get();
    const linkedGoalId = state.pendingNewGoalRunId
      ? dashboard.messages.find((message) => message.runId === state.pendingNewGoalRunId && message.goalId)?.goalId
        ?? dashboard.activeRuns.find((run) => run.id === state.pendingNewGoalRunId)?.goalId
      : undefined;
    if (linkedGoalId) {
      set({ dashboard, selectedGoalId: linkedGoalId, newGoalMode: false, pendingNewGoalRunId: undefined, error: undefined });
      const conversation = dashboard.conversations.find((item) => item.goalId === linkedGoalId);
      if (conversation) void window.selfStudy.conversation.touch(conversation.id);
      return;
    }
    const current = state.selectedGoalId;
    const selectedGoalId = state.newGoalMode
      ? undefined
      : current && dashboard.goals.some((goal) => goal.id === current && goal.status !== 'archived')
        ? current
        : dashboard.goals.find((goal) => goal.status === 'active')?.id;
    set({ dashboard, selectedGoalId, error: undefined });
  },

  async send(content) {
    const dashboard = get().dashboard;
    if (!dashboard || !content.trim()) return;
    const normalized = content.trim();
    set({ sending: true, error: undefined, lastSentContent: normalized });
    try {
      const creatingGoal = get().newGoalMode;
      const goalId = creatingGoal ? undefined : get().selectedGoalId;
      const result = await window.selfStudy.agent.send({ workspaceId: dashboard.workspace.id, goalId, content: normalized, composition: get().composition });
      if (creatingGoal) set({ pendingNewGoalRunId: result.runId, newGoalMode: true });
      // Auto-rename default goal from first message
      if (goalId) {
        const goal = dashboard.goals.find((g) => g.id === goalId);
        if (goal && goal.title === '新目标') {
          const title = extractGoalTitle(normalized);
          if (title) void window.selfStudy.conversation.renameGoal(goalId, title);
        }
      }
      await get().refresh();
    } catch (error) { set({ error: toMessage(error) }); }
    finally { set({ sending: false }); }
  },

  async retryLastMessage() {
    const content = get().lastSentContent;
    if (content) await get().send(content);
  },
  clearError: () => set({ error: undefined }),

  selectGoal(id) {
    set({ selectedGoalId: id, newGoalMode: id === undefined, pendingNewGoalRunId: undefined });
    if (!id) return;
    const conversation = get().dashboard?.conversations.find((item) => item.goalId === id);
    if (conversation) void window.selfStudy.conversation.touch(conversation.id).catch(() => undefined);
  },
  setComposition: (patch) => set((state) => ({ composition: { ...state.composition, ...patch } })),
  setInspectorTab: (inspectorTab) => set({ inspectorTab, inspectorOpen: true }),
  setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
  setFocusMode: (focusMode) => set({ focusMode, inspectorOpen: focusMode ? false : get().inspectorOpen }),
  setArchiveVisible: (archiveVisible) => set({ archiveVisible }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  async saveAppearance(preferences) {
    set((state) => ({ dashboard: state.dashboard ? { ...state.dashboard, appearance: preferences } : state.dashboard }));
    try {
      const saved = await window.selfStudy.appearance.save(preferences);
      set((state) => ({ dashboard: state.dashboard ? { ...state.dashboard, appearance: saved } : state.dashboard }));
    } catch (error) {
      set({ error: toMessage(error) });
      await get().refresh();
    }
  },

  async renameGoal(goalId, title) {
    await window.selfStudy.conversation.renameGoal(goalId, title);
    await get().refresh();
  },
  async archiveGoal(goalId, archived) {
    await window.selfStudy.conversation.archiveGoal(goalId, archived);
    if (archived && get().selectedGoalId === goalId) {
      const next = get().dashboard?.goals.find((g) => g.id !== goalId && g.status === 'active');
      set({ selectedGoalId: next?.id, newGoalMode: !next });
    }
    await get().refresh();
  },
  async pinConversation(conversationId, pinned) {
    await window.selfStudy.conversation.pin(conversationId, pinned);
    await get().refresh();
  },
  async saveDraft(conversationId, draft) {
    set((state) => ({
      dashboard: state.dashboard ? {
        ...state.dashboard,
        conversations: state.dashboard.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, draft, draftUpdatedAt: new Date().toISOString() }
          : conversation)
      } : state.dashboard
    }));
    await window.selfStudy.conversation.saveDraft(conversationId, draft);
  },

  async pause(runId) { await window.selfStudy.agent.pause(runId); await get().refresh(); },
  async resume(runId) { await window.selfStudy.agent.resume(runId); await get().refresh(); },
  async cancel(runId) { await window.selfStudy.agent.cancel(runId); await get().refresh(); },
  async resolveApproval(approvalId, decision) { await window.selfStudy.agent.resolveApproval({ approvalId, decision }); await get().refresh(); },
  async recordReview(itemId, rating) { await window.selfStudy.learning.recordReview(itemId, rating); await get().refresh(); },
  async completeTask(taskId) { await window.selfStudy.learning.completeTask(taskId); await get().refresh(); },
  async completeSession(summary) {
    const dashboard = get().dashboard;
    if (!dashboard) return;
    await window.selfStudy.learning.completeSession(dashboard.workspace.id, summary);
    await get().refresh();
  },
  async completeMilestone(milestoneId) { await window.selfStudy.learning.completeMilestone(milestoneId); await get().refresh(); },
  async submitAssessment(assessmentId, answer) { await window.selfStudy.learning.submitAssessment(assessmentId, answer); await get().refresh(); },
  async evaluateArtifact(artifactId) { await window.selfStudy.learning.evaluateArtifact(artifactId); await get().refresh(); },
  async updateGoal(input) { await window.selfStudy.learning.updateGoal(input); await get().refresh(); },
  async updateTask(input) { await window.selfStudy.learning.updateTask(input); await get().refresh(); },
  async updateMisconception(input) { await window.selfStudy.learning.updateMisconception(input); await get().refresh(); },
  async suspendReview(input) { await window.selfStudy.learning.suspendReview(input); await get().refresh(); },
  async archiveResource(input) { await window.selfStudy.learning.archiveResource(input); await get().refresh(); },
  async archiveAssessment(input) { await window.selfStudy.learning.archiveAssessment(input); await get().refresh(); },
  async archiveArtifact(input) { await window.selfStudy.learning.archiveArtifact(input); await get().refresh(); },
  async createGoal(title) { const goal = await window.selfStudy.learning.createGoal({ title }); set({ selectedGoalId: goal.id, newGoalMode: false }); await get().refresh(); return goal; },
  async createHabit(input) { const value = await window.selfStudy.learning.createHabit(input); await get().refresh(); return value; },
  async updateHabit(input) { const value = await window.selfStudy.learning.updateHabit(input); await get().refresh(); return value; },
  async checkInHabit(input) { const value = await window.selfStudy.learning.checkInHabit(input); await get().refresh(); return value; },
  async upsertContract(input) { const value = await window.selfStudy.learning.upsertContract(input); await get().refresh(); return value; },
  async generateWeeklyReview(input) { const value = await window.selfStudy.learning.generateWeeklyReview(input); await get().refresh(); return value; },
  async createBackup() {
    const snapshot = await window.selfStudy.maintenance.createBackup();
    set({ error: `已创建本地备份，共 ${snapshot.backupCount} 份。` });
    await get().refresh();
  },
  async restoreBackup(name) {
    set({ error: '正在验证备份并重启恢复…' });
    await window.selfStudy.maintenance.restoreBackup(name);
  },
  async importResources() {
    const result = await window.selfStudy.library.importFiles(get().selectedGoalId);
    if (!result.cancelled) set({ error: `已导入 ${result.imported.length} 份资料。` });
    await get().refresh();
  },
  async searchLibrary(query) { return window.selfStudy.library.search(query, get().selectedGoalId); },
  async saveProvider(input) { const saved = await window.selfStudy.provider.save(input); await get().refresh(); return saved; },
  async removeProvider(id) { await window.selfStudy.provider.remove(id); await get().refresh(); },
  async testProvider(id) {
    const result = await window.selfStudy.provider.test(id);
    set({ error: result.status === 'healthy' ? `连接成功：${result.model} · ${result.latencyMs}ms` : `连接失败：${result.message}` });
    await get().refresh();
    return result;
  },
  async setDefaultProvider(id) { await window.selfStudy.provider.setDefault(id); await get().refresh(); },
  async toggleProvider(id, enabled) { await window.selfStudy.provider.toggle({ id, enabled }); await get().refresh(); },
  async exportWorkspace(payload) {
    const result = await window.selfStudy.workspace.export(payload);
    if (!result.cancelled && result.path) set({ error: `已导出到：${result.path}` });
  }
}));

function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function extractGoalTitle(text: string): string {
  const cleaned = text
    .replace(/^我想(要|学|学习|研究|了解|掌握|做|开发|写|读|看|弄|搞)?/u, '')
    .replace(/^我(想|要|希望|打算|准备|计划)/u, '')
    .replace(/^(帮我|帮我一个|请帮我|请你帮我|你来帮我)/u, '')
    .replace(/[，,。.！!？?~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 2) return cleaned.slice(0, 40);
  const fallback = text.replace(/[，,。.！!？?~]/g, ' ').replace(/\s+/g, ' ').trim();
  return fallback.slice(0, 40);
}
