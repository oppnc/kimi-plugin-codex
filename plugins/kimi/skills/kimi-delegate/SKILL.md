---
name: kimi-delegate
description: >
  Hand frontend/UI implementation, CSS/layout, screenshot or video visual bugs,
  multimodal debugging, multi-file coding, or long-horizon goals to local Kimi Code
  via kimi_rescue (+ poll while still_running). Prefer this for frontend and visual
  tasks instead of implementing them in Codex when Kimi is available. Long UI work
  is normal — keep polling; never treat a wait-slice end as failure.
---

# Kimi Code subagent (Codex) — long-running happy path

Treat **local Kimi Code** as a **durable subagent**, not a one-shot remote call.

Frontend + screenshots + multi-file UI often take **many minutes**. The plugin starts a
**background job**; each MCP tool only waits a **slice**. Ending a slice is **not** failure.

## When to call

Use proactively when:

- **Frontend / UI / CSS / layout / components**
- **Screenshot or video** visual bugs (pass image/video paths)
- Multi-file implementation, or the main thread is stuck
- Long-horizon objectives with a clear finish line

Do **not** use for trivial one-liners Codex can finish alone.

## Happy path (frontend / long work)

### 1) Start + first wait slice

```text
kimi_rescue({
  "prompt": "<user task, mostly verbatim>",
  "mode": "yolo"
})
```

With media (screenshot/video iteration):

```text
kimi_rescue({
  "prompt": "<describe the visual bug / desired UI>",
  "mode": "yolo",
  "image": ["C:/path/to/shot.png"]
})
```

Optional: smaller first slice `wait_timeout_ms: 60000`, or pure async `wait_timeout_ms: 1`.

### 2) Read the JSON result

| Field | Meaning |
| --- | --- |
| `text` | Kimi’s answer when finished — **show the user verbatim** |
| `still_running` | **true** → keep polling; do **not** reimplement |
| `jobId` | Pass to `kimi_status` / `kimi_result` / `kimi_cancel` |
| `next_actions` | Suggested follow-up tool calls |
| `sessionId` | For `resume: true` on later visual rounds |
| `resume_hint` | Human/agent guidance |

### 3) While `still_running` (required for long work)

```text
kimi_status({ "job_id": "<jobId>", "wait": true, "wait_timeout_ms": 180000 })
```

or

```text
kimi_result({ "job_id": "<jobId>", "wait": true })
```

Repeat until `status` is `completed` / `failed` / `cancelled`.

**Rules while Kimi runs:**

- Do **not** solve the same task yourself
- Do **not** start a second overlapping rescue for the same work unless the user aborts
- You may briefly tell the user Kimi is still working

### 4) Visual follow-up rounds (screenshot → fix → screenshot)

After a completed job (or while refining):

```text
kimi_rescue({
  "prompt": "Fix layout per this screenshot; keep existing design tokens.",
  "mode": "yolo",
  "resume": true,
  "image": ["C:/path/to/new-shot.png"]
})
```

Then poll again if `still_running`.

## First run

If handoff fails or this is the first use, call **`kimi_setup`** and show the report.

## Routing fields

| Field | Use |
| --- | --- |
| `mode` | `yolo` (default implement), `plan` (plan-only) |
| `image` / `video` / `media` | Multimodal paths |
| `goal: true` | Kimi Goal framing |
| `resume: true` / `session` | Same subagent thread |
| `fresh: true` | New Kimi session |
| `wait_timeout_ms` | First wait slice only (default 120s); not a kill switch |
| `model` / `thinking` | From `kimi_setup` if user asked |

## Other tools

| Tool | When |
| --- | --- |
| `kimi_task_start` / `kimi_goal_start` | Immediate job id, zero wait |
| `kimi_status` / `kimi_result` | **Default continuation** for long jobs |
| `kimi_cancel` | User aborts |
| `kimi_task` | Tiny sync probe only |

## Subagent rules

1. Forward-only — user intent + routing; no invented system prompts  
2. Job + poll — long frontend is normal; wait-slice end ≠ failure  
3. Verbatim results — show Kimi `text` as-is  
4. No parallel steal  
5. Media first — real paths over prose pixels  
6. Resume + image for multi-round UI polish  
