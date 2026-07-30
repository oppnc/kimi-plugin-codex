#!/usr/bin/env node
/**
 * kimi-companion v0.2.0 — Kimi Code over ACP for OpenAI Codex.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { KimiAcpClient, listKimiSessions, runKimiAcpTurn } from "./lib/acp-client.mjs";
import { parseArgs, parseTaskArgs } from "./lib/args.mjs";
import {
  acpFailedError,
  binaryBadError,
  binaryNotFoundError,
  compatNotes,
  invalidModeError,
  nodeTooOldError,
  resumeSessionError,
  taskPromptRequiredError,
} from "./lib/errors.mjs";
import { collectGitContext } from "./lib/git-context.mjs";
import { getHostSessionId } from "./lib/host-session.mjs";
import { buildMediaPromptParts } from "./lib/media.mjs";
import {
  binaryAvailable,
  isPidAlive,
  killPidTree,
  resolveKimiBinary,
} from "./lib/process.mjs";
import {
  ensureDataDirs,
  generateJobId,
  jobLogPath,
  listJobs,
  nowIso,
  readJob,
  writeJob,
} from "./lib/state.mjs";
import {
  renderJobStatus,
  renderSetupReport,
  renderStatusList,
  renderTaskResult,
} from "./lib/render.mjs";
import { companionTaskAcceptance } from "./lib/acceptance.mjs";
import { bridgeNotesEnabled, buildUserPrompt } from "./lib/prompt.mjs";
import { describeWorkspaceRoot, resolveWorkspaceRoot } from "./lib/workspace.mjs";

const VALID_MODES = new Set(["default", "plan", "auto", "yolo"]);
const VERSION = "0.2.0";
const MIN_NODE = "18.18.0";
/** Heartbeat interval for background runners (ms). */
const BG_HEARTBEAT_MS = 10_000;
/** running + no pid older than this → treat as orphan at reconcile (ms). */
const ORPHAN_NO_PID_GRACE_MS = 30_000;

/**
 * Job lifecycle phases (inspired by claude-code-agent-for-codex observability).
 * status remains the coarse state (running|completed|failed|cancelled);
 * phase is the finer progress label for hosts polling status.
 */
const PHASE = {
  QUEUED: "queued",
  LAUNCHING: "launching",
  STARTING_ACP: "starting_acp",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

function printUsage() {
  console.log(
    [
      `kimi-companion v${VERSION}`,
      "",
      "Usage:",
      "  setup [--json]",
      "  task [options] [--] <prompt>",
      "  goal [options] [--] <objective>     # same as task --goal --mode yolo",
      "  sessions [--cwd <path>] [--json]   # ACP session/list",
      "  status [job-id] [--wait] [--cwd] [--all] [--json]",
      "  result [job-id] [--wait] [--cwd] [--json]",
      "  cancel [job-id] [--cwd] [--json]",
      "",
      "task options:",
      "  --mode default|plan|auto|yolo",
      "    (non-interactive: default auto-approves; plan rejects writes + ExitPlanMode)",
      "  --model <id>  --thinking <level>",
      "  --timeout <ms>   optional ACP deadline (default: none; poll status/result)",
      "  --cwd <path>  --session <id>  --resume / --resume-last  --fresh",
      "  --image <path>  --video <path>  --media <path>   (repeatable)",
      "  --git [--base <ref>]   attach git status/diff (not a review rubric)",
      "  --goal                 frame prompt as a Kimi Goal objective",
      "  --background  --json",
      "",
      "Env: KIMI_CLI_PATH, KIMI_PLUGIN_CODEX_DATA_DIR, CODEX_SESSION_ID / KIMI_PLUGIN_CODEX_HOST_SESSION,",
      "     KIMI_BRIDGE_HANDOFF=1 (optional legacy host handoff bullets on task prompt)",
    ].join("\n"),
  );
}

function outputJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function outputText(value) {
  process.stdout.write(value.endsWith("\n") ? value : `${value}\n`);
}

function normalizeMode(raw, fallback = "yolo") {
  if (raw == null || raw === "") {
    return fallback;
  }
  const m = String(raw).trim().toLowerCase();
  if (!VALID_MODES.has(m)) {
    throw new Error(invalidModeError(raw));
  }
  return m;
}

function requireKimiBin() {
  const kimiBin = resolveKimiBinary();
  if (!kimiBin) {
    throw new Error(binaryNotFoundError());
  }
  return kimiBin;
}

function nodeSemverOk(current, min = MIN_NODE) {
  const parse = (v) =>
    String(v)
      .replace(/^v/i, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(min);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

function setupNextSteps() {
  return [
    "When a task is frontend/UI/screenshot/multi-file UI: load skill $kimi:rescue — do not implement it in Codex when Kimi is ready.",
    "Main agent routes (bg/wait, resume); built-in subagent only runs companion; Kimi owns tools/system.",
    "First-time: $kimi:setup, then a short frontend handoff via $kimi:rescue",
    "Light non-UI one-shot: $kimi:task (explicit); large/UI goals: $kimi:rescue with --goal, or $kimi:goal for small non-UI",
    "Long work: $kimi:status / $kimi:result; sessions: $kimi:sessions",
    'CLI probe: node plugins/kimi/scripts/kimi-companion.mjs task --mode yolo -- "Reply with exactly: kimi-bridge-ok"',
  ];
}

function findResumeSessionId(cwd, explicitSession) {
  if (explicitSession) {
    return explicitSession;
  }
  const host = getHostSessionId();
  const jobs = listJobs({ cwd, limit: 50 });
  const candidates = jobs.filter(
    (j) => j.sessionId && j.status === "completed" && j.sessionId.startsWith("session_"),
  );
  if (host) {
    const forHost = candidates.find((j) => j.hostSessionId === host);
    if (forHost) {
      return forHost.sessionId;
    }
  }
  return candidates[0]?.sessionId || null;
}

async function cmdSetup(asJson) {
  const workspace = describeWorkspaceRoot(null);
  const kimiBin = resolveKimiBinary();
  const report = {
    ok: false,
    kimiBin,
    version: null,
    acpOk: false,
    agentName: null,
    agentVersion: null,
    defaultModel: null,
    models: [],
    modes: null,
    capabilities: null,
    pluginVersion: VERSION,
    nodeVersion: process.version,
    workspace,
    compat: null,
    hostSessionId: getHostSessionId(),
    error: null,
    errorCode: null,
    hints: [],
    nextSteps: [],
  };

  if (!nodeSemverOk(process.version, MIN_NODE)) {
    report.error = nodeTooOldError(process.version);
    report.errorCode = "NODE_TOO_OLD";
    report.hints.push(...report.error.split("\n").slice(1));
    failSetup(report, asJson);
    return;
  }

  if (!kimiBin) {
    report.error = binaryNotFoundError();
    report.errorCode = "BINARY_NOT_FOUND";
    report.hints.push("Install: https://github.com/MoonshotAI/kimi-code");
    report.hints.push("Then: kimi login");
    report.hints.push("Windows: set KIMI_CLI_PATH=%USERPROFILE%\\.kimi-code\\bin\\kimi.exe if needed");
    failSetup(report, asJson);
    return;
  }

  const ver = binaryAvailable(kimiBin, ["--version"]);
  report.version = ver.stdout || ver.stderr || null;
  report.compat = compatNotes(report.version, VERSION);
  if (!ver.ok) {
    report.error = binaryBadError(report.version);
    report.errorCode = "BINARY_BAD";
    report.hints.push("Reinstall Kimi Code or fix KIMI_CLI_PATH.");
    failSetup(report, asJson);
    return;
  }

  let client = null;
  try {
    client = new KimiAcpClient({
      kimiBin,
      cwd: workspace.cwd,
      mode: "default",
    });
    const init = await client.start();
    report.acpOk = true;
    report.agentName = init?.agentInfo?.name || null;
    report.agentVersion = init?.agentInfo?.version || null;
    report.capabilities = init?.agentCapabilities || null;

    const sess = await client.newSession();
    const opts = sess.configOptions || [];
    const modelOpt = opts.find((o) => o.id === "model");
    const modeOpt = opts.find((o) => o.id === "mode");
    const thinkOpt = opts.find((o) => o.id === "thinking");
    report.defaultModel = modelOpt?.currentValue || null;
    report.models = (modelOpt?.options || []).map((o) => ({
      id: o.value,
      name: o.name || o.value,
    }));
    report.modes = modeOpt?.options?.map((o) => o.value).join(", ") || "default, plan, auto, yolo";
    report.thinkingOptions = thinkOpt?.options?.map((o) => o.value) || null;
    report.ok = true;
    report.nextSteps = setupNextSteps();

    if (!report.models.length) {
      report.hints.push("No models listed in ACP configOptions; check kimi login / providers.");
    }
    if (report.compat?.level === "warn") {
      report.hints.push(...report.compat.notes);
    }
  } catch (error) {
    const raw = error?.message || String(error);
    report.error = acpFailedError(raw);
    report.errorCode = /login|auth|401|403/i.test(raw) ? "LOGIN_REQUIRED" : "ACP_FAILED";
    report.hints.push("Run `kimi login` in a normal terminal, then re-run setup.");
    report.hints.push("`kimi acp` should wait on stdin when launched alone.");
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
    }
  }

  if (asJson) {
    outputJson(report);
  } else {
    outputText(renderSetupReport(report));
    if (report.models?.length) {
      outputText("\nModels:\n" + report.models.map((m) => `- ${m.id}`).join("\n") + "\n");
    }
  }
}

function failSetup(report, asJson) {
  process.exitCode = 1;
  if (asJson) {
    outputJson(report);
  } else {
    outputText(renderSetupReport(report));
  }
}

async function cmdTask(argv, { forceGoal = false } = {}) {
  const args = parseTaskArgs(argv);
  const cwd = resolveWorkspaceRoot(args.cwd);
  const mode = normalizeMode(args.mode, "yolo");
  const asGoal = forceGoal || args.asGoal;
  const kimiBin = requireKimiBin();

  if (!args.prompt && !args.mediaPaths.length) {
    throw new Error(taskPromptRequiredError());
  }

  // Resolve media against workspace cwd (agent-facing); pin absolute paths for bg jobs.
  const media = buildMediaPromptParts(args.mediaPaths, { cwd });
  if (media.errors.length) {
    throw new Error(media.errors.join("\n\n"));
  }
  const mediaPaths = args.mediaPaths.map((p) => {
    const abs = resolve(cwd, p);
    return fs.existsSync(abs) ? abs : resolve(p);
  });

  let gitContext = "";
  if (args.withGit) {
    gitContext = collectGitContext(cwd, { base: args.base });
  }

  const userText = buildUserPrompt({
    prompt: args.prompt || "(see attached media)",
    asGoal,
    gitContext,
    bridgeNotes: bridgeNotesEnabled(),
  });

  let sessionMode = "new";
  let sessionId = null;
  if (args.fresh) {
    sessionMode = "new";
  } else if (args.session || args.resume) {
    sessionId = findResumeSessionId(cwd, args.session);
    if (!sessionId) {
      throw new Error(resumeSessionError());
    }
    // resume without full history replay (lighter); use load if you need replay
    sessionMode = "resume";
  }

  const requestTimeoutMs =
    args.timeoutMs && Number.isFinite(args.timeoutMs) && args.timeoutMs > 0
      ? args.timeoutMs
      : null;

  if (args.background) {
    return startBackgroundJob({
      cwd,
      mode,
      model: args.model,
      thinking: args.thinking,
      prompt: userText,
      mediaPaths,
      withGit: args.withGit,
      base: args.base,
      asGoal,
      sessionMode,
      sessionId,
      requestTimeoutMs,
      asJson: args.asJson,
    });
  }

  let result;
  try {
    result = await runKimiAcpTurn({
      kimiBin,
      cwd,
      prompt: userText,
      mode,
      model: args.model || null,
      thinking: args.thinking || null,
      requestTimeoutMs,
      sessionMode,
      sessionId,
      extraBlocks: media.blocks,
      asGoal,
    });
  } catch (error) {
    // Keep a failure record so status/result can surface it later.
    writeJob({
      id: generateJobId(),
      status: "failed",
      cwd,
      mode,
      model: args.model || null,
      thinking: args.thinking || null,
      prompt: userText,
      promptPreview: userText.slice(0, 120),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sessionId: sessionId || null,
      hostSessionId: getHostSessionId(),
      resultText: null,
      stopReason: null,
      toolEventCount: 0,
      mediaNotes: media.notes,
      asGoal,
      error: error?.message || String(error),
      pid: null,
    });
    throw error;
  }

  const jobId = generateJobId();
  const hostSessionId = getHostSessionId();
  // Peer posture: empty completion is a failed handoff (shared acceptance.mjs).
  const acc = companionTaskAcceptance(result);
  writeJob({
    id: jobId,
    status: acc.jobStatus,
    cwd,
    mode,
    model: args.model || null,
    thinking: args.thinking || null,
    prompt: userText,
    promptPreview: userText.slice(0, 120),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    sessionId: result.sessionId,
    hostSessionId,
    resultText: result.text,
    stopReason: result.stopReason,
    toolEventCount: result.toolCalls?.length || 0,
    mediaNotes: media.notes,
    asGoal,
    emptyAgentText: acc.emptyAgentText,
    emptyRetried: acc.emptyRetried,
    emptyRecoveryNudged: acc.emptyRecoveryNudged,
    incompleteContinued: acc.incompleteContinued,
    continueCount: acc.continueCount,
    incompleteReason: acc.incompleteReason,
    error: acc.jobError,
    pid: null,
  });

  const payload = {
    jobId,
    sessionId: result.sessionId,
    stopReason: result.stopReason,
    mode,
    sessionMode,
    text: result.text,
    toolCalls: result.toolCalls,
    toolEventCount: result.toolCalls?.length || 0,
    mediaNotes: media.notes,
    agent: result.init?.agentInfo || null,
    emptyAgentText: acc.emptyAgentText,
    emptyRetried: acc.emptyRetried,
    emptyRecoveryNudged: acc.emptyRecoveryNudged,
    incompleteContinued: acc.incompleteContinued,
    continueCount: acc.continueCount,
    incompleteReason: acc.incompleteReason,
    ok: acc.ok,
  };

  if (args.asJson) {
    outputJson(payload);
  } else {
    outputText(renderTaskResult(payload));
  }
  // Non-zero exit so hosts re-dispatch instead of treating empty as success.
  if (acc.exitCode !== 0) {
    process.exitCode = acc.exitCode;
  }
}

/**
 * Mark running jobs whose runner PID is gone as failed (orphan).
 * Called from status/result/wait so the UI does not lie indefinitely.
 * @returns {number} how many jobs were reconciled
 */
function reconcileStaleJobs() {
  let n = 0;
  // Wide scan: all workspaces, up to prune bound
  const jobs = listJobs({ limit: 100 });
  const now = Date.now();
  for (const job of jobs) {
    if (job.status !== "running") {
      continue;
    }
    const pid = job.pid;
    const alive = isPidAlive(pid);
    if (alive) {
      continue;
    }
    // Allow a short grace when spawn has not written pid yet
    if (pid == null || pid === "") {
      const created = Date.parse(job.createdAt || "") || 0;
      if (created && now - created < ORPHAN_NO_PID_GRACE_MS) {
        continue;
      }
    }
    writeJob({
      ...job,
      status: "failed",
      phase: PHASE.FAILED,
      updatedAt: nowIso(),
      pid: null,
      orphaned: true,
      lastProgressMessage: job.lastProgressMessage || "orphan reconciled (runner dead)",
      error:
        job.error ||
        (pid
          ? `orphan: runner pid ${pid} is no longer alive (process exited without finalizing the job)`
          : "orphan: runner never recorded a live pid"),
    });
    n += 1;
  }
  return n;
}

function refreshJob(jobId) {
  reconcileStaleJobs();
  return readJob(jobId);
}

function startBackgroundJob(jobSpec) {
  ensureDataDirs();
  const jobId = generateJobId();
  const createdAt = nowIso();
  const logFile = jobLogPath(jobId);
  const job = {
    id: jobId,
    status: "running",
    phase: PHASE.QUEUED,
    ...jobSpec,
    promptPreview: String(jobSpec.prompt || "").slice(0, 120),
    hostSessionId: getHostSessionId(),
    createdAt,
    updatedAt: createdAt,
    pid: null,
    sessionId: jobSpec.sessionId || null,
    resultText: null,
    stopReason: null,
    toolEventCount: 0,
    lastProgressMessage: "queued",
    error: null,
    logFile,
  };
  // strip non-serializable
  delete job.asJson;
  writeJob(job);

  const self = fileURLToPath(import.meta.url);
  let logFd;
  try {
    logFd = fs.openSync(logFile, "a");
    fs.writeSync(
      logFd,
      `[${createdAt}] spawn _bg-run job=${jobId} cwd=${job.cwd}\n`,
    );
  } catch {
    logFd = "ignore";
  }

  const runner = spawn(process.execPath, [self, "_bg-run", jobId], {
    detached: true,
    // Do not use stdio:"ignore" — crashes become invisible zombies.
    stdio: logFd === "ignore" ? "ignore" : ["ignore", logFd, logFd],
    windowsHide: true,
    env: { ...process.env },
  });
  if (typeof logFd === "number") {
    try {
      fs.closeSync(logFd);
    } catch {
      // child holds the fd
    }
  }

  job.pid = runner.pid ?? null;
  job.phase = PHASE.LAUNCHING;
  job.lastProgressMessage = `spawned runner pid=${job.pid}`;
  job.updatedAt = nowIso();
  writeJob(job);

  runner.on("error", (err) => {
    const cur = readJob(jobId) || job;
    if (cur.status === "running") {
      writeJob({
        ...cur,
        status: "failed",
        phase: PHASE.FAILED,
        updatedAt: nowIso(),
        pid: null,
        lastProgressMessage: "spawn failed",
        error: `failed to spawn background runner: ${err?.message || err}`,
      });
    }
  });

  // If the runner exits before cmdBgRun finalizes (crash / hard kill path
  // where the child never rewrote the job), mark orphan after a short delay.
  runner.on("exit", (code, signal) => {
    setTimeout(() => {
      const cur = readJob(jobId);
      if (!cur || cur.status !== "running") {
        return;
      }
      // Child should have cleared pid or rewritten status; if still running
      // and our spawn pid is gone, reconcile.
      if (!isPidAlive(cur.pid)) {
        writeJob({
          ...cur,
          status: "failed",
          phase: PHASE.FAILED,
          updatedAt: nowIso(),
          pid: null,
          orphaned: true,
          lastProgressMessage: cur.lastProgressMessage || "runner exited without finalize",
          error:
            cur.error ||
            `orphan: background runner exited (code=${code}, signal=${signal}) without finalizing`,
        });
      }
    }, 1500);
  });

  runner.unref();

  const payload = {
    jobId,
    status: "running",
    phase: PHASE.LAUNCHING,
    pid: job.pid,
    logFile,
    // Host-facing: treat as subagent handoff id; poll only if the host cannot wait in one call.
    message: `Kimi Code subagent started (${jobId}).`,
  };
  if (jobSpec.asJson) {
    outputJson(payload);
  } else {
    outputText(`${payload.message}\n`);
  }
}

function appendJobLog(jobId, line) {
  try {
    fs.appendFileSync(jobLogPath(jobId), `[${nowIso()}] ${line}\n`, "utf8");
  } catch {
    // best-effort
  }
}

async function cmdBgRun(jobId) {
  ensureDataDirs();
  let job = readJob(jobId);
  if (!job) {
    process.exit(1);
  }

  // Prefer the real runner pid (this process) over the parent's spawn handle.
  job = {
    ...job,
    pid: process.pid,
    phase: PHASE.STARTING_ACP,
    lastProgressMessage: "runner start",
    updatedAt: nowIso(),
    logFile: job.logFile || jobLogPath(jobId),
  };
  writeJob(job);
  appendJobLog(jobId, `runner start pid=${process.pid} mode=${job.mode || "yolo"}`);

  let finalized = false;
  let toolEventCount = 0;
  let lastSessionId = job.sessionId || null;
  let lastProgressMessage = "runner start";
  let acpReady = false;

  const snapshot = () => readJob(jobId) || job;

  const finalize = (patch) => {
    if (finalized) {
      return;
    }
    finalized = true;
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    const cur = snapshot();
    const status = patch.status || cur.status;
    const phase =
      patch.phase ||
      (status === "completed"
        ? PHASE.COMPLETED
        : status === "cancelled"
          ? PHASE.CANCELLED
          : status === "failed"
            ? PHASE.FAILED
            : cur.phase);
    writeJob({
      ...cur,
      ...patch,
      status,
      phase,
      updatedAt: nowIso(),
      pid: null,
      toolEventCount:
        patch.toolEventCount != null ? patch.toolEventCount : toolEventCount,
      lastProgressMessage:
        patch.lastProgressMessage || lastProgressMessage || cur.lastProgressMessage || null,
    });
    appendJobLog(
      jobId,
      `finalize status=${status} phase=${phase} error=${patch.error || ""} tools=${patch.toolEventCount ?? toolEventCount}`,
    );
  };

  const heartbeat = setInterval(() => {
    try {
      const cur = snapshot();
      if (cur.status !== "running") {
        return;
      }
      writeJob({
        ...cur,
        status: "running",
        phase: acpReady ? PHASE.RUNNING : PHASE.STARTING_ACP,
        updatedAt: nowIso(),
        heartbeatAt: nowIso(),
        pid: process.pid,
        sessionId: lastSessionId || cur.sessionId || null,
        toolEventCount,
        lastProgressMessage,
      });
    } catch {
      // ignore
    }
  }, BG_HEARTBEAT_MS);
  if (typeof heartbeat.unref === "function") {
    heartbeat.unref();
  }

  const failOrphan = (reason) => {
    finalize({
      status: "failed",
      phase: PHASE.FAILED,
      orphaned: true,
      error: reason,
      sessionId: lastSessionId,
      lastProgressMessage: reason,
    });
  };

  // Best-effort if the process is torn down without completing the try/catch.
  process.on("SIGTERM", () => {
    failOrphan("runner received SIGTERM");
    process.exit(143);
  });
  process.on("SIGINT", () => {
    failOrphan("runner received SIGINT");
    process.exit(130);
  });
  process.on("uncaughtException", (err) => {
    failOrphan(`uncaughtException: ${err?.message || err}`);
    process.exit(1);
  });
  process.on("unhandledRejection", (err) => {
    failOrphan(`unhandledRejection: ${err?.message || err}`);
    process.exit(1);
  });
  process.on("exit", () => {
    if (!finalized) {
      // sync write only
      try {
        const cur = snapshot();
        if (cur.status === "running") {
          writeJob({
            ...cur,
            status: "failed",
            phase: PHASE.FAILED,
            updatedAt: nowIso(),
            pid: null,
            orphaned: true,
            error: cur.error || "orphan: runner process exited without finalizing",
            toolEventCount,
            lastProgressMessage: lastProgressMessage || cur.lastProgressMessage,
          });
        }
      } catch {
        // ignore
      }
    }
  });

  const kimiBin = resolveKimiBinary();
  if (!kimiBin) {
    finalize({ status: "failed", phase: PHASE.FAILED, error: "kimi binary not found" });
    process.exit(1);
  }

  try {
    const media = buildMediaPromptParts(job.mediaPaths || []);
    if (job.withGit) {
      // prompt already includes git when queued; re-collect is optional noise
    }
    lastProgressMessage = `acp turn begin cwd=${job.cwd}`;
    writeJob({
      ...snapshot(),
      phase: PHASE.STARTING_ACP,
      lastProgressMessage,
      updatedAt: nowIso(),
      pid: process.pid,
    });
    appendJobLog(jobId, lastProgressMessage);
    const result = await runKimiAcpTurn({
      kimiBin,
      cwd: job.cwd,
      prompt: job.prompt,
      mode: job.mode || "yolo",
      model: job.model || null,
      thinking: job.thinking || null,
      requestTimeoutMs: job.requestTimeoutMs ?? null,
      sessionMode: job.sessionMode || "new",
      sessionId: job.sessionId || null,
      extraBlocks: media.blocks,
      asGoal: Boolean(job.asGoal),
      onUpdate: (update) => {
        const kind = update?.sessionUpdate;
        if (kind === "tool_call" || kind === "tool_call_update") {
          acpReady = true;
          toolEventCount += 1;
          const title = update.title || update.toolCallId || kind;
          const status = update.status ? `:${update.status}` : "";
          lastProgressMessage = `tool ${title}${status} (#${toolEventCount})`;
        } else if (kind === "agent_message_chunk") {
          acpReady = true;
          if (!lastProgressMessage || lastProgressMessage.startsWith("acp")) {
            lastProgressMessage = "agent_message";
          }
        }
      },
      onLog: (msg) => {
        appendJobLog(jobId, `acp: ${msg}`);
        if (String(msg).includes("set_config_option") || String(msg).includes("set_mode")) {
          acpReady = true;
          lastProgressMessage = String(msg);
        }
      },
    });
    lastSessionId = result.sessionId || lastSessionId;
    toolEventCount = Math.max(toolEventCount, result.toolCalls?.length || 0);
    const acc = companionTaskAcceptance(result);
    lastProgressMessage =
      `${acc.jobStatus} stop=${result.stopReason || "unknown"} tools=${toolEventCount}` +
      (acc.incompleteContinued ? ` continued=${acc.continueCount}` : "") +
      (acc.emptyRetried ? " emptyRetried" : "") +
      (acc.emptyRecoveryNudged ? " emptyRecovery" : "");
    finalize({
      status: acc.jobStatus,
      phase: acc.jobStatus === "failed" ? PHASE.FAILED : PHASE.COMPLETED,
      sessionId: result.sessionId,
      resultText: result.text,
      stopReason: result.stopReason,
      toolEventCount,
      mediaNotes: media.notes,
      emptyAgentText: acc.emptyAgentText,
      emptyRetried: acc.emptyRetried,
      emptyRecoveryNudged: acc.emptyRecoveryNudged,
      incompleteContinued: acc.incompleteContinued,
      continueCount: acc.continueCount,
      incompleteReason: acc.incompleteReason,
      error: acc.jobError,
      orphaned: false,
      lastProgressMessage,
    });
    if (acc.exitCode !== 0) {
      process.exitCode = acc.exitCode;
    }
  } catch (error) {
    finalize({
      status: "failed",
      phase: PHASE.FAILED,
      sessionId: lastSessionId,
      error: error?.message || String(error),
      lastProgressMessage: error?.message || String(error),
    });
    process.exitCode = 1;
  }
}

function resolveJobId(explicit, cwd) {
  if (explicit) {
    return explicit;
  }
  const host = getHostSessionId();
  const jobs = listJobs({ cwd, limit: 20 });
  if (host) {
    const hit = jobs.find((j) => j.hostSessionId === host);
    if (hit) {
      return hit.id;
    }
  }
  return jobs[0]?.id || null;
}

async function waitForJob(jobId, timeoutMs = null, intervalMs = 2000) {
  const start = Date.now();
  const limitMs =
    timeoutMs != null && Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
      ? Number(timeoutMs)
      : null;
  for (;;) {
    reconcileStaleJobs();
    const job = readJob(jobId);
    if (!job) {
      return null;
    }
    if (job.status !== "running") {
      return job;
    }
    if (limitMs != null && Date.now() - start >= limitMs) {
      return job;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function cmdStatus(argv) {
  const parsed = parseArgs(argv, {
    flags: new Set(["json", "all", "wait"]),
    options: new Set(["cwd", "wait-timeout"]),
  });
  const asJson = Boolean(parsed.flags.json);
  const cwd = resolveWorkspaceRoot(parsed.options.cwd);
  let jobId = parsed._[0] || null;

  reconcileStaleJobs();

  if (parsed.flags.wait) {
    jobId = resolveJobId(jobId, cwd);
    if (!jobId) {
      throw new Error("No job to wait for");
    }
    const waitRaw = parsed.options["wait-timeout"];
    const timeout =
      waitRaw != null && waitRaw !== "" ? Number(waitRaw) : null;
    const job = await waitForJob(jobId, timeout);
    if (asJson) {
      outputJson(job);
    } else {
      outputText(renderJobStatus(job));
    }
    if (!job || job.status === "failed" || job.status === "cancelled") {
      process.exitCode = 1;
    }
    return;
  }

  if (jobId) {
    const job = refreshJob(jobId);
    if (asJson) {
      outputJson(job);
    } else {
      outputText(renderJobStatus(job));
    }
    if (!job) {
      process.exitCode = 1;
    }
    return;
  }

  const jobs = listJobs({ cwd: parsed.flags.all ? undefined : cwd, limit: 20 });
  if (asJson) {
    outputJson(jobs);
  } else {
    outputText(renderStatusList(jobs));
  }
}

async function cmdResult(argv) {
  const parsed = parseArgs(argv, {
    flags: new Set(["json", "wait"]),
    options: new Set(["cwd", "wait-timeout"]),
  });
  const asJson = Boolean(parsed.flags.json);
  const cwd = resolveWorkspaceRoot(parsed.options.cwd);
  reconcileStaleJobs();
  let jobId = resolveJobId(parsed._[0], cwd);

  if (parsed.flags.wait && jobId) {
    const waitRaw = parsed.options["wait-timeout"];
    const timeout =
      waitRaw != null && waitRaw !== "" ? Number(waitRaw) : null;
    await waitForJob(jobId, timeout);
  }

  const job = jobId ? refreshJob(jobId) : null;
  if (!job) {
    if (asJson) {
      outputJson({ error: "no job" });
    } else {
      outputText("No job found.\n");
    }
    process.exitCode = 1;
    return;
  }
  if (asJson) {
    outputJson(job);
  } else {
    outputText(renderJobStatus(job));
  }
  if (job.status === "failed" || job.status === "cancelled") {
    process.exitCode = 1;
  } else if (job.status === "running") {
    process.exitCode = 0;
  }
}

async function cmdCancel(argv) {
  const parsed = parseArgs(argv, {
    flags: new Set(["json"]),
    options: new Set(["cwd"]),
  });
  const asJson = Boolean(parsed.flags.json);
  const cwd = resolveWorkspaceRoot(parsed.options.cwd);
  reconcileStaleJobs();
  const jobId = resolveJobId(parsed._[0], cwd);
  const job = jobId ? readJob(jobId) : null;
  if (!job) {
    if (asJson) {
      outputJson({ error: "no job" });
    } else {
      outputText("No job found.\n");
    }
    process.exitCode = 1;
    return;
  }
  if (job.status === "running" && job.pid) {
    killPidTree(job.pid);
  }
  const updated = {
    ...job,
    status: job.status === "running" ? "cancelled" : job.status,
    phase: job.status === "running" ? PHASE.CANCELLED : job.phase || job.status,
    lastProgressMessage:
      job.status === "running" ? "cancelled by host" : job.lastProgressMessage,
    updatedAt: nowIso(),
    pid: null,
  };
  writeJob(updated);
  if (asJson) {
    outputJson(updated);
  } else {
    outputText(`Cancelled ${job.id} (was ${job.status})\n`);
  }
}

async function cmdSessions(argv) {
  const parsed = parseArgs(argv, {
    flags: new Set(["json", "all"]),
    options: new Set(["cwd"]),
  });
  const cwd = parsed.flags.all ? null : resolveWorkspaceRoot(parsed.options.cwd);
  const kimiBin = requireKimiBin();
  // Single ACP process; `cwd: null` lists sessions across all workspaces.
  const result = await listKimiSessions({
    kimiBin,
    cwd: cwd || null,
  });
  const sessions = result?.sessions || [];

  if (parsed.flags.json) {
    outputJson({ sessions });
  } else if (!sessions.length) {
    outputText("No Kimi sessions found.\n");
  } else {
    const lines = ["Kimi ACP sessions:", ""];
    for (const s of sessions) {
      const id = s.sessionId || s.id || "?";
      const title = s.title || s.cwd || "";
      lines.push(`- ${id}  ${title}`);
    }
    outputText(lines.join("\n") + "\n");
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    printUsage();
    return;
  }
  if (argv[0] === "-V" || argv[0] === "--version") {
    outputText(`${VERSION}\n`);
    return;
  }

  const command = argv[0];
  const rest = argv.slice(1);

  try {
    switch (command) {
      case "setup":
        await cmdSetup(rest.includes("--json"));
        break;
      case "task":
        await cmdTask(rest);
        break;
      case "goal":
        await cmdTask(rest, { forceGoal: true });
        break;
      case "sessions":
        await cmdSessions(rest);
        break;
      case "status":
        await cmdStatus(rest);
        break;
      case "result":
        await cmdResult(rest);
        break;
      case "cancel":
        await cmdCancel(rest);
        break;
      case "_bg-run":
        await cmdBgRun(rest[0]);
        break;
      default:
        printUsage();
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

await main();
