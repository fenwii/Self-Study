import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from './shared/contracts';
import { IPC } from './shared/contracts';
import type { RunEvent } from './shared/domain';

const api: DesktopApi = {
  dashboard: { get: () => ipcRenderer.invoke(IPC.DASHBOARD_GET) },
  agent: {
    send: (input) => ipcRenderer.invoke(IPC.AGENT_SEND, input),
    pause: (runId) => ipcRenderer.invoke(IPC.AGENT_PAUSE, runId),
    resume: (runId) => ipcRenderer.invoke(IPC.AGENT_RESUME, runId),
    cancel: (runId) => ipcRenderer.invoke(IPC.AGENT_CANCEL, runId),
    resolveApproval: (input) => ipcRenderer.invoke(IPC.APPROVAL_RESOLVE, input)
  },
  learning: {
    recordReview: (itemId, rating) => ipcRenderer.invoke(IPC.LEARNING_REVIEW_RECORD, { itemId, rating }),
    completeTask: (taskId) => ipcRenderer.invoke(IPC.LEARNING_TASK_COMPLETE, taskId),
    completeSession: (workspaceId, summary) => ipcRenderer.invoke(IPC.LEARNING_SESSION_COMPLETE, { workspaceId, summary }),
    completeMilestone: (milestoneId) => ipcRenderer.invoke(IPC.LEARNING_MILESTONE_COMPLETE, { milestoneId }),
    submitAssessment: (assessmentId, answer) => ipcRenderer.invoke(IPC.LEARNING_ASSESSMENT_SUBMIT, { assessmentId, answer }),
    evaluateArtifact: (artifactId) => ipcRenderer.invoke(IPC.LEARNING_ARTIFACT_EVALUATE, { artifactId }),
    updateGoal: (input) => ipcRenderer.invoke(IPC.LEARNING_GOAL_UPDATE, input),
    updateTask: (input) => ipcRenderer.invoke(IPC.LEARNING_TASK_UPDATE, input),
    updateMisconception: (input) => ipcRenderer.invoke(IPC.LEARNING_MISCONCEPTION_UPDATE, input),
    suspendReview: (input) => ipcRenderer.invoke(IPC.LEARNING_REVIEW_SUSPEND, input),
    archiveResource: (input) => ipcRenderer.invoke(IPC.LEARNING_RESOURCE_ARCHIVE, input),
    archiveAssessment: (input) => ipcRenderer.invoke(IPC.LEARNING_ASSESSMENT_ARCHIVE, input),
    archiveArtifact: (input) => ipcRenderer.invoke(IPC.LEARNING_ARTIFACT_ARCHIVE, input),
    createGoal: (input) => ipcRenderer.invoke(IPC.LEARNING_GOAL_CREATE, input),
    createHabit: (input) => ipcRenderer.invoke(IPC.LEARNING_HABIT_CREATE, input),
    updateHabit: (input) => ipcRenderer.invoke(IPC.LEARNING_HABIT_UPDATE, input),
    checkInHabit: (input) => ipcRenderer.invoke(IPC.LEARNING_HABIT_CHECKIN, input),
    upsertContract: (input) => ipcRenderer.invoke(IPC.LEARNING_CONTRACT_UPSERT, input),
    generateWeeklyReview: (input) => ipcRenderer.invoke(IPC.LEARNING_WEEKLY_REVIEW, input)
  },
  conversation: {
    renameGoal: (goalId, title) => ipcRenderer.invoke(IPC.CONVERSATION_RENAME_GOAL, { goalId, title }),
    archiveGoal: (goalId, archived) => ipcRenderer.invoke(IPC.CONVERSATION_ARCHIVE_GOAL, { goalId, archived }),
    pin: (conversationId, pinned) => ipcRenderer.invoke(IPC.CONVERSATION_PIN, { conversationId, pinned }),
    saveDraft: (conversationId, draft) => ipcRenderer.invoke(IPC.CONVERSATION_SAVE_DRAFT, { conversationId, draft }),
    touch: (conversationId) => ipcRenderer.invoke(IPC.CONVERSATION_TOUCH, { conversationId })
  },
  library: {
    importFiles: (goalId) => ipcRenderer.invoke(IPC.LIBRARY_IMPORT_FILES, { goalId }),
    search: (query, goalId) => ipcRenderer.invoke(IPC.LIBRARY_SEARCH, { query, goalId, limit: 8 })
  },
  provider: {
    list: () => ipcRenderer.invoke(IPC.PROVIDER_LIST),
    save: (input) => ipcRenderer.invoke(IPC.PROVIDER_SAVE, input),
    remove: (id) => ipcRenderer.invoke(IPC.PROVIDER_REMOVE, id),
    test: (id) => ipcRenderer.invoke(IPC.PROVIDER_TEST, id),
    setDefault: (id) => ipcRenderer.invoke(IPC.PROVIDER_SET_DEFAULT, id),
    toggle: (input) => ipcRenderer.invoke(IPC.PROVIDER_TOGGLE, input)
  },
  appearance: { save: (input) => ipcRenderer.invoke(IPC.APPEARANCE_SAVE, input) },
  workspace: { export: (payload) => ipcRenderer.invoke(IPC.WORKSPACE_EXPORT, payload) },
  maintenance: {
    snapshot: () => ipcRenderer.invoke(IPC.MAINTENANCE_SNAPSHOT),
    createBackup: () => ipcRenderer.invoke(IPC.MAINTENANCE_BACKUP_CREATE),
    restoreBackup: (name) => ipcRenderer.invoke(IPC.MAINTENANCE_BACKUP_RESTORE, { name })
  },
  events: {
    subscribe: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: RunEvent) => listener(payload);
      ipcRenderer.on(IPC.EVENT, handler);
      return () => ipcRenderer.removeListener(IPC.EVENT, handler);
    }
  }
};

contextBridge.exposeInMainWorld('selfStudy', api);
