---
name: kimi-setup
description: >
  First-run doctor for local Kimi Code + ACP (binary, login, workspace, next verify steps).
  Use after install or when kimi_rescue fails.
---

# Kimi setup (Codex)

Call MCP tool **`kimi_setup`** and show the report to the user (ok / binary / workspace / next steps).

## Common fixes

| Symptom | Fix |
| --- | --- |
| kimi binary not found | Install [Kimi Code](https://github.com/MoonshotAI/kimi-code); set `KIMI_CLI_PATH` |
| ACP / login errors | `kimi login` in a normal terminal, then re-run setup |
| Windows PATH gaps | Prefer `%USERPROFILE%\.kimi-code\bin\kimi.exe` via `KIMI_CLI_PATH` |
| MCP tools missing | Absolute path: `codex mcp add kimi -- node <repo>/plugins/kimi/scripts/kimi-mcp.mjs` |

## After setup ok — first verify

1. **Smoke (short):** `kimi_rescue` with prompt `Reply with exactly: kimi-bridge-ok` — expect `text` and `still_running: false`.
2. **Long-work habit:** for real frontend work, if `still_running: true`, poll `kimi_status` / `kimi_result` with `jobId` until done. Wait-slice end is **not** failure.

Example:

> Use kimi_rescue to implement a small responsive settings section using existing design tokens. If still_running, keep polling until completed; return Kimi’s text verbatim.

Local Codex only — not Codex Cloud. Maintainer details: repo `AGENTS.md`.
