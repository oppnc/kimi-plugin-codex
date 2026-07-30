---
name: goal
description: >
  Explicit goal handoff: Kimi Goal framing with --mode yolo. Large or frontend/UI goals MUST
  use $kimi:rescue (with --goal), not this skill alone. Small non-UI goals may call companion goal.
---

# Kimi Code Goal

Use when the user wants a **Goal**-framed Kimi Code run (clear finish line + verifiable evidence).

## Routing

| Work type | Do this |
| --- | --- |
| Large goals, or any frontend/UI/visual/multi-file UI | **`$kimi:rescue`** and pass goal intent (include `--goal` in the rescue task flags) |
| Small non-UI objectives | This skill → companion `goal` |

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" goal --mode yolo $ARGUMENTS
```

Supported arguments: objective after `--`, plus `--model`, `--thinking`,
`--image` / `--video` / `--media`, `--cwd`, `--resume` / `--session` / `--fresh`,
`--git` / `--base`, `--background`, `--timeout`, `--json`.

## Long-running

- Parent may use `--background` only if the user asked; then poll `$kimi:status` / `$kimi:result`.
- Prefer foreground for short goals.
- Write objectives with a finish line and evidence (tests, build, visible UI state).

## Output

- Present companion stdout **exactly as returned**.
- Do not reimplement the goal in Codex when Kimi is available.
