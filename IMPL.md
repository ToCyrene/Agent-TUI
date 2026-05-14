# 实现顺序

## 阶段 1：基础设施

1. `package.json` — 添加 `"type": "module"` 和 npm scripts
2. `src/utils/config.js` — 环境变量读取
3. `src/utils/logger.js` — 日志工具

## 阶段 2：API 通信层

4. `src/api/client.js` — HTTP 请求构造（Node.js v24 内置 fetch）
5. `src/api/stream.js` — SSE 流解析器

> 验证：临时脚本发送一次请求，确认收到流式响应。

## 阶段 3：工具层

6. `src/tools/schema.js` — 工具 JSON Schema 定义
7. `src/tools/registry.js` — 注册表（register / execute）
8. `src/tools/builtin/` — 内置工具实现

> 验证：单元测试注册和工具执行逻辑。

## 阶段 4：核心层

9. `src/core/state.js` — useReducer 全局状态
10. `src/core/conversation.js` — messages[] 管理、token 计数
11. `src/core/agent.js` — Agent 主循环（编排 api + tools）

> 验证：Mock fetch，测试完整工具调用循环。

## 阶段 5：UI 层

12. `src/ui/StatusBar.jsx` — 状态栏（最简单，先验证 Ink 能渲染）
13. `src/ui/Message.jsx` — 单条消息（用户/助手/工具三种类型）
14. `src/ui/ToolCallCard.jsx` — 工具调用卡片
15. `src/ui/Input.jsx` — 输入区（useInput hook）
16. `src/ui/ChatView.jsx` — 消息列表 + 视口管理
17. `src/ui/App.jsx` — 根布局组合

## 阶段 6：入口 & 集成

18. `src/index.js` — `render(<App/>)` 挂载
19. 端到端验证 — 启动终端，输入消息，观察完整流程
