# 一对一学习契约与正式周复盘

## 1. 为什么需要契约

普通聊天AI只处理当前问题。一对一自学系统必须知道：为什么学、怎样算成功、每周真实能投入多少、学习者希望怎样被反馈，以及AI最终要撤除到什么程度。

契约不是法律文件，而是学习者与AI教练之间可编辑、可暂停、可版本化的工作协议。

## 2. 契约字段

```typescript
interface LearningContract {
  goalId: string;
  learnerName: string;
  whyNow: string;
  successDefinition: string;
  weeklyMinutes: number;
  sessionMinutes: number;
  preferredDays: number[];
  preferredTime: string;
  coachingStyle: 'socratic' | 'direct' | 'balanced' | 'project';
  feedbackPreference: 'gentle' | 'direct' | 'evidence-first';
  challengeLevel: number;
  autonomyTarget: number;
  minimumCommitment: string;
  reviewCadence: 'weekly' | 'biweekly' | 'monthly';
  status: 'draft' | 'active' | 'paused' | 'completed';
  version: number;
}
```

## 3. 契约如何改变系统行为

### 时间边界

路径、任务和每周会话数不得超过真实预算。系统根据：

```text
plannedSessions = ceil(weeklyMinutes / sessionMinutes)
```

生成周计划，但至少保留一次正式学习机会。

### 教练方式

- `socratic`：优先提问、反问和自我解释；
- `direct`：在用户明确需要时先给出清晰示范；
- `balanced`：示范、尝试、反馈和撤除脚手架平衡；
- `project`：围绕作品、里程碑和真实交付组织学习。

### 自主性目标

能力证据中的独立性均值与契约目标比较：

```text
currentAutonomy = average(evidence.independence)
autonomyGap = autonomyTarget - currentAutonomy
```

差距较大时，Alignment要求减少直接答案，增加独立尝试、证据与迁移。

## 4. 正式周复盘

周复盘保存：

- 周期开始和结束；
- 计划会话数；
- 完成会话数；
- 完成最小行动数；
- 新增能力证据数；
- 学习者反思；
- 教练摘要；
- 下周唯一重点；
- 行为调整。

复盘原则：

1. 先陈述事实，不做人格判断；
2. 行为、学习和成果分开判断；
3. 一次只调整一个关键变量；
4. 连续天数不能替代能力证据；
5. 学习完成率低时优先缩小计划和摩擦；
6. 学习稳定后优先增加独立尝试、真实作品和迁移。

## 5. 生命周期

```text
无契约
→ 草稿
→ 学习者确认
→ 启用
⇄ 暂停
→ 完成
```

每次保存版本号递增，历史Trace记录本次运行使用的契约版本。旧目标升级到V1.0时不自动创建契约，必须由用户明确确认。
