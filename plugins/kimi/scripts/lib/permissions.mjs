/**
 * Permission option picking for Kimi ACP reverse-RPC
 * `session/request_permission`.
 *
 * Wire optionIds (from Moonshot acp-adapter):
 *   approve_once | approve_always | reject
 *   plan_approve | plan_revise | plan_reject_and_exit | plan_opt_<i>
 *   legacy: approve | approve_for_session
 */

export const APPROVE_ALWAYS = "approve_always";
export const APPROVE_ONCE = "approve_once";
export const REJECT = "reject";
export const PLAN_APPROVE = "plan_approve";
export const PLAN_REVISE = "plan_revise";
export const PLAN_REJECT_EXIT = "plan_reject_and_exit";

/** Tool titles that look like mutating work (reject under plan policy). */
const MUTATING_TOOL_RE =
  /^(Write|Edit|AgentSwarm|CronCreate|CronDelete|CreateGoal|UpdateGoal|SetGoalBudget)$/i;

/**
 * @param {Array<{ optionId?: string, kind?: string, name?: string }>} options
 * @param {object} ctx
 * @param {'auto'|'reject'|'plan'} ctx.policy
 * @param {{ title?: string, toolCallId?: string, content?: unknown[] }} [ctx.toolCall]
 */
export function pickPermissionOptionId(options, ctx = {}) {
  const list = Array.isArray(options) ? options : [];
  const byId = (id) => list.find((o) => o.optionId === id);
  const rejectId =
    byId(REJECT)?.optionId ||
    list.find((o) => o.kind === "reject_once" || o.kind === "reject_always")?.optionId ||
    REJECT;

  const policy = ctx.policy || "auto";

  if (policy === "reject") {
    return rejectId;
  }

  if (policy === "plan") {
    const title = String(ctx.toolCall?.title || "");
    // ExitPlanMode: approving would exit plan mode and start execution, after
    // which this policy would reject every write — a broken half-run. Decline
    // execution instead; the plan text already streamed is the deliverable.
    if (/^ExitPlanMode$/i.test(title)) {
      return byId(PLAN_REJECT_EXIT)?.optionId || rejectId;
    }
    // Kimi plan mode should already block writes; this is a second line of defense
    // when the client is asked about clearly mutating tools.
    if (MUTATING_TOOL_RE.test(title) || /write|edit|delete|overwrite/i.test(title)) {
      return rejectId;
    }
    // Prefer one-shot approve for plan (do not install session-wide allow rules).
    return (
      byId(APPROVE_ONCE)?.optionId ||
      byId("approve")?.optionId ||
      byId(PLAN_APPROVE)?.optionId ||
      list.find((o) => String(o.kind || "").startsWith("allow"))?.optionId ||
      list.find((o) => String(o.optionId || "").startsWith("plan_opt_"))?.optionId ||
      APPROVE_ONCE
    );
  }

  // auto (default for yolo/auto/default non-interactive rescue)
  return (
    byId(APPROVE_ALWAYS)?.optionId ||
    byId("approve_for_session")?.optionId ||
    byId(PLAN_APPROVE)?.optionId ||
    byId(APPROVE_ONCE)?.optionId ||
    byId("approve")?.optionId ||
    list.find((o) => String(o.kind || "").startsWith("allow"))?.optionId ||
    list.find((o) => String(o.optionId || "").startsWith("plan_opt_"))?.optionId ||
    list[0]?.optionId ||
    APPROVE_ALWAYS
  );
}

/**
 * Map ACP mode to companion permission policy.
 * @param {'default'|'plan'|'auto'|'yolo'} mode
 *
 * NOTE: this plugin runs Kimi non-interactively, so `default` behaves like
 * `auto`/`yolo` — every permission request is auto-approved (approve_always),
 * there is no interactive human confirmation. Only `plan` rejects writes.
 * If you need interactive approval, run `kimi` in a normal terminal instead.
 */
export function permissionPolicyForMode(mode) {
  if (mode === "plan") {
    return "plan";
  }
  return "auto";
}
