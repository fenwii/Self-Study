# V0.2.0 → V0.3.0 迁移

## 自动迁移

启动时数据库自动升级至Schema v3，并创建：

- knowledge_edges；
- misconceptions；
- review_items；
- learning_sessions；
- artifacts；
- model_usage。

已有工作区、目标、任务、消息、Run、Trace和供应商配置不会被删除。

## 默认种子

新工作区会获得一个起步知识节点和复习项，用于展示完整闭环。已有工作区不会重复插入同一主键记录。

## 备份

迁移完成后，应用使用SQLite `VACUUM INTO`生成当日一致性备份：

```text
<userData>/backups/self-study-YYYY-MM-DD.db
```

保留最近14份。

## 发布前操作

1. 备份V0.2用户目录；
2. 启动V0.3并检查目标、任务和供应商；
3. 验证知识、复习、会话和作品面板；
4. 导出JSON/Markdown；
5. 检查日志中没有敏感信息；
6. 完成九模型健康检查。

## 回滚

V0.2无法理解v3新增表，但不会主动删除它们。正式环境如需回滚，应恢复升级前数据库备份，而不是在同一数据库上反复切换版本。
