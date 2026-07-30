# Changelog

**Language / 语言:** [English](CHANGELOG.md) | [中文](CHANGELOG.zh-CN.md)

## 0.2.0

Public package version continues from GitHub **0.1.x** as **0.2.0** (aligned with **kimi-plugin-cc** 0.2.0). Intermediate local labels (0.2.x–0.3.0) below were development history and are not separate public tags.

### Added
- Skills-only host path: **`$kimi:rescue`** (implicit for frontend/UI) + explicit `$kimi:setup` / `status` / `result` / `cancel` / `plan` / `goal` / `task` / `sessions`
- Functional parity with CC host surface (same capability set; skill form)
- `lib/prompt.mjs` + optional `KIMI_BRIDGE_HANDOFF=1` (default off)
- Job **phase** + **lastProgressMessage**; richer status render
- `tests/skills-contracts.test.mjs`

### Changed
- **Removed MCP entirely** (skills → built-in default subagent pipe → companion → ACP only)
- Core companion alignment with **kimi-plugin-cc** 0.2.0
- Routing tables: UI/large work → `$kimi:rescue`; light non-UI → `$kimi:task`
- Docs: strip false `--prompt-file` claims
- Version **0.2.0**

### Migration
- If you added a global `codex mcp add kimi` from older builds, run `codex mcp remove kimi`
- After skill edits: `codex plugin remove kimi@kimi-plugin-codex` then `codex plugin add kimi@kimi-plugin-codex`

---

## Development history (local labels before public 0.2.0)

These sections record work that shipped into **0.2.0**; version numbers below were local-only.

### Local 0.3.0 — skills only
- Removed MCP surface; single path skills → pipe → companion → ACP

### Local 0.2.2 — stricter handoff language
- Rescue MUST for frontend/UI; lifecycle skills explicit-only

### Local 0.2.1 — orchestration clarity
- Parent routes; pure pipe subagent; bridge notes opt-in

### Local 0.2.0-skills — host architecture shift
- Primary path skills + built-in subagent (MCP optional at that time)

## 0.1.4

### Changed
- **Long frontend work is first-class:** `kimi_rescue` default wait slice is **120s** (was 540s hard-block). Ending a slice returns `still_running` + `jobId` + `next_actions` — not failure. Host should poll `kimi_status` / `kimi_result`.
- `kimi_status` / `kimi_result` accept `wait_timeout_ms` (default poll slice 180s); enrich running status with next_actions.
- MCP `tool_timeout_sec` raised to **900**.
- Skill `kimi-delegate` documents job + poll + resume+image multi-round UI loop (aligned with codex-plugin-cc / cc-plugin-codex background job pattern).

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
