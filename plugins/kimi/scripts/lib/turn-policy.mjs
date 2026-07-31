/**
 * Turn acceptance policy for headless Kimi ACP.
 *
 * Mode A — empty completion: end_turn with zero agent text and zero tools.
 * Mode B — premature stop: action/disk work ends after plan text or read-only tools.
 *
 * Peer lessons (applied where Kimi allows):
 * - claude-agent-acp: detect empty delivery; surface a clear empty note; no zero-chunk crash;
 *   result-body reassembly is Claude-SDK-specific (Kimi has no recoverable result body).
 * - Copilot autopilot / OpenDev / pi todo-enforcer / Claude stop hooks: force continue only
 *   when work is unfinished — not on every short text reply; bound re-entry (max nudges + stagnation).
 * - Live headless probes: pure empty is Mode A (do not reclassify as B); "Reply with exactly…"
 *   must not trigger implement-style Mode B.
 */

/** Default fresh-session retries for Mode A (empty end_turn). */
export const MAX_EMPTY_RETRIES = 5;

/**
 * Resolve the Mode A empty-turn retry budget from env (KIMI_EMPTY_RETRIES).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function emptyRetryBudget(env = process.env) {
  const raw = String(env.KIMI_EMPTY_RETRIES ?? "").trim();
  if (raw === "") {
    return MAX_EMPTY_RETRIES;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : MAX_EMPTY_RETRIES;
}

/**
 * Resolve the retry budget with explicit-option precedence:
 * explicit value > env (KIMI_EMPTY_RETRIES) > default (MAX_EMPTY_RETRIES).
 * @param {number|string|null|undefined} value
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveEmptyRetries(value, env = process.env) {
  if (value != null && value !== "") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) {
      return Math.floor(n);
    }
  }
  return emptyRetryBudget(env);
}

/** Max same-session continue nudges for Mode B. */
export const MAX_CONTINUE_NUDGES = 2;

/**
 * Tool titles that clearly mutate the workspace (or durable agent state).
 * Keep aligned with permissions.mjs MUTATING_TOOL_RE intent.
 */
export const MUTATING_TOOL_RE =
  /^(Write|Edit|MultiEdit|NotebookEdit|Delete|ApplyPatch|StrReplace|AgentSwarm|CronCreate|CronDelete|CreateGoal|UpdateGoal|SetGoalBudget)$/i;

/**
 * Shell / run tools — treat as potentially mutating (counts as "did work").
 * Known FN: explore-via-shell with no disk writes will not Mode-B continue.
 */
export const EXECUTE_TOOL_RE =
  /^(Bash|Shell|Run|Execute|Terminal|Cmd|PowerShell)$/i;

/** Read / search / inspect tools. */
export const READ_TOOL_RE =
  /^(Read|ReadFile|ReadMediaFile|Glob|Grep|Search|LS|List|Find|WebSearch|WebFetch|SemanticSearch|BashOutput|NotebookRead|TaskGet|GetTask|ListGoals|GetGoal)$/i;

/** English verbs that imply workspace / code changes (not bare "ui/css/feature"). */
const DISK_ACTION_RE =
  /\b(implement|fix|build|create|add|change|update|refactor|redesign|migrate|wire|ship|write|edit|modify|replace|remove|delete|patch|make|convert|port|upgrade|install|configure|generate|scaffold|rewrite|restyle|polish)\b/i;

/** Chinese action cues (no word boundaries). */
const CJK_DISK_ACTION_RE =
  /实现|修复|修改|重写|重构|添加|创建|删除|改写|写入|落地|改一下|修一下|做成|加上|去掉|替换|完善|调整样式|换.*风格|改.*css|改.*html|改.*js/i;

/** Explicit disk / file mandates. */
const DISK_MANDATE_RE =
  /\b(on disk|edit files?|change files?|write files?|modify files?|use write\/?edit|save (to|the) file|touch the (code|file|repo))\b/i;

/**
 * Q&A / how-to lead-ins. Checked *before* action verbs so
 * "How do I implement dark mode?" does not Mode-B force implement.
 */
const QA_LEAD_RE =
  /^\s*(what|why|how does|how do|how is|how are|how can|how should|how would|how to|explain|describe|summarize|summarise|list the|who|when|where|which|is there|are there|can you tell|tell me about|does|do you|could you explain)\b/i;

/**
 * Pure reply / echo probes — never Mode B (bridge-ok / circuit-ok style).
 */
const REPLY_ONLY_RE =
  /^\s*(reply|respond|answer|say|output|print|return)\b[\s\S]{0,80}\b(exactly|only)\b/i;

const REPLY_EXACTLY_RE = /reply with exactly|respond with exactly|answer with exactly|exactly:\s*\S+/i;

/** Agent text that looks like plan-then-stop, not a finished handoff. */
const PLANNING_TEXT_RE =
  /\b(i('ll| will)|i am going to|let me (first|start|begin)|first i('ll| will)?|going to (read|look|plan|start)|here('s| is) (my )?plan|my plan is|i plan to)\b/i;

const PLANNING_TEXT_CJK_RE = /^(先|我会|接下来先|计划[:：]|我先|先看|先读|先分析)/;

/** Soft "already done" claims — suppress text-only Mode B (tradeoff: may trust a lie). */
const COMPLETION_CLAIM_RE =
  /\b(done|completed|finished|fixed|implemented|changed|updated|wrote|edited|created|patched|shipped)\b/i;

const COMPLETION_CLAIM_CJK_RE = /已(完成|改好|写好|修好|添加|更新|修改)|修改完成|改完了/;

/**
 * @param {object|null|undefined} result
 * @returns {boolean}
 */
export function isEmptyTurn(result) {
  return (
    !String(result?.text || "").trim() &&
    (!result?.toolCalls || result.toolCalls.length === 0) &&
    (result?.stopReason === "end_turn" || result?.stopReason == null)
  );
}

/**
 * @param {string|null|undefined} title
 * @returns {'mutate'|'execute'|'read'|'unknown'}
 */
export function classifyToolTitle(title) {
  const t = String(title || "").trim();
  if (!t) {
    return "unknown";
  }
  if (MUTATING_TOOL_RE.test(t) || /write|edit|delete|overwrite|patch|apply.?patch/i.test(t)) {
    return "mutate";
  }
  if (EXECUTE_TOOL_RE.test(t)) {
    return "execute";
  }
  if (READ_TOOL_RE.test(t) || /read|list|glob|grep|search|fetch|inspect|stat/i.test(t)) {
    return "read";
  }
  return "unknown";
}

/**
 * @param {Array<{ title?: string }>|null|undefined} toolCalls
 * @returns {boolean}
 */
export function hasMutatingOrExecuteWork(toolCalls) {
  for (const tc of toolCalls || []) {
    const kind = classifyToolTitle(tc?.title);
    if (kind === "mutate" || kind === "execute") {
      return true;
    }
  }
  return false;
}

/**
 * Pure echo / bridge probes (not implementation handoffs).
 * @param {string} p
 */
export function isReplyOnlyPrompt(p) {
  const s = String(p || "").trim();
  if (!s) {
    return false;
  }
  return REPLY_ONLY_RE.test(s) || REPLY_EXACTLY_RE.test(s);
}

/**
 * Goal-wrapped task text (buildUserPrompt) prefixes framing before
 * "Objective: <task>". Classify against the actual objective when present so
 * goal-framed Q&A / reply-exactly probes still skip Mode B.
 * @param {string} p
 */
function objectiveSubject(p) {
  const m = /Objective:\s*([\s\S]+)$/i.exec(p);
  return m ? m[1].trim() : p;
}

/**
 * Prompt asks for workspace/code changes (disk work), not pure Q&A or echo.
 * @param {string|null|undefined} prompt
 * @param {{ asGoal?: boolean }} [opts]
 */
export function looksLikeActionPrompt(prompt, opts = {}) {
  const p = String(prompt || "").trim();
  if (!p) {
    return false;
  }
  const subject = objectiveSubject(p);
  // Pure reply / echo probes (bridge-ok, reply-with-exactly) are never action
  // work, even under goal framing — the Goal wrapper must not Mode-B nudge them.
  if (isReplyOnlyPrompt(subject)) {
    return false;
  }
  // How-to / explain first — even if "implement" appears later in the question,
  // and even when goal-framed ("Objective: Explain how X works" is still Q&A).
  if (QA_LEAD_RE.test(subject) && !DISK_MANDATE_RE.test(subject)) {
    return false;
  }
  if (opts.asGoal) {
    return true;
  }
  if (/Objective:|as a Kimi \*\*Goal\*\*/i.test(p)) {
    return true;
  }
  if (DISK_ACTION_RE.test(subject) || CJK_DISK_ACTION_RE.test(subject) || DISK_MANDATE_RE.test(subject)) {
    return true;
  }
  // Multi-word task-ish without Q&A / reply: require a file path cue or "code/repo"
  if (
    subject.length >= 12 &&
    subject.length <= 400 &&
    !/\?\s*$/.test(subject) &&
    (/\.(js|ts|tsx|jsx|css|html|vue|py|go|rs|json|md)\b/i.test(subject) ||
      /\b(code|repo|repository|workspace|file|module|component)\b/i.test(subject) ||
      /文件|代码|仓库|项目/.test(subject))
  ) {
    return true;
  }
  return false;
}

/**
 * Agent text still sounds like planning, not a finished handoff.
 * @param {string|null|undefined} text
 */
export function looksLikePlanningText(text) {
  const t = String(text || "").trim();
  if (!t) {
    return false;
  }
  return PLANNING_TEXT_RE.test(t) || PLANNING_TEXT_CJK_RE.test(t);
}

/**
 * @param {string|null|undefined} text
 */
export function looksLikeCompletionClaim(text) {
  const t = String(text || "").trim();
  if (!t) {
    return false;
  }
  return COMPLETION_CLAIM_RE.test(t) || COMPLETION_CLAIM_CJK_RE.test(t);
}

/**
 * Whether Mode B force-continue is enabled (default on).
 * Disable with KIMI_FORCE_CONTINUE=0|false|no|off
 * @param {NodeJS.ProcessEnv} [env]
 */
export function forceContinueEnabled(env = process.env) {
  const v = String(env.KIMI_FORCE_CONTINUE ?? "1")
    .trim()
    .toLowerCase();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

/**
 * @param {object|null|undefined} result - last prompt result
 * @param {object} ctx
 * @param {string} [ctx.prompt]
 * @param {string} [ctx.mode]
 * @param {boolean} [ctx.asGoal]
 * @param {boolean} [ctx.enabled]
 * @returns {{ incomplete: boolean, reason: string|null }}
 */
export function looksIncompleteTurn(result, ctx = {}) {
  const mode = ctx.mode || "yolo";
  if (mode === "plan") {
    return { incomplete: false, reason: null };
  }
  // enabled === false → off; true → on (overrides env); undefined → KIMI_FORCE_CONTINUE
  if (ctx.enabled === false) {
    return { incomplete: false, reason: null };
  }
  if (ctx.enabled !== true && !forceContinueEnabled()) {
    return { incomplete: false, reason: null };
  }
  if (!looksLikeActionPrompt(ctx.prompt, { asGoal: ctx.asGoal })) {
    return { incomplete: false, reason: null };
  }

  const stop = result?.stopReason;
  if (stop && stop !== "end_turn") {
    // cancelled / refusal / max_tokens — do not auto-nudge into a new loop
    return { incomplete: false, reason: null };
  }

  // Mode A owns pure emptiness
  if (isEmptyTurn(result)) {
    return { incomplete: false, reason: null };
  }

  if (hasMutatingOrExecuteWork(result?.toolCalls)) {
    return { incomplete: false, reason: null };
  }

  const tools = result?.toolCalls || [];
  const text = String(result?.text || "").trim();

  if (tools.length === 0) {
    // text-only: only incomplete when planning-like, or no completion claim on disk work
    if (looksLikePlanningText(text)) {
      return { incomplete: true, reason: "text_only_no_tools" };
    }
    if (looksLikeCompletionClaim(text)) {
      return { incomplete: false, reason: null };
    }
    // Short echo-like answers on action prompts still incomplete (no tools, no claim)
    // Long analysis without claim / tools → incomplete (plan-then-stop without "I'll")
    return { incomplete: true, reason: "text_only_no_tools" };
  }

  // tools present but none mutate/execute → read-only explore then stop
  return { incomplete: true, reason: "read_only_tools" };
}

/**
 * @param {string|null|undefined} reason
 * @returns {string}
 */
export function buildContinueNudge(reason) {
  const why =
    reason === "read_only_tools"
      ? "You only used read/search tools and then stopped."
      : "You returned text without making tool-backed changes on disk.";
  return [
    "[Host continue] Incomplete handoff — do not treat the previous turn as done.",
    why,
    "Stop planning. Use Write/Edit (or equivalent mutating tools) to implement the user objective on disk now.",
    "If a shell command is required to finish, run it and observe the result.",
    "After real changes, briefly list files you changed. If truly blocked, state one concrete blocker and stop.",
  ].join("\n");
}

/**
 * Peer-style recovery when a turn delivered zero agent text (Mode A residual).
 * Used same-session after fresh-session empty retries are exhausted.
 */
export function buildEmptyRecoveryNudge() {
  return [
    "[Host recovery] The previous turn completed with stop=end_turn but produced zero agent text and zero tool calls.",
    "That is an empty ACP completion, not a successful answer.",
    "Respond to the original user request fully now. If implementation is required, use tools and change files on disk.",
    "Do not reply with only silence or config updates.",
  ].join("\n");
}

/**
 * Stagnation: continue turn produced no tools and no meaningful new text.
 * @param {object} prev
 * @param {object} next
 */
export function isContinueStagnant(prev, next) {
  const nextTools = next?.toolCalls?.length || 0;
  if (nextTools > 0) {
    return false;
  }
  const prevText = String(prev?.text || "").trim();
  const nextText = String(next?.text || "").trim();
  if (!nextText) {
    return true;
  }
  if (nextText === prevText) {
    return true;
  }
  // Tiny echo / apology without progress
  if (nextText.length < 40 && nextTools === 0) {
    return true;
  }
  return false;
}

/**
 * Merge successive same-session prompt results for host-facing payload.
 * @param {object} base
 * @param {object} next
 */
export function mergeTurnResults(base, next) {
  const textParts = [];
  const a = String(base?.text || "").trim();
  const b = String(next?.text || "").trim();
  if (a) {
    textParts.push(a);
  }
  if (b && b !== a) {
    textParts.push(b);
  }
  return {
    ...base,
    ...next,
    text: textParts.join("\n\n"),
    toolCalls: [...(base?.toolCalls || []), ...(next?.toolCalls || [])],
    stopReason: next?.stopReason ?? base?.stopReason,
    sessionId: next?.sessionId || base?.sessionId,
  };
}
