import { describe, expect, it } from 'vitest';
import { scheduleNextReview } from '../src/main/learning/spaced-repetition';

const base = { intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 };

describe('spaced repetition', () => {
  it('schedules a successful first review for the next day', () => {
    const result = scheduleNextReview(base, 'good', new Date('2026-01-01T00:00:00Z'));
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.dueAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('resets repetitions and records a lapse when recalled incorrectly', () => {
    const result = scheduleNextReview({ intervalDays: 8, easeFactor: 2.4, repetitions: 4, lapses: 1 }, 'again', new Date('2026-01-01T00:00:00Z'));
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(2);
    expect(result.intervalDays).toBeLessThan(1);
  });
});
