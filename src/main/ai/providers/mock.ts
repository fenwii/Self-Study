import type { LLMProvider, LLMRequest, LLMResponse } from './types';

export class MockProvider implements LLMProvider {
  readonly kind = 'mock';

  async complete(request: LLMRequest): Promise<LLMResponse> {
    await delay(220, request.signal);
    const messages = request.messages;
    const user = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const system = messages.find((m) => m.role === 'system')?.content ?? '';

    // Extract composition from system prompt for level-aware responses
    const agentMatch = system.match(/A([1-5])/);
    const agentLevel = agentMatch ? Number(agentMatch[1]) : 3;

    return {
      text: buildResponse(user, system, agentLevel),
      inputTokens: Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 3.2),
      outputTokens: 380,
      costCny: 0
    };
  }
}

function buildResponse(userInput: string, _systemPrompt: string, level: number): string {
  const input = userInput.trim();

  // === Goal creation ===
  if (/我想|我要|目标|学会|掌握|三个月|六个月|计划.*学/u.test(input) && !/契约|习惯|复习|评估/u.test(input)) {
    return buildGoalCreationResponse(input, level);
  }

  // === Explanation / teaching ===
  if (/解释|什么是|为什么|讲讲|演示|怎么理解|如何|区别/u.test(input)) {
    return buildExplanationResponse(input, level);
  }

  // === Practice / exercise ===
  if (/练习|做题|出题|实战|挑战|训练|闯关/u.test(input)) {
    return buildPracticeResponse(input, level);
  }

  // === Review / spaced repetition ===
  if (/复习|回忆|遗忘|间隔|今天.*复习|帮我.*复习/u.test(input)) {
    return buildReviewResponse(level);
  }

  // === Verification / assessment ===
  if (/验证|检查|考考我|测试|是否掌握|评估/u.test(input)) {
    return buildVerificationResponse(level);
  }

  // === Behavior diagnosis (Fogg Model) ===
  if (/为什么.*做不到|不想学|拖延|没动力|太难了|总是忘|行为诊断|无法开始/u.test(input)) {
    return buildBehaviorDiagnosisResponse(level);
  }

  // === Habit design ===
  if (/微习惯|习惯配方|锚点|最小行动|小到不能|设计.*习惯|帮我.*建立.*习惯/u.test(input)) {
    return buildHabitDesignResponse(input, level);
  }

  // === Habit check-in ===
  if (/完成.*微习惯|打卡|刚刚做了|最小行动.*完成|今天.*做了|记录.*微习惯/u.test(input)) {
    return buildHabitCheckinResponse(level);
  }

  // === Learning contract ===
  if (/学习契约|一对一契约|教练方式|每周投入|成功标准|陪我制定.*规则|学习.*约定/u.test(input)) {
    return buildContractResponse(input, level);
  }

  // === Weekly review ===
  if (/周复盘|本周复盘|一周总结|周总结|回顾这一周|本周.*学/u.test(input)) {
    return buildWeeklyReviewResponse(level);
  }

  // === Learning path ===
  if (/学习路径|路线图|里程碑|一条龙路径|编译.*路径|怎么.*学.*路线/u.test(input)) {
    return buildPathResponse(input, level);
  }

  // === Reflection ===
  if (/反思|复盘|哪里做得|总结今天|学习日志|结束.*学习/u.test(input)) {
    return buildReflectionResponse(level);
  }

  // === Artifact / project ===
  if (/作品|产出|交付物|做一个.*项目|创建.*项目|作品集/u.test(input)) {
    return buildArtifactResponse(input, level);
  }

  // === Progress check ===
  if (/进度|我学到哪|完成多少|学习情况|仪表盘/u.test(input)) {
    return buildProgressResponse(level);
  }

  // === Resource / library ===
  if (/导入.*资料|添加.*资料|本地资料|资料库|从资料|搜索.*资料/u.test(input)) {
    return buildResourceResponse(level);
  }

  // === General / fallback ===
  return buildGeneralResponse(input, level);
}

// ── Response builders ──

function buildGoalCreationResponse(input: string, level: number): string {
  const title = input
    .replace(/^(我想|我要|希望|请帮我|帮我|计划是|目标是|请)\s*/u, '')
    .replace(/[。！!？?].*$/u, '')
    .trim()
    .slice(0, 60) || '新的学习目标';

  const lines = [
    `收到。我们不急着列课程表——先把"${title}"变成一个可验证、可完成、能形成独立能力的长期目标。`,
    '',
    '### 演示：完整闭环',
    '目标诊断 → 知识地图 → 每周任务 → 真实作品 → 延迟复测 → 跨场景迁移。',
    '每一步都留下你自己的证据，而不是 AI 的输出。',
    '',
    '### 降维：用旅行比喻',
    '目标是终点，知识地图是路线，任务是每天走的路，作品和复测是到站凭证。',
    '你不会因为"看了地图"就说自己到过那里。',
    '',
    '### 体系：现在需要明确四件事',
    '1. **已有基础**：不查资料，你现在知道什么、会做什么？',
    '2. **每周时间**：真实可投入的分钟数（不是理想状态）；',
    '3. **最终作品**：完成后能拿出什么给第三方看？',
    '4. **掌握证据**：什么现象能证明你已经"真的会了"？',
  ];

  if (level >= 4) {
    lines.push(
      '',
      `当前 CHART 自治层级 A${level}：我会把目标编译为带证据门槛的一条龙路径，`,
      '每个阶段只有上一阶段留下独立证据后才解锁。',
      '',
      '**下一步（30秒）：** 用你自己的话写出：现在会什么、最不确定什么、最后想做出什么。'
    );
  } else {
    lines.push(
      '',
      '**下一步（2分钟）：** 写三句话——你现在会什么、最不确定什么、想独立做出什么。'
    );
  }

  return lines.join('\n');
}

function buildExplanationResponse(_input: string, level: number): string {
  const lines = [
    '我用"演示—降维—体系"三步带你理解，而不是直接给你定义。',
    '',
    '### 1. 演示：先看它怎么工作',
    '从一个最小、可观察的例子开始。你不用懂全部术语，先看到"输入→过程→输出"。',
    '',
    '### 2. 降维：连接你已有的经验',
    '找一个你熟悉的场景做类比。同时明确指出：这个类比在哪里会失效。',
    '好的类比要标注边界，否则会制造新的误解。',
    '',
    '### 3. 体系：放回知识结构',
    '标出前置依赖（不懂A就学不会B）、相邻概念（容易混淆的）、',
    '实际用途（在哪里用）和未知边界（当前知识的极限）。',
  ];

  if (level >= 3) {
    lines.push(
      '',
      '在我展开之前，**请先写一句你现在对这件事的理解**。',
      '不是考你——是从你的真实起点出发，不重复你已经知道的内容。'
    );
  } else {
    lines.push('', '在我展开之前，你可以先想一想：这件事和你已经会的什么东西最像？');
  }

  return lines.join('\n');
}

function buildPracticeResponse(_input: string, _level: number): string {
  return [
    '学习不是"听懂了"，而是"能独立做出"。',
    '',
    '### 练习设计原则',
    '我会给你一个最近发展区任务：不太简单（否则是重复），也不太难（否则会放弃）。',
    '你会得到三级提示阶梯：',
    '1. **方向提示**：只给你大方向，不涉及具体解法；',
    '2. **局部提示**：在一个关键点上给线索；',
    '3. **完整演示**：展示一个类似但不同的例子的完整过程。',
    '',
    '### Fogg 行为模型提醒',
    '如果觉得太难，不是你的问题——是任务需要再缩小一步。',
    '**B = MAP**：行为发生 = 动机 + 能力 + 提示在同一时刻汇聚。',
    '我们把"能力"这一项调高：减少步骤、降低认知负担、缩短时间。',
    '',
    '**下一步：** 先独立尝试 5 分钟，再决定是否需要提示。不要提前看答案。'
  ].join('\n');
}

function buildReviewResponse(_level: number): string {
  return [
    '复习不是重读，而是**无提示回忆**——合上所有资料，用自己的话复述核心概念、过程和边界。',
    '',
    '### 间隔复习原理',
    '遗忘不是失败，是大脑的自然机制。间隔复习利用"提取强度"原理：',
    '每次从记忆中费力提取，都会让下一次提取更容易，保持更久。',
    '',
    '### 操作方式',
    '1. 先不看答案，尝试回忆或独立完成；',
    '2. 对照正确答案，找出差异；',
    '3. 诚实选择：再次（几乎忘了）、困难（想了很久）、良好（基本正确）、轻松（秒答）。',
    '',
    '### Fogg 行为视角',
    '选择"再次"不是失败——它告诉系统这个知识点需要更小的间隔和更多的提取练习。',
    '不要因为"困难"就跳过评分：诚实的数据让算法为你工作。',
    '',
    '**下一步：** 打开复习面板，完成今天到期的一项复习，按真实难度评分。'
  ].join('\n');
}

function buildVerificationResponse(_level: number): string {
  return [
    '掌握 ≠ 听懂 ≠ 做对一次。真正掌握需要三重证据：',
    '',
    '### 三重验证标准',
    '1. **独立性**：不看资料、不靠提示，能独立完成吗？',
    '2. **保持性**：隔一天、一周、一个月后，还能复现吗？',
    '3. **迁移性**：换一个场景、换一种问法，还能应用吗？',
    '',
    '### 常见误解检查',
    '我会特别关注：',
    '- 你"做对了"但解释错了（幸运的正确）；',
    '- 你能复述但不会变化（表面理解）；',
    '- 你能用一个方法但不知道边界（未形成判断）。',
    '',
    '**下一步：** 说"考考我"，我会围绕当前目标生成一次独立掌握评估。'
  ].join('\n');
}

function buildBehaviorDiagnosisResponse(_level: number): string {
  return [
    '我们不谈意志力，不谈懒惰。每个行为背后都有三个条件——这就是福格行为模型的核心：',
    '',
    '### B = MAP：行为 = 动机 × 能力 × 提示',
    '只有当这三者在同一时刻汇聚，行为才会发生。任何一个为零，行为就是零。',
    '',
    '### 现在我们来诊断',
    '请诚实回答（不需要告诉我，在心里想）：',
    '',
    '**动机（Motivation）**',
    '- 这件事对你真的重要吗？还是"应该做"？',
    '- 完成后你会感受到什么？恐惧失败还是期待成果？',
    '',
    '**能力（Ability）**',
    '- 这件事是不是太大了？（比如"学习机器学习" vs "打开一个教程读第一段"）',
    '- 有没有时间、工具、认知负担或体力上的真实障碍？',
    '',
    '**提示（Prompt）**',
    '- 有什么东西在你想学的时候恰好提醒你？',
    '- 还是只能靠"想起来"和"意志力"？',
    '',
    '### 福格模型的黄金法则',
    '**提高能力比提高动机更有效。** 当行为没有发生时，',
    '优先缩小动作——缩到 30 秒也能完成的版本——而不是反复说服自己"我应该更努力"。',
    '',
    '**下一步：** 告诉我你最想开始但一直没开始的一件事，我帮你把它缩小到"小到不能失败"。'
  ].join('\n');
}

function buildHabitDesignResponse(input: string, _level: number): string {
  const topic = input.replace(/.*(?:微习惯|习惯配方|设计|建立|帮我).*(?:关于|针对|为了)?/u, '').replace(/[。！!？?]/gu, '').trim() || '当前学习目标';

  return [
    '福格行为模型的实践方法：**微习惯配方**。',
    '',
    '### 配方三要素',
    '1. **锚点（Anchor）**：一个已经在你的生活中稳定发生的事件——',
    '   "我喝完早晨第一杯水后"、"我合上笔记本电脑前"、"我打开 Self-Study 后"。',
    '2. **最小行为（Tiny Behavior）**：小到低能量、没心情时也能完成的动作——',
    '   "只打开项目文件并读一行 TODO"、"只写一个问题"、"只做一个俯卧撑"。',
    `3. **即时庆祝（Celebration）**：完成最小动作后立即做——`,
    '   "轻轻点头，对自己说‘我已经开始了’"、"在笔记本上画一个对勾并微笑"。',
    '',
    '### 关键原则',
    '- **完成最小版本即算成功**，不要求扩展；',
    '- **跳过后不补偿**：不连做、不加量，只恢复到最小版本；',
    '- **能力链**：从"我做不到"到"我能做到"的关键是缩小动作，不是增强动机；',
    '- **连续天数只是观察信号**，不是羞耻或排名工具。',
    '',
    `针对"${topic.slice(0, 28)}"，我建议的配方：`,
    '',
    `**锚点：** 打开 Self-Study 当前目标后`,
    `**最小行为：** 只写下今天的一个问题或做第一步，持续 30 秒`,
    `**庆祝：** 轻轻点头，对自己说"我已经开始了"`,
    '',
    '**下一步：** 说"帮我保存这个微习惯"，我会把它写入你的行为系统。'
  ].join('\n');
}

function buildHabitCheckinResponse(_level: number): string {
  return [
    '已记录。让我们用福格模型的视角看待这次行动：',
    '',
    '### 完成 = 成功',
    '你完成了最小版本——这本身就是成功。扩展行为是可选奖励，不是必须。',
    '',
    '### 行为条件回顾',
    '花 5 秒回顾：',
    '- 当时动机高还是低？',
    '- 动作难度刚好还是需要再缩小？',
    '- 锚点提示出现了吗？还是靠"想起来"？',
    '',
    '### 能力链调整',
    '如果下次更难开始，就把动作再缩小一半。如果已经稳定一周，可以自然扩展。',
    '但始终保留最小版本作为低能量保底。',
    '',
    '**庆祝时刻：** 完成最小行动后，做你约定的庆祝动作——这不是仪式，是大脑的"成功编码"。',
    '福格博士的研究表明：**庆祝是习惯形成的核心机制**，它告诉大脑"这个行为值得重复"。'
  ].join('\n');
}

function buildContractResponse(_input: string, _level: number): string {
  return [
    '一对一学习契约不是承诺"我会努力"——它是你和 AI 之间的协作规则：',
    '明确成功定义、真实时间预算、教练方式和自主性边界。',
    '',
    '### 契约包含六个核心',
    '1. **为什么现在学**：不是"应该学"，而是"为什么是现在"——这决定了动机的真实性；',
    '2. **成功定义**：不是"学完"，而是"能独立做什么、拿出什么证据"；',
    '3. **时间预算**：每周真实可投入分钟数——保守估计，不按理想状态填写；',
    '4. **教练方式**：苏格拉底追问 / 直接指导 / 平衡 / 项目驱动；',
    '5. **反馈偏好**：温和 / 直接 / 证据优先；',
    '6. **自主性目标**：从 20% 到 100%，当前 AI 应该代劳多少，你希望最终独立多少。',
    '',
    '### 福格行为视角',
    '学习契约本质上是**动机与能力的长期结构设计**：',
    '- 时间预算过低 → 能力不足 → 行为无法发生 → 自我责备；',
    '- 时间预算过高 → 动机无法持续 → 放弃 → 归因于"不够自律"。',
    '契约帮助我们在开始之前就校准这三个变量。',
    '',
    '**下一步：** 打开进度面板 → 契约标签，填写你的真实数据和偏好。'
  ].join('\n');
}

function buildWeeklyReviewResponse(_level: number): string {
  return [
    '周复盘不是自我检讨——它是基于真实数据的行为和学习审计。',
    '',
    '### 复盘四步',
    '1. **事实陈述**：本周完成了多少会话、多少微行动、多少证据？先看数据，不看感觉。',
    '2. **行为诊断（B=MAP）**：没有发生的学习行为，是动机不足、能力不够、还是提示缺失？',
    '3. **能力证据**：本周有没有产生你自己的独立输出？还是全是 AI 生成的？',
    '4. **唯一调整**：只改变一个变量——动机、能力或提示，只选一个。',
    '',
    '### 福格模型的周复盘应用',
    '不要把未完成归因于"这周状态不好"或"我不够自律"——',
    '追问：动作还不够小？锚点消失了？时间预算被高估了？庆祝没发生？',
    '',
    '**下一步：** 打开进度面板 → 契约标签 → 周复盘，我会生成一份正式的教练总结。'
  ].join('\n');
}

function buildPathResponse(_input: string, level: number): string {
  const lines = [
    '一条龙学习路径不是课程目录——它是一个有证据门槛的状态机：',
    '只有上一阶段留下规定的独立证据后，下一阶段才解锁。',
    '',
    '### 路径结构',
    '1. **起点诊断**：不查资料，写出已有理解和能做的东西；',
    '2. **知识骨架**：最小但完整的前置依赖和核心节点；',
    '3. **主动练习**：最近发展区任务 + 提示阶梯；',
    '4. **独立作品**：一个可被第三方检查的真实成果；',
    '5. **延迟复测**：间隔复习 + 陌生场景迁移；',
    '6. **能力证据**：独立性、保持性、迁移性三重得分。',
  ];

  if (level >= 4) {
    lines.push(
      '',
      `CHART A${level} 模式下，每个里程碑都附带明确的证据门槛。`,
      '系统不会因为"任务标记为完成"就认为你掌握了——它要求可检查的输出。'
    );
  }

  lines.push('', '**下一步：** 说"编译我的学习路径"，系统会基于当前目标和证据生成一条动态路径。');
  return lines.join('\n');
}

function buildReflectionResponse(_level: number): string {
  return [
    '好的反思不空泛。我们问三个具体问题：',
    '',
    '1. **什么真正推动了理解？**',
    '   不是"我今天学了 2 小时"，而是"我在不看资料的情况下画出了状态机图，发现了三个之前没注意到的边界条件"。',
    '',
    '2. **什么在阻碍你？**',
    '   区分：知识缺口（真不会）vs 任务过大（会但没开始）vs 注意力分散（开始但中断）。',
    '',
    '3. **唯一下一步是什么？**',
    '   不是"继续学"，而是"明天打开 X 文件，不看文档，独立完成 Y 功能"。',
    '',
    '### 福格行为视角',
    '反思如果只停留在"这周不够努力"，会激发羞耻回路，反而降低下一次的动机。',
    '把反思变成：**上一次行为为什么没有发生？下一次如何把动作缩到能发生？**',
    '',
    '**下一步：** 写下一句话版"有效/阻塞/下一步"，我会保存为学习反思。'
  ].join('\n');
}

function buildArtifactResponse(_input: string, _level: number): string {
  return [
    '作品是学习最诚实的证据。它不需要很大——但需要是你自己做的。',
    '',
    '### 作品锻造四步',
    '1. **定义用户和边界**：这个作品给谁看/用？什么不算？',
    '2. **写验收标准**：做成什么样算通过？标准要在开始之前写清楚；',
    '3. **设定里程碑**：把大作品拆成 2-4 个可独立检查的阶段；',
    '4. **保留来源**：哪些部分是你独立完成的，哪些参考了外部资源。',
    '',
    '### 为什么作品比考试更准',
    '作品同时检查了：知识（你知道什么）、技能（你能做什么）、',
    '决策（你如何取舍）和迁移（你能在新场景中应用吗）。',
    '',
    '**下一步：** 告诉我你想做什么作品，我帮你定义边界和验收标准。'
  ].join('\n');
}

function buildProgressResponse(_level: number): string {
  return [
    '进度不以学习时长衡量——以能力证据衡量。',
    '',
    '### 当前状态检查',
    '打开右侧进度面板，你会看到：',
    '- 知识节点掌握度（不是"学过"，是"独立复现"）；',
    '- 到期复习数量（越少越好——说明保持力稳定）；',
    '- 开放误解（需要修复的概念漏洞）；',
    '- 能力证据（独立性 × 保持性 × 迁移性）；',
    '- 作品状态（草稿 → 修订 → 验收）。',
    '',
    '### 行为层面',
    '连续天数不是炫耀的徽章——它是系统向你反馈"行为是否稳定"的信号。',
    '如果你连续做了 5 天微习惯，不是"成功了"，而是"当前锚点、能力和动机配方是有效的"。',
    '如果断了 3 天，不是"失败了"，而是"配方需要调整一个变量"。',
    '',
    '**下一步：** 打开右侧进度面板，选择一个你最关心的维度查看详情。'
  ].join('\n');
}

function buildResourceResponse(_level: number): string {
  return [
    '你的个人资料库只属于你——所有导入的资料都保存在本地，不会上传。',
    '',
    '### 支持的格式',
    '- TXT 纯文本',
    '- Markdown（.md）',
    '- JSON',
    '- CSV',
    '- 单文件最大 5MB',
    '',
    '### 导入后会自动',
    '1. 生成 SHA-256 校验值（确保资料完整性）；',
    '2. 按语义分块（便于检索）；',
    '3. 提取摘要和关键词；',
    '4. 关联到当前学习目标。',
    '',
    '### 检索时',
    'AI 会优先引用你的本地资料，并明确标注来源。',
    '如果资料不足以回答问题，AI 会说明缺口，不会假装知道。',
    '',
    '**下一步：** 点击右侧资料库面板的"导入资料"，选择你要加入的文件。'
  ].join('\n');
}

function buildGeneralResponse(input: string, level: number): string {
  const topic = input.slice(0, 60);

  const lines = [
    `我已经把"${topic}"纳入当前学习上下文。`,
    '',
    '我们不追求一次得到最多内容，而追求得到一个**可执行、可验证、能形成独立能力的下一步**。',
    '',
    '### 当前系统能力（CHART A' + level + '-D' + level + '）',
  ];

  if (level >= 4) {
    lines.push(
      '- 长程记忆与跨会话上下文保持',
      '- 风险感知工具执行 + 人工审批',
      '- 动态难度与路径调整',
      '- 完整审计追踪与交叉验证'
    );
  } else {
    lines.push(
      '- 目标 → 知识地图 → 任务 → 复习闭环',
      '- 行为诊断与微习惯设计',
      '- 间隔复习与掌握度追踪'
    );
  }

  lines.push(
    '',
    '### 你现在可以',
    '- 直接说"我想学___"，我会帮你建立长期目标；',
    '- 说"考考我"，创建独立掌握评估；',
    '- 说"帮我设计微习惯"，建立最小学习行为；',
    '- 说"建立学习契约"，约定时间、成功标准和教练方式；',
    '- 导入学习资料到个人资料库；',
    '- 创建作品并验收。',
    '',
    '**下一步：** 选一个方向，用自然语言告诉我你想做什么。不需要学习任何命令。'
  );

  return lines.join('\n');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
