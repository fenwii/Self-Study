import { randomUUID } from 'node:crypto';
import type { AgentPlan, AgentPlanStep, IntentName } from '../../shared/domain';

const step = (title: string, description: string, tool?: AgentPlanStep['tool'], risk: AgentPlanStep['risk'] = 'low'): AgentPlanStep => ({
  id: randomUUID(), title, description, tool, risk, requiresApproval: false, status: 'pending'
});

export function createPlan(intent: IntentName, input: string, hasGoal: boolean): AgentPlan {
  const plans: Record<IntentName, AgentPlan> = {
    'create-goal': {
      objective: '把自然语言愿望转化为长期、可验证的学习目标。',
      rationale: '先定义结果、能力、作品和证据边界，再开始学习。',
      steps: [
        step('理解目标与时间尺度', '识别学习对象、期限、已有基础和最终作品。'),
        step('创建长期学习目标', input, 'goal.create'),
        step('建立起点知识节点', '记录起点、核心能力与作品三个节点。', 'knowledge.create'),
        step('安排第一次专注会话', '用25分钟完成不查资料的起点诊断。', 'session.start'),
        step('给出第一个最小行动', '提供今天可以完成并留下证据的任务。')
      ],
      expectedEvidence: ['起点诊断', '知识地图草案', '首个小作品'],
      stopConditions: ['目标无法描述为可验证成果', '学习者尚未确认投入时间']
    },
    'setup-contract': {
      objective: '建立正式的一对一学习契约，明确成功、时间、教练方式和自主性边界。',
      rationale: '长期学习需要稳定的协作规则；AI必须知道何时解释、何时追问、何时撤除帮助。',
      steps: [
        step('澄清为什么现在学习', '识别目标意义、现实约束与希望改变的结果。'),
        step('定义成功证据', '把成功改写为可观察、可验收的独立能力或作品。'),
        step('约定真实投入', '确定每周分钟数、单次会话长度、首选日期与时间。'),
        step('约定教练风格', '选择苏格拉底式、直接式、平衡式或项目式，以及反馈强度。'),
        step('保存一对一学习契约', input, hasGoal ? 'contract.upsert' : undefined, 'medium')
      ],
      expectedEvidence: ['学习契约', '成功定义', '时间预算', '自主性目标'],
      stopConditions: ['没有学习目标', '投入承诺明显超过真实可用时间']
    },
    'weekly-review': {
      objective: '完成一次不羞辱、基于证据的一对一周复盘。',
      rationale: '周复盘同时检查行为是否发生、学习是否推进、能力是否形成，并只调整一个关键变量。',
      steps: [
        step('读取本周真实数据', '统计专注会话、微行动、任务、评估、作品与能力证据。', 'knowledge.search'),
        step('生成正式周复盘', input, hasGoal ? 'review.weekly' : undefined),
        step('定位唯一主要摩擦', '区分时间、能力、提示、任务范围或反馈方式问题。'),
        step('确定下周唯一重点', '保留有效系统，只调整一个行为或学习变量。')
      ],
      expectedEvidence: ['本周事实', '教练总结', '行为调整', '下周唯一重点'],
      stopConditions: ['用连续天数或情绪评价替代真实学习证据']
    },
    'plan-learning': {
      objective: '构建最短有效学习路径和动态知识地图。',
      rationale: '路径必须围绕前置依赖、主动练习、间隔复习和作品。',
      steps: [
        step('读取现有目标与证据', '从长期上下文定位真实起点。', 'knowledge.search'),
        step('运行知识地图技能', '选择适合当前层级的动态知识地图技能。', 'skill.run'),
        step('创建核心知识节点', '形成基础、核心、迁移三个最小节点。', 'knowledge.create'),
        ...(hasGoal ? [step('创建下一项学习任务', input, 'task.create')] : []),
        step('安排关键节点复习', '为最容易遗忘的核心原则建立复习项。', 'review.schedule'),
        step('定义阶段验收', '说明什么证据才算真正掌握。')
      ],
      expectedEvidence: ['知识地图', '阶段任务', '复习队列', '验收标准'],
      stopConditions: ['缺少明确目标', '任务范围大于当前时间预算']
    },
    'start-session': {
      objective: '启动一段有明确成果边界的专注学习会话。',
      rationale: '把长期目标压缩为一次有限时、可结束、可留下证据的行动。',
      steps: [
        step('选择本次唯一目标', '从到期复习、误解和高优先任务中选择一个。', 'knowledge.search'),
        step('启动专注会话', input, 'session.start'),
        step('设置完成定义', '要求本次至少产生一次独立输出。'),
        step('准备会话结束证据', '结束时保存总结、作品或能力证据。')
      ],
      expectedEvidence: ['独立输出', '会话总结'],
      stopConditions: ['同时存在多个互斥目标', '目标无法在当前时间盒内完成']
    },
    explain: {
      objective: '用演示、降维、体系三法建立可迁移理解。',
      rationale: '解释不能只追求听懂，还要能复述、应用并知道边界。',
      steps: [
        step('激活已有理解', '邀请学习者先写出当前理解。'),
        step('运行万能三法技能', '按当前能力和目标调整演示、类比和体系深度。', 'skill.run'),
        step('检索长期学习上下文', '关联已有知识、误解和作品。', 'knowledge.search'),
        step('提出一个独立检验问题', '要求学习者不用AI完成。'),
        ...(hasGoal ? [step('安排延迟复习', '把核心原则加入复习队列。', 'review.schedule')] : [])
      ],
      expectedEvidence: ['学习者复述', '独立例子', '边界说明'],
      stopConditions: ['学习者未提供任何尝试且问题涉及作业代答']
    },
    practice: {
      objective: '把知识转化为一次主动练习。',
      rationale: '只听解释无法形成能力，必须产生学习者自己的输出。',
      steps: [
        step('运行主动练习技能', '设计最近发展区任务和提示阶梯。', 'skill.run'),
        ...(hasGoal ? [step('创建练习任务', input, 'task.create')] : []),
        step('启动练习会话', '建立25分钟时间盒。', 'session.start'),
        step('定义验收与迁移', '除完成任务外，再安排一个变化场景。')
      ],
      expectedEvidence: ['首次尝试', '修正记录', '迁移任务'],
      stopConditions: ['任务风险超出学习环境', '学习者要求直接提交答案']
    },
    review: {
      objective: '用无提示回忆和间隔重复降低遗忘。',
      rationale: '复习优先处理到期、低置信和反复出错的知识。',
      steps: [
        step('读取到期复习项', '优先选择最早到期和高遗忘风险内容。', 'knowledge.search'),
        step('运行间隔复习技能', '先无提示回忆，再展示答案与差异。', 'skill.run'),
        step('启动复习会话', input, 'session.start'),
        step('记录复习结果', '按再次、困难、良好、轻松更新下次时间。', 'review.record')
      ],
      expectedEvidence: ['无提示回忆', '真实难度评分'],
      stopConditions: ['没有可复习项目']
    },
    verify: {
      objective: '判断理解是否达到独立、保持和迁移标准。',
      rationale: '即时正确不等于长期掌握，需要保存证据和误解。',
      steps: [
        step('运行掌握度审计技能', '检查事实、逻辑、独立性和迁移。', 'skill.run'),
        step('保存当前独立表达', input, hasGoal ? 'evidence.create' : undefined),
        ...(hasGoal ? [step('记录待修复误解', '把最关键的错误形成可复测误解节点。', 'misconception.create')] : []),
        ...(hasGoal ? [step('安排无提示复测', '安排延迟回忆和变式任务。', 'review.schedule')] : []),
        step('给出掌握置信度', '明确已掌握、待验证和误解节点。')
      ],
      expectedEvidence: ['独立表达', '延迟复测', '迁移结果'],
      stopConditions: ['证据完全由AI生成', '没有学习者自己的输出']
    },
    'create-artifact': {
      objective: '把学习目标转化为可验收作品。',
      rationale: '作品是知识、技能、决策和迁移能力的综合证据。',
      steps: [
        step('运行作品锻造技能', '定义用户、边界、验收标准与里程碑。', 'skill.run'),
        ...(hasGoal ? [step('创建作品记录', input, 'artifact.create', 'medium')] : []),
        ...(hasGoal ? [step('创建首个作品任务', '只创建第一个可执行里程碑。', 'task.create')] : []),
        step('定义能力证据', '说明哪些部分必须由学习者独立完成。')
      ],
      expectedEvidence: ['作品规格', '验收标准', '首个里程碑'],
      stopConditions: ['没有明确目标', '作品范围无法在一个学习周期内验证']
    },
    'show-knowledge': {
      objective: '展示当前知识结构、薄弱节点和依赖关系。',
      rationale: '知识地图用于决策下一步，而不是装饰性目录。',
      steps: [
        step('读取知识节点和关系', '检索掌握度、置信度、误解和复习状态。', 'knowledge.search'),
        step('运行知识地图技能', '压缩为核心节点、前置依赖和下一杠杆点。', 'skill.run'),
        step('识别最薄弱承重节点', '优先指出阻塞后续迁移的基础。')
      ],
      expectedEvidence: ['知识状态摘要', '下一承重节点'],
      stopConditions: []
    },
    reflect: {
      objective: '把学习经历转化为可复用策略并结束当前会话。',
      rationale: '反思必须落到下一步行为。',
      steps: [
        step('识别有效行为', '找出真正促进理解或完成的动作。'),
        step('识别阻塞与误解', '区分知识缺口、任务过大和注意力问题。'),
        ...(hasGoal ? [step('保存学习反思', input, 'reflection.create')] : []),
        step('结束当前学习会话', '记录实际时间和会话成果。', 'session.complete'),
        step('确定唯一下一步', '选择一个最小、具体、可验证动作。')
      ],
      expectedEvidence: ['反思记录', '会话总结', '下一步行动'],
      stopConditions: ['反思没有关联真实行为或结果']
    },
    'show-progress': {
      objective: '以能力证据而非学习时长展示进度。',
      rationale: '进度反映独立完成、保持、迁移和作品。',
      steps: [
        step('读取目标、任务、证据和作品', '汇总当前学习状态。', 'knowledge.search'),
        step('区分完成与掌握', '标出已做任务和已验证能力。'),
        step('找出下一杠杆点', '选择最能推动目标的下一任务。')
      ],
      expectedEvidence: ['能力进度摘要'],
      stopConditions: []
    },
    'compile-path': {
      objective: '把长期目标编译为有里程碑、证据门槛和解锁条件的一条龙学习路径。',
      rationale: '路径不是课程目录，而是从起点到独立作品的可验证状态机。',
      steps: [
        step('读取目标与当前证据', '识别真实起点、时间预算和最主要缺口。', 'knowledge.search'),
        step('编译动态学习路径', input, hasGoal ? 'path.compile' : undefined, 'medium'),
        step('解释里程碑解锁规则', '只有上一阶段留下规定证据后才进入下一阶段。'),
        step('选择当前唯一阶段', '把长期路线压缩为今天一个可执行动作。')
      ],
      expectedEvidence: ['路径版本', '阶段里程碑', '证据门槛', '当前唯一行动'],
      stopConditions: ['没有明确目标', '路径没有独立能力或作品终点']
    },
    'import-resource': {
      objective: '把本地资料安全导入个人学习资料库。',
      rationale: '资料导入属于显式文件权限操作，必须由用户在桌面界面选择文件。',
      steps: [
        step('说明支持格式与边界', '支持TXT、Markdown、JSON和CSV纯文本资料，单文件最大5MB。'),
        step('等待用户选择文件', '通过资料库面板执行显式导入。'),
        step('建立分块与校验', '导入后生成SHA-256、摘要和本地检索分块。')
      ],
      expectedEvidence: ['资料清单', '校验值', '可检索片段'],
      stopConditions: ['文件包含不可解析二进制内容', '用户未授权文件访问']
    },
    'search-library': {
      objective: '从用户拥有的本地资料中检索与当前问题最相关的证据。',
      rationale: '优先使用个人资料并明确来源，避免把模型记忆当作资料事实。',
      steps: [
        step('检索本地资料', input, 'resource.search'),
        step('比较相关片段', '按标题、关键词命中和目标关联排序。'),
        step('结合长期上下文回答', '区分资料内容、模型推断和待验证结论。')
      ],
      expectedEvidence: ['来源资料名', '相关片段', '结论与证据映射'],
      stopConditions: ['资料库无相关内容']
    },
    'take-assessment': {
      objective: '创建或提交一次独立掌握评估。',
      rationale: '评估必须检查机制、迁移和误解，而不是只检查短期记忆。',
      steps: /提交|回答是|我的回答|这是我的答案|答案如下/u.test(input) ? [
        step('定位待提交评估', '选择当前目标最近的开放评估。', 'knowledge.search'),
        step('提交学习者独立答案', input, hasGoal ? 'assessment.submit' : undefined, 'medium'),
        step('生成反馈和后续复测', '不通过时指出缺失证据，通过后安排延迟迁移。')
      ] : [
        step('读取当前知识和误解', '基于目标、知识节点和证据确定评估范围。', 'knowledge.search'),
        step('创建独立掌握评估', input, hasGoal ? 'assessment.create' : undefined),
        step('说明作答规则', '一次性回答全部问题，不让AI代写。')
      ],
      expectedEvidence: ['学习者独立答案', '量化得分', '反馈', '后续复测'],
      stopConditions: ['没有学习目标', '答案完全由AI生成']
    },
    'evaluate-artifact': {
      objective: '依据作品量表和可检查证据完成阶段验收。',
      rationale: '作品存在不等于能力成立，需要逐项检查可运行性、解释力和独立贡献。',
      steps: [
        step('定位当前作品与量表', '读取作品内容、来源和验收标准。', 'knowledge.search'),
        step('执行作品验收', input, hasGoal ? 'artifact.evaluate' : undefined, 'medium'),
        step('形成修订或迁移建议', '通过后进入外部评审或陌生场景，不通过则只补最弱证据。')
      ],
      expectedEvidence: ['逐项评分', '验收结论', '下一修订动作'],
      stopConditions: ['没有作品', '作品无验收标准']
    },
    'behavior-diagnose': {
      objective: '找出学习行为没有发生的真实原因，并把下一步降到当前状态可以完成。',
      rationale: '行为失败通常来自动机、能力或提示没有在同一时刻满足，而不是人格或意志力缺陷。',
      steps: [
        step('读取近期行为状态', '检查动机、难度、提示可靠性和最近七天完成情况。', 'behavior.diagnose'),
        step('定位主要摩擦', '只选择一个当前最主要阻塞：意义不足、动作太难或提示失效。'),
        step('生成最小行动', '把行动压缩到低能量状态也能开始的版本。'),
        step('设计恢复规则', '跳过后不补偿、不连做，只回到最小版本。')
      ],
      expectedEvidence: ['主要行为阻塞', '一个可立即完成的最小行动', '恢复规则'],
      stopConditions: ['用羞耻、责备或虚假激励推动学习']
    },
    'design-habit': {
      objective: '为当前学习目标设计一个稳定、轻量、可恢复的微习惯配方。',
      rationale: '习惯配方由可靠锚点、极小行为和即时庆祝组成，扩展行为保持可选。',
      steps: [
        step('诊断行为条件', '读取当前动机、能力、提示和任务摩擦。', 'behavior.diagnose'),
        step('设计习惯配方', input, hasGoal ? 'habit.design' : undefined),
        step('检查动作是否足够小', '最小版本应在30—120秒内完成，不依赖高动机。'),
        step('约定成功定义', '完成最小版本即算成功，扩展不计入最低要求。')
      ],
      expectedEvidence: ['稳定锚点', '最小行为', '即时庆祝', '低能量保底版本'],
      stopConditions: ['没有学习目标', '动作仍依赖大块时间或复杂准备']
    },
    'habit-checkin': {
      objective: '记录一次真实行为，并用数据调整下一次配方。',
      rationale: '打卡用于学习行为设计，不用于制造连续天数压力。',
      steps: [
        step('记录最小行动', input, hasGoal ? 'habit.checkin' : undefined),
        step('判断行为条件', '分别记录当时动机、能力、提示是否出现。'),
        step('强化成功感', '完成最小版本后立即执行真实、不尴尬的庆祝。'),
        step('调整下一次难度', '困难时缩小动作，稳定后允许自然扩展。')
      ],
      expectedEvidence: ['行为结果', '动机/能力/提示数据', '下一次调整'],
      stopConditions: ['把跳过解释为失败人格', '要求补做或惩罚']
    },
    general: {
      objective: '理解真实意图并给出可执行的学习下一步。',
      rationale: '用户无需学习命令，系统负责路由。',
      steps: [
        step('理解当前表达', '结合长期上下文判断需求。'),
        step('选择合适技能', '决定演示、地图、练习或验证的比重。', 'skill.run'),
        step('生成最小行动', '给出一个立即可执行、可验证的下一步。')
      ],
      expectedEvidence: ['学习者下一次输出'],
      stopConditions: []
    }
  };
  return plans[intent];
}
