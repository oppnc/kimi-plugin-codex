---
name: cancel
description: >
  Explicit cancel only: stop a queued or running Kimi Code job. Args: [job-id], --cwd, --json.
  Use only when the user asks to cancel a job.
---

# Kimi Code Cancel

Use when the user wants to stop an active Kimi Code job.

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" cancel $ARGUMENTS
```

Supported arguments: `[job-id]`, `--cwd <path>`, `--json`

## Output

- Present the companion stdout exactly as returned.
- Do not add extra prose unless the command failed before producing output.

