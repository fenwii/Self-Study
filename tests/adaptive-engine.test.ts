import { describe, expect, it } from 'vitest';
import { deriveLearnerState } from '../src/main/learning/adaptive-engine';

const now = '2026-01-10T00:00:00.000Z';

describe('C5 adaptive learner state', () => {
  it('prioritizes due reviews before new tasks', () => {
    const state = deriveLearnerState({
      tasks: [{ id: 't', goalId: 'g', title: 'new task', description: '', status: 'todo', stage: 'practice', priority: 100, estimatedMinutes: 25, createdAt: now, updatedAt: now }],
      evidence: [], knowledgeNodes: [], misconceptions: [], sessions: [], artifacts: [],
      reviewItems: [{ id: 'r', goalId: 'g', prompt: 'recall', answer: 'answer', dueAt: '2026-01-09T00:00:00.000Z', intervalDays: 1, easeFactor: 2.5, repetitions: 1, lapses: 0, suspended: false, createdAt: now, updatedAt: now }]
    }, new Date(now));
    expect(state.dueReviews).toBe(1);
    expect(state.nextBestAction).toContain('无提示回忆');
  });

  it('continues an active session instead of switching context', () => {
    const state = deriveLearnerState({
      tasks: [], evidence: [], knowledgeNodes: [], misconceptions: [], reviewItems: [], artifacts: [],
      sessions: [{ id: 's', workspaceId: 'w', goalId: 'g', mode: 'focus', objective: 'finish proof', status: 'active', plannedMinutes: 25, actualMinutes: 0, summary: '', startedAt: now, createdAt: now, updatedAt: now }]
    }, new Date(now));
    expect(state.nextBestAction).toContain('finish proof');
  });
});
