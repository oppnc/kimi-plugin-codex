---
name: plan
description: >
  Explicit plan-only handoff: Kimi in plan mode (no writes / no ExitPlanMode execution).
  Not for normal frontend implementation (use $kimi:rescue). Use when the user wants a plan-only pass.
---

# Kimi Code Plan

Use only when the user explicitly wants a **plan-only** Kimi Code pass (no implementation).

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" task --mode plan $ARGUMENTS
```

Default mode is **plan** (do not override to yolo unless the user clearly asked to implement).

Supported arguments: task text after `--`, plus companion flags such as `--model`, `--thinking`,
`--image` / `--video` / `--media`, `--cwd`, `--resume` / `--session` / `--fresh`,
`--git` / `--base`, `--timeout`, `--json`.

## Notes

- **Not** the happy path for normal frontend/UI work — use `$kimi:rescue` instead (implementation goes through rescue; plan-only stays here).
- Present companion stdout **exactly as returned**.
- Do not reimplement the plan yourself in Codex when Kimi returned one.
- Long plan runs: if you use `--background` (only when the user asked), poll `$kimi:status` / `$kimi:result`.
