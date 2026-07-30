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
 * Primary subagent path: kimi_rescue (start + wait for result).
 * Fallback for multi-MCP-timeout work: kimi_task_start → kimi_status → kimi_result.
 * Codex default tool_timeout_sec is 60s unless raised (plugin .mcp.json sets 600).
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPANION = join(__dirname, "kimi-companion.mjs");
const SERVER_NAME = "kimi-plugin-codex";
const SERVER_VERSION = "0.1.3";

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
      "PRIMARY happy path: hand frontend/UI, screenshot or video visual bugs, multimodal, or multi-file " +
      "implementation to local Kimi Code (subagent) and wait for its result. " +
      "Prefer this over implementing frontend/UI yourself when Kimi is available. " +
      "Forwards the user task over ACP (Kimi keeps tools/models/skills). " +
      "If still running when the wait budget ends, returns job_id for kimi_status/kimi_result.",
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
            "Max ms to wait for the subagent (default 540000). Stay under Codex MCP tool_timeout_sec.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_task_start",
    description:
      "Start Kimi Code in the background and return job_id immediately. " +
      "Use only when kimi_rescue wait budget is too short or the user asked to detach. " +
      "Then poll kimi_status / kimi_result.",
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
      "Start a long-horizon Kimi Goal in the background (subagent). Returns job_id. Prefer kimi_rescue with goal=true when wait budget allows.",
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
      "SHORT synchronous Kimi turn only. Prefer kimi_rescue for normal work.",
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
      "Subagent job status (phase, progress, tools). Use after kimi_task_start or if kimi_rescue timed out still running.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        cwd: { type: "string" },
        wait: { type: "boolean", description: "Block until job finishes (within tool timeout)." },
        all: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "kimi_result",
    description: "Fetch stored result for a job (or latest for this workspace).",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        cwd: { type: "string" },
        wait: { type: "boolean" },
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

/**
 * One subagent handoff: start background job, wait for terminal status, return result payload.
 * If still running after wait budget, return job_id for continued polling (Codex MCP timeout).
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

  const waitMsRaw = Number(args.wait_timeout_ms);
  const waitMs =
    Number.isFinite(waitMsRaw) && waitMsRaw > 0
      ? Math.min(waitMsRaw, 540_000)
      : 540_000;

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

  const payload = {
    subagent: "kimi-code",
    jobId: started.jobId,
    status: job.status || "unknown",
    phase: job.phase || null,
    sessionId: job.sessionId || null,
    stopReason: job.stopReason || null,
    toolEventCount: job.toolEventCount ?? null,
    lastProgressMessage: job.lastProgressMessage || null,
    orphaned: job.orphaned || false,
    error: job.error || null,
    // Verbatim subagent output for the host to show the user
    text: job.resultText || null,
    still_running: job.status === "running",
    resume_hint:
      job.status === "completed" && job.sessionId
        ? "If the objective looks unfinished, call kimi_rescue again with resume:true (or session)."
        : job.status === "running"
          ? "Subagent still running; poll kimi_status / kimi_result with this jobId, or call kimi_rescue wait again."
          : null,
  };

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
      if (args.wait) {
        cmd.push("--wait");
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
        timeoutMs: args.wait ? 600_000 : 30_000,
      });
      return textContent(stdout.trim());
    }
    case "kimi_result": {
      const cmd = ["result", "--json"];
      if (args.wait) {
        cmd.push("--wait");
      }
      if (args.cwd) {
        cmd.push("--cwd", args.cwd);
      }
      if (args.job_id) {
        cmd.push(args.job_id);
      }
      const { stdout } = await runCompanion(cmd, {
        timeoutMs: args.wait ? 600_000 : 30_000,
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
        "PRIMARY: kimi_rescue — one handoff, wait for Kimi's result, return text verbatim. " +
        "Do not reimplement Kimi system prompts; tools/models/skills stay with Kimi Code. " +
        "If kimi_rescue is still_running, continue with kimi_status/kimi_result (or another rescue with resume). " +
        "kimi_task_start is only for explicit detach / multi-timeout work.",
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
