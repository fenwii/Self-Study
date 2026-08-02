# 模型与 API 配置

## 1. 安全原则

本项目只预置公开的 API 端点、协议和模型 ID，不包含任何真实 API 密钥。

推荐优先级：

1. Electron 设置页 + `safeStorage`；
2. 企业密钥注入或系统环境变量；
3. 仅开发环境使用未提交的 `.env` 文件。

不要把密钥写入源码、Git、截图、Issue、日志或导出的学习资产。

## 2. 内置供应商

| 供应商 | 默认模型 | 协议 | 默认 Base URL | 环境变量 |
|---|---|---|---|---|
| DeepSeek | `deepseek-v4-flash` | OpenAI Chat | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` |
| MiniMax | `MiniMax-M2.7` | OpenAI Chat | `https://api.minimaxi.com/v1` | `MINIMAX_API_KEY` |
| Kimi | `kimi-k3` | OpenAI Chat | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` |
| Qwen | `qwen-plus` | OpenAI Chat | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` |
| StepFun | `step-3.7-flash` | OpenAI Chat | `https://api.stepfun.ai/v1` | `STEP_API_KEY` |
| GLM | `glm-5.2` | OpenAI Chat | `https://open.bigmodel.cn/api/paas/v4` | `ZAI_API_KEY` |
| GPT | `gpt-5.5` | OpenAI Responses | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| Gemini | `gemini-3.5-flash` | Gemini Native | `https://generativelanguage.googleapis.com/v1beta` | `GEMINI_API_KEY` |
| Claude | `claude-sonnet-5` | Anthropic Messages | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` |

供应商可能调整模型名、区域端点或账户级 Endpoint。所有预置字段都能在设置页覆盖，不需要修改源代码。

## 3. 桌面设置

1. 打开右上角“设置”；
2. 选择供应商；
3. 确认模型和 Base URL；
4. 输入 API 密钥；
5. 点击“保存并测试”；
6. 连接健康后设为默认，或保留 DeepSeek 默认；
7. 调整优先级决定自动故障切换顺序。

优先级数值越小，越靠前；默认模型额外获得路由优先权。

## 4. 环境变量

开发机可以在启动 Electron 的 shell 中设置：

```bash
export DEEPSEEK_API_KEY="..."
export MINIMAX_API_KEY="..."
export MOONSHOT_API_KEY="..."
export DASHSCOPE_API_KEY="..."
export STEP_API_KEY="..."
export ZAI_API_KEY="..."
export OPENAI_API_KEY="..."
export GEMINI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
```

Windows PowerShell 示例：

```powershell
$env:DEEPSEEK_API_KEY="..."
npm start
```

当前项目不自动解析 `.env` 文件；`.env.example` 只用于展示变量名。生产桌面用户应使用设置页，托管部署应由启动器或密钥管理系统注入环境变量。

## 5. 路由规则

模型路由综合考虑：

- 是否是默认模型；
- 用户设置的优先级；
- 是否配置密钥；
- 最近健康检查；
- A4/A5 对推理能力的偏好；
- C4/C5 对长上下文的偏好；
- D4/D5 对结构化输出的偏好。

失败策略：

```text
默认主模型
→ 同等级候选
→ 其他已配置云模型
→ 本地演示模型
```

HTTP 408、409、425、429 和部分 5xx 会进行有限重试。认证、参数和模型不存在等非重试错误会直接切换候选模型。

## 6. D5 双模型审计

当且仅当：

```text
intent = verify
且 governance = D5
```

系统会在主模型回答成功后，尝试选择另一个已配置、支持推理的非 Mock 模型进行独立审计。审计检查：

- 事实性；
- 逻辑性；
- 遗漏；
- 过度自信；
- 学习者依赖风险；
- 最小修正建议。

审计失败不会丢弃已经成功的主回答，但失败会进入 Trace 和供应商健康状态。

## 7. 自定义 OpenAI 兼容模型

设置页选择“＋自定义”，配置：

- 类型：OpenAI 兼容；
- 协议：OpenAI Chat Completions；
- 显示名称；
- 模型 ID；
- Base URL；
- 密钥；
- 优先级；
- 超时；
- 能力标签。

Base URL 应指向 `/v1` 或供应商要求的兼容根路径，程序会追加 `/chat/completions`。
