/**
 * Host-facing acceptance contract for companion task results.
 *
 * Peers treat empty/incomplete handoffs as failed work (fail-loud / re-dispatch),
 * not as successful short answers. Used by kimi-companion so unit tests can drive
 * the same classification as the CLI without spawning ACP.
 */

/**
 * Classify a runKimiAcpTurn-shaped result for jobs, JSON payload, and process exit.
 *
 * @param {object|null|undefined} result
 * @returns {{
 *   emptyAgentText: boolean,
 *   planEmptyText: boolean,
 *   emptyRetried: boolean,
 *   emptyRecoveryNudged: boolean,
 *   incompleteContinued: boolean,
 *   continueCount: number,
 *   incompleteReason: string|null,
 *   ok: boolean,
 *   exitCode: number,
 *   jobStatus: 'failed'|'completed',
 *   jobError: string|null,
 * }}
 */
export function companionTaskAcceptance(result) {
  const emptyFail = Boolean(result?.emptyAgentText);
  // Plan mode deliverable is the plan text itself. Read-only tools are allowed,
  // but tools without any agent_message_chunk still deliver zero text — that is
  // a failed plan handoff, not a successful plan (hosts should re-dispatch).
  const planEmptyText =
    (result?.mode || "yolo") === "plan" &&
    !String(result?.text || "").trim() &&
    (Array.isArray(result?.toolCalls) ? result.toolCalls.length : 0) > 0;
  const failed = emptyFail || planEmptyText;
  return {
    emptyAgentText: emptyFail,
    planEmptyText,
    emptyRetried: Boolean(result?.emptyRetried),
    emptyRecoveryNudged: Boolean(result?.emptyRecoveryNudged),
    incompleteContinued: Boolean(result?.incompleteContinued),
    continueCount: Number(result?.continueCount) || 0,
    incompleteReason: result?.incompleteReason ?? null,
    ok: !failed,
    exitCode: failed ? 1 : 0,
    jobStatus: failed ? "failed" : "completed",
    jobError: emptyFail
      ? "empty ACP completion: stop=end_turn with no agent text and no tool calls after retries"
      : planEmptyText
        ? "plan mode ended with no plan text: tools ran but no agent_message_chunk; the plan is the deliverable"
        : null,
  };
}
