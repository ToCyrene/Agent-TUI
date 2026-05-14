# CLAUDE.md - Agent TUI 项目指南

## 项目概述

Agent TUI 是一个基于 Node.js 的 AI Agent 终端用户界面。采用 **Ink** 构建终端 UI，**React** 管理组件状态，通过 **手动实现的 HTTP 客户端 + SSE 流解析** 与 OpenAI 兼容 API 通信，支持流式响应和工具调用（function calling）。项目不使用 OpenAI SDK，所有通信逻辑从底层构建，以深入理解 Agent 工作机制。

## 目录结构

```
src/
  index.js             - 入口，render(<App/>) 挂载到终端
  ui/                  - Ink React UI 组件
    App.jsx            - 根组件，管理全局布局
    ChatView.jsx       - 对话消息列表
    Message.jsx        - 单条消息渲染（用户 / 助手 / 工具调用）
    Input.jsx          - 底部输入区，处理用户键入
    StatusBar.jsx      - 状态栏（连接状态、模型、token 消耗）
    ToolCallCard.jsx   - 工具调用的卡片展示
  core/                - Agent 核心逻辑
    agent.js           - Agent 编排：用户输入 → 调用 API → 处理 tool calls → 生成回复
    conversation.js    - 对话状态：消息历史、token 计数、上下文窗口管理
    state.js           - 全局应用状态（useReducer）
  tools/               - 工具层
    registry.js        - 工具注册表：注册、查找、执行
    schema.js          - 工具 JSON Schema 定义（OpenAI function calling 格式）
    builtin/           - 内置工具实现
  api/                 - API 通信层（手动实现）
    client.js          - HTTP 请求构造与发送（基于 Node.js v24 内置 fetch）
    stream.js          - SSE 流式响应解析器
  utils/               - 公共工具
    config.js          - 环境变量读取与校验
    logger.js          - 日志工具
```

## 环境概述

| 项目     | 说明                               |
| -------- | ---------------------------------- |
| 运行时   | Node.js v24.15.0，通过 fnm 管理    |
| 包管理   | npm 11.12.1                       |
| 核心依赖 | ink ^7.0.3, react ^19.2.6          |
| 模块系统 | ES modules（`package.json` 设置 `"type": "module"`） |
| 测试     | vitest（原生 ESM 支持，与 Ink 兼容） |

## 运行与构建命令

```bash
# 开发模式（Node.js v24 原生 --watch）
node --watch src/index.js
# 生产运行
node src/index.js
# npm scripts（在 package.json 中配置）
npm start          # node src/index.js
npm run dev        # node --watch src/index.js
# 测试
npx vitest
```

## 架构分层

### UI 层 (`src/ui/`)

- 使用 Ink 提供的 `Box`, `Text`, `Static` 等组件构建布局，所有组件必须是**函数组件**
- 全屏应用根布局：
  ```jsx
  <Box flexDirection="column" height="100%" padding={1}>
    <ChatView flexGrow={1} />
    <StatusBar />
    <Input />
  </Box>
  ```
- 用户输入通过 `useInput` hook 捕获，特殊键区分（Enter 发送、Esc 取消等）
- 不支持 CSS，布局依赖 Flexbox（`flexDirection`, `justifyContent`, `alignItems`, `flexGrow`, `gap`）
- 颜色使用 Ink 的 `color` prop（如 `color="green"`）
- 流式渲染优化：`React.memo` 包裹纯展示组件，避免每个 token 触发全量重渲染

### 核心层 (`src/core/`)

- 管理完整的 Agent 对话生命周期
- `agent.js` 实现主循环：
  1. 用户输入 → 追加 `role: "user"` 到 messages
  2. 调用 `/chat/completions`，stream: true
  3. 流式解析 content 实时更新 UI
  4. 遇到 `finish_reason: "tool_calls"` → 提取 tool_calls → 执行工具 → 结果以 `role: "tool"` 追加
  5. 再次调用 API（回到步骤 2），直到 `finish_reason: "stop"`
- `conversation.js` 维护 `messages[]` 数组，符合 OpenAI Chat Completions 格式
- 状态管理使用 `useReducer`，避免多个独立 `useState` 导致渲染碎片化

### 工具层 (`src/tools/`)

- 每个工具定义三个要素：`name`（唯一标识）、`description`（LLM 理解用途）、`parameters`（JSON Schema）
- 工具实现为纯函数：`async (args: object) => string`
- `registry.js` 提供 `register(tool)` 和 `execute(name, args)` 方法
- 工具执行必须：设置超时、捕获异常返回错误文本（不阻断 Agent 循环）、限制工作目录

### 通信层 (`src/api/`)

不使用 OpenAI SDK，基于 Node.js v24 内置 `fetch` 和 `ReadableStream` 手动实现。

**关键技术要点**：
- SSE 格式：每条 `data: ...` 行一个 JSON chunk，`[DONE]` 标记流结束
- `tool_calls` 的 `function.arguments` 按 chunk 分片传输，需根据 `index` 拼接完整 JSON
- `TextDecoder` 的 `stream: true` 确保多字节 Unicode 字符（如中文）在 chunk 边界处不截断
- 同一个 chunk 可能同时包含 `content` 和 `tool_calls`，需分别处理

## 编码规范

### 命名

- **文件**: kebab-case（`chat-view.jsx`, `tool-call-card.jsx`）
- **组件**: PascalCase（`ChatView`, `ToolCallCard`）
- **函数/变量**: camelCase（`handleSendMessage`, `streamTokens`）
- **常量**: UPPER_SNAKE_CASE（`MAX_RETRY`, `DEFAULT_MODEL`）

### 文件组织

- 每个文件只导出一个主要模块，避免多职责混杂
- JSX 文件使用 `.jsx` 扩展名，纯 JS 文件使用 `.js`
- 导入顺序：Node 内置模块 → npm 包 → 项目内部模块

### 组件模式

- 一律使用 React Hooks，不引入类组件
- 复杂逻辑抽为自定义 Hook（如 `useConversation`, `useStreaming`, `useToolExecution`）
- 纯展示组件使用 `React.memo` 包裹以减少流式渲染压力

### 错误处理

- API 请求统一 try-catch，将错误转为用户可读消息
- 工具执行失败返回错误文本给 LLM，不抛出异常
- 使用 Ink 的 ErrorBoundary 组件防止单个异常导致终端白屏

## 约束

- **严禁 `npm install -g`**，所有 CLI 工具通过 `npx` 运行
- **不使用 OpenAI SDK**，所有 API 通信使用 Node.js v24 内置 `fetch` + 手动 SSE 解析
- 不引入 axios、node-fetch 等第三方 HTTP 库
- 代码必须使用 ES modules（`import`/`export`）
- 环境变量不得硬编码，统一通过 `src/utils/config.js` 读取
- 工具执行必须限制（超时、权限、工作目录），避免安全风险

## 测试

- 使用 **vitest** 作为测试框架（ESM 原生支持，速度快）
- 单元测试：`tools/` 下每个工具配备 `*.test.js`
- API 层：Mock 内置 `fetch`，验证流式解析和工具调用逻辑
- 组件测试：`ink-testing-library` 验证 Ink 组件渲染输出
- .env包含了模型API信息(URL,api-key,model)，可用于测试