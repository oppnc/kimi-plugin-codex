---
name: task
description: >
  Explicit light one-shot on local Kimi Code. Args: companion task flags + prompt.
  For ANY frontend/UI/mock/style/screenshot/video or multi-file work, do NOT use this alone —
  MUST use $kimi:rescue. Use only when the user wants a small non-UI Kimi task.
---

# Kimi Code Task

Light one-shot handoff. **Not** the happy path for frontend/UI.

## Routing

| Work type | Do this |
| --- | --- |
| Frontend / UI / mock / style / screenshot / video / multi-file UI | **`$kimi:rescue`** (do not use this skill alone) |
| Small non-UI one-shot | This skill → companion `task` |

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" task --mode yolo $ARGUMENTS
```

If the user already passed `--mode`, do not add another.

Supported arguments: prompt after `--`, plus `--mode` (`default|plan|auto|yolo`), `--model`,
`--thinking`, `--image` / `--video` / `--media`, `--cwd`, `--resume` / `--session` / `--fresh`,
`--git` / `--base`, `--goal`, `--background`, `--timeout`, `--json`.

## Long-running

- Prefer foreground unless the user asked for background.
- If you start with `--background`, poll with `$kimi:status` / `$kimi:result` (parent owns wait).
- Do **not** pass `--background` / `--wait` into a child pipe as if they were Kimi flags for the child to invent.

## Output

- Present companion stdout **exactly as returned**.
- Keep media paths as flags; do not paste pixel prose.
- Do not reimplement the task in Codex when Kimi is available.
