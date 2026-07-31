export function renderSetupReport(report) {
  const lines = [
    "Kimi Plugin Codex — setup",
    "─────────────────────────",
    `plugin      : ${report.pluginVersion || "-"}`,
    `node        : ${report.nodeVersion || process.version}`,
    `workspace   : ${report.workspace?.cwd || "-"} (${report.workspace?.source || "?"}${report.workspace?.envKey ? `:${report.workspace.envKey}` : ""})`,
    `kimi binary : ${report.kimiBin || "(not found)"}`,
    `version     : ${report.version || "(unknown)"}`,
    `compat      : ${report.compat?.level || "-"}`,
    `acp probe   : ${report.acpOk ? "ok" : "FAILED"}`,
    `agent       : ${[report.agentName, report.agentVersion].filter(Boolean).join(" ") || "-"}`,
  ];
  if (report.defaultModel) {
    lines.push(`default model: ${report.defaultModel}`);
  }
  if (report.modes) {
    lines.push(`modes       : ${report.modes}`);
  }
  if (report.error) {
    lines.push(`error       : ${report.error}`);
  }
  if (report.hints?.length) {
    lines.push("", "Hints:");
    for (const h of report.hints) {
      lines.push(`- ${h}`);
    }
  }
  if (report.compat?.notes?.length) {
    lines.push("", "Compatibility:");
    for (const n of report.compat.notes) {
      lines.push(`- ${n}`);
    }
  }
  if (report.nextSteps?.length) {
    lines.push("", "Next (first verify):");
    for (const n of report.nextSteps) {
      lines.push(`- ${n}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderTaskResult(result) {
  const lines = [];
  lines.push(`Kimi task finished (stop=${result.stopReason || "unknown"})`);
  if (result.mode) {
    lines.push(`mode: ${result.mode}`);
  }
  if (result.sessionId) {
    lines.push(`session: ${result.sessionId}`);
  }
  if (result.jobId) {
    lines.push(`job: ${result.jobId}`);
  }
  if (result.cwd) {
    lines.push(`cwd: ${result.cwd}`);
  }
  if (result.mediaNotes?.length) {
    lines.push(`media: ${result.mediaNotes.join("; ")}`);
  }
  lines.push("");
  const body = result.text?.trim();
  if (body) {
    lines.push(body);
  } else {
    lines.push("(no agent text)");
    if (result.emptyAgentText || result.emptyRetried || result.emptyRecoveryNudged) {
      lines.push(
        "",
        "note: Kimi ACP ended with stop=end_turn but streamed no agent_message_chunk",
        "      (and no tool calls). This is an empty completion from Kimi, not a clarifying question.",
        "      Hosts should treat this as a failed handoff and re-dispatch (exit code is non-zero).",
      );
      if (result.emptyRetried) {
        lines.push(
          `      companion already retried on a fresh session (emptyRetried=${result.emptyRetried}).`,
        );
      }
      if (result.emptyRecoveryNudged) {
        lines.push(
          "      companion also sent a same-session empty-recovery nudge after retries.",
        );
      }
    }
    if (result.planEmptyText) {
      lines.push(
        "",
        "note: plan mode ran read-only tools but streamed no agent_message_chunk,",
        "      so no plan text was delivered. The plan is the deliverable in plan mode,",
        "      so hosts should re-dispatch (exit code is non-zero).",
      );
    }
  }
  if (result.incompleteContinued) {
    lines.push(
      "",
      `note: companion force-continued incomplete work (${result.continueCount || 1} nudge(s)` +
        (result.incompleteReason ? `; reason=${result.incompleteReason}` : "") +
        ").",
    );
    if (result.incompleteReason) {
      lines.push(
        "      If the objective still looks unfinished, resume with --resume and the same session.",
      );
    }
  }
  if (result.toolCalls?.length) {
    lines.push("");
    lines.push(`tool events: ${result.toolCalls.length}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderJobStatus(job) {
  if (!job) {
    return "No job found.\n";
  }
  const lines = [
    `job       : ${job.id}`,
    `status    : ${job.status}`,
    `cwd       : ${job.cwd}`,
    `mode      : ${job.mode || "-"}`,
    `created   : ${job.createdAt}`,
    `updated   : ${job.updatedAt}`,
  ];
  if (job.phase) {
    lines.push(`phase     : ${job.phase}`);
  }
  if (job.sessionId) {
    lines.push(`session   : ${job.sessionId}`);
  }
  if (job.stopReason) {
    lines.push(`stop      : ${job.stopReason}`);
  }
  if (job.pid != null) {
    lines.push(`pid       : ${job.pid}`);
  }
  if (job.toolEventCount != null) {
    lines.push(`tools     : ${job.toolEventCount}`);
  }
  if (job.lastProgressMessage) {
    lines.push(`progress  : ${job.lastProgressMessage}`);
  }
  if (job.heartbeatAt) {
    lines.push(`heartbeat : ${job.heartbeatAt}`);
  }
  if (job.logFile) {
    lines.push(`log       : ${job.logFile}`);
  }
  if (job.orphaned) {
    lines.push(`orphaned  : true`);
  }
  if (job.error) {
    lines.push(`error     : ${job.error}`);
  }
  if (job.status === "completed" && job.sessionId) {
    lines.push(
      "",
      "hint      : if the objective looks unfinished, resume with --resume / resume:true and the same session",
    );
  } else if (job.status === "failed" && job.sessionId) {
    // e.g. an ACP timeout that kept the session alive — the thread is resumable.
    lines.push(
      "",
      "hint      : this failed job kept its session — resume with --resume / resume:true and the same session to continue the thread",
    );
  }
  if (job.resultText) {
    lines.push("", "--- result ---", job.resultText.trim());
  }
  return `${lines.join("\n")}\n`;
}

export function renderStatusList(jobs) {
  if (!jobs.length) {
    return "No jobs recorded for this workspace.\n";
  }
  const lines = ["Recent Kimi jobs:", ""];
  for (const j of jobs) {
    const preview = (j.promptPreview || "").replace(/\s+/g, " ").slice(0, 50);
    const phase = j.phase ? `/${j.phase}` : "";
    lines.push(
      `- ${j.id}  ${String(j.status + phase).padEnd(18)}  ${j.updatedAt || j.createdAt}  ${preview}`,
    );
  }
  lines.push("", "Use: kimi-companion.mjs result <job-id>");
  return `${lines.join("\n")}\n`;
}
