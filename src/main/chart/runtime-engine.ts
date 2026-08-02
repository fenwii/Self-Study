import type { LearningService } from '../services/learning-service';
import type { AgentComposition, AgentPlanStep, IntentName, ReviewRating, RuntimeToolName, SessionMode } from '../../shared/domain';
import { selectSkills } from '../skills/catalog';

export interface RuntimeContext {
  workspaceId: string;
  goalId?: string;
  userInput: string;
  intent: IntentName;
  composition: AgentComposition;
}

export interface RuntimeResult {
  summary: string;
  data?: unknown;
}

export class RuntimeEngine {
  constructor(private readonly learning: LearningService) {}

  execute(tool: RuntimeToolName, step: AgentPlanStep, context: RuntimeContext): RuntimeResult {
    switch (tool) {
      case 'goal.create': {
        const title = extractGoalTitle(context.userInput);
        const goal = this.learning.createGoal({
          workspaceId: context.workspaceId,
          title,
          description: context.userInput,
          desiredOutcome: `能够不依赖AI，完成与“${title}”相关的真实作品与迁移任务。`,
          currentLevel: 1,
          targetLevel: 5
        });
        const tasks = [
          ['完成起点诊断并写出已有理解', '不要查资料，先写出你现在知道什么、会做什么和不确定什么。', 'understanding', 25],
          ['建立第一版知识地图与前置依赖', '用演示、降维、体系三法建立最小知识骨架。', 'mapping', 25],
          ['完成一个可验证的小作品', '选择一个30—90分钟可完成的成果，并定义验收标准。', 'practice', 60]
        ].map(([taskTitle, description, stage, minutes], index) => this.learning.createTask({
          goalId: goal.id,
          title: String(taskTitle),
          description: String(description),
          stage: stage as 'understanding' | 'mapping' | 'practice',
          priority: 100 - index * 10,
          estimatedMinutes: Number(minutes)
        }));
        const path = this.learning.compileLearningPath({ goalId: goal.id });
        return { summary: `已创建长期目标“${goal.title}”、${tasks.length} 个起步任务和 ${path.milestones.length} 个一条龙里程碑。`, data: { goal, tasks, path } };
      }
      case 'knowledge.create': {
        if (!context.goalId) return { summary: '尚未选定目标，知识节点将在目标建立后创建。' };
        const topic = extractGoalTitle(context.userInput);
        const foundation = this.learning.createKnowledgeNode({ goalId: context.goalId, title: `${topic}·基础`, summary: '术语、前置知识与最小运行机制。', stage: 'understanding' });
        const core = this.learning.createKnowledgeNode({ goalId: context.goalId, title: `${topic}·核心`, summary: '决定实际能力的核心方法、模式和权衡。', stage: 'mapping' });
        const transfer = this.learning.createKnowledgeNode({ goalId: context.goalId, title: `${topic}·迁移`, summary: '在陌生场景中独立应用并形成作品。', stage: 'transfer' });
        this.learning.linkKnowledge({ goalId: context.goalId, sourceNodeId: foundation.id, targetNodeId: core.id, type: 'prerequisite' });
        this.learning.linkKnowledge({ goalId: context.goalId, sourceNodeId: core.id, targetNodeId: transfer.id, type: 'prerequisite' });
        return { summary: `已创建“基础→核心→迁移”三个知识节点并建立依赖。`, data: [foundation, core, transfer] };
      }
      case 'knowledge.link':
        return { summary: '知识关系由知识地图技能根据节点依赖自动维护。' };
      case 'task.create': {
        if (!context.goalId) throw new Error('创建学习任务前需要选定学习目标。');
        const task = this.learning.createTask({
          goalId: context.goalId,
          title: step.title,
          description: step.description,
          stage: inferStage(context.userInput),
          priority: 70,
          estimatedMinutes: extractMinutes(context.userInput) ?? 25
        });
        return { summary: `已创建任务“${task.title}”。`, data: task };
      }
      case 'task.complete':
        return { summary: '任务完成需要学习者明确确认，避免把AI生成等同于学习完成。' };
      case 'session.start': {
        const session = this.learning.startSession({
          workspaceId: context.workspaceId,
          goalId: context.goalId,
          mode: inferSessionMode(context.intent),
          objective: extractSessionObjective(context.userInput),
          plannedMinutes: extractMinutes(context.userInput) ?? 25
        });
        return { summary: `已启动${session.plannedMinutes}分钟${sessionModeLabel(session.mode)}会话：“${session.objective}”。`, data: session };
      }
      case 'session.complete': {
        const session = this.learning.completeActiveSession(context.workspaceId, context.userInput);
        return { summary: session ? `已结束学习会话，记录 ${session.actualMinutes} 分钟和本次总结。` : '当前没有进行中的学习会话。', data: session };
      }
      case 'review.schedule': {
        if (!context.goalId) return { summary: '选定目标后才能创建复习项。' };
        const item = this.learning.scheduleReview({
          goalId: context.goalId,
          prompt: `不看资料，用自己的话解释：${extractGoalTitle(context.userInput)}`,
          answer: '对照原理、边界和一个独立例子进行自检。'
        });
        return { summary: '已把核心内容加入间隔复习队列。', data: item };
      }
      case 'review.record': {
        const dashboard = this.learning.dashboard();
        const item = dashboard.reviewItems.find((review) => !review.suspended && new Date(review.dueAt) <= new Date() && (!context.goalId || review.goalId === context.goalId));
        const rating = extractRating(context.userInput);
        if (!item || !rating) return { summary: '请完成无提示回忆后，在复习面板选择“再次、困难、良好或轻松”记录真实难度。' };
        const updated = this.learning.recordReview(item.id, rating);
        return { summary: `已按“${ratingLabel(rating)}”更新复习间隔，下次复习：${formatDate(updated.dueAt)}。`, data: updated };
      }
      case 'evidence.create': {
        if (!context.goalId) throw new Error('记录能力证据前需要选定学习目标。');
        const evidence = this.learning.createEvidence({
          goalId: context.goalId,
          kind: 'explanation',
          title: '学习者当前独立表达',
          content: context.userInput,
          independence: 0.7,
          retention: 0.35,
          transfer: 0.25,
          evaluator: 'ai',
          provenance: { source: 'natural-language', intent: context.intent, composition: `${context.composition.agent}+${context.composition.control}+${context.composition.adaptation}+${context.composition.governance}` }
        });
        return { summary: '已保存独立表达证据；保持和迁移分数需后续复测提升。', data: evidence };
      }
      case 'artifact.create': {
        if (!context.goalId) throw new Error('创建作品前需要选定学习目标。');
        const title = extractArtifactTitle(context.userInput);
        const artifact = this.learning.createArtifact({
          goalId: context.goalId,
          kind: inferArtifactKind(context.userInput),
          title,
          description: context.userInput,
          rubric: ['成果可以被第三方查看或运行', '学习者能解释核心决策', '至少存在一个独立完成部分', '包含明确验收标准'],
          provenance: { createdBy: 'artifact.create', intent: context.intent }
        });
        return { summary: `已创建作品“${artifact.title}”及四项验收标准。`, data: artifact };
      }
      case 'reflection.create': {
        if (!context.goalId) throw new Error('记录反思前需要选定学习目标。');
        const reflection = this.learning.createReflection({
          goalId: context.goalId,
          content: context.userInput,
          whatWorked: '学习者主动进行了复盘。',
          whatFailed: '需要用后续任务验证总结是否准确。',
          nextAction: this.learning.dashboard().learnerState.nextBestAction
        });
        return { summary: '已保存反思，并把下一最佳行动写入长期上下文。', data: reflection };
      }
      case 'misconception.create': {
        if (!context.goalId) return { summary: '没有选定目标，未创建误解记录。' };
        const misconception = this.learning.createMisconception({
          goalId: context.goalId,
          statement: `待验证的理解：${context.userInput.slice(0, 300)}`,
          correction: '需要通过反例、变式任务或来源核验后确认。',
          evidenceNeeded: '无提示解释 + 一个反例 + 一个迁移应用。'
        });
        return { summary: '已将最关键的待验证理解登记为误解候选，避免一次回答后永久遗忘。', data: misconception };
      }
      case 'skill.run': {
        const skills = selectSkills(context.intent, context.composition.agent);
        return { summary: skills.length ? `已启用技能：${skills.map((skill) => skill.name).join('、')}。` : '当前层级使用基础自然语言教学策略。', data: skills };
      }
      case 'checkpoint.create':
        return { summary: '运行状态由Traceability内核保存。' };
      case 'knowledge.search': {
        const state = this.learning.dashboard().learnerState;
        return { summary: `已检索目标、任务、知识、误解、复习、作品与历史消息。下一最佳行动：${state.nextBestAction}` };
      }
      case 'path.compile': {
        if (!context.goalId) throw new Error('编译学习路径前需要选定学习目标。');
        const result = this.learning.compileLearningPath({ goalId: context.goalId });
        return { summary: `已编译“${result.path.title}”，包含 ${result.milestones.length} 个带证据门槛的里程碑。`, data: result };
      }
      case 'milestone.complete':
        return { summary: '里程碑完成必须从路径面板明确确认，系统会解锁下一阶段。' };
      case 'resource.search': {
        const hits = this.learning.searchResources(context.workspaceId, context.userInput, context.goalId, 6);
        return { summary: hits.length ? `已从本地资料库检索到 ${hits.length} 个相关片段：${hits.map((hit) => hit.resourceTitle).filter((value, index, all) => all.indexOf(value) === index).join('、')}。` : '本地资料库尚未找到相关内容，可先导入Markdown、TXT、JSON或CSV资料。', data: hits };
      }
      case 'assessment.create': {
        if (!context.goalId) throw new Error('创建评估前需要选定学习目标。');
        const assessment = this.learning.createAssessment({ goalId: context.goalId, topic: extractGoalTitle(context.userInput) });
        return { summary: `已创建“${assessment.title}”，包含 ${assessment.questions.length} 个独立掌握问题。`, data: assessment };
      }
      case 'assessment.submit': {
        const assessment = this.learning.dashboard().assessments.find((item) => item.status === 'ready' && (!context.goalId || item.goalId === context.goalId));
        if (!assessment) return { summary: '当前没有待提交评估，请先说“考考我”创建评估。' };
        const attempt = this.learning.submitAssessment(assessment.id, context.userInput);
        return { summary: `评估得分 ${Math.round(attempt.score * 100)}%。${attempt.feedback}`, data: attempt };
      }
      case 'artifact.evaluate': {
        const artifact = this.learning.dashboard().artifacts.find((item) => !context.goalId || item.goalId === context.goalId);
        if (!artifact) return { summary: '当前没有可验收作品。' };
        const evaluation = this.learning.evaluateArtifact(artifact.id);
        return { summary: `作品验收得分 ${Math.round(evaluation.score * 100)}%，${evaluation.passed ? '已通过当前门槛' : '需要继续补齐证据'}。`, data: evaluation };
      }
      case 'contract.upsert': {
        if (!context.goalId) throw new Error('建立学习契约前需要选定学习目标。');
        const dashboard = this.learning.dashboard();
        const goal = dashboard.goals.find((item) => item.id === context.goalId);
        const contract = this.learning.upsertLearningContract({
          goalId: context.goalId,
          learnerName: extractLearnerName(context.userInput) ?? '学习者',
          whyNow: context.userInput,
          successDefinition: goal?.desiredOutcome || `能够独立完成与“${goal?.title ?? '当前目标'}”相关的真实任务并通过迁移验证`,
          weeklyMinutes: extractWeeklyMinutes(context.userInput) ?? 180,
          sessionMinutes: Math.min(90, extractMinutes(context.userInput) ?? 25),
          preferredDays: [1, 2, 3, 4, 5],
          preferredTime: '',
          coachingStyle: /苏格拉底|追问/u.test(context.userInput) ? 'socratic' : /项目|作品/u.test(context.userInput) ? 'project' : 'balanced',
          feedbackPreference: /直接|严格/u.test(context.userInput) ? 'direct' : 'evidence-first',
          challengeLevel: 3,
          autonomyTarget: 0.8,
          minimumCommitment: dashboard.behaviorStates[context.goalId]?.suggestedTinyAction ?? '每天完成一次最小学习行动',
          reviewCadence: 'weekly',
          status: 'active',
          agree: true
        });
        return { summary: `已建立一对一学习契约：每周${contract.weeklyMinutes}分钟、单次${contract.sessionMinutes}分钟，教练方式为${contract.coachingStyle}，自主性目标${Math.round(contract.autonomyTarget * 100)}%。`, data: contract };
      }
      case 'review.weekly': {
        if (!context.goalId) throw new Error('周复盘前需要选定学习目标。');
        const review = this.learning.generateWeeklyReview(context.goalId, context.userInput);
        return { summary: `${review.coachSummary}

下周唯一重点：${review.nextFocus}
行为调整：${review.behaviorAdjustment}`, data: review };
      }
      case 'behavior.diagnose': {
        const dashboard = this.learning.dashboard();
        const state = context.goalId ? dashboard.behaviorStates[context.goalId] ?? dashboard.behaviorState : dashboard.behaviorState;
        return {
          summary: `行为诊断：动机 ${Math.round(state.motivation * 100)}%，能力 ${Math.round(state.ability * 100)}%，提示可靠性 ${Math.round(state.promptReliability * 100)}%。${state.diagnosis.join('；')} 下一步：${state.suggestedTinyAction}`,
          data: state
        };
      }
      case 'habit.design': {
        if (!context.goalId) throw new Error('设计微习惯前需要选定学习目标。');
        const dashboard = this.learning.dashboard();
        const goal = dashboard.goals.find((item) => item.id === context.goalId);
        const task = dashboard.tasks.find((item) => item.goalId === context.goalId && !item.archived && !['done', 'archived'].includes(item.status));
        const topic = task?.title ?? goal?.title ?? extractGoalTitle(context.userInput);
        const habit = this.learning.createHabit({
          goalId: context.goalId,
          title: `${topic}·最小启动`,
          anchor: extractAnchor(context.userInput) ?? '我打开Self-Study当前目标后',
          tinyBehavior: extractTinyBehavior(context.userInput) ?? `只写下“${topic}”的一个问题或做第一步，持续30秒`,
          expansionBehavior: `状态允许时继续 ${Math.min(10, extractMinutes(context.userInput) ?? 10)} 分钟；不扩展也算成功。`,
          celebration: extractCelebration(context.userInput) ?? '轻轻点头，对自己说“我已经开始了”',
          minimumSeconds: 30,
          preferredMinutes: Math.min(25, extractMinutes(context.userInput) ?? 10)
        });
        return { summary: `已创建微习惯配方：当“${habit.anchor}”，我将“${habit.tinyBehavior}”，然后“${habit.celebration}”。完成最小版本即算成功。`, data: habit };
      }
      case 'habit.checkin': {
        if (!context.goalId) throw new Error('记录微习惯前需要选定学习目标。');
        const dashboard = this.learning.dashboard();
        const habit = dashboard.habits.find((item) => item.goalId === context.goalId && item.status === 'active');
        if (!habit) return { summary: '当前目标还没有启用的微习惯。你可以说“帮我设计一个微习惯”。' };
        const result = /没做|跳过|未完成/u.test(context.userInput) ? 'skipped' : /做了一点|部分/u.test(context.userInput) ? 'partial' : 'done';
        const checkIn = this.learning.checkInHabit({
          habitId: habit.id,
          result,
          motivation: inferFivePoint(context.userInput, 'motivation'),
          ability: inferFivePoint(context.userInput, 'ability'),
          promptSeen: !/没提醒|忘了|没有提示/u.test(context.userInput),
          celebrated: result === 'done',
          durationSeconds: Math.max(habit.minimumSeconds, (extractMinutes(context.userInput) ?? 1) * 60),
          note: context.userInput
        });
        const message = result === 'done'
          ? `已记录完成。现在执行庆祝：“${habit.celebration}”。今天不需要补偿性加量。`
          : `已记录${result === 'partial' ? '部分完成' : '跳过'}。这不是人格失败；下一次回到“${habit.tinyBehavior}”的最小版本。`;
        return { summary: message, data: checkIn };
      }
      case 'goal.update':
      case 'workspace.export':
        return { summary: `工具 ${tool} 需要通过显式界面或审批执行。` };
      default: {
        const exhaustive: never = tool;
        throw new Error(`未知工具：${String(exhaustive)}`);
      }
    }
  }
}

function extractGoalTitle(input: string): string {
  const cleaned = input.replace(/^(我想|我要|希望|请帮我|帮我|计划|目标是|请)\s*/u, '').replace(/[。！!？?].*$/u, '').trim();
  return cleaned.slice(0, 80) || '新的长期学习目标';
}

function extractSessionObjective(input: string): string {
  return input.replace(/开始|专注|学习|分钟|进入|模式/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 100) || '完成一个可验证的最小学习成果';
}

function extractArtifactTitle(input: string): string {
  return input.replace(/^(请|帮我|我想|我要|创建|做一个|制作)\s*/u, '').replace(/[。！!？?].*$/u, '').trim().slice(0, 100) || '新的学习作品';
}

function extractMinutes(input: string): number | undefined {
  const match = input.match(/(\d{1,3})\s*分钟/u);
  if (!match) return undefined;
  return Math.max(5, Math.min(180, Number(match[1])));
}

function inferStage(input: string): 'practice' | 'verification' | 'mapping' | 'understanding' {
  if (/验证|测试|检查|掌握/u.test(input)) return 'verification';
  if (/地图|体系|结构|路线/u.test(input)) return 'mapping';
  if (/练习|题|项目|作品|实战/u.test(input)) return 'practice';
  return 'understanding';
}

function inferSessionMode(intent: IntentName): SessionMode {
  if (intent === 'review') return 'review';
  if (intent === 'create-artifact' || intent === 'practice') return 'project';
  if (intent === 'reflect') return 'reflection';
  if (intent === 'show-knowledge') return 'research';
  return 'focus';
}

function inferArtifactKind(input: string): 'note' | 'code' | 'essay' | 'experiment' | 'project' | 'presentation' | 'dataset' | 'other' {
  if (/代码|应用|软件|程序/u.test(input)) return 'code';
  if (/文章|论文|报告/u.test(input)) return 'essay';
  if (/实验/u.test(input)) return 'experiment';
  if (/演示|PPT|幻灯/u.test(input)) return 'presentation';
  if (/数据集|数据/u.test(input)) return 'dataset';
  return 'project';
}

function extractRating(input: string): ReviewRating | undefined {
  if (/再次|忘了|不会/u.test(input)) return 'again';
  if (/困难|很难/u.test(input)) return 'hard';
  if (/良好|还行|正确/u.test(input)) return 'good';
  if (/轻松|简单/u.test(input)) return 'easy';
  return undefined;
}

function sessionModeLabel(mode: SessionMode): string {
  return ({ focus: '专注', review: '复习', project: '项目', research: '研究', reflection: '反思' } as Record<SessionMode, string>)[mode];
}

function ratingLabel(rating: ReviewRating): string {
  return ({ again: '再次', hard: '困难', good: '良好', easy: '轻松' } as Record<ReviewRating, string>)[rating];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}


function extractAnchor(input: string): string | undefined {
  const match = input.match(/(?:当|在|每次|等到)([^，。；]{2,60})(?:后|时)/u);
  return match?.[1]?.trim();
}

function extractTinyBehavior(input: string): string | undefined {
  const match = input.match(/(?:我就|我将|只做|微行为是|最小行动是)([^，。；]{2,100})/u);
  return match?.[1]?.trim();
}

function extractCelebration(input: string): string | undefined {
  const match = input.match(/(?:庆祝|完成后)(?:是|就)?([^，。；]{2,80})/u);
  return match?.[1]?.trim();
}

function inferFivePoint(input: string, kind: 'motivation' | 'ability'): number {
  const explicit = input.match(kind === 'motivation' ? /动机\s*([1-5])/u : /(?:容易度|能力)\s*([1-5])/u);
  if (explicit) return Number(explicit[1]);
  if (/很难|没动力|不想/u.test(input)) return kind === 'motivation' ? 2 : 2;
  if (/轻松|很容易|状态很好/u.test(input)) return 5;
  return 3;
}

function extractWeeklyMinutes(input: string): number | undefined {
  const weeklyHours = input.match(/每周\s*(\d+(?:\.\d+)?)\s*小时/u);
  if (weeklyHours) return Math.max(15, Math.min(10_080, Math.round(Number(weeklyHours[1]) * 60)));
  const weeklyMinutes = input.match(/每周\s*(\d+)\s*分钟/u);
  return weeklyMinutes ? Math.max(15, Math.min(10_080, Number(weeklyMinutes[1]))) : undefined;
}

function extractLearnerName(input: string): string | undefined {
  const match = input.match(/(?:我叫|学习者是|称呼我为)\s*([\p{L}\p{N}_·-]{1,30})/u);
  return match?.[1];
}
