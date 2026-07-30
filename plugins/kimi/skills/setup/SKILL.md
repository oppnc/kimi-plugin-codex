---
name: setup
description: >
  Explicit setup only: first-run doctor for local Kimi Code + ACP (binary, login, models, workspace).
  Use when the user asks for setup/doctor, or when rescue/handoff fails with missing Kimi/auth.
  Do not use for normal coding tasks. Args: --json.
---

# Kimi Code Setup

Use when the user wants to verify Kimi Code readiness for this Codex plugin.

Resolve `<plugin-root>` as **two directories above** this `SKILL.md` file. Always run:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" setup
```

Supported arguments: `--json` (for branching only)

## Workflow

1. Run the machine-readable probe:

   ```text
   node "<plugin-root>/scripts/kimi-companion.mjs" setup --json
   ```

2. If Kimi is missing, show install guidance from the report (`BINARY_NOT_FOUND`, `KIMI_CLI_PATH`, Windows path hints). Do not invent install steps beyond the companion output.
3. If login/ACP fails, tell the user to run `kimi login` in a normal terminal, then re-run setup.
4. After any branching, run the user-facing report **without** `--json` unless the user asked for JSON:

   ```text
   node "<plugin-root>/scripts/kimi-companion.mjs" setup
   ```

## Output

- Present the final companion stdout **exactly as returned**.
- Use JSON only for host-side branching (ok / errorCode / nextSteps).
- After setup is ok, first verify with `$kimi:rescue` on a tiny frontend probe, or CLI:

  ```text
  node "<plugin-root>/scripts/kimi-companion.mjs" task --mode yolo -- "Reply with exactly: kimi-bridge-ok"
  ```

