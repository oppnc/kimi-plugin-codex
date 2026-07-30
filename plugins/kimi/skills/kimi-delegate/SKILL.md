---
name: kimi-delegate
description: >
  Hand frontend/UI implementation, CSS/layout, screenshot or video visual bugs,
  multimodal debugging, multi-file coding, or long-horizon goals to local Kimi Code
  via kimi_rescue. Prefer this for frontend and visual tasks instead of implementing
  them in Codex when Kimi is available.
---

# Kimi Code subagent (Codex) — happy path

Treat **local Kimi Code** as a **subagent**, not as a remote ops API.

## When to call

Use proactively when:

- **Frontend / UI / CSS / layout / components**
- **Screenshot or video** visual bugs (pass image/video paths)
- Multi-file implementation, or the main thread is stuck
- Long-horizon objectives with a clear finish line

Do **not** use for trivial one-liners Codex can finish alone.

## Happy path (only path most users need)

One tool call:

```text
kimi_rescue({
  "prompt": "<user task, mostly verbatim>",
  "mode": "yolo"
})
```

With media:

```text
kimi_rescue({
  "prompt": "<describe the visual bug>",
  "mode": "yolo",
  "image": ["C:/path/to/shot.png"]
})
```

### After `kimi_rescue` returns

- `text` — **show the user verbatim** (Kimi’s answer). Do not rewrite as “your” work.
- `still_running` — if true, poll `kimi_status` / `kimi_result` with `jobId` (advanced).
- `resume_hint` — unfinished objective → `kimi_rescue` with `resume: true`.

While waiting, you may say Kimi is working. **Do not** solve the same task in parallel.

## First run

If handoff fails or this is the first use, call **`kimi_setup`** and show the report (includes Fix steps and next verify prompts).

## Optional routing fields

| Field | Use |
| --- | --- |
| `mode` | `yolo` (default implement), `plan` (plan-only) |
| `image` / `video` / `media` | Multimodal paths (workspace-relative or absolute) |
| `goal: true` | Kimi Goal framing |
| `resume: true` / `session` | Same subagent thread |
| `fresh: true` | New Kimi session |
| `model` / `thinking` | From `kimi_setup` if user asked |

## Advanced (only if needed)

| Tool | When |
| --- | --- |
| `kimi_task_start` + `kimi_status` + `kimi_result` | User asked to detach, or work outlives one MCP wait |
| `kimi_goal_start` | Explicit long goal + detach |
| `kimi_cancel` | User aborts |

Do **not** narrate job plumbing unless the user asks.

## Subagent rules

1. Forward-only — user intent + routing; no invented system prompts  
2. One handoff — prefer `kimi_rescue`  
3. Verbatim results  
4. No parallel steal  
5. Media first — real paths over prose pixels  
