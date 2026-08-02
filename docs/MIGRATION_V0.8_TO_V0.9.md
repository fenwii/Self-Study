# V0.8 → V0.9迁移

## Schema

数据库版本由8升级为9。

新增表：

```sql
habit_recipes
habit_checkins
```

新增索引：

```sql
idx_habits_goal_status
idx_habit_checkins_habit
idx_habit_checkins_goal
```

## 数据保留

迁移不会删除或重写：

- Workspace；
- Goal与GoalConversation；
- 消息与草稿；
- 学习路径和里程碑；
- 任务、复习、知识和误解；
- 本地资料；
- 评估和作答；
- 作品和验收；
- 能力证据；
- 模型配置、Run、Trace和Checkpoint；
- 外观偏好和备份。

旧目标迁移后默认没有微习惯。系统不会自动替用户生成未经确认的行为配方。

## 派生状态

`behaviorStates`不作为重复数据存入数据库，而是在Dashboard生成时按目标从Habit与Check-in实时派生。

## 回滚

V0.9首次打开前仍会使用现有每日备份机制。需要回退应用版本时，应先使用V0.9导出或手动备份；V0.8不会理解新表，但旧核心学习数据保持兼容。

## 本地日历语义

`habit_checkins`同时保存：

```text
created_at               UTC审计时间
local_date               用户设备本地日历日期
timezone_offset_minutes  当次设备时区偏移
```

连续记录和“今天是否完成”使用`local_date`，避免UTC午夜导致跨日错误；旧的预发布V9记录会以`created_at`日期回填并保留偏移0。
