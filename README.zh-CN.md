# 赛博喷客

[English](README.md) | 中文

赛博喷客是一个本地运行的 AI 多 Agent 辩论平台。你可以配置辩题、轮数、多个辩手 Agent、模型、说话风格、Skills、MCP 能力描述和 Prompt 模板，让不同模型或不同角色围绕同一议题进行流式辩论。

项目由 FastAPI 后端和原生 HTML/CSS/JavaScript 前端组成，不需要前端构建步骤。

## 功能概览

- 多 Agent 辩论：配置辩题、轮数、回答长度和 1-12 个 Agent。
- 模型配置库：保存多个模型配置，包括 Provider、模型名、API Key、Base URL、Temperature、Max Tokens。
- Prompt 模板：统一管理 Agent 系统提示词、轮次提示词和精简/适中/详细三档回答长度提示词。
- 能力注入：在设置页维护风格、Skills、MCPs，并在 Agent 配置中多选使用。
- Prompt 预览：查看某个 Agent 实际发送给 LLM 的 system/user messages。
- 流式输出：通过 SSE 实时展示每个 Agent 的增量发言。
- Markdown 渲染：支持标题、列表、代码块、引用、链接和表格。
- 中英双语界面：前端支持中文和 English 切换。
- 本地 Mock Provider：无需 API Key 即可验证完整流程。

> 当前 Skills 和 MCPs 会作为提示词内容注入 Agent，不会实际启动 MCP server 或执行工具调用。

## Quickstart

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
```

打开：

```text
http://127.0.0.1:8000
```

首次运行建议准备本地设置文件：

```bash
cp data/settings.example.json data/settings.json
```

然后可以先使用 `Mock 本地演示` 模型直接开始辩论；接入真实模型时，在设置页填写 API Key，或通过环境变量提供。

## Provider

支持的 Provider：

- `mock`：本地模拟输出，不请求外部 API。
- `openai`：默认请求 `https://api.openai.com/v1/chat/completions`。
- `anthropic`：默认请求 `https://api.anthropic.com/v1/messages`。
- `openai_compatible`：使用 OpenAI Chat Completions 兼容格式，需填写 Base URL。
- `deepseek`：默认 `https://api.deepseek.com/v1`。
- `qwen`：默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- `moonshot`：默认 `https://api.moonshot.cn/v1`。
- `local`：默认 `http://localhost:8000/v1`。

Base URL 建议填写 API 根路径，例如：

```text
https://api.openai.com/v1
https://api.deepseek.com/v1
https://dashscope.aliyuncs.com/compatible-mode/v1
```

如果误填成完整 endpoint，例如 `/v1/chat/completions` 或 `/v1/messages`，后端会兼容处理。

## API Key

API Key 可以在设置页为每个模型单独填写，也可以通过环境变量提供：

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
QWEN_API_KEY=...
MOONSHOT_API_KEY=...
```

`openai_compatible` 会读取 `OPENAI_COMPATIBLE_API_KEY`，其他兼容 Provider 会读取对应的 `{PROVIDER}_API_KEY`。

## 设置文件

配置保存到：

```text
data/settings.json
```

仓库提供脱敏模板：

```text
data/settings.example.json
```

`data/settings.json` 可能包含 API Key，默认已加入 `.gitignore`。不要提交真实的 `data/settings.json`、`.env` 或任何密钥。

## Prompt 模板占位符

常用占位符：

- `{topic}`：辩题
- `{agent_name}`：当前 Agent 名称
- `{role}`：当前 Agent 角色或立场
- `{agent_prompt}`：Agent 单独配置的 Prompt
- `{current_round}` / `{total_rounds}`：当前轮次和总轮数
- `{round_prompt}`：轮次模板渲染结果
- `{answer_length}` / `{answer_length_label}`：回答长度代码和显示名
- `{answer_length_prompt}`：回答长度模板渲染结果
- `{style}` / `{style_section}`：所选风格原文和带标题风格块
- `{skills}` / `{skills_section}`：所选 Skills 列表和带标题能力块
- `{mcps}` / `{mcps_section}`：所选 MCPs 列表和带标题能力块

## 接口概览

- `GET /api/health`：健康检查
- `GET /api/settings`：读取设置
- `PUT /api/settings`：保存设置
- `POST /api/debate/start`：返回完整辩论结果
- `POST /api/debate/stream`：SSE 流式辩论
- `POST /api/prompt/preview`：预览实际 Prompt

## 测试

```bash
python3 -m pytest -q
```
