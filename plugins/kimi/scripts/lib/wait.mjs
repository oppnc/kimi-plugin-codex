/**
 * Wait-slice budget for long-running Kimi jobs under Codex MCP.
 * Ending a slice is not a Kimi failure — host should poll status/result.
 */

/** Default first wait slice for kimi_rescue (ms). */
export const DEFAULT_RESCUE_WAIT_MS = 120_000;
/** Hard cap per wait_timeout_ms / single status --wait (ms). */
export const MAX_RESCUE_WAIT_MS = 540_000;
/** Default slice when kimi_status/kimi_result wait:true without a bound. */
export const DEFAULT_POLL_WAIT_MS = 180_000;

/**
 * @param {unknown} raw
 * @param {number} [defaultMs]
 */
export function resolveWaitMs(raw, defaultMs = DEFAULT_RESCUE_WAIT_MS) {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(Math.max(1, Math.floor(n)), MAX_RESCUE_WAIT_MS);
  }
  return defaultMs;
}
