# 变更日志

**Language / 语言:** [English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

## 0.2.0

公开包版本自 GitHub **0.1.x** 起记为 **0.2.0**（与 **kimi-plugin-cc** 0.2.0 锁步）。下方本地曾用的 0.2.x–0.3.0 标签仅为开发记录，不是独立公开发版。

### 新增
- 仅 Skills 宿主路径：**`$kimi:rescue`**（前端/UI 可隐式）+ 显式 `$kimi:setup` / `status` / `result` / `cancel` / `plan` / `goal` / `task` / `sessions`
- 与 CC 宿主面功能对等（能力集合相同，形态为 skill）
- `lib/prompt.mjs` + 可选 `KIMI_BRIDGE_HANDOFF=1`（默认关）
- Job **phase** + **lastProgressMessage**；更丰富的 status 渲染
- `tests/skills-contracts.test.mjs`

### 变更
- **彻底移除 MCP**（skills → 内置 default subagent 管道 → companion → ACP）
- companion 核心与 **kimi-plugin-cc** 0.2.0 对齐
- 路由：UI/大任务 → `$kimi:rescue`；轻量非 UI → `$kimi:task`
- 文档：去掉虚假的 `--prompt-file`
- 版本 **0.2.0**

### 迁移
- 若旧构建曾 `codex mcp add kimi`，请 `codex mcp remove kimi`
- 改 skill 后：`codex plugin remove kimi@kimi-plugin-codex` 再 `codex plugin add kimi@kimi-plugin-codex`

---

## 开发历史（公开 0.2.0 之前的本地标签）

以下内容已并入 **0.2.0**；版本号仅为本地记录。

### 本地 0.3.0 — 仅 Skills
- 移除 MCP；唯一路径 skills → 管道 → companion → ACP

### 本地 0.2.2 — 更严交接语气
- 前端/UI MUST rescue；生命周期 skill 仅显式

### 本地 0.2.1 — 编排语义
- 主线程路由；纯管道 subagent；bridge notes 可选

### 本地 0.2.0-skills — 宿主架构转向
- 主路径 skills + 内置 subagent（当时 MCP 仍为可选副通道）

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
- **Codex 插件 MCP 未注入工具：** `.mcp.json` 用了裸 `"kimi": {…}`；官方要求 `"mcpServers": { "kimi": {…} }`。
- stdio 入口改为相对 `./scripts/kimi-mcp.mjs` + `"cwd": "."`。

### 文档
- 澄清 `kimi_rescue` 是 MCP 工具名而非 `kimi.exe`；版本 bump 后重装检查清单

## 0.1.1

### 新增
- **首次验证**路径与 setup `nextSteps`
- Setup doctor、标准错误 Fix 列表、workspace / media 路径解析

### 变更
- 用户文档 happy path：`kimi_rescue` 做前端/UI/截图/视频

## 0.1.0

首个公开发版：OpenAI Codex 插件，经 ACP 把本地 **Kimi Code** 当 subagent。

### 说明
- 仅本地 Codex（非 Codex Cloud）
- 维护文档：[AGENTS.md](AGENTS.md)

---

**English:** [CHANGELOG.md](CHANGELOG.md)
