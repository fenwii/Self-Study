import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveOneToOneState, nextReviewDate } from '../src/main/learning/one-to-one-engine';
import { routeIntent } from '../src/main/agents/intent-router';
import { resolveComposition } from '../src/main/chart/composition';
import type { LearningContract, LearningEvidence, WeeklyLearningReview } from '../src/shared/domain';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));
const temporaryDirectories: string[] = [];
afterEach(() => { for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

const contract: LearningContract = {
  id: 'contract-1', goalId: 'goal-1', learnerName: '学习者', whyNow: '现在需要形成长期能力',
  successDefinition: '独立完成真实作品并通过迁移评估', weeklyMinutes: 180, sessionMinutes: 25,
  preferredDays: [1, 3, 5], preferredTime: '20:30', coachingStyle: 'balanced', feedbackPreference: 'evidence-first',
  challengeLevel: 3, autonomyTarget: 0.8, minimumCommitment: '完成30秒最小行动', reviewCadence: 'weekly',
  status: 'active', version: 1, agreedAt: '2026-07-20T00:00:00.000Z', createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z'
};

const review: WeeklyLearningReview = {
  id: 'review-1', goalId: 'goal-1', periodStart: '2026-07-20', periodEnd: '2026-07-26', plannedSessions: 6,
  completedSessions: 4, tinyActionsCompleted: 5, evidenceCreated: 2, reflection: '', coachSummary: '节奏稳定',
  nextFocus: '完成迁移任务', behaviorAdjustment: '保持最小行动', createdAt: '2026-07-26T10:00:00.000Z'
};

function evidence(independence: number): LearningEvidence {
  return { id: crypto.randomUUID(), goalId: 'goal-1', kind: 'exercise', title: '证据', content: '独立输出', independence, retention: 0.7, transfer: 0.6, evaluator: 'automated', createdAt: '2026-07-26T10:00:00.000Z' };
}

describe('V1.0 formal one-to-one self-study system', () => {
  it('routes contract and weekly review natural language', () => {
    expect(routeIntent('帮我建立一对一学习契约，明确每周投入和成功标准')).toBe('setup-contract');
    expect(routeIntent('请带我做本周复盘')).toBe('weekly-review');
  });

  it('exposes contract and weekly review tools in A5+B5+C5+D5', () => {
    const composition = resolveComposition({ agent: 'A5', control: 'B5', adaptation: 'C5', governance: 'D5' });
    expect(composition.chart.runtime.tools).toEqual(expect.arrayContaining(['contract.upsert', 'review.weekly']));
  });

  it('derives autonomy gap and review cadence from the active contract', () => {
    const state = deriveOneToOneState({ contract, reviews: [review], evidence: [evidence(0.45), evidence(0.55)] });
    expect(state.contractReady).toBe(true);
    expect(state.currentAutonomy).toBeCloseTo(0.5);
    expect(state.coachingSummary).toContain('减少直接答案');
    expect(nextReviewDate(contract, review)).toBe('2026-08-02');
  });

  it('persists a contract and generates a data-backed weekly review', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v100-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const goal = learning.createGoal({ workspaceId: workspace.id, title: '正式版目标', description: '建立系统能力', desiredOutcome: '独立交付真实作品' });
    const saved = learning.upsertLearningContract({
      goalId: goal.id, learnerName: '星星', whyNow: '现在需要长期积累', successDefinition: '独立完成并解释作品',
      weeklyMinutes: 180, sessionMinutes: 25, preferredDays: [1, 3, 5], preferredTime: '20:30', coachingStyle: 'balanced',
      feedbackPreference: 'evidence-first', challengeLevel: 3, autonomyTarget: 0.8, minimumCommitment: '完成30秒最小行动',
      reviewCadence: 'weekly', status: 'active', agree: true
    });
    const weekly = learning.generateWeeklyReview(goal.id, '本周完成起步。');
    const snapshot = learning.dashboard();
    expect(snapshot.maintenance.schemaVersion).toBe(10);
    expect(saved.version).toBe(1);
    expect(weekly.goalId).toBe(goal.id);
    expect(snapshot.contracts).toHaveLength(1);
    expect(snapshot.weeklyReviews).toHaveLength(1);
    expect(snapshot.oneToOneStates[goal.id]?.contractReady).toBe(true);
    expect(snapshot.metrics.activeContracts).toBe(1);
    database.close();
  });
});
