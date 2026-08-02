# V0.3 → V0.4迁移

## 自动迁移

应用首次打开V0.3数据库时，V0.4会在同一个SQLite文件中创建：

- `learning_paths`
- `path_milestones`
- `learning_resources`
- `resource_chunks`
- `assessments`
- `assessment_attempts`
- `artifact_evaluations`

并写入`schema_migrations.version = 4`。

## 保留数据

以下V0.3数据不会被重建或清空：

- Workspace和Goal；
- Task；
- Knowledge Node/Edge；
- Misconception和Review；
- Session；
- Artifact和Evidence；
- Message、Run、Approval、Trace、Checkpoint；
- Provider和Model Usage。

## 路径策略

旧目标不会强制在迁移时批量创建路径。用户可：

- 在自然语言中说“为这个目标编译学习路径”；
- 或在后续目标创建时自动获得第一版路径。

这样避免升级时对历史目标作出未经用户确认的结构化推断。

## 备份

数据库打开并迁移后，系统会用`VACUUM INTO`创建当日一致性备份。正式升级前仍建议手动复制用户数据目录。

## 已演练场景

真实迁移测试使用V0.3 AppDatabase创建数据库和遗留目标，再用V0.4打开：

- Schema从3升至4；
- 遗留Goal保留；
- 七个新表存在；
- Provider和旧学习数据可继续读取；
- 新备份可生成。
