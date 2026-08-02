import type { BehaviorState, HabitCheckIn, HabitRecipe, LearningGoal, LearningTask } from '../../shared/domain';

const DAY_MS = 86_400_000;

/**
 * Fogg Behavior Model (B = MAP): Behavior happens when Motivation,
 * Ability, and Prompt converge at the same moment.
 *
 * This engine derives the current behavior state by analyzing recent
 * habit check-ins, task completion patterns, and MAP convergence.
 */
export function deriveBehaviorState(input: {
  goals: LearningGoal[];
  tasks: LearningTask[];
  habits: HabitRecipe[];
  checkIns: HabitCheckIn[];
}, at = new Date()): BehaviorState {
  const activeHabits = input.habits.filter((h) => h.status === 'active');
  const recent = input.checkIns.filter(
    (item) => at.getTime() - new Date(item.createdAt).getTime() <= 7 * DAY_MS
  );
  const completed = recent.filter((item) => item.result === 'done');
  const partial = recent.filter((item) => item.result === 'partial');
  const skipped = recent.filter((item) => item.result === 'skipped');
  const prompted = recent.filter((item) => item.promptSeen);

  // ── MAP convergence analysis ──
  // Motivation: from self-reported 1-5 scores normalized to 0-1
  const motivationValues = recent.map((item) => item.motivation / 5);
  const motivation = average(motivationValues, 0.6);

  // Ability: from self-reported 1-5 scores normalized to 0-1
  const abilityValues = recent.map((item) => item.ability / 5);
  const ability = average(abilityValues, 0.65);

  // Prompt reliability: when prompted, how often did behavior occur?
  const promptReliability = prompted.length
    ? completed.filter((item) => item.promptSeen).length / prompted.length
    : 0.5;

  // MAP convergence score: all three conditions must be simultaneously met
  // This is the Fogg Model's core insight — if any one is zero, behavior is zero
  const mapConvergence = round(motivation * ability * promptReliability);

  // Success rate over the window
  const successRate = recent.length
    ? (completed.length + partial.length * 0.5) / recent.length
    : 0;

  // ── Trend analysis (7-day window) ──
  const trend = computeTrend(recent);

  // ── Today's status ──
  const today = localDateKey(at);
  const todayCompleted = input.checkIns.filter(
    (item) => item.localDate === today && item.result === 'done'
  ).length;

  // ── Suggested tiny action ──
  const first = activeHabits[0];
  const pendingTask = input.tasks.find(
    (task) => !task.archived && !['done', 'archived'].includes(task.status)
  );
  const fallbackAction = pendingTask
    ? `打开"${pendingTask.title}"，只做 ${Math.min(2, Math.max(1, Math.ceil(pendingTask.estimatedMinutes / 20)))} 分钟。`
    : '打开当前目标，只写下一步动作的一句话。';
  const suggestedTinyAction = first
    ? `当"${first.anchor}"发生后，只做：${first.tinyBehavior}`
    : fallbackAction;

  // ── MAP-aware diagnosis ──
  const diagnosis = buildDiagnosis({
    recent,
    completed,
    skipped,
    motivation,
    ability,
    promptReliability,
    mapConvergence,
    successRate,
    activeHabits,
    todayCompleted,
    trend
  });

  return {
    motivation: round(motivation),
    ability: round(ability),
    promptReliability: round(promptReliability),
    successRate: round(successRate),
    activeHabitCount: activeHabits.length,
    todayCompleted,
    suggestedTinyAction,
    diagnosis
  };
}

/**
 * Compute 7-day trend: is behavior improving, declining, or stable?
 * Uses a simple linear regression on completion count per day.
 */
function computeTrend(
  checkIns: HabitCheckIn[]
): 'improving' | 'declining' | 'stable' | 'insufficient-data' {
  const days = new Map<string, number>();
  for (const item of checkIns) {
    const key = item.localDate || item.createdAt.slice(0, 10);
    days.set(key, (days.get(key) ?? 0) + (item.result === 'done' ? 1 : item.result === 'partial' ? 0.5 : 0));
  }

  const entries = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length < 3) return 'insufficient-data';

  // Simple slope of completion over the ordered days
  const n = entries.length;
  const indices = entries.map((_, index) => index);
  const values = entries.map(([, count]) => count);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let index = 0; index < n; index += 1) {
    num += (indices[index] - meanX) * (values[index] - meanY);
    den += (indices[index] - meanX) ** 2;
  }

  if (den === 0) return 'stable';
  const slope = num / den;
  if (slope > 0.08) return 'improving';
  if (slope < -0.08) return 'declining';
  return 'stable';
}

/**
 * Build MAP-aware diagnostic messages.
 *
 * The Fogg Model teaches us to diagnose in order:
 * 1. Is there a Prompt? (easiest to fix)
 * 2. Is the Ability too low? (most effective lever)
 * 3. Is the Motivation sufficient? (hardest to sustain)
 */
function buildDiagnosis(params: {
  recent: HabitCheckIn[];
  completed: HabitCheckIn[];
  skipped: HabitCheckIn[];
  motivation: number;
  ability: number;
  promptReliability: number;
  mapConvergence: number;
  successRate: number;
  activeHabits: HabitRecipe[];
  todayCompleted: number;
  trend: ReturnType<typeof computeTrend>;
}): string[] {
  const lines: string[] = [];
  const {
    recent,
    completed,
    skipped,
    motivation,
    ability,
    promptReliability,
    mapConvergence,
    successRate,
    activeHabits,
    todayCompleted,
    trend
  } = params;

  // ── No data yet ──
  if (recent.length === 0) {
    lines.push('还没有行为样本。从福格模型的视角：先设计一个极小动作，连接到稳定锚点，完成即庆祝。不判断意志力。');
    if (activeHabits.length === 0) {
      lines.push('当前没有启用的微习惯。说"帮我设计微习惯"，系统会基于 MAP 三条件为你设计配方。');
    }
    return lines;
  }

  // ── MAP convergence diagnosis ──
  // Order: Prompt → Ability → Motivation (Fogg's recommended diagnostic sequence)

  // 1. Prompt — the最容易修复的变量
  if (promptReliability < 0.4) {
    lines.push(
      'MAP·提示缺失：近期只有 ' + Math.round(promptReliability * 100) +
      '% 的行为发生在提示出现后。提示是福格模型中最容易修复的变量——' +
      '把锚点改成更稳定、更频繁、更可观察的事件（如"刷牙后""打开电脑后"）。'
    );
  } else if (promptReliability < 0.65) {
    lines.push(
      'MAP·提示不稳定：提示可靠性 ' + Math.round(promptReliability * 100) +
      '%。考虑让锚点更具体、更频繁发生，或添加环境提示（便签、手机提醒）。'
    );
  }

  // 2. Ability — the most effective lever (Fogg's golden rule)
  if (ability < 0.4) {
    lines.push(
      'MAP·能力过低：近期行为难度评分仅 ' + Math.round(ability * 100) +
      '%。福格模型的黄金法则是优先提高能力而非动机。继续缩小动作：减少步骤、时间、准备成本或认知负担。'
    );
  } else if (ability < 0.6) {
    lines.push(
      'MAP·能力偏低：难度评分 ' + Math.round(ability * 100) +
      '%。检查能力链：时间不够？步骤太多？工具太复杂？认知负担太重？选一个缩小。'
    );
  }

  // 3. Motivation — the hardest to sustain, use sparingly
  if (motivation < 0.35) {
    lines.push(
      'MAP·动机偏低：近期动机仅 ' + Math.round(motivation * 100) +
      '%。不靠增强说服来提升动机——把动作缩小到不需要动机也能完成的版本，并连接行为背后的真实意义。'
    );
  } else if (motivation < 0.5) {
    lines.push(
      'MAP·动机偏低：' + Math.round(motivation * 100) +
      '%。考虑：这个目标真的重要吗？还是"应该做"？如果意义不清晰，缩小动作比增强动机更可靠。'
    );
  }

  // ── MAP convergence specifically ──
  if (mapConvergence < 0.15) {
    lines.push(
      'MAP·汇聚度严重不足（' + Math.round(mapConvergence * 100) +
      '%）：动机、能力、提示三者在近期几乎没有同时出现。从提示开始修复，然后缩小动作，最后再考虑动机。'
    );
  }

  // ── Success / stability ──
  if (successRate >= 0.75 && activeHabits.length > 0 && recent.length >= 5) {
    lines.push(
      'MAP·稳定阶段：近期成功率 ' + Math.round(successRate * 100) +
      '%。最小行动已较稳定。可以自然扩展，但保留最小版本作为低能量保底——这是福格模型中"能力链"的关键。'
    );
  }

  // ── Skipping pattern ──
  if (skipped.length >= 3 && completed.length < skipped.length) {
    lines.push(
      'MAP·跳过模式：近期跳过次数超过完成次数。不要补偿、不要惩罚——回到最小版本，检查锚点是否失效、动作是否还需要缩小。'
    );
  }

  // ── Trend ──
  if (trend === 'improving') {
    lines.push('行为趋势改善：MAP 汇聚度在上升。保持当前配方，不要急于加大动作。');
  } else if (trend === 'declining') {
    lines.push(
      '行为趋势下降：MAP 汇聚度在降低。选择一个最容易修复的变量——优先检查提示是否稳定、动作是否又变大了。'
    );
  }

  // ── Today ──
  if (todayCompleted > 0) {
    lines.push(
      '今天已经完成最小行动。后续扩展属于可选奖励，不制造补偿压力。' +
      '福格模型的核心：完成最小版本就是成功——庆祝这个事实。'
    );
  }

  // ── Celebration check ──
  const celebratedRate = completed.length
    ? completed.filter((item) => item.celebrated).length / completed.length
    : 0;
  if (celebratedRate < 0.5 && completed.length >= 3) {
    lines.push(
      '庆祝缺失：近期只有 ' + Math.round(celebratedRate * 100) +
      '% 的完成伴随了庆祝。福格博士的研究表明庆祝是习惯形成的核心——' +
      '它向大脑发送"这个行为值得重复"的信号。选择一个真实、不尴尬的庆祝动作。'
    );
  }

  return lines;
}

// ── Utility ──

export function previousScheduledDateKey(habit: HabitRecipe, at = new Date()): string {
  const candidate = new Date(at);
  candidate.setHours(12, 0, 0, 0);
  for (let offset = 1; offset <= 14; offset += 1) {
    const previous = new Date(candidate);
    previous.setDate(candidate.getDate() - offset);
    if (shouldHabitRunToday(habit, previous)) return localDateKey(previous);
  }
  const fallback = new Date(candidate);
  fallback.setDate(candidate.getDate() - 1);
  return localDateKey(fallback);
}

export function shouldHabitRunToday(habit: HabitRecipe, at = new Date()): boolean {
  if (habit.status !== 'active') return false;
  const day = at.getDay();
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'weekdays') return day >= 1 && day <= 5;
  if (habit.frequency === 'weekly') return day === (habit.customDays[0] ?? 1);
  return habit.customDays.includes(day);
}

/**
 * Calculate the Fogg Ability Chain score for a given habit.
 * The ability chain decomposes "can I do this?" into:
 * time, money, physical effort, mental effort, and routine fit.
 * Returns 0-1 where higher = easier.
 */
export function abilityChainScore(habit: HabitRecipe): number {
  let score = 0;
  // Time: shorter = easier
  score += Math.max(0, 1 - habit.minimumSeconds / 300); // max 0.2
  // Mental effort: simpler = easier (heuristic from description length)
  score += Math.max(0, 1 - habit.tinyBehavior.length / 600); // max 0.2
  // Routine fit: anchor quality (longer, more specific anchor = better)
  score += Math.min(0.2, habit.anchor.length / 400); // max 0.2
  // Expansion is optional = good
  score += habit.expansionBehavior ? 0.2 : 0.1;
  // Celebration present = good
  score += habit.celebration.length > 0 ? 0.2 : 0;
  return Math.min(1, Math.max(0, score));
}

function average(values: number[], fallback: number): number {
  return values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : fallback;
}

function round(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
