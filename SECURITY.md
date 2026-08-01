# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| 0.1.x | Security fixes only |

## What this plugin does (trust boundary)

**kimi-plugin-codex** is a thin bridge that starts local **[Kimi Code](https://github.com/MoonshotAI/kimi-code)** over ACP and forwards your tasks from OpenAI Codex.

- It does **not** reimplement Kimi system prompts or tools.
- In non-interactive modes (`yolo` / `auto` / default bridge policy), the companion **answers Kimi permission prompts on your behalf**, including auto-approving tools.
- Kimi then runs **with the same privileges as the `kimi` process** on your machine and can **read and modify files in the workspace** (and whatever else Kimi’s own tools allow).

Installing and using this plugin means you trust:

1. This repository (and the release you installed),
2. Your local Kimi Code installation and login, and
3. The tasks you send through the bridge.

Do **not** point this bridge at untrusted workspaces, or run untrusted prompts under `yolo`, unless you accept full agent access to that environment.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems that could be exploited.

1. Prefer [GitHub Security Advisories](https://github.com/oppnc/kimi-plugin-codex/security/advisories/new) for this repository, or
2. Open a **private** contact via the maintainer profile: [github.com/oppnc](https://github.com/oppnc)

Include:

- Affected version / commit
- Reproduction steps
- Impact (e.g. unexpected file access, command execution outside intent)
- Whether a public fix is already known

We will acknowledge credible reports as soon as practical and coordinate disclosure.
