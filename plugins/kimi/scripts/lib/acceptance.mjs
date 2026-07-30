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
  return {
    emptyAgentText: emptyFail,
    emptyRetried: Boolean(result?.emptyRetried),
    emptyRecoveryNudged: Boolean(result?.emptyRecoveryNudged),
    incompleteContinued: Boolean(result?.incompleteContinued),
    continueCount: Number(result?.continueCount) || 0,
    incompleteReason: result?.incompleteReason ?? null,
    ok: !emptyFail,
    exitCode: emptyFail ? 1 : 0,
    jobStatus: emptyFail ? "failed" : "completed",
    jobError: emptyFail
      ? "empty ACP completion: stop=end_turn with no agent text and no tool calls after retries"
      : null,
  };
}
