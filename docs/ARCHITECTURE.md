# Self-Study AI V1.0.0 正式版架构

## V1.0正式版新增层

```text
Desktop Interaction
→ Goal Conversation Boundary
→ One-to-One Contract + Weekly Review
→ Behavior / Learning / Outcome Engines
→ CHART Orchestrator
→ Typed Runtime + Provider Control Plane
→ SQLite V10 + Evidence Ledger + Backup
```

每个目标的`LearningContract`与`OneToOneState`进入Context；Harness控制契约写入；Alignment按时间预算与自主性目标约束教学；Runtime执行`contract.upsert`与`review.weekly`；Trace记录契约版本、复盘依据和下一调整。

## 1. 产品壳层

```text
左侧：目标会话
中间：当前目标聊天、微小启动和唯一下一步
右侧：按需Inspector
```

行为设计被融入主聊天和目标Context，而不是作为孤立打卡应用。

## 2. 进程边界

```text
Renderer: React / Zustand / Markdown / KaTeX / 微习惯交互
  无Node、SQLite、密钥和任意文件访问
            ↓ 类型化IPC + Zod
Preload: 最小contextBridge白名单
            ↓
Main: Conversation / Behavior / Agent / CHART / SQLite / Provider / Trace / Backup
```

## 3. 一对一目标聚合

```text
Goal
└── GoalConversation
    ├── Message / Draft / AgentRun
    ├── Path / Task / Review / Knowledge
    ├── Resource / Assessment / Artifact / Evidence
    └── HabitRecipe / HabitCheckIn / BehaviorState
```

每个目标拥有独立行为配方和行为画像。

## 4. 行为设计执行链

```text
自然语言
→ Intent Router
→ behavior-diagnose / design-habit / habit-checkin
→ Goal-scoped Context
→ Planner + Alignment anti-shame rules
→ Harness风险与范围检查
→ Runtime Tool
→ SQLite事务
→ BehaviorState重新派生
→ C5下一最佳行动
```

## 5. 双闭环

```text
成果闭环：目标→路径→练习→评估→作品→迁移
行为闭环：动机/能力/提示→锚点→最小行动→庆祝→记录→调节
```

行为闭环负责让学习发生，成果闭环负责证明学习有效。

## 6. CHART

- **C**：当前目标会话、学习资产和目标级行为状态；
- **H**：工具白名单、预算、审批、SQLite范围和恢复；
- **A**：独立能力、最小行动、不羞辱、不补偿和反依赖；
- **R**：长程Agent、模型、资料库、评估、作品与行为工具；
- **T**：用户输入、配方、Check-in、模型、工具、成本和证据。

## 7. 数据与派生

数据库保存HabitRecipe和HabitCheckIn；BehaviorState按最近七天动态派生，避免缓存陈旧诊断。

```text
全局 behaviorState：空间汇总
behaviorStates[goalId]：一对一目标状态
```

## 8. 长程状态机

```text
queued → planning → running ⇄ paused
                         ↓
                awaiting-approval
                         ↓
          completed / failed / cancelled
```

微习惯工具作为标准Runtime步骤参与Checkpoint和Trace。