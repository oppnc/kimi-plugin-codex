# AGENTS.md

Instructions for coding agents and maintainers of **kimi-plugin-codex**.  
Humans: start with [README.md](README.md) / [README.zh-CN.md](README.zh-CN.md).

## What this repo is

Thin host shell around local **Kimi Code** over **ACP** (`kimi acp` NDJSON JSON-RPC), packaged for **OpenAI Codex**.

**Only host path (aligned with sendbird/cc-plugin-codex):** main agent **discovers** frontend/UI work → loads **`$kimi:rescue`** → **routes** (bg/wait, resume, conservative task shape) → Codex **built-in default subagent** (pipe only) → **kimi-companion** → Kimi ACP.

**Plugin root (dead rule — models must not invent cache paths):**  
`<plugin-root>` = absolute path of `skills/rescue/SKILL.md` **two parents up** (parent of `skills/`).  
Installed cache shape: `~/.codex/plugins/cache/kimi-plugin-codex/kimi/<version>/` — **not** `…/kimi-plugin-codex/scripts/`.  
Grok/Claude avoid this guess because they expand `${CLAUDE_PLUGIN_ROOT}` and use a registered `kimi:kimi-rescue` agent type.

**No MCP tools.** No `kimi_*` tool surface. Trigger = skills + companion only.

- **Does:** `$kimi:setup`, `$kimi:rescue`, `$kimi:status` / `$kimi:result` / `$kimi:cancel`, jobs, multimodal paths, session resume, optional git facts.
- **Does not:** MCP server, reimplement Kimi system prompts, own tools/swarm/skills, ship a review-gate product, client FS reverse-RPC, default host “handoff” bullets on prompts.

Sibling package for Claude Code / Grok: **kimi-plugin-cc** (commands + agents UX).

Public repo: `https://github.com/oppnc/kimi-plugin-codex`  
Marketplace name: `kimi-plugin-codex` · plugin id: `kimi` → install as `kimi@kimi-plugin-codex`.

## Product posture (do not violate)

| Principle | Behavior |
| --- | --- |
| Skills only | One trigger style: plugin skills → companion (like cc-plugin-codex). **No MCP** |
| Kimi as subagent | Whole Kimi Code process; one handoff; result verbatim; main agent does not steal UI work |
| Discover → hand off | Main agent **MUST** hand frontend/UI to `$kimi:rescue` when Kimi is available |
| Main agent commands | Parent owns bg/wait, resume/fresh, conservative task shaping |
| Built-in forwarder | Codex default subagent is a **pipe** only — one companion command |
| Conservative shaping | Tighten follow-ups; no invented repo facts; no long host manuals |
| No prompt reimplementation | Resolved task → `session/prompt`; Kimi owns system/tools/swarm |
| Real ACP | NDJSON JSON-RPC via companion |
| Local workspace | Kimi edits disk; no client FS reverse-RPC bridge |
| Product focus | Frontend, multimodal, goals — not review pipelines |

## Version (keep in sync — all **0.2.1**)

| Location | Field |
| --- | --- |
| `package.json` | `version` |
| `plugins/kimi/.codex-plugin/plugin.json` | `version` |
| `plugins/kimi/scripts/kimi-companion.mjs` | `VERSION` + file header |
| `plugins/kimi/scripts/lib/acp-client.mjs` | `PLUGIN_VERSION` (ACP `clientInfo`) |
| `tests/skills-contracts.test.mjs` | `VERSION` pin |
| README badges / CHANGELOG | human-facing version label |

After bumping: `npm test` and `npm run smoke`.

## Layout

```text
kimi-plugin-codex/
  .agents/plugins/marketplace.json
  plugins/kimi/
    .codex-plugin/plugin.json      # skills only — no mcpServers
    skills/
      rescue/                      # $kimi:rescue — primary handoff
      setup/                       # $kimi:setup
      status/ result/ cancel/      # job lifecycle (explicit-only)
      plan/ goal/ sessions/        # explicit-only companion wrappers
      kimi-cli-runtime/            # internal forwarder contract
    scripts/kimi-companion.mjs     # CLI / ACP runner
    scripts/lib/                   # acp, args, media, permissions, state, …
  tests/
  scripts/smoke.mjs
  AGENTS.md
```

## Host architecture (do not regress)

```text
User task (or $kimi:rescue)
  → Main Codex agent discovers frontend/UI → loads rescue skill
  → Parent routes (bg/wait, resume/fresh) + optional conservative task shape
  → spawn_agent (built-in default pipe; omit agent_type)
  → child runs one: node <plugin-root>/scripts/kimi-companion.mjs task ...
  → Kimi Code (ACP)
  → stdout verbatim to parent (foreground)
Background: parent does not wait; child still runs companion in foreground.
Jobs: $kimi:status / $kimi:result / $kimi:cancel via companion.
```

- Resolve `<plugin-root>` as two directories above the skill’s `SKILL.md`.
- Never detach companion from the **parent** with `nohup` / `&`.
- `--background` / `--wait` are parent-only; never pass them to companion `task`.
- Default task prompt is resolved user/task text only. Opt-in legacy bullets: `KIMI_BRIDGE_HANDOFF=1`.
- **Empty / failed handoff:** companion exit ≠ 0, `(no agent text)`, or JSON `ok:false` / `emptyAgentText` → parent re-dispatches **once** (`--fresh`); still never implement UI in the main Codex thread. Full table: `skills/rescue/SKILL.md` **Acceptance**.
- **Codex Desktop shell kill (~14s):** child **must** set shell tool `timeout_ms: 86400000` (prose alone fails). Open-ended UI redesign → parent **`--background`** + `$kimi:status` / `$kimi:result`.

## Turn acceptance (Mode A / Mode B — keep isomorphic with kimi-plugin-cc)

Shared policy: `plugins/kimi/scripts/lib/turn-policy.mjs` (applied in `runKimiAcpTurn`).

| Mode | Symptom | Companion action |
| --- | --- | --- |
| **A — empty** | `end_turn` with no agent text and no tools | Up to **5** fresh-session retries (default), then **1** same-session empty-recovery nudge; still empty → job **`failed`**, **exit code 1** |
| **B — incomplete** | Disk/action task ends after plan text or only read/search tools | Up to **2** same-session continue nudges; stop if stagnant |

- Mode A retry budget: `--empty-retries <n>` (explicit) → `KIMI_EMPTY_RETRIES` env → default **5**; `0` disables retries.
- Off in `plan` mode; off for Q&A/how-to, reply-exactly probes, completion-claim text; disable with `KIMI_FORCE_CONTINUE=0`.
- Empty turns are Mode A only (not reclassified as B).
- Keep this core identical to kimi-plugin-cc except package identity strings.

## Skills

| Skill | Role | Implicit |
| --- | --- | --- |
| **rescue** | Hand work to Kimi | **ON** (auto when frontend/UI matches) |
| **setup** | Doctor | OFF |
| **status** | List / wait on jobs | OFF |
| **result** | Open finished job output | OFF |
| **cancel** | Stop a running job | OFF |
| **plan** | Plan-only companion task | OFF |
| **goal** | Goal-framed companion run | OFF |
| **sessions** | List ACP sessions | OFF |
| **kimi-cli-runtime** | Internal pipe contract | OFF |

Job phases (status JSON): `queued` → `launching` → `starting_acp` → `running` → terminal.  
Orphaned dead runners → `failed` + `orphaned: true`.  
Job store pruned to newest ~100 (job **and** its `.log` pruned together). `status`/`result --wait`
exit **non-zero** when the wait budget runs out while the job is still `running`.

## Env

| Variable | Purpose |
| --- | --- |
| `KIMI_CLI_PATH` | Absolute path to `kimi` / `kimi.exe` |
| `KIMI_PLUGIN_CODEX_DATA_DIR` | Job store (default `~/.kimi-plugin-codex`) |
| `CODEX_SESSION_ID` / `KIMI_PLUGIN_CODEX_HOST_SESSION` | Best-effort job scoping |
| `KIMI_BRIDGE_HANDOFF` | `1`/`true` = legacy host handoff bullets (default off) |
| `KIMI_FORCE_CONTINUE` | `0`/`false`/`off` disables Mode B incomplete-work continue (default on) |

## Codex install

Remote (preferred, same shape as Claude Code marketplace):

```bash
codex plugin marketplace add oppnc/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

Local checkout (authors):

```bash
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

Then `$kimi:setup` once. After skill/version edits:

```bash
codex plugin marketplace upgrade kimi-plugin-codex
codex plugin remove kimi@kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

Windows: prefer `%USERPROFILE%\.kimi-code\bin\kimi.exe` via `KIMI_CLI_PATH`.

If an old global MCP entry remains from earlier versions, remove it:

```bash
codex mcp remove kimi
```

## Companion CLI (direct, no Codex)

```bash
node plugins/kimi/scripts/kimi-companion.mjs setup

node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- \
  "Make the settings page responsive using existing tokens"

node plugins/kimi/scripts/kimi-companion.mjs status
node plugins/kimi/scripts/kimi-companion.mjs result
```

## Development

```bash
npm test
npm run smoke
node plugins/kimi/scripts/kimi-companion.mjs setup --json
```
