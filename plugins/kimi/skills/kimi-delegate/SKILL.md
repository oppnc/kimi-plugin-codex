---
name: kimi-delegate
description: >
  Hand substantial implementation, frontend/UI, multimodal visual debugging,
  multi-file coding, or long-horizon goals to local Kimi Code as a subagent
  (kimi_rescue). Use when the main Codex thread should not own that work.
---

# Kimi Code subagent (Codex)

Treat **local Kimi Code** as a **subagent**, not as a remote ops API.

- Thin handoff only: forward the user task over ACP.
- **Do not** reimplement Kimi system prompts, tools, swarm, or skills.
- Kimi keeps its own environment (models, tools, multimodal, goals).

## When to call the subagent

Use proactively when:

- Frontend / UI / visual bugs (pass screenshot or recording paths)
- Multi-file implementation, or the main thread is stuck
- Long-horizon objectives with a clear finish line

Do **not** use for trivial one-liners Codex can finish alone.

## One handoff (primary)

Prefer a **single** tool call:

```text
kimi_rescue({
  "prompt": "<user task, mostly verbatim>",
  "mode": "yolo"
})
```

Optional fields (routing only — not a second system prompt):

| Field | Use |
| --- | --- |
| `mode` | `yolo` (default implement), `plan` (plan-only), `auto` / `default` |
| `image` / `video` / `media` | Multimodal paths |
| `goal: true` or use objective-style wording | Kimi Goal framing |
| `resume: true` / `session` | Same subagent thread |
| `fresh: true` | New Kimi session |
| `model` / `thinking` | From `kimi_setup` catalog if user asked |
| `git: true` | Raw git facts only |

### After `kimi_rescue` returns

JSON includes:

- `text` — **show the user verbatim** (Kimi’s answer). Do not rewrite as “your” work.
- `status` / `phase` / `sessionId`
- `still_running` — if true, the subagent is still working past the wait budget:
  - poll `kimi_status` / `kimi_result` with `jobId`, **or**
  - call `kimi_rescue` again only if appropriate; otherwise keep polling
- `resume_hint` — if the objective looks unfinished after `completed`, call `kimi_rescue` with `resume: true`

While waiting, you may tell the user briefly that Kimi is working. **Do not** solve the same task yourself in parallel unless the user asks.

## Fallback paths (implementation detail)

Only when needed:

| Tool | When |
| --- | --- |
| `kimi_setup` | First use / diagnostics |
| `kimi_task_start` + `kimi_status` + `kimi_result` | User asked to detach, or work must outlive one MCP wait |
| `kimi_goal_start` | Explicit long goal + detach |
| `kimi_task` | Tiny sync probe only |
| `kimi_cancel` | User aborts |

Do **not** narrate job plumbing to the user unless they ask for status details.

## Subagent rules

1. **Forward-only** — user intent + routing flags; no invented review rubrics or system prompts  
2. **One handoff** — prefer `kimi_rescue`; hide start/poll unless fallback is required  
3. **Verbatim results** — return Kimi `text` as-is  
4. **No parallel steal** — don’t implement the same task while Kimi runs  
5. **Same thread** — follow-ups use `resume: true` / `session` unless user wants a fresh start  
6. **Media first** — prefer real paths over describing pixels in prose  

## Modes (bridge permission mapping)

| mode | Meaning |
| --- | --- |
| `yolo` | Default implement/rescue |
| `plan` | Plan-only; mutating tools rejected on the bridge |
| `auto` / `default` | See setup / companion notes |
