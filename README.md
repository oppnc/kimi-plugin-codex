# kimi-plugin-codex

**Language / 语言:** [English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](./CHANGELOG.md)

This plugin does one thing: call **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** as a subagent from **OpenAI Codex / ChatGPT**.

Kimi k3 is strong at frontend and multimodal work. In its familiar environment (Kimi Code), it is even stronger. If you prefer not to live in the Kimi CLI, want to boost your main agent’s frontend ability, or want to spend limited Kimi tokens where they count — this is for you.

Anyone who has used Codex / ChatGPT knows GPT’s frontend skill can feel like a first-year student from fifteen years ago — and you also have to admit that Codex / ChatGPT products are excellent, and GPT’s engineering strength is real. Now use **kimi-plugin-codex** to level up your frontend work.

Thin ACP bridge only. No reimplemented system prompts. Tools, swarm, skills, and models stay with Kimi Code.

| | |
| --- | --- |
| **Version** | **0.1.0** |
| **Host** | OpenAI Codex / ChatGPT (local) |
| **Node** | ≥ 18.18 |
| **Repository** | [github.com/oppnc/kimi-plugin-codex](https://github.com/oppnc/kimi-plugin-codex) |

> Changelog: [English](CHANGELOG.md) · [中文](CHANGELOG.zh-CN.md)  
> Security: [SECURITY.md](SECURITY.md) · Maintainers: **[AGENTS.md](AGENTS.md)**

This is **not** the Claude Code package. For Claude Code / Grok, use **[kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc)**.

## Features

| Feature | How |
| --- | --- |
| Full Kimi agent | `kimi acp` → `session/prompt` |
| Modes | `default` \| `plan` \| `auto` \| `yolo` |
| Multimodal | image / video / media paths |
| Goals | Goal-framed handoff |
| Resume | Continue the same Kimi session |
| Jobs | status / result / cancel |
| Host UX | Skill one-handoff → MCP `kimi_rescue` |

## Requirements

- Node.js ≥ 18.18
- [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code) installed and logged in (`kimi login`)
- Local Codex (CLI or IDE). **Not Codex Cloud** (no local `kimi` there)

## Install

From this repository root (marketplace at `.agents/plugins/marketplace.json`):

```bash
codex plugin marketplace add /absolute/path/to/kimi-plugin-codex
codex plugin add kimi@kimi-plugin-codex
```

Enable **kimi** in Codex and restart if needed. On first use, run setup / diagnostics via skill **`kimi-setup`**.

To pick up a newer release: refresh the marketplace and reinstall **kimi** (Codex refreshes when declared `version` changes).

If MCP tools do not appear after install, see the fallback registration in [AGENTS.md](AGENTS.md).

## How to use

In Codex, hand work to Kimi when you want the subagent, for example:

- Frontend / UI / visual bugs from screenshots  
- Multi-file implementation, or when the main agent is stuck  
- Long objectives with a clear finish line  

The main path is **one handoff** (`kimi_rescue`): give Kimi the task, wait, return the result **verbatim**.  
Do not invent a system prompt for Kimi, and do not solve the same task in parallel while it runs.

## Related

| Package | Host |
| --- | --- |
| [kimi-plugin-cc](https://github.com/oppnc/kimi-plugin-cc) | Claude Code / Grok |
| **kimi-plugin-codex** (this repo) | OpenAI Codex |

## License

MIT — see [LICENSE](./LICENSE).  
Kimi Code is a separate project with its own license.

---

**中文文档:** [README.zh-CN.md](README.zh-CN.md)
