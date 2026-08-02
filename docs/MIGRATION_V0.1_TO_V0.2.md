# V0.1.0 → V0.2.0迁移

## 自动迁移

应用启动时会：

1. 保留现有学习空间、目标、任务、证据、消息、Run、Trace和Checkpoint；
2. 为`providers`表补充V0.2.0新字段；
3. 规范旧Anthropic、Gemini、OpenAI和Mock协议；
4. 插入缺失的九家内置供应商；
5. 若旧默认是Mock或没有默认模型，把DeepSeek设为默认；
6. 保留用户已选择的非Mock默认供应商；
7. 不覆盖用户创建的自定义供应商。

## API密钥

V0.1.0已有密钥引用会保留。新内置供应商需要在设置页逐个输入密钥，或由环境变量提供。

## 备份建议

升级前备份Electron用户数据目录中的：

- `self-study.db`
- `self-study.db-wal`
- `self-study.db-shm`
- `secrets.json`

也可以先从旧版导出JSON和Markdown学习资产。

## 回滚

V0.2.0对数据库进行向前兼容加列。旧程序可能忽略新字段，但正式环境不建议在同一数据库上反复降级。需要回滚时应恢复升级前备份。
