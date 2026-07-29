---
name: kimi-setup
description: >
  Diagnose local Kimi Code CLI install and ACP readiness for the kimi Codex plugin
  (binary path, login, models). Use when setup fails or first-time install.
---

# Kimi setup (Codex)

Call MCP tool **`kimi_setup`** and show the report to the user (ok / binary / models).

## Common fixes

| Symptom | Fix |
| --- | --- |
| kimi binary not found | Install [Kimi Code](https://github.com/MoonshotAI/kimi-code); set `KIMI_CLI_PATH` |
| ACP / login errors | `kimi login` in a normal terminal, then re-run setup |
| Windows PATH gaps | Prefer `%USERPROFILE%\.kimi-code\bin\kimi.exe` via `KIMI_CLI_PATH` |
| MCP tools missing | Absolute path: `codex mcp add kimi -- node <repo>/plugins/kimi/scripts/kimi-mcp.mjs` |

Local Codex only — not Codex Cloud. Maintainer details: repo `AGENTS.md`.
