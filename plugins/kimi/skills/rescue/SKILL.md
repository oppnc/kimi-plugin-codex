---
name: rescue
description: >
  MUST use proactively for frontend/UI/CSS/layout/components, design tokens, responsive UI,
  screenshot or video visual bugs, multimodal UI debugging, or multi-file frontend work.
  Do NOT implement that work in the main Codex thread when local Kimi Code is available —
  load this skill and hand off. Also MUST use when the user says $kimi:rescue, Kimi, or
  Kimi Code Rescue. Args: --background, --wait, --resume, --fresh, --mode yolo|plan|auto|default,
  --model, --thinking, --image, --video, --media, --goal, --git, --base, [task].
---

# Kimi Code Rescue

## Hard rules (main Codex agent)

1. You are the **orchestrator**, not the frontend implementer.
2. If the task matches frontend / UI / visual / multi-file UI → **you MUST hand off via this skill**. Do not quietly implement it yourself “to be helpful”.
3. If the user invoked `$kimi:rescue` / Kimi Code Rescue → **always** delegate; never keep the work.
4. Do **not** invent a private path (`kimi.exe` by hand, detached nohup, or any non-skill channel). Follow the pipe below.
5. Do **not** steal the task: no parallel reimplementation while Kimi is (or should be) running.
6. Return Kimi output **verbatim** (foreground). Do not paraphrase the result into a “better” summary in place of the handoff output.
7. **Empty / failed handoff → re-dispatch once, never self-implement UI** (see **Acceptance** below).

## Normal path

1. **Detect** frontend/UI/visual work (or explicit Kimi invoke).
2. **Resolve `<plugin-root>` once** (see **Plugin root — do not guess**).
3. **Route**: foreground vs background, resume vs fresh, flags.
4. **Optionally tighten** task text conservatively (below).
5. **Spawn exactly one** Codex built-in default subagent that only runs companion `task`.
6. **Foreground:** wait and return companion stdout **verbatim**.  
   **Background:** do not wait forever; tell the user `$kimi:status` / `$kimi:result`.
7. **Accept or re-dispatch** using the table in **Acceptance** (do not skip this step).

## When to hand off (must)

- Frontend / UI / CSS / layout / components / design tokens / responsive polish
- Screenshot or video visual bugs (keep real media paths)
- Multi-file UI implementation, or main thread stuck on frontend
- User asks for Kimi / `$kimi:rescue`

## When not to

- Trivial one-liners Codex can finish alone
- Pure non-UI backend with no visual surface
- User explicitly forbids Kimi / external agents

## Plugin root — do not guess

Codex does **not** inject `CLAUDE_PLUGIN_ROOT`. You must resolve the installed plugin root from **this skill file’s real absolute path**.

### Algorithm (mandatory)

1. Obtain the **absolute path** of **this** skill file after you load it  
   (example shape ends with `...\skills\rescue\SKILL.md` or `.../skills/rescue/SKILL.md`).
2. `<plugin-root>` = **parent of `skills`** = **two directories above** that `SKILL.md`
   (`skills/rescue/SKILL.md` → plugin root). Same as: go up from `SKILL.md` → `rescue/` → `skills/` → **stop** (plugin root).
3. Companion path is **always**:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" task ...
```

On Windows PowerShell, prefer:

```text
node "<plugin-root>\scripts\kimi-companion.mjs" task ...
```

Installed layout always includes a version segment:

```text
…/kimi/<version>/scripts/kimi-companion.mjs
```

### Worked examples (copy the shape, not the version number)

| This SKILL.md absolute path | `<plugin-root>` | Companion |
| --- | --- | --- |
| `C:\Users\…\.codex\plugins\cache\kimi-plugin-codex\kimi\0.2.0\skills\rescue\SKILL.md` | `C:\Users\…\.codex\plugins\cache\kimi-plugin-codex\kimi\0.2.0` | `…\kimi\0.2.0\scripts\kimi-companion.mjs` (= `…/kimi/<version>/scripts/kimi-companion.mjs`) |
| `…/plugins/kimi/skills/rescue/SKILL.md` (dev checkout) | `…/plugins/kimi` | `…/plugins/kimi/scripts/kimi-companion.mjs` |

### Forbidden paths (never invent these)

| Wrong | Why |
| --- | --- |
| `…\plugins\cache\kimi-plugin-codex\scripts\kimi-companion.mjs` | Missing `kimi\<version>\` — **marketplace cache root ≠ plugin root** |
| `…\plugins\cache\kimi-plugin-codex\skills\…` | Skills live under `kimi\<version>\skills\`, not marketplace root |
| Any path under the **user workspace** (e.g. `Desktop\LIMS\…\kimi-companion.mjs`) | Companion is **not** in the project repo |
| Guessing a version folder without reading this skill’s real path | Version changes every release |

### Sanity check before spawn

If you constructed `<plugin-root>` correctly, **all** of these exist:

- `<plugin-root>/scripts/kimi-companion.mjs`
- `<plugin-root>/skills/rescue/SKILL.md`
- `<plugin-root>/skills/kimi-cli-runtime/SKILL.md`

If the first path is missing, **re-read this skill’s absolute path and recompute** — do not invent another prefix.

Raw skill arguments: `$ARGUMENTS`

## Main-thread routing (parent owns this)

| Control | Who | Notes |
| --- | --- | --- |
| `--background` / `--wait` | Parent only | **Never** pass to companion |
| `--resume` / `--fresh` / `--session` | Parent → companion | Session continuity |
| `--mode` / `--model` / `--thinking` | Parent → companion | Default mode **yolo** |
| `--image` / `--video` / `--media` | Parent → companion | Prefer real paths |
| `--goal` / `--git` / `--base` / `--cwd` | Parent → companion | Optional |
| Task text | Parent resolves, then **byte-for-byte** into companion | See shaping |

- No task and no media → ask what Kimi should do.
- `--background` -> spawn **without waiting**; **parent** must then poll `$kimi:status` / `$kimi:result` (the spawned subagent returns immediately and cannot poll itself).
- `--wait` -> wait for subagent (still requires child `timeout_ms: 86400000` on its shell).
- **Default routing for ALL UI** (open-ended “整体换风格”, multi-file redesign, “modernize the demo”, **and** small/bounded fixes):  
  **foreground pipe** = companion `task` **without `--background`**, child shell `timeout_ms: 86400000`.  
  The subagent blocks until Kimi finishes and returns real agent text. This is the reliable path (aligns with `openai/codex-plugin-cc` PR #214: inner task call **must always run in foreground**).
- `--background` is **not** the default. Use it **only** when the user **explicitly** asks to detach. Then the **parent** (not the subagent) owns polling `$kimi:status` / `$kimi:result` until the job `status: completed`.
- Default mode **yolo** unless user asked for plan-only.
- Prefer media flags over describing pixels in prose.
- Do **not** inspect the repo to *do the UI yourself* in the same handoff turn.

## Parent-side task shaping (conservative)

Parent may **tighten** task text before the companion command. The child must **not** re-interpret.

**Allowed:** preserve intent; **no new repo facts**; strip routing flags; short delta for “fix it / continue”; keep concrete requests literal; keep language mix.

**Forbidden:** long host manuals (“不要向用户提问 / 请验证并报告 / 最终返回改动文件列表…” unless the user said so); multi-paragraph host system prompts; inventing product names, stacks, or file lists; replacing user intent with your design brief.

Resolved text → companion as-is via `-- "…"`.

## Subagent launch (built-in default = pipe only)

- `spawn_agent`, **omit `agent_type`** (Desktop may expose this as `multi_agent_v1__spawn_agent` — same rules)
- Prefer `fork_context: false`
- Omit `model` on spawn; prefer `reasoning_effort: "medium"`
- Never `nohup` / `&` companion from the **parent**
- Child contract: `../kimi-cli-runtime/SKILL.md`
- Put the **fully resolved absolute** companion command in the child message. Child must **not** re-resolve roots or re-read skills.
- Child runs **exactly one** blocking shell command:

  ```text
  node "<plugin-root>/scripts/kimi-companion.mjs" task --mode yolo [flags] -- <resolved task>
  ```

### Child message template (REQUIRED shape — paste and fill)

Session evidence (Codex Desktop): omitting shell `timeout_ms` → **`command timed out after ~14000 milliseconds`**, empty stdout, Kimi never finishes. **Prose about “24h timeout” does not set the tool field.**

```text
Run EXACTLY one host shell tool call. Return stdout verbatim.
Do not read the repo. Do not re-resolve paths. Do not run a second command if the first fails.

MANDATORY shell tool args (Codex Desktop):
- timeout_ms: 86400000   ← REQUIRED numeric field; never omit; never use ~14s default
- workdir: the user workspace absolute path
- command: the single node companion line below

Do NOT pass companion --timeout (ACP has no default deadline).
Do NOT only write "use a long timeout" in English/Chinese without setting timeout_ms.

command:
node "<ABSOLUTE-plugin-root>/scripts/kimi-companion.mjs" task --mode yolo --cwd "<workspace>" -- "<resolved task text>"
```

**Required** Codex Desktop `shell_command` / exec shape (child must use this form):

```js
await tools.shell_command({
  command: 'node "<ABSOLUTE-plugin-root>\\\\scripts\\\\kimi-companion.mjs" task --mode yolo --cwd "<workspace>" -- "<task>"',
  workdir: "<workspace>",
  timeout_ms: 86400000, // REQUIRED — host default ~14s kills Kimi mid-start
});
```

### Explicit `--background` (user-detach only; parent owns polling)

Only when the user **explicitly** asks to detach, parent enqueues:

```text
node "<plugin-root>/scripts/kimi-companion.mjs" task --background --mode yolo --cwd "<workspace>" -- "<task>"
```

The subagent returns immediately (companion prints a job id and exits). The **parent** then polls `$kimi:status` / `$kimi:result` (or companion `status` / `result`) until `status: completed`. Do **not** rely on the subagent return value or on inspecting files - the subagent cannot see the background job finish. Never pass `--background` into a nested re-spawn: **only the parent** adds it.

- Shell-hostile / multi-line / quote-heavy text → parent may write a temp file outside the repo and pass a short task after `--` that points at that file **in the task text** (companion has **no** `--prompt-file` flag)
- Child must not read the repo, reimplement UI, or invent Kimi system prompts
- Auth failures → return companion output; user runs `$kimi:setup`
- **`timed out after N milliseconds` with N under 60000** (or Exit **124**) + empty stdout -> **host shell kill**, not Mode A.  
  Re-dispatch once with child message that includes **`timeout_ms: 86400000`**. Do not implement UI yourself.

## Acceptance (parent after pipe returns)

Companion applies Mode A (empty retry + recovery nudge) and Mode B (incomplete continue) internally. Parent still **classifies** the outcome:

| Signal | Meaning | Parent action |
| --- | --- | --- |
| Exit **0** + real agent text (or JSON `"ok": true`) | Success | Surface stdout **verbatim** |
| Exit **≠ 0** | Failed handoff | Show output; **re-dispatch once** (below) |
| `(no agent text)` / JSON `emptyAgentText: true` / `ok: false` | Mode A empty ACP (after companion retries) | **Not** a clarifying question → **re-dispatch once** |
| `emptyRetried` / `emptyRecoveryNudged` true but still empty | Companion already tried | Still one parent-level `--fresh` re-dispatch allowed |
| `incompleteContinued` and work still unfinished on disk | Mode B nudged but objective may remain | Prefer **one** `--resume` with same session + short “finish Write/Edit” delta |
| Exit **124** / `timed out after ~14s` / empty stdout after few seconds | **Host shell kill** (Codex default), not Mode A | Re-dispatch with **`timeout_ms: 86400000`** in child shell tool field (foreground). Do **not** switch to `--background` as a workaround - it makes the subagent return empty. |

### Timeout keeps the session

`--timeout <ms>` is a **soft** ACP deadline. On timeout the companion sends `session/cancel`
and keeps the session alive — the job records `sessionId`, and `status`/`result` show a
resume hint. Continue the same thread with `--resume` / `--session <id>`, do **not** treat
a timeout as a lost handoff.

### Re-dispatch rules (max one automatic retry)

1. **Host timeout (~14s):** re-spawn child with mandatory `timeout_ms: 86400000` **tool field** (not prose only). Same task text is OK. Do **not** use `--background` here - the subagent returns immediately and the parent cannot retrieve the result via the subagent.
2. Prefer companion flags: **`--fresh`** for Mode A empty failures; **`--resume` / `--session <id>`** when a session exists and work was partial.
3. Tighten task text slightly: require **Write/Edit on disk** and a short file list if the user already named paths — still **no** multi-paragraph host system prompts.
4. Optional: add **`--json`** so `ok` / empty flags / `sessionId` are explicit.
5. After a **second** empty/fail (not counting pure host-timeout re-dispatches that then succeed), **stop**: report failure, suggest `$kimi:setup` / model check. **Still do not** implement the UI yourself unless the user explicitly asks Codex to take over after Kimi failed.
6. Background jobs: poll `$kimi:status` / `$kimi:result`; treat job `status: failed` + `emptyAgentText` the same as exit ≠ 0.

## What Kimi receives

- Resolved task (+ optional git/media/goal routing) only
- Kimi keeps tools / models / skills / system
- No default “Host handoff” bullets (`KIMI_BRIDGE_HANDOFF=1` to opt in)

## Only trigger path

**Skills only** (aligned with cc-plugin-codex): detect frontend → this skill → built-in pipe → companion.  
There is **no** MCP tool surface in this plugin.
