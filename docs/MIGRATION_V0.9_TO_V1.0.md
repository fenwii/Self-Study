# V0.9 → V1.0迁移

## 1. Schema变化

数据库版本从9升级到10，新增：

```text
learning_contracts
weekly_learning_reviews
```

以及：

```text
idx_contracts_goal_status
idx_weekly_reviews_goal_period
```

## 2. 数据保留

迁移不会修改或删除：

- 学习目标与独立会话；
- 聊天消息与草稿；
- 路径、里程碑和任务；
- 知识节点、误解与复习；
- 本地资料与分块；
- 评估、作品与证据；
- 微习惯与Check-in；
- 模型配置、Trace和Checkpoint；
- 外观设置与备份。

## 3. 不自动制造契约

旧目标迁移后：

```text
contracts = 0
weeklyReviews = 0
```

系统只在用户主动建立并确认契约时写入正式契约，避免把默认偏好冒充用户承诺。

## 4. 首次启动流程

```text
打开旧数据库
→ 创建升级前每日备份
→ 执行Schema V10 DDL
→ 写入schema_migrations
→ 保留旧数据
→ PRAGMA integrity_check
→ 显示“建立一对一契约”为当前下一步
```

## 5. 回滚

V0.9不会理解V1.0新增表，但旧核心表仍然存在。需要回滚应用时，应先：

1. 创建手动备份；
2. 导出JSON与Markdown；
3. 保留原V1.0数据库副本；
4. 使用恢复功能选择升级前备份。
