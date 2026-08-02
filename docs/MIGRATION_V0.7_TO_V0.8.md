# V0.7 → V0.8 迁移

## Schema

数据库版本由7升级为8。

新增列：

```text
tasks.completed_at
tasks.archived
misconceptions.resolved_at
review_items.suspended_at
learning_resources.archived
assessments.archived_at
artifacts.archived_at
```

新增索引：

```text
idx_tasks_goal_archived
idx_resources_archived
```

## 自动回填

迁移会为旧数据补齐语义：

- `status='done'`的任务使用旧`updated_at`回填完成时间；
- `status='resolved'`的误解使用旧`updated_at`回填解决时间；
- `suspended=1`的复习使用旧`updated_at`回填暂停时间；
- 旧资料默认未归档；
- 所有目标、会话、消息、草稿、路径、资料、评估、作品、证据和模型配置原样保留。

## 兼容性

迁移采用`ALTER TABLE ADD COLUMN`和幂等更新，可重复打开。迁移后执行SQLite完整性检查，并继续生成每日一致性备份。
