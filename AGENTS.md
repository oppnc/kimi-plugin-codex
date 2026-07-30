# AGENTS.md

Instructions for coding agents and maintainers of **kimi-plugin-codex**.  
Humans: start with [README.md](README.md) / [README.zh-CN.md](README.zh-CN.md).

## What this repo is

Thin host shell around local **Kimi Code** over **ACP** (`kimi acp` NDJSON JSON-RPC), packaged for **OpenAI Codex** (skills + MCP).

- **Does:** setup probe, one-handoff subagent call (`kimi_rescue`), task/goal forward, permissions over the bridge, jobs, multimodal paths, session resume, optional git facts.
- **Does not:** reimplement Kimi system prompts, own tools/swarm/skills, ship a review-gate product, advertise client FS reverse-RPC (Kimi edits the workspace disk itself).

Sibling package for Claude Code / Grok: **kimi-plugin-cc** (commands + agents UX).

Public repo: `https://github.com/oppnc/kimi-plugin-codex`  
Marketplace name: `kimi-plugin-codex` · plugin id: `kimi` → install as `kimi@kimi-plugin-codex`.

## Product posture (do not violate)

| Principle | Behavior |
| --- | --- |
| Kimi as subagent | One handoff; result verbatim; main agent does not steal the task |
| Thin host shell | Skills / MCP only forward routing flags + user text |
| No prompt reimplementation | User text → `session/prompt`; Kimi owns system/tools/swarm |
| Real ACP | NDJSON JSON-RPC via companion |
| Local workspace | Kimi edits disk; no client FS reverse-RPC bridge |
| Product focus | Frontend, multimodal, goals — not review pipelines |

## Version (keep in sync — all **0.1.1**)

| Location | Field |
| --- | --- |
| `package.json` | `version` |
| `plugins/kimi/.codex-plugin/plugin.json` | `version` |
| `plugins/kimi/scripts/kimi-companion.mjs` | `VERSION` + file header |
| `plugins/kimi/scripts/kimi-mcp.mjs` | `SERVER_VERSION` |
| `plugins/kimi/scripts/lib/acp-client.mjs` | `PLUGIN_VERSION` (ACP `clientInfo`) |
| README badges / CHANGELOG | human-facing version label |

After bumping: `npm test` and `npm run smoke`.

## Layout

```text
kimi-plugin-codex/
  .agents/plugins/marketplace.json
  plugins/kimi/
    .codex-plugin/plugin.json
    .mcp.json                      # MCP server for Codex plugin load
    skills/kimi-delegate/          # subagent handoff skill (host-facing AI)
    skills/kimi-setup/             # diagnostics skill
    scripts/kimi-mcp.mjs           # MCP entry (tools → companion)
    scripts/kimi-companion.mjs     # CLI / ACP runner
    scripts/lib/                   # acp, args, media, permissions, state, …
  tests/
  scripts/smoke.mjs
  AGENTS.md                        # this file
```

## MCP tools (implementation detail)

| Tool | Role |
| --- | --- |
| `kimi_setup` | Probe binary + ACP + models |
| **`kimi_rescue`** | **Primary** subagent handoff (start + wait + result JSON with `text`) |
| `kimi_task_start` / `kimi_goal_start` | Detach / multi-timeout fallback → `job_id` |
| `kimi_status` / `kimi_result` / `kimi_cancel` | Continue or cancel |
| `kimi_sessions` | List ACP sessions |
| `kimi_task` | Short sync probe only |

Host skill **`kimi-delegate`** should prefer `kimi_rescue` and hide job plumbing from the user.

Job phases (status JSON): `queued` → `launching` → `starting_acp` → `running` → terminal.  
Orphaned dead runners → `failed` + `orphaned: true`.

## Env

| Variable | Purpose |
| --- | --- |
| `KIMI_CLI_PATH` | Absolute path to `kimi` / `kimi.exe` |
| `KIMI_PLUGIN_CODEX_DATA_DIR` | Job store (default `~/.kimi-plugin-codex`) |
| `CODEX_SESSION_ID` / `KIMI_PLUGIN_CODEX_HOST_SESSION` | Best-effort job scoping |

## Codex install / MCP pitfalls

- Plugin `.mcp.json` uses `${PLUGIN_ROOT}`. If tools never appear, register absolute path:

```bash
codex mcp add kimi -- node /absolute/path/to/kimi-plugin-codex/plugins/kimi/scripts/kimi-mcp.mjs
```

- Plugin sets `tool_timeout_sec = 600` in `.mcp.json`. Raise further in `~/.codex/config.toml` if needed (plugin key may vary).
- Prefer MCP tools over shelling to companion (sandbox friction).
- Strict sandbox / headless `codex exec` may cancel MCP tools in some versions — compare interactive TUI.
- Windows: prefer native `%USERPROFILE%\.kimi-code\bin\kimi.exe`; set `KIMI_CLI_PATH` if PATH is incomplete.

Optional config sketch:

```toml
[plugins."kimi@kimi-plugin-codex".mcp_servers.kimi]
enabled = true
tool_timeout_sec = 600
default_tools_approval_mode = "approve"
```

## Companion CLI (direct, no Codex)

```bash
node plugins/kimi/scripts/kimi-companion.mjs setup

node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- \
  "Make the settings page responsive using existing tokens"

node plugins/kimi/scripts/kimi-companion.mjs task --image shot.png -- \
  "Find the layout bug shown in the media"

node plugins/kimi/scripts/kimi-companion.mjs goal -- \
  "Ship a working dark-mode toggle with tests green"

node plugins/kimi/scripts/kimi-companion.mjs task --resume -- \
  "Continue from where you left off"
```

## Development

```bash
npm test
npm run smoke
node plugins/kimi/scripts/kimi-companion.mjs setup --json
```

After skill/MCP edits, reinstall the plugin so the Codex cache refreshes:

```bash
codex plugin remove kimi@kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```
