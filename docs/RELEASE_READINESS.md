# V1.0正式发布质量门禁

## 已通过

- [x] `package.json`版本为1.0.0；
- [x] Schema V10及新增表、索引；
- [x] 一对一契约领域模型、IPC、SQLite、Context和UI贯通；
- [x] 正式周复盘领域模型、SQLite、Context和UI贯通；
- [x] A5+B5+C5+D5包含`contract.upsert`与`review.weekly`；
- [x] 自然语言契约与周复盘意图路由；
- [x] 目标级契约和自主性状态隔离；
- [x] V0.9→V1.0真实数据库迁移；
- [x] 数据库完整性检查；
- [x] TypeScript语法与相对导入检查；
- [x] 核心Main/Shared严格语义检查；
- [x] 高置信硬编码密钥扫描；
- [x] 源码SHA-256完整性清单；
- [x] ZIP完整性检查；
- [x] 正式版、契约、迁移、安全与验证文档。

## 需要联网构建环境完成

- [ ] 完整`npm install`并生成`package-lock.json`（当前内部npm代理对`@electron-forge/cli@7.8.1`返回404）；
- [ ] 真实依赖下`npm run typecheck`；
- [ ] 正式Vitest与ESLint；
- [ ] Electron Renderer启动与人工交互验收；
- [ ] Windows、macOS、Linux安装包；
- [ ] Windows代码签名；
- [ ] macOS签名与Notarization；
- [ ] 九家模型真实API回归、限流、超时和计费验证；
- [ ] 跨平台视觉回归和可访问性人工测试。

## 发布阻断原则

以下任一情况出现时不得发布签名安装包：

- 数据迁移破坏旧目标或消息；
- API密钥出现在Renderer、日志或导出中；
- 数据库完整性不是`ok`；
- 高风险写入绕过Harness或审批；
- 未生成锁文件；
- 正式测试或类型检查失败；
- 安装包未完成签名或来源声明。
