# 行为设计与微习惯工程

## 1. 定位

Self-Study V1.0 的行为设计层不是提醒器、打卡器或激励话术库，而是一个目标级学习行为控制系统：

```text
学习者当前状态
+ 真实生活锚点
+ 学习任务摩擦
+ 长期能力目标
        ↓
一个此刻真正能发生的最小学习行为
```

实现依据公开的 Fogg Behavior Model 与 Tiny Habits 方法进行工程化转译，不代表合作、授权或背书。

## 2. 行为状态模型

行为画像包含：

```ts
interface BehaviorState {
  motivation: number;
  ability: number;
  promptReliability: number;
  successRate: number;
  activeHabitCount: number;
  todayCompleted: number;
  suggestedTinyAction: string;
  diagnosis: string[];
}
```

评分使用最近七天真实Check-in，而不是用户人格标签。

### 动机

来源于行为发生时的1—5分自评。低动机时不默认增加说服或奖惩，而是先降低行为门槛并连接目标意义。

### 能力

衡量动作在当时是否容易。能力不足时可以减少：

- 行为步骤；
- 所需时间；
- 工具切换；
- 环境准备；
- 认知负荷；
- 完美标准。

### 提示可靠性

衡量提示是否与稳定、可观察、自然发生的生活事件连接。提示失效时修改锚点，而不是增加通知数量。

## 3. 目标隔离

平台同时提供：

```text
behaviorState       学习空间汇总
behaviorStates[id]  单个目标行为画像
```

Agent Context、聊天下一步和Inspector均读取当前目标画像，避免不同领域相互污染。

## 4. 微习惯数据结构

```ts
interface HabitRecipe {
  goalId: string;
  anchor: string;
  tinyBehavior: string;
  expansionBehavior: string;
  celebration: string;
  frequency: 'daily' | 'weekdays' | 'weekly' | 'custom';
  customDays: number[];
  minimumSeconds: number;
  preferredMinutes: number;
  status: 'active' | 'paused' | 'retired';
  streak: number;
  bestStreak: number;
}
```

### 锚点规则

合格锚点应当：

- 已经稳定发生；
- 可以被立即观察；
- 与目标行为发生地点相容；
- 不依赖另一个尚未形成的新习惯。

### 最小行为规则

- 默认30—120秒；
- 低能量状态也能完成；
- 无需复杂准备；
- 完成后可以立即判断；
- 本身能启动目标方向，而不是无关替代行为。

### 庆祝规则

- 紧接最小行为；
- 自然、不尴尬；
- 不依赖消费、积分或外部奖品；
- 目的是让学习者真实感到“我已经开始/我做到了”。

## 5. Check-in不是传统打卡

```ts
interface HabitCheckIn {
  result: 'done' | 'partial' | 'skipped';
  motivation: number;
  ability: number;
  promptSeen: boolean;
  celebrated: boolean;
  durationSeconds: number;
  note: string;
}
```

其用途是诊断配方，而不是评价人。

### 完成

- 立即提醒执行庆祝；
- 最小版本已经满足成功定义；
- 扩展属于可选行为；
- 不要求“趁热多做”。

### 部分完成

说明动作可能仍偏大，下一次进一步缩小。

### 跳过

- 不惩罚；
- 不补做；
- 不要求连续加量；
- 检查是能力、提示还是意义连接失效；
- 下一次回到最小版本。

## 6. 连续性边界

系统保留`streak`与`bestStreak`作为观察信息，但：

- 不以连续天数解锁学习权利；
- 不把中断渲染为损失；
- 不使用羞耻性红色警告；
- 不要求补签；
- 不用连续天数替代真实能力证据。

长期成功指标仍是：

```text
独立性 × 保持 × 迁移 × 作品
```

## 7. 自然语言路由

```text
行为诊断：没动力、拖延、太难、总是忘、为什么做不到
习惯设计：微习惯、锚点、最小行动、习惯配方
行为记录：完成微习惯、刚刚做了、打卡、最小行动完成
```

行为记录意图优先于设计意图，避免“完成了最小行动”被“最小行动”关键词误判为创建配方。

## 8. 与学习模块联动

### 任务

过大任务会被转换为微习惯候选，例如：

```text
“完成状态机项目”
→ “打开项目后，只写一个状态名称”
```

### 复习

到期复习可以绑定锚点，但复习质量仍通过Recall与间隔算法评价。

### 评估

微习惯只帮助开始评估，不能代替独立作答与评分。

### 作品

微习惯帮助持续推进作品；作品最终仍需量表验收。

### 证据

Check-in属于行为证据，不自动等同于能力证据。

## 9. CHART映射

- **C**：目标级行为历史、当前配方、近期M/A/P数据；
- **H**：类型化写入、范围校验、频率和状态约束；
- **A**：以独立能力为终点，禁止行为依赖和强迫设计；
- **R**：diagnose/design/checkin工具和SQLite状态；
- **T**：记录行为配方、结果、调整和责任链。

## 10. 反依赖原则

系统最终目标不是让用户依赖微习惯界面，而是逐步形成：

```text
外部提示
→ 稳定生活锚点
→ 自发启动
→ 按目标灵活调整
→ 不依赖平台也能持续学习
```

## 11. 本地日期与频率

行为发生时间同时保留UTC审计时间和设备本地日期。每日、工作日、每周与自定义频率都按本地日历判断；工作日习惯在周一计算连续性时会寻找上一个计划日（周五），而不是错误要求周末也完成。
