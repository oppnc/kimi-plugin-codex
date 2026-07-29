# Changelog

**Language / 语言:** [English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

## 0.1.0

First public release: OpenAI Codex plugin that runs local **Kimi Code** as a subagent over ACP.

### Added

- Thin ACP companion + MCP server (`kimi-mcp.mjs`)
- Primary handoff: `kimi_rescue` (start + wait + result)
- Fallback job tools: `kimi_task_start` / `kimi_goal_start` / `kimi_status` / `kimi_result` / `kimi_cancel` / `kimi_sessions` / `kimi_setup`
- Skills: `kimi-delegate` (subagent handoff), `kimi-setup`
- Modes, multimodal paths, goals, session resume, optional git context
- Background jobs with phase / progress / orphan reclaim
- Unit tests (`npm test`) and smoke (`npm run smoke`)

### Notes

- Local Codex only (not Codex Cloud)
- No reimplemented Kimi system prompts; tools/swarm/skills stay with Kimi Code
- Maintainer docs: [AGENTS.md](AGENTS.md)

---

**中文版:** [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)
