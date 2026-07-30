---
name: status
description: >
  Explicit job inspection only: list or detail Kimi Code jobs. Args: [job-id], --wait, --all, --cwd, --json.
  Use when the user asks for job status/progress, not for starting frontend work (use rescue).
---

# Kimi Code Status

Use when the user wants the state of Kimi Code jobs started by this plugin.

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" status $ARGUMENTS
```

Supported arguments: `[job-id]`, `--wait`, `--all`, `--cwd <path>`, `--json`

## Output

- Present the companion stdout **exactly as returned**.
- Do not reformat, summarize, or invent job ids.
- Default listing is recent jobs for this workspace; `--all` widens the list when the companion supports it.
- With `--wait` and a job id, block until the companion returns a terminal state or its own wait budget ends.

