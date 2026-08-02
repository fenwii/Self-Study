# 目标独立会话设计 V0.7

## 1. 产品不变量

```text
一个长期目标 = 一个独立会话空间
```

会话不仅保存聊天，还承载目标生命周期和自然交互状态。

## 2. 数据结构

```text
GoalConversation
├── id / workspaceId / goalId
├── title / status
├── pinned
├── draft / draftUpdatedAt
├── lastOpenedAt
├── messageCount / lastMessagePreview / lastMessageAt
└── createdAt / updatedAt
```

`messages`与`agent_runs`同时保存`goal_id`和`conversation_id`。

## 3. 独立草稿

切换目标时：

```text
当前输入 → 450ms防抖保存到当前Conversation
→ 选择另一目标并touch
→ 恢复另一Conversation草稿
```

消息创建后，服务层在同一事务中更新最后消息时间并清空当前Conversation草稿。其他目标草稿不受影响。

## 4. 排序与生命周期

活动目标优先于归档目标；活动目标内部按置顶和最近打开/最近消息排序。归档动作：

- Goal状态改为`archived`；
- Conversation状态改为`archived`；
- 自动取消置顶；
- 不删除任何消息或学习资产。

## 5. 新目标原子迁移

```text
临时Conversation
→ 保存第一条消息和Run
→ goal.create
→ 创建正式Conversation
→ 同一事务迁移Run和全部Message
→ 后续步骤只读取新目标Context
```

## 6. 长程历史

- 数据库永久保存全量消息；
- 每个会话独立加载最近500条；
- 导出读取全量消息；
- 会话完整计数和摘要不受窗口限制。
