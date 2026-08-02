# Self-Study AI V1.0.0 正式版校验记录

校验日期：2026-07-30。

## 1. 交付范围

本次校验覆盖：

- 一对一学习契约；
- 正式周复盘；
- 目标级`OneToOneState`；
- CHART工具、Context、Alignment与自然语言路由；
- Schema V10；
- V0.9→V1.0迁移；
- 源码结构、相对导入、密钥和压缩包完整性。

## 2. 源码语法与导入

执行项目自带`verify-source`逻辑：

```text
Verified 69 TypeScript files.
Syntax errors: 0
Missing relative imports: 0
```

## 3. 密钥扫描

```text
Secret scan passed.
No high-confidence hardcoded credentials found.
```

压缩包不包含真实API密钥、`.env`实值、`node_modules`或内部测试桩。

## 4. 核心严格TypeScript语义

使用TypeScript 5.8.3，在与项目一致的ES2022、Bundler、strict配置下检查以下核心模块：

- `shared/domain.ts`；
- `one-to-one-engine.ts`；
- `learning-service.ts`；
- Context、Alignment、Harness、Runtime；
- Intent Router、Planner、Skill Catalog与Composition。

结果：

```text
0 errors
```

由于当前环境没有完整第三方依赖，Electron与Zod仅在该核心检查中使用临时类型声明；声明未进入源码包。

## 5. 真实SQLite Schema V10集成

真实执行：

```text
初始化数据库
→ 创建正式学习目标
→ 保存并确认一对一契约
→ 生成正式周复盘
→ 构建DashboardSnapshot
→ 派生OneToOneState
→ PRAGMA integrity_check
```

结果：

```json
{
  "schema": 10,
  "contractVersion": 1,
  "contracts": 1,
  "reviews": 1,
  "activeContracts": 1,
  "contractReady": true,
  "weeklyCapacityMinutes": 180,
  "plannedSessionMinutes": 25,
  "autonomyTarget": 0.8,
  "currentAutonomy": 0,
  "integrity": "ok"
}
```

## 6. 契约与复盘行为验证

验证：

- 自然语言“建立一对一学习契约”路由为`setup-contract`；
- “本周复盘”路由为`weekly-review`；
- A5+B5+C5+D5组合包含`contract.upsert`和`review.weekly`；
- 契约更新版本号递增；
- 时间预算和单次会话长度进入目标状态；
- 能力证据的独立性均值形成当前自主性；
- 自主性差距较大时，教练摘要要求减少直接答案；
- 同一目标同一周期周复盘使用UPSERT更新；
- 复盘统计实际会话、完成微行动和新增Evidence；
- 无契约时周复盘拒绝执行。

## 7. V0.9 → V1.0真实迁移

使用V0.9源码创建旧数据库并写入旧目标与消息，再由V1.0打开：

```json
{
  "schema": 10,
  "goal": "V0.9遗留目标",
  "message": "V0.9遗留消息",
  "contracts": 0,
  "reviews": 0,
  "integrity": "ok"
}
```

确认：

- 旧目标、会话和消息保留；
- 旧路径、任务、资料、评估、作品、证据、习惯和模型配置不被删除；
- 新表和索引创建成功；
- 不自动制造未经用户确认的契约；
- 数据库完整性为`ok`。

## 8. 当前未完成的外部验证

当前执行环境执行 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` 时，内部npm代理对 `@electron-forge/cli@7.8.1` 返回404，因此没有伪称完成：

- `package-lock.json`；
- 真实第三方依赖下全项目`npm run typecheck`；
- 正式Vitest和ESLint命令；
- Electron Renderer真实启动；
- Electron Forge安装包；
- Windows/macOS/Linux签名构建；
- 九家模型真实云API压力、限流与计费测试；
- 跨平台视觉回归。

正式签名发布前必须完成[`RELEASE_READINESS.md`](RELEASE_READINESS.md)中所有未勾选项。

## 9. 源码规模

```text
113个交付文件（含源码完整性清单）
66个src/tests TypeScript或TSX文件
约9774行TS/TSX
约1247行CSS
28份docs文档
```
