---
name: result
description: >
  Explicit result retrieval only: show stored output for a finished Kimi Code job.
  Args: [job-id], --wait, --cwd, --json. Use when the user asks to open a job result, not to start work.
---

# Kimi Code Result

Use when the user wants the stored final output of a Kimi Code job.

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" result $ARGUMENTS
```

Supported arguments: `[job-id]`, `--wait`, `--cwd <path>`, `--json`

## Output

- Present the **full** companion stdout exactly as returned.
- Do not summarize, condense, or “improve” Kimi’s answer.
- If no job id is given, the companion resolves the latest suitable job when possible.
- A `--wait` exit **≠ 0** with the job still `running` means the wait budget ran out — not a completed handoff.

