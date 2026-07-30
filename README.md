# kimi-plugin-codex

**Language / 语言:** [English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-green.svg)](./CHANGELOG.md)

Call local **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** as a subagent from **OpenAI Codex** (local CLI / IDE).

Kimi k3 is strong at frontend and multimodal work — and stronger inside Kimi Code. This plugin is a **thin ACP bridge** via **skills + companion** (same host shape as [cc-plugin-codex](https://github.com/sendbird/cc-plugin-codex)). **No MCP tools.** Not for Codex Cloud.

| | |
| --- | --- |
| **Version** | **0.2.0** |
| **Host** | Local OpenAI Codex |
| **Node** | ≥ 18.18 |
| **Needs** | Kimi Code CLI + `kimi login` |
| **Trigger** | **Skills only** (`$kimi:rescue`, …) |

For Claude Code / Grok use **[kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc)**.

## Happy path

```text
Main agent notices frontend/UI work (or user runs $kimi:rescue)
  → loads skill, routes (bg/wait, resume; conservative task shape)
  → Codex built-in default subagent (pipe only)
  → node <plugin-root>/scripts/kimi-companion.mjs task ...
  → local Kimi Code (ACP)
```

| | |
| --- | --- |
| **Primary** | **`$kimi:rescue`** (implicit when task matches frontend/UI) |
| **Lifecycle / ops** | `$kimi:setup`, `$kimi:status`, `$kimi:result`, `$kimi:cancel`, `$kimi:plan`, `$kimi:goal`, `$kimi:task`, `$kimi:sessions` (explicit; UI → rescue) |
| **Rules** | Main agent commands the handoff; Kimi does the work; return output **verbatim** |
| **Background** | Parent does not wait; use **`$kimi:status`** / **`$kimi:result`** |

Example:

```text
$kimi:rescue make the settings page responsive using existing design tokens
$kimi:rescue --background fix the layout bug in this screenshot --image C:/path/shot.png
$kimi:status
$kimi:result
```

Details: [AGENTS.md](AGENTS.md).

## Install

```bash
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

Enable **kimi**, restart if needed. First time: **`$kimi:setup`**.

After changing version / skills:

```bash
codex plugin remove kimi@kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

If you previously registered a global MCP for this plugin (pre-0.3), remove it:

```bash
codex mcp remove kimi
```

Windows: prefer `KIMI_CLI_PATH=%USERPROFILE%\.kimi-code\bin\kimi.exe` when PATH is incomplete.

## First verify

```text
$kimi:setup
$kimi:rescue implement a small responsive settings section using existing design tokens
```

CLI probe:

```bash
node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- "Reply with exactly: kimi-bridge-ok"
```

## Commands

| Command | What it does |
| --- | --- |
| `$kimi:setup` | Verify Kimi CLI, login, ACP |
| `$kimi:rescue` | Hand a task to Kimi (built-in subagent + companion) |
| `$kimi:status` | List or inspect jobs |
| `$kimi:result` | Open finished job output |
| `$kimi:cancel` | Cancel a running job |
| `$kimi:plan` | Plan-only companion task (explicit; not normal frontend) |
| `$kimi:goal` | Goal-framed run (explicit; large/UI → rescue) |
| `$kimi:task` | Light non-UI one-shot (explicit; frontend → rescue) |
| `$kimi:sessions` | List ACP sessions for resume |
| `$kimi:sessions` | List ACP sessions (explicit) |

`--background` / `--wait` control whether the **Codex parent** waits; they are not companion detach flags.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `BINARY_NOT_FOUND` | Install Kimi Code; `kimi login`; set `KIMI_CLI_PATH` |
| `ACP_FAILED` / `LOGIN_REQUIRED` | `kimi login`; re-run `$kimi:setup` |
| Skills not found | Reinstall plugin; restart Codex |
| Old `kimi_*` MCP tools still appear | `codex mcp remove kimi` (removed in 0.3.0) |
| Long task still running | `$kimi:status` / `$kimi:result` |
| Codex Cloud | Not supported |

Errors are prefixed with `[kimi-plugin]` and include a **Fix** list.

## Compatibility

| Component | Requirement |
| --- | --- |
| This plugin | 0.2.0 |
| Node | ≥ 18.18 |
| Kimi Code | CLI with working `kimi acp` |
| Codex | Local only, with plugin skills + built-in subagent |

## Related

| Package | Host |
| --- | --- |
| [kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc) | Claude Code / Grok |
| **kimi-plugin-codex** (this repo) | OpenAI Codex |
| [cc-plugin-codex](https://github.com/sendbird/cc-plugin-codex) | Reference host shape |

Maintainer docs: [AGENTS.md](AGENTS.md) · Changelog: [CHANGELOG.md](CHANGELOG.md)

## License

MIT — see [LICENSE](./LICENSE).
