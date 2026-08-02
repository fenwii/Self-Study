import type { AgentSkill, IntentName } from '../../shared/domain';

export const BUILT_IN_SKILLS: AgentSkill[] = [
  {
    id: 'skill-three-methods',
    name: '万能三法教学',
    description: '用演示、降维、体系三法建立可迁移理解。',
    category: 'teach',
    minAgentLevel: 'A1',
    requiredTools: ['knowledge.search'],
    promptTemplate: '先演示运行过程，再建立准确类比并指出边界，最后放回知识体系。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-knowledge-atlas',
    name: '动态知识地图',
    description: '提取知识节点、前置依赖、易错点、应用和未知边界。',
    category: 'map',
    minAgentLevel: 'A2',
    requiredTools: ['knowledge.search', 'knowledge.create', 'knowledge.link'],
    promptTemplate: '构建最小但完整的知识图，并标记前置、核心、迁移与未知节点。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-active-practice',
    name: '主动练习教练',
    description: '设计最近发展区任务、提示阶梯与迁移挑战。',
    category: 'practice',
    minAgentLevel: 'A2',
    requiredTools: ['task.create', 'session.start'],
    promptTemplate: '先让学习者独立尝试，再按方向、局部、完整演示逐级提示。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-mastery-audit',
    name: '掌握度审计',
    description: '用独立性、保持、迁移三重证据判断是否掌握。',
    category: 'verify',
    minAgentLevel: 'A3',
    requiredTools: ['evidence.create', 'misconception.create', 'review.schedule'],
    promptTemplate: '区分听懂、会做、延迟保持和跨场景迁移，不以即时正确代替掌握。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-spaced-review',
    name: '间隔复习',
    description: '围绕易忘节点和误解生成复习队列。',
    category: 'review',
    minAgentLevel: 'A2',
    requiredTools: ['review.schedule', 'review.record'],
    promptTemplate: '优先复习到期、低置信和反复出错的知识，要求无提示回忆。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-project-forge',
    name: '作品锻造',
    description: '把学习目标转化为可验收的真实作品。',
    category: 'project',
    minAgentLevel: 'A3',
    requiredTools: ['task.create', 'artifact.create', 'evidence.create'],
    promptTemplate: '定义作品用户、边界、验收标准、里程碑和迁移任务。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-research-lens',
    name: '研究透镜',
    description: '解剖假设、证据、边界、争议与可证伪实验。',
    category: 'research',
    minAgentLevel: 'A4',
    requiredTools: ['knowledge.search', 'artifact.create'],
    promptTemplate: '把所有结论视为待检验假说，明确证据强度、反例和下一实验。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-path-compiler',
    name: '学习路径编译器',
    description: '把目标编译为阶段里程碑、证据门槛和动态解锁规则。',
    category: 'path',
    minAgentLevel: 'A3',
    requiredTools: ['knowledge.search', 'path.compile'],
    promptTemplate: '路径必须以独立能力和真实作品为终点，每个阶段都有可检查证据。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-local-library',
    name: '本地资料研究',
    description: '从用户拥有的本地资料中检索、引用并区分事实与推断。',
    category: 'library',
    minAgentLevel: 'A2',
    requiredTools: ['resource.search'],
    promptTemplate: '优先引用本地资料片段，明确来源；资料不足时说明缺口，不制造证据。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-authentic-assessment',
    name: '真实性能力评估',
    description: '用机制解释、迁移和误解验证学习者是否真正掌握。',
    category: 'assess',
    minAgentLevel: 'A3',
    requiredTools: ['assessment.create', 'assessment.submit', 'evidence.create'],
    promptTemplate: '评估学习者自己的输出，不把AI生成内容计为独立能力。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-tiny-habits',
    name: '微习惯行为教练',
    description: '用动机、能力与提示诊断行为，并设计锚点、最小行动和即时庆祝。',
    category: 'habit',
    minAgentLevel: 'A2',
    requiredTools: ['behavior.diagnose', 'habit.design', 'habit.checkin'],
    promptTemplate: '不责备意志力。先判断动机、能力、提示哪个缺失，再缩小行动，连接稳定锚点，并设计真实不尴尬的即时庆祝。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-one-to-one-contract',
    name: '一对一学习契约',
    description: '明确目标意义、成功证据、真实时间预算、教练风格与自主性边界。',
    category: 'coach',
    minAgentLevel: 'A2',
    requiredTools: ['contract.upsert'],
    promptTemplate: '把学习者的现实约束写进契约；默认保护自主性，不制造超出时间预算的计划。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-weekly-coaching-review',
    name: '一对一周复盘',
    description: '联合检查行为发生、学习推进和能力证据，并只调整一个关键变量。',
    category: 'coach',
    minAgentLevel: 'A3',
    requiredTools: ['review.weekly'],
    promptTemplate: '先陈述事实，再解释摩擦，最后确定下周唯一重点；不以情绪或连续天数替代能力证据。',
    enabled: true,
    version: '1.0.0'
  },
  {
    id: 'skill-reflection-loop',
    name: '学习反思闭环',
    description: '把一次经历提炼成下一轮可执行的个人学习策略。',
    category: 'reflect',
    minAgentLevel: 'A2',
    requiredTools: ['reflection.create', 'session.complete'],
    promptTemplate: '识别有效行为、阻塞根因和唯一下一步，避免空泛总结。',
    enabled: true,
    version: '1.0.0'
  }
];

const intentSkillMap: Record<IntentName, string[]> = {
  'create-goal': ['skill-knowledge-atlas'],
  'plan-learning': ['skill-knowledge-atlas', 'skill-project-forge'],
  'start-session': ['skill-active-practice'],
  explain: ['skill-three-methods'],
  practice: ['skill-active-practice'],
  review: ['skill-spaced-review'],
  verify: ['skill-mastery-audit'],
  'create-artifact': ['skill-project-forge'],
  'show-knowledge': ['skill-knowledge-atlas'],
  reflect: ['skill-reflection-loop'],
  'show-progress': ['skill-mastery-audit'],
  'compile-path': ['skill-path-compiler', 'skill-knowledge-atlas'],
  'import-resource': ['skill-local-library'],
  'search-library': ['skill-local-library'],
  'take-assessment': ['skill-authentic-assessment', 'skill-mastery-audit'],
  'evaluate-artifact': ['skill-project-forge', 'skill-authentic-assessment'],
  'design-habit': ['skill-tiny-habits'],
  'habit-checkin': ['skill-tiny-habits'],
  'behavior-diagnose': ['skill-tiny-habits', 'skill-reflection-loop'],
  'setup-contract': ['skill-one-to-one-contract'],
  'weekly-review': ['skill-weekly-coaching-review', 'skill-reflection-loop'],
  general: ['skill-three-methods']
};

export function selectSkills(intent: IntentName, agentLevel: AgentSkill['minAgentLevel']): AgentSkill[] {
  const current = Number(agentLevel.slice(1));
  const preferred = new Set(intentSkillMap[intent]);
  return BUILT_IN_SKILLS.filter((skill) => skill.enabled && preferred.has(skill.id) && Number(skill.minAgentLevel.slice(1)) <= current);
}
