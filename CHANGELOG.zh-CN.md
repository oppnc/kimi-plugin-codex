# 变更日志

**Language / 语言:** [English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

## 0.1.4

### 变更
- **长前端任务一等公民：** `kimi_rescue` 默认只等 **120s** 一片；超时返回 `still_running` + `jobId` + `next_actions`，**不是失败**。继续用 `kimi_status` / `kimi_result` 轮询。
- status/result 支持 `wait_timeout_ms`（默认 180s 一片）。
- MCP `tool_timeout_sec` 提到 **900**。
- Skill 写明 job + 轮询 + resume+截图多轮（对齐官方/社区 background job 模式）。

## 0.1.3

### 修复
- **Codex 将 `kimi` 标为 unavailable（无工具）：** stdout 发了 LSP `Content-Length`；Codex rmcp 要 **NDJSON**。日志：`Failed to parse message receive: Content-Length…` → `has_cached_tools=false`。stdout 改为 NDJSON；stdin 仍兼容 Content-Length。
- 加固 stdin 半包解析；增加回归测试。
- `startup_timeout_sec` 提到 60；`.mcp.json` 改为官方 `mcpServers` 包装。

## 0.1.2

### 修复
- **Codex 插件 MCP 不注入工具：** `.mcp.json` 写成裸 `"kimi"` 对象；官方要求 `"mcpServers": { "kimi": … }`。装上了但 agent 没有 `kimi_setup` / `kimi_rescue`。
- stdio 入口改为相对路径 `./scripts/kimi-mcp.mjs` + `"cwd": "."`，与官方插件一致。

### 文档
- 明确 `kimi_rescue` 是 MCP 工具名而非 `kimi.exe`；版本变更后需重装缓存

## 0.1.1

### 新增
- README + setup 的 **首次验证**（`kimi_rescue` 交前端任务）
- Setup doctor：Node、workspace、compat、可行动错误码
- 标准化 `[kimi-plugin]` 错误与 Fix 列表
- 工作区 / 媒体路径解析增强

### 变更
- 用户文档只保留主路径 `kimi_rescue`；加强前端/视觉触发

## 0.1.0

首次公开发布：在 **OpenAI Codex** 中通过 ACP 将本机 **Kimi Code** 作为 subagent 调用。

### 新增

- 薄 ACP companion + MCP 服务（`kimi-mcp.mjs`）
- 主路径交接：`kimi_rescue`（start + wait + 结果）
- 回退 job 工具：`kimi_task_start` / `kimi_goal_start` / `kimi_status` / `kimi_result` / `kimi_cancel` / `kimi_sessions` / `kimi_setup`
- Skills：`kimi-delegate`（subagent 交接）、`kimi-setup`
- 模式、多模态路径、Goals、会话续聊、可选 git 上下文
- 后台 job（phase / progress / 孤儿回收）
- 单元测试（`npm test`）与 smoke（`npm run smoke`）

### 说明

- 仅本地 Codex（不支持 Codex Cloud）
- 不重写 Kimi system prompt；工具 / swarm / skills 仍归 Kimi Code
- 维护者文档：[AGENTS.md](AGENTS.md)

---

**English:** [CHANGELOG.md](CHANGELOG.md)
