# V0.4 → V0.5迁移

## Schema变化

```text
Schema 4
→ Schema 5
```

新增：

- `goal_conversations`表；
- `messages.goal_id`；
- `messages.conversation_id`；
- `agent_runs.conversation_id`；
- 目标、会话和消息索引。

## 自动迁移顺序

1. 应用启动并打开旧SQLite；
2. 创建V0.5表和缺失列；
3. 为已有目标创建独立Conversation；
4. 依据旧Run的`goal_id`回填消息目标；
5. 将旧Message和Run连接到对应Conversation；
6. 计算`last_message_at`；
7. 写入Schema版本5；
8. 创建当天一致性备份。

## 保留内容

- 所有旧工作区和目标；
- 所有旧消息正文、元数据和时间；
- 所有Run、Trace、审批和Checkpoint；
- 路径、任务、知识、复习、资料、评估、作品和证据；
- 模型供应商和安全密钥引用。

## 回滚

迁移前应备份数据库。V0.5新增列不会删除旧字段，但Schema 4应用不理解目标会话，因此不建议迁移后直接使用旧版本继续写入同一数据库。
