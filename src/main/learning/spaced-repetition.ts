import type { ReviewItem, ReviewRating } from '../../shared/domain';

const DAY_MS = 86_400_000;

const ratingQuality: Record<ReviewRating, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5
};

export interface ReviewScheduleUpdate {
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastRating: ReviewRating;
  lastReviewedAt: string;
}

export function scheduleNextReview(item: Pick<ReviewItem, 'intervalDays' | 'easeFactor' | 'repetitions' | 'lapses'>, rating: ReviewRating, reviewedAt = new Date()): ReviewScheduleUpdate {
  const quality = ratingQuality[rating];
  let easeFactor = Math.max(1.3, item.easeFactor || 2.5);
  let repetitions = item.repetitions;
  let lapses = item.lapses;
  let intervalDays: number;

  if (rating === 'again') {
    repetitions = 0;
    lapses += 1;
    intervalDays = 0.04; // 约1小时后重新出现，兼顾桌面端当日复习。
  } else {
    repetitions += 1;
    if (rating === 'hard') {
      intervalDays = Math.max(1, Math.round(Math.max(1, item.intervalDays) * 1.2));
    } else if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = rating === 'easy' ? 6 : 3;
    } else {
      const multiplier = rating === 'easy' ? easeFactor * 1.3 : easeFactor;
      intervalDays = Math.max(1, Math.round(Math.max(1, item.intervalDays) * multiplier));
    }
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const dueAt = new Date(reviewedAt.getTime() + intervalDays * DAY_MS).toISOString();

  return {
    dueAt,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitions,
    lapses,
    lastRating: rating,
    lastReviewedAt: reviewedAt.toISOString()
  };
}
