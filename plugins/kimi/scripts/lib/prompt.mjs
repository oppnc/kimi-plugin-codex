/**
 * Build the user-facing ACP prompt text for Kimi.
 *
 * Product rule: forward the resolved task text; do not inject host system prompts.
 * Optional git facts and goal framing are explicit routing features, not default chatter.
 */

/**
 * @param {object} opts
 * @param {string} opts.prompt - Resolved task text (after parent-side routing)
 * @param {boolean} [opts.asGoal]
 * @param {string} [opts.gitContext]
 * @param {boolean} [opts.bridgeNotes] - Legacy host handoff bullets (off by default)
 * @returns {string}
 */
export function buildUserPrompt({
  prompt,
  asGoal = false,
  gitContext = "",
  bridgeNotes = false,
}) {
  const chunks = [];
  if (gitContext) {
    chunks.push(gitContext);
    chunks.push("");
  }

  const task = String(prompt ?? "").trim() || "(see attached media)";

  if (asGoal) {
    chunks.push(
      [
        "Treat the following as a Kimi **Goal**: a clear finish line with verifiable evidence.",
        "Use CreateGoal / goal tools if available, keep working until the objective is met or blocked,",
        "and report evidence of completion.",
        "",
        `Objective: ${task}`,
      ].join("\n"),
    );
  } else {
    chunks.push(task);
  }

  if (bridgeNotes) {
    chunks.push("");
    chunks.push(
      [
        "Host handoff (keep working in your normal Kimi Code environment):",
        "- Finish the user objective, or stop only when blocked with concrete evidence.",
        "- Prefer short tool steps; if you background a command, observe its completion before claiming done.",
      ].join("\n"),
    );
  }

  return chunks.join("\n");
}

/** Opt-in legacy bridge bullets: KIMI_BRIDGE_HANDOFF=1|true|yes */
export function bridgeNotesEnabled(env = process.env) {
  const v = String(env.KIMI_BRIDGE_HANDOFF || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
