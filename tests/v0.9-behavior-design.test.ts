import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveBehaviorState, previousScheduledDateKey, shouldHabitRunToday } from '../src/main/learning/behavior-engine';
import { routeIntent } from '../src/main/agents/intent-router';
import { selectSkills } from '../src/main/skills/catalog';
import { resolveComposition } from '../src/main/chart/composition';
import type { HabitCheckIn, HabitRecipe } from '../src/shared/domain';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function habit(overrides: Partial<HabitRecipe> = {}): HabitRecipe {
  return {
    id: 'habit-1', goalId: 'goal-1', title: '打开后写一句', anchor: '打开Self-Study后',
    tinyBehavior: '写下一个问题', expansionBehavior: '状态允许时继续十分钟',
    celebration: '点头说“已开始”', frequency: 'daily', customDays: [], minimumSeconds: 30,
    preferredMinutes: 10, status: 'active', streak: 0, bestStreak: 0,
    createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', ...overrides
  };
}

function checkIn(overrides: Partial<HabitCheckIn> = {}): HabitCheckIn {
  return {
    id: crypto.randomUUID(), habitId: 'habit-1', goalId: 'goal-1', result: 'skipped',
    motivation: 2, ability: 2, promptSeen: false, celebrated: false, durationSeconds: 0,
    note: '', localDate: '2026-07-28', timezoneOffsetMinutes: -480, createdAt: '2026-07-28T08:00:00.000Z', ...overrides
  };
}

describe('V0.9 behavior design and micro-habit engine', () => {
  it('diagnoses ability and prompt friction without blaming motivation alone', () => {
    const state = deriveBehaviorState({
      goals: [], tasks: [], habits: [habit()],
      checkIns: [checkIn(), checkIn({ id: 'two', localDate: '2026-07-27', createdAt: '2026-07-27T08:00:00.000Z' })]
    }, new Date('2026-07-29T08:00:00.000Z'));

    expect(state.ability).toBeLessThan(0.55);
    expect(state.promptReliability).toBeLessThan(0.5);
    expect(state.suggestedTinyAction).toContain('写下一个问题');
    expect(state.diagnosis.join('')).toContain('行动难度偏高');
    expect(state.diagnosis.join('')).toContain('提示与真实生活锚点连接较弱');
  });

  it('routes natural language to behavior diagnosis, recipe design and check-in', () => {
    expect(routeIntent('我最近总是没动力，为什么做不到？')).toBe('behavior-diagnose');
    expect(routeIntent('帮我设计一个30秒微习惯和锚点')).toBe('design-habit');
    expect(routeIntent('我刚刚完成了最小行动，打卡')).toBe('habit-checkin');
    expect(selectSkills('design-habit', 'A5').map((item) => item.id)).toContain('skill-tiny-habits');
  });

  it('exposes behavior tools across the full CHART composition', () => {
    const composition = resolveComposition({ agent: 'A5', control: 'B5', adaptation: 'C5', governance: 'D5' });
    expect(composition.chart.runtime.tools).toEqual(expect.arrayContaining(['behavior.diagnose', 'habit.design', 'habit.checkin']));
  });

  it('supports schedule-aware habit prompts', () => {
    expect(shouldHabitRunToday(habit({ frequency: 'weekdays' }), new Date('2026-07-29T08:00:00.000Z'))).toBe(true);
    expect(shouldHabitRunToday(habit({ frequency: 'weekdays' }), new Date('2026-08-01T08:00:00.000Z'))).toBe(false);
    expect(shouldHabitRunToday(habit({ frequency: 'custom', customDays: [3] }), new Date('2026-07-29T08:00:00.000Z'))).toBe(true);
    expect(previousScheduledDateKey(habit({ frequency: 'weekdays' }), new Date(2026, 7, 3, 12))).toBe('2026-07-31');
  });

  it('persists a goal-scoped habit, check-in, streak and behavior snapshot', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v09-habits-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const goal = learning.createGoal({ workspaceId: workspace.id, title: '学习状态机', description: '', desiredOutcome: '独立实现状态机' });
    const created = learning.createHabit({
      goalId: goal.id,
      title: '状态机最小启动',
      anchor: '早餐后打开电脑',
      tinyBehavior: '只写一个状态名称',
      celebration: '轻轻点头说“开始了”'
    });
    learning.checkInHabit({
      habitId: created.id, result: 'done', motivation: 3, ability: 5,
      promptSeen: true, celebrated: true, durationSeconds: 45, note: '完成最小版本'
    });

    const snapshot = learning.dashboard();
    expect(snapshot.maintenance.schemaVersion).toBe(9);
    expect(snapshot.habits.find((item) => item.id === created.id)?.streak).toBe(1);
    expect(snapshot.habitCheckIns.some((item) => item.habitId === created.id && item.result === 'done')).toBe(true);
    expect(snapshot.behaviorState.activeHabitCount).toBe(1);
    expect(snapshot.behaviorStates[goal.id]?.activeHabitCount).toBe(1);
    expect(snapshot.metrics.activeHabits).toBe(1);
    database.close();
  });
});
