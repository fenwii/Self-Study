# V0.5 → V0.6迁移

首次由V0.6打开V0.5数据库时，迁移自动执行，无需用户操作。

## 新增列

`goal_conversations`新增：

```sql
pinned INTEGER NOT NULL DEFAULT 0
draft_text TEXT NOT NULL DEFAULT ''
draft_updated_at TEXT
last_opened_at TEXT
```

## 回填规则

- `pinned`默认为0；
- `draft_text`默认为空字符串；
- `draft_updated_at`保持NULL；
- `last_opened_at`使用原`updated_at`回填；
- 旧标题、状态、消息、Run和所有学习资产保持不变。

## 索引

新增`idx_conversations_status_pin`，支持按工作区、状态、置顶和更新时间排序。

## 已验证

迁移演练确认：Schema从5升级到6，旧目标会话和旧消息保留，四个新字段存在且具有安全默认值。
