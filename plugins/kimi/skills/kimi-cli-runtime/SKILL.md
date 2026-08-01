---
name: kimi-cli-runtime
description: >
  Internal contract for the Codex built-in rescue forwarder. Runs one kimi-companion
  task command for frontend/UI handoff to local Kimi Code. Not for direct user invocation.
---

# Kimi Runtime (Codex built-in forwarder)

Use **only** inside the rescue forwarding worker from `$kimi:rescue` / `skills/rescue/SKILL.md`.

## Paths (dead rules)

- The parent **must** put a **fully resolved absolute** path to `kimi-companion.mjs` in the single command.
- **Reuse that path.** Do **not** re-derive plugin root from this skill file, from the workspace, or by guessing `…\cache\kimi-plugin-codex\scripts\…`.
- Correct companion path always ends with:

```text
…/kimi/<version>/scripts/kimi-companion.mjs
```

or (dev checkout):

```text
…/plugins/kimi/scripts/kimi-companion.mjs
```

- **Forbidden:** `…/cache/kimi-plugin-codex/scripts/kimi-companion.mjs` (missing `kimi/<version>/`).

## Primary helper

```text
node "<absolute-plugin-root>/scripts/kimi-companion.mjs" task ...
```

## You are a pipe, not a coder

- Launch **exactly one** `task` command; wait until it exits.
- Return **stdout verbatim** (foreground path). Ignore stderr progress lines.
- Do **not** inspect the repo, fix UI yourself, or reinterpret parent routing.
- Do **not** call `setup`, `status`, `result`, `cancel`, or `sessions` unless the parent’s single command is literally that (normal rescue is always `task`).
- Do **not** invent system prompts for Kimi.
- Do **not** re-read rescue/runtime skills unless the parent message is missing the absolute companion path (then ask parent / return an error — still no repo UI work).
- If that command fails (`MODULE_NOT_FOUND`, etc.), **return the error as-is** — do not invent a second path or inspect the repo “to help”.

## MANDATORY host shell timeout (Codex Desktop kill ≈ 14s)

**This is the #1 failure mode.** Codex Desktop / `shell_command` / `exec` defaults often kill the process around **10–15 seconds** (`command timed out after 14054 milliseconds`). That is **not** Kimi empty completion (Mode A). Kimi never got a chance to answer.

### Hard rules for the single shell call

1. **You MUST set** `timeout_ms: 86400000` (24h) on the host shell tool (`shell_command` / `exec` / Bash equivalent).  
   - On hosts where `timeout_ms: 0` / omitted means **unlimited**, that is also OK.  
   - **Forbidden:** omitting `timeout_ms` on Codex Desktop; **forbidden:** values under **600000** (10 min) for rescue UI work.
2. **Prose is not enough.** Writing “use a 24h timeout” in text **without** setting the tool argument is a **contract violation** — the default 14s kill will still fire.
3. Do **not** pass companion `--timeout` unless the user asked (companion ACP default = no deadline).
4. If you see `timed out after N milliseconds` with **N under 60000** and empty/partial stdout → report the **host timeout** string **as-is**; do **not** implement UI; parent will re-dispatch with `timeout_ms: 86400000` or `--background`.

### Required call shape (copy; only fill absolute paths / task)

```js
await tools.shell_command({
  command: 'node "C:\\\\Users\\\\…\\\\kimi\\\\0.2.1\\\\scripts\\\\kimi-companion.mjs" task --mode yolo --cwd "C:\\\\…\\\\workspace" -- "<task>"',
  workdir: "C:\\\\…\\\\workspace",
  timeout_ms: 86400000, // REQUIRED — never omit on Codex Desktop
});
```

## Acceptance signals (after the single command exits)

Mode A/B policy runs **inside** companion. You only surface outcomes:

| Signal | Meaning | Pipe behavior |
| --- | --- | --- |
| Exit **0** + useful text (or JSON `"ok": true`) | Success | Return stdout **verbatim** |
| Exit **≠ 0** | Failed handoff (includes empty ACP after retries) | Return stdout/stderr **as-is**; parent re-dispatches |
| `(no agent text)` / `"emptyAgentText": true` / `"ok": false` | Mode A empty completion | Same as exit ≠ 0 — **not** a clarifying question |
| Exit **124** / host timeout | Host killed shell mid-run | Report timeout; parent raises shell timeout or uses background — **not** the same as empty ACP |

Parent owns re-dispatch (prefer one `--fresh` retry). This child never implements UI and never invents a second companion command unless the parent’s message already is that single command.

## Flags the parent already resolved

- `--background` / `--wait` must **already be stripped** — never pass them to companion.
- Companion `task` runs in the **foreground of this child** until exit (default).
- Forward when present: `--mode`, `--model`, `--thinking`, `--image`, `--video`, `--media`, `--goal`, `--resume`, `--session`, `--fresh`, `--cwd`, `--git`, `--base`, `--json`.
- Default `--mode yolo` if parent did not set mode.
- There is **no** companion `--prompt-file` flag — always pass task text after `--`.

## Task text

- Use the **resolved** task text the parent prepared (after conservative shaping).
- Copy it **byte-for-byte** into `-- "…"`.
- Multi-line / quotes / XML: parent should already resolve text; pass that string after `--` (do not invent flags).

## Background child message

If the parent is not waiting: final assistant message may point at `$kimi:status` / `$kimi:result` instead of dumping a huge raw result into a notification — full stdout still comes from the shell tool result for the host log.
