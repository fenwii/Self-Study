# Self-Study AI V1.0.0 正式版安全模型

## V1.0契约与复盘数据边界

- 契约只存于本地SQLite，除必要Context字段外不整表发送给模型；
- 学习者名称、时间预算和反馈偏好不进入模型供应商配置；
- 周复盘由本地会话、Check-in和Evidence聚合后生成，原始数据库记录不整体上传；
- 契约写入经过Zod、类型化IPC、目标归属检查和SQLite UPSERT；
- 旧目标迁移不自动创建契约，避免未经同意的承诺或画像；
- JSON/Markdown导出包含契约和复盘，用户可审查、备份与迁移。

## Electron边界

- `contextIsolation: true`；
- `sandbox: true`；
- `nodeIntegration: false`；
- `webSecurity: true`；
- 禁止不安全内容；
- 生产环境关闭Renderer DevTools；
- Preload只暴露类型化白名单API；
- IPC写操作使用Zod验证；
- 所有权限请求默认拒绝；
- 禁止WebView附加；
- 新窗口一律拒绝，HTTPS链接交给系统浏览器。

## 密钥

- API密钥使用Electron `safeStorage`加密；
- 也可通过环境变量注入；
- Renderer无法读取；
- Trace、日志、数据库导出和Markdown不保存密钥；
- 操作系统无法安全加密时拒绝明文降级；
- Base URL默认要求HTTPS，本地模型仅允许有限localhost HTTP地址。

## 日志

日志使用JSON Lines，存放于`<userData>/logs`：

- 5MB轮转；
- 最多5份归档；
- API Key、Authorization、Secret、Token、Password字段自动脱敏；
- 记录主进程异常、Renderer崩溃/卡死、启动和退出；
- 日志失败不得导致应用崩溃。

## 数据

- SQLite WAL和外键；
- 单实例避免多个进程竞争写数据库；
- 每日`VACUUM INTO`一致性备份；
- 保留14份；
- 导出数据不包含SecretStore；
- 删除供应商时同步删除安全存储引用。

## 本地资料库

- 资料导入必须由用户通过系统文件选择器显式授权；
- Renderer不能提交任意文件路径让Main读取；
- 仅允许TXT、Markdown、JSON和CSV；
- 单文件最大5MB，单次最多20个；
- 不执行导入内容中的脚本、HTML或命令；
- 使用SHA-256去重；
- 默认只把命中的必要片段加入单次模型Context；
- 资料、分块、Trace和导出均不得包含API密钥。

## Markdown与LaTeX

- 使用React AST渲染，不执行消息内容；
- `skipHtml`开启，原始HTML被忽略；
- 不启用`rehype-raw`；
- KaTeX设置`trust:false`和严格解析；
- 外部链接使用`noopener noreferrer`，并由Main进程决定是否交给系统浏览器；
- 消息内容无法访问Node、SQLite、SecretStore或原始IPC；
- 代码块复制只调用浏览器Clipboard API，不获得任意系统命令权限。

## 目标会话完整性

- 服务层验证Conversation与Workspace一致；
- 指定Goal时验证Conversation与Goal一致；
- 新目标Run和关联消息在同一事务中迁移；
- Context Engine在未选目标时不回退读取其他活动目标；
- 目标会话完整记录只在用户主动导出时读取。

## 自然交互状态

- 草稿以普通学习内容存入当前Conversation，不进入SecretStore；
- Renderer只可通过类型化IPC保存当前会话草稿、置顶、归档和标题；
- 服务层验证Conversation、Goal与Workspace关系；
- 重命名同时更新Goal和Conversation，避免显示与Context不一致；
- 归档不删除数据，降低误操作造成的永久损失；
- 搜索和建议只在当前目标范围内计算；
- 错误重试复用最后用户内容，但不重复暴露模型密钥或内部Trace。

## Assessment与Evidence

- 保存学习者原始答案和评分依据；
- 自动评分只作为学习反馈，不作为高风险认证；
- 模型生成内容不能直接标记为学习者独立能力；
- 作品验收与作品内容分表保存，保留历史；
- D5记录Assessment和Artifact Evaluation责任链。

## Agent Harness

- 模型只能请求类型化工具；
- B等级决定工具权限；
- 中高风险持久化动作触发审批；
- 成本超过人民币预算时拒绝执行；
- 运行可暂停、取消和恢复；
- D5保存完整责任链和第二模型审计。

## Electron Fuses

正式打包启用：

- RunAsNode关闭；
- Cookie加密；
- Node Options环境变量关闭；
- CLI Inspect关闭；
- ASAR完整性验证；
- 仅从ASAR加载应用。

## CI门禁

`npm run verify`依次执行：

1. 源码语法和相对导入；
2. 高置信密钥扫描；
3. TypeScript严格检查；
4. 单元测试；
5. ESLint。

三平台打包在质量任务通过后才执行。

## V0.7外观与可访问性安全边界

- 外观偏好只保存枚举、布尔值和受限字号倍率；
- Zod限制字号为0.9—1.2，主题、密度和阅读宽度只允许固定枚举；
- Renderer不能直接读写SQLite；
- CSS主题不允许注入自定义CSS或任意颜色字符串；
- 设置不进入模型Context、不写入Trace Prompt、不包含密钥；
- 减少动态效果同时尊重操作系统`prefers-reduced-motion`。

## 备份恢复安全

V0.8恢复流程不接受任意文件路径，只接受系统生成且符合命名规则的备份名。Main进程会：

- 将路径解析到固定`backups`目录并验证目录边界；
- 用只读SQLite连接运行`PRAGMA integrity_check`；
- 恢复前创建手动保护性备份；
- 只写入权限为0600的待恢复标记；
- 应用重启后删除旧WAL/SHM并原子替换主数据库；
- 失败时恢复原数据库文件。


## V0.9行为数据安全

- 动机、能力、提示和Check-in默认仅保存在本地SQLite；
- 行为画像只进入当前目标的最小必要Context；
- 不用于广告、人格标签、惩罚或跨目标推断；
- Check-in不会自动升级为能力证据；
- 导出行为数据时与目标分组，用户可检查完整原始记录；
- API密钥、行为记录和学习内容保持不同数据域。