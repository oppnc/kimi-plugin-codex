# Changelog

**Language / 语言:** [English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

## 0.1.3

### Fixed
- **Codex marks server `kimi` unavailable (no tools):** stdout used LSP `Content-Length` framing; Codex’s rmcp client expects **NDJSON** (`JSON\\n`). Logs: `Failed to parse message receive: Content-Length: … expected value at line 1 column 1` → `has_cached_tools=false`. Emit NDJSON on stdout; still accept Content-Length on stdin.
- Harden stdin reader so partial Content-Length headers are not NDJSON-split; add chunked-header regression test.
- Raise plugin `startup_timeout_sec` to 60.
- Fix `.mcp.json` shape to official `"mcpServers": { … }` and relative `./scripts/kimi-mcp.mjs` + `cwd: "."`.

## 0.1.2

### Fixed
- **Codex plugin MCP never injected tools:** `.mcp.json` used a bare `"kimi": {…}` object; official plugins require `"mcpServers": { "kimi": {…} }` (same as plugin-creator stub). Without this, install/enable succeeded but agents had no `kimi_setup` / `kimi_rescue`.
- Align stdio entry with official plugins: relative `./scripts/kimi-mcp.mjs` + `"cwd": "."` (instead of only `${PLUGIN_ROOT}`).

### Docs
- Clarify `kimi_rescue` is an MCP tool name, not `kimi.exe`; reinstall-after-version-bump checklist

## 0.1.1

### Added
- **First verify** path in README + setup `nextSteps` (frontend handoff via `kimi_rescue`)
- Setup doctor: Node version, workspace source, soft Kimi Code **compat** notes, actionable `errorCode`
- Standardized `[kimi-plugin]` errors with numbered **Fix** lists
- Workspace root resolution from host env; media paths resolve against workspace cwd

### Changed
- Happy path only in user docs: `kimi_rescue` for frontend/UI/screenshot/video
- Stronger MCP/skill triggers for frontend and visual work; MCP tool descriptions updated

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
