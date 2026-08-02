# V0.6 → V0.7迁移

数据库Schema从6升级到7。

## 新增设置

`settings`表写入`appearance`记录：

```json
{
  "theme": "system",
  "fontScale": 1,
  "density": "comfortable",
  "readingWidth": "standard",
  "reduceMotion": false,
  "highContrast": false
}
```

已有数据库不会修改目标、会话、消息、草稿、路径、资料、评估、作品、证据、模型配置或密钥引用。

若旧数据库中没有外观记录，自动插入默认值；后续更新通过`ON CONFLICT`原子覆盖同一个设置记录。
