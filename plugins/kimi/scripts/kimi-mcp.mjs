#!/usr/bin/env node
/**
 * Minimal stdio MCP server for kimi-plugin-codex (zero npm deps).
 *
 * Framing: **NDJSON** (one JSON object per line) on stdout — required by Codex's
 * rmcp client. Content-Length/LSP responses are rejected as
 * `Parse error … expected value at line 1 column 1` and the server is marked
 * unavailable (no kimi_* tools). Readers still accept Content-Length inbound
 * for compatibility with older clients/tests.
 *
 * Tools shell out to kimi-companion.mjs with --json.
 *
 * Long frontend work (screenshots, multi-file UI) is first-class:
 *   kimi_rescue starts a background job, waits a SHORT slice, then returns
 *   still_running + jobId so the host polls kimi_status / kimi_result.
 *   Never treat MCP tool timeout as "Kimi failed" — only as "wait slice ended".
 *
 * Primary: kimi_rescue (+ poll if still_running).
 * Immediate detach: kimi_task_start / kimi_goal_start → poll.
 * Codex default tool_timeout_sec is 60s unless raised (plugin .mcp.json).
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_POLL_WAIT_MS,
  DEFAULT_RESCUE_WAIT_MS,
  MAX_RESCUE_WAIT_MS,
  resolveWaitMs,
} from "./lib/wait.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPANION = join(__dirname, "kimi-companion.mjs");
const SERVER_NAME = "kimi-plugin-codex";
const SERVER_VERSION = "0.1.4";

function writeMessage(obj) {
  // Codex rmcp: NDJSON only. Do not emit Content-Length headers on stdout.
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function okResult(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function errResult(id, code, message) {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function textContent(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function runCompanion(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [COMPANION, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      reject(new Error(`companion timed out after ${timeoutMs}ms: ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `companion exited ${code}`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

const TASK_ARG_PROPS = {
  mode: {
    type: "string",
    enum: ["yolo", "plan", "auto", "default"],
    description: "ACP mode (default yolo for implement/rescue).",
  },
  cwd: { type: "string", description: "Workspace root (default: current cwd)." },
  model: { type: "string" },
  thinking: { type: "string" },
  resume: { type: "boolean", description: "Continue prior Kimi session (same subagent thread)." },
  session: { type: "string", description: "Explicit Kimi ACP session id." },
  fresh: { type: "boolean", description: "Force a new Kimi session." },
  image: { type: "array", items: { type: "string" }, description: "Image paths for Kimi multimodal." },
  video: { type: "array", items: { type: "string" }, description: "Video paths for Kimi multimodal." },
  media: { type: "array", items: { type: "string" }, description: "Extra media paths." },
  git: { type: "boolean", description: "Attach raw git status/diff facts." },
  base: { type: "string", description: "Git base ref when git=true." },
  goal: { type: "boolean", description: "Frame as a Kimi Goal objective." },
};

const TOOLS = [
  {
    name: "kimi_setup",
    description:
      "First-run doctor: check local Kimi Code CLI, login, ACP, workspace cwd, and print next verify steps. " +
      "Call once after install or when handoff fails.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "kimi_rescue",
    description:
      "PRIMARY: hand frontend/UI, screenshot/video bugs, multimodal, or multi-file work to local Kimi Code. " +
      "Starts a durable background job, waits a short slice (default 120s), then returns JSON. " +
      "If still_running=true, KEEP polling kimi_status/kimi_result with jobId — do NOT reimplement, " +
      "and do NOT treat wait-slice end as failure. Long UI work often needs several poll rounds or " +
      "resume+image follow-ups. Prefer this over implementing frontend yourself.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "User task for Kimi. Forward intent; do not invent a system prompt.",
        },
        objective: {
          type: "string",
          description: "Alias for prompt when framing a goal.",
        },
        ...TASK_ARG_PROPS,
        wait_timeout_ms: {
          type: "number",
          description:
            `First wait slice ms (default ${DEFAULT_RESCUE_WAIT_MS}, max ${MAX_RESCUE_WAIT_MS}). ` +
            "Not a hard kill of Kimi — only how long this tool call blocks. Use polls for long work.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_task_start",
    description:
      "Start Kimi in the background and return job_id immediately (no wait). " +
      "Use for long frontend/implement work when you prefer not to block, then poll kimi_status/kimi_result. " +
      "Equivalent to kimi_rescue with wait_timeout_ms=1 when you only need the job id.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Task for Kimi (forward user intent; do not invent a system prompt).",
        },
        ...TASK_ARG_PROPS,
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "kimi_goal_start",
    description:
      "Start a long-horizon Kimi Goal in the background; returns job_id immediately. Poll status/result.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string" },
        prompt: { type: "string", description: "Alias for objective." },
        ...TASK_ARG_PROPS,
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_task",
    description:
      "SHORT synchronous Kimi turn only (probes). Prefer kimi_rescue (+ poll) for real work.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        ...TASK_ARG_PROPS,
        timeout_ms: { type: "number", description: "Optional hard ACP deadline ms." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "kimi_status",
    description:
      "PRIMARY continuation for long Kimi jobs: phase, progress, tools, resultText when done. " +
      "Call after kimi_rescue still_running or kimi_task_start. Prefer wait:true with a slice " +
      "rather than busy-looping without wait.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        cwd: { type: "string" },
        wait: {
          type: "boolean",
          description: "Block until job finishes or wait_timeout_ms elapses (default slice when wait).",
        },
        wait_timeout_ms: {
          type: "number",
          description: `When wait=true, max ms to block (default ${DEFAULT_POLL_WAIT_MS}, max ${MAX_RESCUE_WAIT_MS}).`,
        },
        all: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_result",
    description:
      "Fetch stored result for a job (or latest). Use when status is completed, or with wait:true to block a slice.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        cwd: { type: "string" },
        wait: { type: "boolean" },
        wait_timeout_ms: {
          type: "number",
          description: `When wait=true, max ms to block (default ${DEFAULT_POLL_WAIT_MS}).`,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_cancel",
    description: "Cancel a running background job.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        cwd: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_sessions",
    description: "List Kimi ACP sessions for the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        all: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
];

function pushMediaArgs(args, input) {
  for (const p of input.image || []) {
    args.push("--image", p);
  }
  for (const p of input.video || []) {
    args.push("--video", p);
  }
  for (const p of input.media || []) {
    args.push("--media", p);
  }
}

function pushCommonTaskArgs(args, input) {
  if (input.mode) {
    args.push("--mode", input.mode);
  }
  if (input.cwd) {
    args.push("--cwd", input.cwd);
  }
  if (input.model) {
    args.push("--model", input.model);
  }
  if (input.thinking) {
    args.push("--thinking", input.thinking);
  }
  if (input.resume) {
    args.push("--resume");
  }
  if (input.session) {
    args.push("--session", input.session);
  }
  if (input.fresh) {
    args.push("--fresh");
  }
  if (input.git) {
    args.push("--git");
  }
  if (input.base) {
    args.push("--base", input.base);
  }
  if (input.goal) {
    args.push("--goal");
  }
  pushMediaArgs(args, input);
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(String(text || "").trim());
  } catch {
    return null;
  }
}

function buildJobPayload(job, jobId, { waitedMs = null } = {}) {
  const status = job.status || "unknown";
  const stillRunning = status === "running";
  const sessionId = job.sessionId || null;

  let resume_hint = null;
  let next_actions = [];
  if (stillRunning) {
    resume_hint =
      "Kimi is still working (wait slice ended — NOT a failure). " +
      "Poll kimi_status/kimi_result with this jobId until status is completed/failed/cancelled. " +
      "Do not reimplement the task in Codex while it runs.";
    next_actions = [
      {
        tool: "kimi_status",
        args: { job_id: jobId, wait: true, wait_timeout_ms: DEFAULT_POLL_WAIT_MS },
      },
      { tool: "kimi_result", args: { job_id: jobId, wait: true } },
      { tool: "kimi_cancel", args: { job_id: jobId }, when: "user aborts" },
    ];
  } else if (status === "completed" && sessionId) {
    resume_hint =
      "If the objective looks unfinished or the user provides a new screenshot, " +
      "call kimi_rescue again with resume:true (and image/video paths when relevant).";
    next_actions = [
      {
        tool: "kimi_rescue",
        args: { resume: true, prompt: "<follow-up or screenshot fix>", mode: "yolo" },
        when: "visual follow-up / more work",
      },
    ];
  } else if (status === "failed" || status === "cancelled") {
    resume_hint = job.error
      ? `Job ended (${status}): ${job.error}`
      : `Job ended (${status}).`;
  }

  return {
    subagent: "kimi-code",
    jobId,
    status,
    phase: job.phase || null,
    sessionId,
    stopReason: job.stopReason || null,
    toolEventCount: job.toolEventCount ?? null,
    lastProgressMessage: job.lastProgressMessage || null,
    orphaned: job.orphaned || false,
    error: job.error || null,
    text: job.resultText || null,
    still_running: stillRunning,
    waited_ms: waitedMs,
    resume_hint,
    next_actions,
  };
}

/**
 * One subagent handoff: start background job, wait a SHORT slice, return result or still_running.
 * Long frontend/UI work continues via kimi_status / kimi_result (industry pattern: job + poll).
 */
async function rescueSubagent(args = {}) {
  const prompt = args.prompt || args.objective || "";
  if (!prompt) {
    throw new Error("prompt (or objective) is required");
  }
  const asGoal = Boolean(args.goal) || Boolean(args.objective && !args.prompt);
  const startCmd = asGoal
    ? ["goal", "--background", "--json"]
    : ["task", "--background", "--json"];
  pushCommonTaskArgs(startCmd, { ...args, goal: asGoal ? false : args.goal });
  startCmd.push("--", prompt);

  const { stdout: startOut } = await runCompanion(startCmd, { timeoutMs: 60_000 });
  const started = parseJsonLoose(startOut);
  if (!started?.jobId) {
    return textContent(startOut.trim() || "failed to start Kimi subagent");
  }

  const waitMs = resolveWaitMs(args.wait_timeout_ms, DEFAULT_RESCUE_WAIT_MS);

  // wait_timeout_ms <= 1 → start-only (immediate job id for pure async)
  if (waitMs <= 1) {
    const payload = buildJobPayload(
      { status: "running", phase: "queued" },
      started.jobId,
      { waitedMs: 0 },
    );
    payload.resume_hint =
      "Job started; poll kimi_status / kimi_result with jobId (no initial wait was requested).";
    return textContent(JSON.stringify(payload, null, 2));
  }

  const waitCmd = [
    "status",
    "--json",
    "--wait",
    "--wait-timeout",
    String(waitMs),
    started.jobId,
  ];
  if (args.cwd) {
    waitCmd.push("--cwd", args.cwd);
  }

  const { stdout: statusOut } = await runCompanion(waitCmd, {
    timeoutMs: waitMs + 30_000,
  });
  const job = parseJsonLoose(statusOut) || {};
  const payload = buildJobPayload(job, started.jobId, { waitedMs: waitMs });
  return textContent(JSON.stringify(payload, null, 2));
}

async function callTool(name, args = {}) {
  switch (name) {
    case "kimi_setup": {
      const { stdout } = await runCompanion(["setup", "--json"], { timeoutMs: 90_000 });
      return textContent(stdout.trim());
    }
    case "kimi_rescue": {
      return rescueSubagent(args);
    }
    case "kimi_task_start": {
      const cmd = ["task", "--background", "--json"];
      pushCommonTaskArgs(cmd, args);
      cmd.push("--", args.prompt || "");
      const { stdout } = await runCompanion(cmd, { timeoutMs: 60_000 });
      return textContent(stdout.trim());
    }
    case "kimi_goal_start": {
      const objective = args.objective || args.prompt;
      if (!objective) {
        throw new Error("objective (or prompt) is required");
      }
      const cmd = ["goal", "--background", "--json"];
      pushCommonTaskArgs(cmd, { ...args, goal: false });
      cmd.push("--", objective);
      const { stdout } = await runCompanion(cmd, { timeoutMs: 60_000 });
      return textContent(stdout.trim());
    }
    case "kimi_task": {
      const cmd = ["task", "--json"];
      pushCommonTaskArgs(cmd, args);
      if (args.timeout_ms) {
        cmd.push("--timeout", String(args.timeout_ms));
      }
      cmd.push("--", args.prompt || "");
      const { stdout } = await runCompanion(cmd, {
        timeoutMs: Math.max(Number(args.timeout_ms) || 0, 600_000) + 30_000,
      });
      return textContent(stdout.trim());
    }
    case "kimi_status": {
      const cmd = ["status", "--json"];
      const pollWait = args.wait
        ? resolveWaitMs(args.wait_timeout_ms, DEFAULT_POLL_WAIT_MS)
        : null;
      if (pollWait != null) {
        cmd.push("--wait", "--wait-timeout", String(pollWait));
      }
      if (args.all) {
        cmd.push("--all");
      }
      if (args.cwd) {
        cmd.push("--cwd", args.cwd);
      }
      if (args.job_id) {
        cmd.push(args.job_id);
      }
      const { stdout } = await runCompanion(cmd, {
        timeoutMs: pollWait != null ? pollWait + 30_000 : 30_000,
      });
      const parsed = parseJsonLoose(stdout);
      if (parsed && parsed.id && parsed.status === "running") {
        const enriched = buildJobPayload(parsed, parsed.id, { waitedMs: pollWait });
        return textContent(
          JSON.stringify(
            { ...parsed, ...enriched, text: parsed.resultText || null },
            null,
            2,
          ),
        );
      }
      return textContent(stdout.trim());
    }
    case "kimi_result": {
      const cmd = ["result", "--json"];
      const pollWait = args.wait
        ? resolveWaitMs(args.wait_timeout_ms, DEFAULT_POLL_WAIT_MS)
        : null;
      if (pollWait != null) {
        cmd.push("--wait", "--wait-timeout", String(pollWait));
      }
      if (args.cwd) {
        cmd.push("--cwd", args.cwd);
      }
      if (args.job_id) {
        cmd.push(args.job_id);
      }
      const { stdout } = await runCompanion(cmd, {
        timeoutMs: pollWait != null ? pollWait + 30_000 : 30_000,
      });
      return textContent(stdout.trim());
    }
    case "kimi_cancel": {
      const cmd = ["cancel", "--json"];
      if (args.cwd) {
        cmd.push("--cwd", args.cwd);
      }
      if (args.job_id) {
        cmd.push(args.job_id);
      }
      const { stdout } = await runCompanion(cmd, { timeoutMs: 30_000 });
      return textContent(stdout.trim());
    }
    case "kimi_sessions": {
      const cmd = ["sessions", "--json"];
      if (args.all) {
        cmd.push("--all");
      }
      if (args.cwd) {
        cmd.push("--cwd", args.cwd);
      }
      const { stdout } = await runCompanion(cmd, { timeoutMs: 60_000 });
      return textContent(stdout.trim());
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleRequest(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    okResult(id, {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "Local Kimi Code as a Codex subagent over ACP. " +
        "PRIMARY: kimi_rescue for frontend/UI/screenshot work — starts a durable job, short wait slice, " +
        "returns text if done OR still_running+jobId. " +
        "If still_running: poll kimi_status/kimi_result until completed — NEVER treat wait-slice end as failure, " +
        "and NEVER reimplement the same task in Codex while Kimi runs. " +
        "Visual follow-ups: kimi_rescue with resume:true + image/video paths. " +
        "Do not reimplement Kimi system prompts; tools/models/skills stay with Kimi Code.",
    });
    return;
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }

  if (method === "ping") {
    okResult(id, {});
    return;
  }

  if (method === "tools/list") {
    okResult(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    const name = params?.name;
    const toolArgs = params?.arguments || {};
    try {
      const result = await callTool(name, toolArgs);
      okResult(id, result);
    } catch (error) {
      okResult(id, {
        content: [{ type: "text", text: error?.message || String(error) }],
        isError: true,
      });
    }
    return;
  }

  if (id === undefined || id === null) {
    return;
  }
  errResult(id, -32601, `Method not found: ${method}`);
}

// --- stdio reader: Content-Length (LSP/MCP) first; NDJSON only when clearly JSON ---
let buffer = Buffer.alloc(0);

function dispatchMessage(msg) {
  Promise.resolve(handleRequest(msg)).catch((error) => {
    if (msg?.id !== undefined && msg?.id !== null) {
      errResult(msg.id, -32603, error?.message || String(error));
    }
  });
}

function bufferHeadLooksLikeContentLength(buf) {
  // Never NDJSON-split an in-progress Content-Length frame (partial headers used to
  // drop the "Content-Length:" line and break Codex handshake → 30s timeout, no tools).
  const head = buf.subarray(0, Math.min(buf.length, 48)).toString("utf8").trimStart();
  return /^content-length\s*:/i.test(head);
}

function bufferHeadLooksLikeJson(buf) {
  const head = buf.subarray(0, Math.min(buf.length, 8)).toString("utf8").trimStart();
  return head.startsWith("{");
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length) {
    if (bufferHeadLooksLikeContentLength(buffer) || buffer.indexOf(Buffer.from("Content-Length:")) === 0) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        // Wait for full headers — do not fall through to NDJSON.
        break;
      }
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        // Malformed header block; skip separator and keep scanning.
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + len) {
        break;
      }
      const body = buffer.subarray(bodyStart, bodyStart + len).toString("utf8");
      buffer = buffer.subarray(bodyStart + len);
      try {
        dispatchMessage(JSON.parse(body));
      } catch {
        // ignore malformed body
      }
      continue;
    }

    if (bufferHeadLooksLikeJson(buffer)) {
      const nl = buffer.indexOf("\n");
      if (nl === -1) {
        break;
      }
      const line = buffer.subarray(0, nl).toString("utf8").trim();
      buffer = buffer.subarray(nl + 1);
      if (!line) {
        continue;
      }
      try {
        dispatchMessage(JSON.parse(line));
      } catch {
        // ignore
      }
      continue;
    }

    // Skip leading noise until a known framing appears.
    const cl = buffer.indexOf(Buffer.from("Content-Length:"));
    const brace = buffer.indexOf(Buffer.from("{"));
    let skipTo = -1;
    if (cl !== -1 && brace !== -1) {
      skipTo = Math.min(cl, brace);
    } else if (cl !== -1) {
      skipTo = cl;
    } else if (brace !== -1) {
      skipTo = brace;
    }
    if (skipTo > 0) {
      buffer = buffer.subarray(skipTo);
      continue;
    }
    break;
  }
});

process.stdin.on("end", () => process.exit(0));
// Keep process alive for stdio MCP hosts.
process.stdin.resume();
