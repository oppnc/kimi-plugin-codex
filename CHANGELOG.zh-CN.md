# 变更日志

**Language / 语言:** [English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

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
