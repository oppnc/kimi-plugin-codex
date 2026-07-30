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

Ask Codex to run **`kimi_rescue`** with a small **frontend** task, for example:

> Use kimi_rescue to implement a small responsive settings section using existing design tokens. Return Kimi’s result verbatim.

Local Codex only — not Codex Cloud. Maintainer details: repo `AGENTS.md`.
