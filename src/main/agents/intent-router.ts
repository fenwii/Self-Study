import type { IntentName } from '../../shared/domain';

export function routeIntent(input: string): IntentName {
  const text = input.trim();
  if (/学习契约|一对一契约|教练方式|每周投入|成功标准|陪我制定.*规则/u.test(text)) return 'setup-contract';
  if (/周复盘|本周复盘|一周总结|周总结|回顾这一周/u.test(text)) return 'weekly-review';
  if (/为什么.*做不到|不想学|拖延|没动力|太难了|总是忘|行为诊断/u.test(text)) return 'behavior-diagnose';
  if (/完成.*微习惯|打卡|刚刚做了|最小行动.*完成|完成.*最小行动|今天.*做了/u.test(text)) return 'habit-checkin';
  if (/微习惯|习惯配方|锚点|最小行动|小到不能失败|设计.*习惯/u.test(text)) return 'design-habit';
  if (/导入.*资料|添加.*资料|本地资料|资料库/u.test(text) && /导入|添加/u.test(text)) return 'import-resource';
  if (/搜索.*资料|查找.*资料|资料库.*找|从资料中/u.test(text)) return 'search-library';
  if (/学习路径|路线图|里程碑|一条龙路径|编译.*路径/u.test(text)) return 'compile-path';
  if (/验收.*作品|评估.*作品|作品.*验收/u.test(text)) return 'evaluate-artifact';
  if (/提交.*评估|这是我的答案|我的回答是/u.test(text)) return 'take-assessment';
  if (/考考我|创建.*评估|能力评估|掌握度测试/u.test(text)) return 'take-assessment';
  if (/进度|我学到哪|完成多少|学习情况|仪表盘/u.test(text)) return 'show-progress';
  if (/知识图谱|展示.*知识|知识节点|我会什么|我还缺什么/u.test(text)) return 'show-knowledge';
  if (/结束.*学习|结束.*会话|完成.*专注|学习总结/u.test(text)) return 'reflect';
  if (/开始.*学习|开始.*专注|专注.*分钟|学习.*分钟|进入.*模式/u.test(text)) return 'start-session';
  if (/复习|回忆|遗忘|间隔重复|今天.*复习/u.test(text)) return 'review';
  if (/作品|产出|交付物|做一个.*项目|创建.*项目|作品集/u.test(text)) return 'create-artifact';
  if (/反思|复盘|哪里做得|总结今天|学习日志/u.test(text)) return 'reflect';
  if (/验证|检查我|考考我|测试我|是否掌握|评估/u.test(text)) return 'verify';
  if (/练习|出题|实战|挑战|闯关/u.test(text)) return 'practice';
  if (/路线|计划|学习路径|怎么学/u.test(text)) return 'plan-learning';
  if (/我想|我要|目标|计划在.*学会|希望.*掌握/u.test(text)) return 'create-goal';
  if (/解释|什么是|为什么|讲讲|演示/u.test(text)) return 'explain';
  return 'general';
}
