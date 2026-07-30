---
name: sessions
description: >
  Explicit session listing only: list on-disk Kimi ACP sessions via companion.
  Args: --cwd, --all, --json. Not for starting work (use $kimi:rescue).
---

# Kimi Code Sessions

Use when the user wants to list Kimi Code ACP sessions tracked by the companion.

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" sessions $ARGUMENTS
```

Supported arguments: `--cwd <path>`, `--all`, `--json`

## Output

- Present the companion stdout **exactly as returned**.
- Do not invent session ids.
- **Not** the happy path for normal frontend/UI work — use `$kimi:rescue` instead.
