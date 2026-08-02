# Self-Study AI Desktop V1.0.0 正式版

Self-Study AI 是一个本地优先、目标隔离、长期可恢复、可审计的 Electron 原生一对一自学操作系统。正式版以 **CHART（Context / Harness / Alignment / Runtime / Traceability）** 为生产工程内核，支持 **A1–A5、B1–B5、C1–C5、D1–D5** 的625种基础组合，并把福格行为模型、微习惯、学习契约、主动练习、真实性评估、作品验收和长期能力证据统一到同一条自学链路。

```text
真实目标
→ 一对一学习契约
→ 行为条件诊断
→ 锚点与最小行动
→ 个性化学习路径
→ 主动练习与误解修复
→ 间隔复习
→ 真实性评估
→ 作品验收
→ 能力证据
→ 正式周复盘
→ 脚手架逐步撤除
→ 独立学习与长期成果
```

> 正式版成功标准不是“AI回答了多少问题”，而是学习者能否在更少提示下理解、保持、迁移并独立完成真实作品。

## 1. 正式版三层引擎

### 行为发生层

基于福格行为模型分别观察动机、能力与提示：

```text
Behavior = Motivation × Ability × Prompt
```

行为没有发生时，默认先降低难度，再修复锚点与提示，最后才讨论动机。系统禁止羞辱、补偿性加量、断签焦虑和人格归因。

### 学习形成层

```text
目标诊断
→ 知识地图
→ 学习者先尝试
→ 最小提示
→ 主动练习
→ 误解修复
→ 间隔复习
→ 独立评估
```

### 成果证明层

```text
阶段任务
→ 真实作品
→ 量表验收
→ 延迟复测
→ 跨场景迁移
→ 能力证据
```

微习惯只负责让正确行为更容易发生；是否真正掌握，仍由独立评估、作品和迁移证据决定。

## 2. 一对一学习契约

每个长期目标拥有独立正式契约：

- 学习者名称；
- 为什么现在学习；
- 怎样才算真正成功；
- 每周真实可投入分钟数；
- 单次学习时长；
- 偏好日期与时间；
- 教练方式：苏格拉底式、直接式、平衡式、项目式；
- 反馈方式：温和、直接、证据优先；
- 挑战强度；
- 自主性目标；
- 最低承诺；
- 周、双周或月度复盘节奏；
- 草稿、启用、暂停、完成状态；
- 契约版本与确认时间。

契约会真实约束AI：学习计划不能超出时间预算；自主性低于目标时，系统减少直接答案，增加尝试、证据、延迟复测与迁移。

## 3. 正式周复盘

周复盘不是情绪总结，也不是连续天数统计。系统同时读取：

- 契约计划会话数；
- 实际完成会话数；
- 完成的最小行动；
- 新增能力证据；
- 用户真实反思；
- 当前自主性差距。

输出：

```text
本周事实
→ 教练判断
→ 下周唯一重点
→ 只调整一个行为变量
```

同一周重复生成会更新原复盘，不会制造重复记录。

## 4. 微习惯与目标级行为画像

每个目标可以建立独立配方：

```text
当【稳定锚点】发生后，
我将【30—120秒最小学习行为】，
然后立即【自然庆祝】。
```

系统记录完成、部分完成或跳过，以及当时动机、容易程度、提示是否出现、是否庆祝、本地日期和时区。目标级行为画像不会跨目标污染。

## 5. 一条龙学习模块

正式版包含：

1. **目标与独立会话**：每个目标拥有独立聊天、草稿、Context和全部学习资产。
2. **学习契约**：明确时间、结果、教练风格和自主性目标。
3. **六阶段路径**：诊断、理解、建图、练习、验证、作品。
4. **任务系统**：待处理、进行中、受阻、完成、归档与恢复。
5. **知识与误解图谱**：知识节点、依赖关系、误解验证、解决与复发。
6. **间隔复习**：Again、Hard、Good、Easy与暂停恢复。
7. **本地资料库**：显式导入、SHA-256去重、中文检索和来源感知Context。
8. **真实性评估**：机制解释、迁移、反例与验证设计。
9. **作品锻造**：作品量表、逐项验收、修订和状态恢复。
10. **能力证据**：独立性、保持度、迁移度和来源链。
11. **微习惯**：锚点、最小行为、庆祝、频率和真实Check-in。
12. **正式周复盘**：依据真实行为、会话、证据和成果调整下一周。
13. **长程Agent**：计划、暂停、恢复、审批、Checkpoint与失败保留。
14. **模型控制面**：九家模型、安全密钥、健康检查、路由、回退和D5双模型审计。
15. **维护与数据治理**：完整性检查、一致性备份、安全恢复、JSON/Markdown导出。

## 6. CHART与625种组合

```text
A1–A5 × B1–B5 × C1–C5 × D1–D5 = 625种基础组合
```

### Context

当前目标独立编译：契约、会话、路径、任务、知识、误解、复习、资料、评估、作品、证据、微习惯、行为画像和最近周复盘。

### Harness

工具白名单、风险分级、人工审批、预算、最大步骤、超时、文件与网络边界、暂停、取消、恢复和数据库事务。

### Alignment

先尝试后提示、最小提示阶梯、反AI依赖、契约优先、不羞辱、最小版本即成功、真实证据和脚手架逐步撤除。

### Runtime

九模型调用、本地工具、学习技能、资料检索、评估、作品验收、行为诊断、契约保存、周复盘和长程Checkpoint。

### Traceability

保存目标、会话、原始输入、契约版本、行为条件、CHART组合、Context摘要、计划、审批、工具IO、模型路由、人民币成本、Checkpoint与结果。

## 7. 自然简洁桌面交互

```text
左侧：长期目标与独立会话
中间：当前目标聊天、唯一下一步和自然输入框
右侧：按需展开的结构化学习抽屉
```

- 采用克制、少即是多、一次只突出一个主要行动的设计原则；
- Markdown、GFM、代码块和安全KaTeX；
- 明亮、深色、跟随系统；
- 文字倍率、阅读宽度、界面密度、增强对比和减少动态；
- 目标置顶、重命名、归档、恢复、搜索和专注模式；
- 每个目标独立持久化草稿；
- 会话内错误恢复和长程运行状态；
- 契约缺失或复盘到期时，唯一下一步优先提示建立契约或完成复盘。

## 8. 模型支持

默认 DeepSeek，可配置：

- DeepSeek；
- MiniMax；
- Kimi；
- Qwen；
- StepFun；
- GLM；
- GPT；
- Gemini；
- Claude。

支持OpenAI Chat兼容协议、OpenAI Responses、Gemini原生与Anthropic Messages；API密钥通过Electron `safeStorage`或环境变量注入，不写入源码、Trace或导出文件。

## 9. 本地优先与安全

- SQLite Schema V10；
- `contextIsolation: true`；
- `sandbox: true`；
- `nodeIntegration: false`；
- Renderer不接触数据库、文件系统和模型密钥；
- Preload仅暴露类型化白名单API；
- IPC写操作使用Zod校验；
- Markdown不解析原始HTML；
- KaTeX `trust: false`；
- 每日一致性备份、手动备份、恢复前保护备份和完整性检查；
- 全量JSON和Markdown资产导出，避免平台锁定。

## 10. Schema V10

V1.0新增：

```text
learning_contracts
weekly_learning_reviews
```

并继续保留：

```text
goals / goal_conversations / messages
learning_paths / path_milestones
tasks / knowledge_nodes / knowledge_edges
misconceptions / review_items
learning_resources / resource_chunks
assessments / assessment_attempts
artifacts / artifact_evaluations / evidence
habit_recipes / habit_checkins
learning_sessions / reflections
agent_runs / approvals / traces / checkpoints
model_providers / model_usage / settings
```

旧V0.9数据库首次打开时自动升级到V10；旧目标、消息和学习资产完整保留，系统不会自动制造未经用户确认的学习契约。

## 11. 本地运行

```bash
cd self-study-electron-v1.0.0
npm install
npm run verify
npm start
```

生成安装包：

```bash
npm run make
```

第一次成功安装依赖后应提交`package-lock.json`，正式CI统一使用：

```bash
npm ci
npm run verify
npm run make
```

## 12. 当前交付边界

本源码已经完成语法、相对导入、密钥扫描、核心严格语义、真实SQLite Schema V10、一对一契约、周复盘和V0.9→V1.0迁移验证。

当前执行环境未能完成外部npm依赖安装，因此本仓库是**经过核心行为和数据层验证的完整正式版源码**，不是已签名的Windows/macOS/Linux安装包。详见[`docs/VALIDATION.md`](docs/VALIDATION.md)与[`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md)。

## 13. 文档入口

- [`docs/FORMAL_RELEASE.md`](docs/FORMAL_RELEASE.md)
- [`docs/ONE_TO_ONE_CONTRACT.md`](docs/ONE_TO_ONE_CONTRACT.md)
- [`docs/BEHAVIOR_DESIGN.md`](docs/BEHAVIOR_DESIGN.md)
- [`docs/CHART_A5_B5_C5_D5.md`](docs/CHART_A5_B5_C5_D5.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/MIGRATION_V0.9_TO_V1.0.md`](docs/MIGRATION_V0.9_TO_V1.0.md)
- [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md)
- [`docs/VALIDATION.md`](docs/VALIDATION.md)
