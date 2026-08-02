import type { LearningContract, LearningEvidence, OneToOneState, WeeklyLearningReview } from '../../shared/domain';

const DAY_MS = 86_400_000;

export function nextReviewDate(contract: LearningContract, latest?: WeeklyLearningReview): string {
  const base = latest ? new Date(`${latest.periodEnd}T12:00:00`) : new Date(contract.agreedAt ?? contract.updatedAt);
  const days = contract.reviewCadence === 'weekly' ? 7 : contract.reviewCadence === 'biweekly' ? 14 : 30;
  return new Date(base.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function deriveOneToOneState(input: {
  contract?: LearningContract;
  reviews: WeeklyLearningReview[];
  evidence: LearningEvidence[];
}): OneToOneState {
  const latest = input.reviews[0];
  const currentAutonomy = input.evidence.length
    ? input.evidence.reduce((sum, item) => sum + item.independence, 0) / input.evidence.length
    : 0;
  if (!input.contract) {
    return {
      contractReady: false,
      weeklyCapacityMinutes: 0,
      plannedSessionMinutes: 0,
      autonomyTarget: 0.8,
      currentAutonomy,
      coachingSummary: '尚未建立一对一学习契约。先明确为什么学、怎样算成功、每周真实可投入多少时间，以及希望AI如何反馈。'
    };
  }
  const contract = input.contract;
  const gap = Math.max(0, contract.autonomyTarget - currentAutonomy);
  const coachingSummary = contract.status !== 'active'
    ? `学习契约当前为${contract.status === 'paused' ? '暂停' : contract.status === 'completed' ? '已完成' : '草稿'}状态。`
    : gap > 0.25
      ? `当前独立性仍低于契约目标，教练应减少直接答案，优先要求尝试、证据和迁移。`
      : `当前独立性接近契约目标，可以逐步撤除脚手架并增加真实作品与跨场景迁移。`;
  return {
    contractReady: contract.status === 'active' || contract.status === 'completed',
    contractStatus: contract.status,
    weeklyCapacityMinutes: contract.weeklyMinutes,
    plannedSessionMinutes: contract.sessionMinutes,
    autonomyTarget: contract.autonomyTarget,
    currentAutonomy,
    latestReviewAt: latest?.createdAt,
    nextReviewDue: nextReviewDate(contract, latest),
    coachingSummary
  };
}
