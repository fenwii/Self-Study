# Self-Study AI V1.0.0 正式版数据模型

## Schema V10正式版模型

新增：

```text
LearningContract 1──1 LearningGoal
LearningGoal 1──N WeeklyLearningReview
LearningGoal 1──1 OneToOneState（派生）
```

`learning_contracts`按`goal_id`唯一，保存版本、确认时间与完整教练协议；`weekly_learning_reviews`按目标和周期唯一，保证同一周期复盘更新而不重复。旧V0.9数据迁移后不自动创建契约。

## 核心聚合

```text
Workspace
├── Goal
│   └── GoalConversation
│       ├── Interaction State
│       ├── Message
│       └── AgentRun ── Trace / Approval / Checkpoint / ModelUsage
│   ├── LearningPath ── PathMilestone
│   ├── Task / ReviewItem / LearningSession
│   ├── KnowledgeNode / Edge / Misconception
│   ├── LearningResource / ResourceChunk
│   ├── Assessment / AssessmentAttempt
│   ├── Artifact / ArtifactEvaluation
│   └── LearningEvidence / Reflection
```

## GoalConversation V0.6字段

- `workspaceId`；
- 可选`goalId`；
- `title`与`status`；
- `pinned`；
- `draft`与`draftUpdatedAt`；
- `lastOpenedAt`；
- `lastMessageAt`；
- 查询聚合字段`messageCount`和`lastMessagePreview`；
- 创建和更新时间。

SQLite新增列：

```sql
pinned INTEGER NOT NULL DEFAULT 0,
draft_text TEXT NOT NULL DEFAULT '',
draft_updated_at TEXT,
last_opened_at TEXT
```

## 状态不变量

1. 正式Goal只有一个主Conversation；
2. 草稿属于Conversation，不属于全局应用；
3. 发送消息只清空对应Conversation草稿；
4. 归档目标保留全部学习对象和消息；
5. 归档时取消置顶，恢复时允许重新置顶；
6. Goal标题和主Conversation标题在同一事务中更新；
7. `lastOpenedAt`用于自然排序，不改变历史消息时间；
8. Context不得读取其他Goal的学习实体；
9. API密钥永不存入会话、消息、Trace或导出。

## Schema版本

- v1：目标、任务、知识、证据和Run；
- v2：九模型控制面；
- v3：知识边、误解、复习、会话、作品和成本；
- v4：路径、资料库、真实性评估和作品验收；
- v5：目标独立会话、目标级消息/Run和富聊天；
- v6：持久草稿、置顶、归档交互和最近打开状态。

## AppearancePreferences（Schema v7）

```text
settings['appearance']
├── theme: system | light | dark
├── fontScale: 0.9 | 1.0 | 1.1 | 1.2
├── density: comfortable | compact
├── readingWidth: narrow | standard | wide
├── reduceMotion: boolean
└── highContrast: boolean
```

该设置属于应用级本地偏好，不进入模型Context，也不包含学习内容或敏感密钥。

## Schema V8 生命周期字段

```text
LearningTask.completedAt / archived
MisconceptionRecord.resolvedAt
ReviewItem.suspendedAt
LearningResource.archived
LearningAssessment.archivedAt
LearningArtifact.archivedAt
MaintenanceSnapshot
```

这些字段使UI状态、Context编译、下一行动和Trace具有统一事实来源，避免只在前端临时隐藏对象。

## V0.9行为设计模型

```text
Goal
├── HabitRecipe
│   └── HabitCheckIn[]
└── BehaviorState（运行时派生）
```

### HabitRecipe

- `anchor`：稳定锚点；
- `tinyBehavior`：最小行为；
- `expansionBehavior`：可选扩展；
- `celebration`：即时庆祝；
- `frequency/customDays`：发生节奏；
- `minimumSeconds/preferredMinutes`：最低与理想规模；
- `status`：active、paused、retired；
- `streak/bestStreak`：观察信号；
- `lastCheckInAt`：最后行为时间。

### HabitCheckIn

- `result`：done、partial、skipped；
- `motivation/ability`：1—5分行为条件；
- `promptSeen`：提示是否出现；
- `celebrated`：是否立即庆祝；
- `durationSeconds`：实际最小行动时长；
- `note`：原始行为说明。

### BehaviorState

不持久化，按最近七天Check-in实时计算。Dashboard同时返回全局汇总和`behaviorStates[goalId]`目标画像。

## Schema版本补充

- v9：目标级行为设计、微习惯配方、行为Check-in和行为画像。

### 本地时间字段

HabitCheckIn同时保存`createdAt`（UTC审计时间）、`localDate`（设备本地日期）与`timezoneOffsetMinutes`。日历频率、今日完成和连续性计算使用本地日期。