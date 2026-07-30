# kimi-plugin-codex

**Language / 语言:** [English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.1-green.svg)](./CHANGELOG.md)

Call local **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** as a subagent from **OpenAI Codex** (local CLI / IDE).

Kimi k3 is strong at frontend and multimodal work — and stronger inside Kimi Code. This plugin is a **thin ACP bridge** (skills + MCP). Not for Codex Cloud (no local `kimi` there).

| | |
| --- | --- |
| **Version** | **0.1.1** |
| **Host** | Local OpenAI Codex |
| **Node** | ≥ 18.18 |
| **Needs** | Kimi Code CLI + `kimi login` |

For Claude Code / Grok use **[kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc)**.

## Happy path

| | |
| --- | --- |
| **Tool** | MCP **`kimi_rescue`** (skill **`kimi-delegate`** prefers this) |
| **When** | Frontend/UI, CSS/layout, screenshot/**video** bugs, multi-file implement |
| **How** | Ask Codex to hand the task to Kimi and return the result **verbatim** |

Example prompt to Codex:

> Use kimi_rescue to implement a small responsive settings section using existing design tokens. Return Kimi’s result verbatim.

Advanced tools (`kimi_task_start` / status / result): see [AGENTS.md](AGENTS.md).

## Install

Codex plugin install is **local-marketplace oriented** (host policy). Typical flow:

```bash
# from a clone of this repo
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

Enable **kimi**, restart if needed. First time: run skill **`kimi-setup`** or MCP **`kimi_setup`**.

### If MCP tools never appear

Register with an absolute path (most common fix):

```bash
codex mcp add kimi -- node /absolute/path/to/kimi-plugin-codex/plugins/kimi/scripts/kimi-mcp.mjs
```

Windows: prefer `KIMI_CLI_PATH=%USERPROFILE%\.kimi-code\bin\kimi.exe` when PATH is incomplete.

## First verify (do this once)

### 1) Doctor

```bash
node plugins/kimi/scripts/kimi-companion.mjs setup
# or in Codex: kimi_setup / kimi-setup skill
```

Expect `acp probe: ok` and **Next (first verify)**.

### 2) Hand a frontend task to Kimi

In Codex:

> Use kimi_rescue to implement a small responsive settings section using existing design tokens. Keep changes minimal. Return Kimi’s result verbatim.

CLI probe:

```bash
node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- "Reply with exactly: kimi-bridge-ok"
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `BINARY_NOT_FOUND` | Install Kimi Code; `kimi login`; set `KIMI_CLI_PATH` |
| `ACP_FAILED` / `LOGIN_REQUIRED` | `kimi login` in a normal terminal; re-run setup |
| MCP tools missing | Absolute `codex mcp add` (above) |
| Long task cut off | Plugin sets long tool timeout; or use start + status (advanced) |
| Codex Cloud | Not supported — needs local `kimi` |
| `MEDIA_NOT_FOUND` | Absolute path or path under the workspace Kimi uses |

Errors are prefixed with `[kimi-plugin]` and include a **Fix** list.

## Compatibility

| Component | Requirement |
| --- | --- |
| This plugin | 0.1.1 |
| Node | ≥ 18.18 |
| Kimi Code | CLI with working `kimi acp`. Setup prints `compat` + version. |
| Codex | Local only |

## Related

| Package | Host |
| --- | --- |
| [kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc) | Claude Code / Grok |
| **kimi-plugin-codex** (this repo) | OpenAI Codex |

Maintainer docs: [AGENTS.md](AGENTS.md) · Changelog: [CHANGELOG.md](CHANGELOG.md)

## License

MIT — see [LICENSE](./LICENSE).
