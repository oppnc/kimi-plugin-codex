/**
 * ACP client for `kimi acp` (NDJSON JSON-RPC over stdio).
 *
 * Methods used:
 * - initialize, session/new, session/load, session/resume, session/list
 * - session/set_config_option, session/prompt, session/cancel
 * - reverse-RPC session/request_permission
 */

import readline from "node:readline";

import { permissionPolicyForMode, pickPermissionOptionId } from "./permissions.mjs";
import { spawnKimiAcp, terminateProcessTree } from "./process.mjs";
import {
  buildContinueNudge,
  buildEmptyRecoveryNudge,
  isContinueStagnant,
  isEmptyTurn,
  looksIncompleteTurn,
  MAX_CONTINUE_NUDGES,
  mergeTurnResults,
  resolveEmptyRetries,
} from "./turn-policy.mjs";

/** Handshake / config only — not used for session/prompt work. */
const INIT_TIMEOUT_MS = 60 * 1000;
const PLUGIN_VERSION = "0.2.1";

/** Positive ms → enforce; null/undefined/≤0 → no ACP request deadline. */
function normalizeRequestTimeoutMs(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export class KimiAcpClient {
  /**
   * @param {object} options
   */
  constructor(options) {
    this.kimiBin = options.kimiBin;
    this.cwd = options.cwd;
    this.mode = options.mode || "yolo";
    this.model = options.model || null;
    this.thinking = options.thinking || null;
    this.permissionPolicy =
      options.permissionPolicy || permissionPolicyForMode(this.mode);
    this.requestTimeoutMs = normalizeRequestTimeoutMs(options.requestTimeoutMs);
    this.mcpServers = Array.isArray(options.mcpServers) ? options.mcpServers : [];
    this.onLog = options.onLog || (() => {});
    this.onUpdate = options.onUpdate || (() => {});
    // Test seam: allow injecting a fake spawn instead of the real kimi binary.
    this.spawnFn = options.spawnFn || spawnKimiAcp;
    this.spawnArgs = options.spawnArgs || null;

    this.proc = null;
    this.rl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
    this.agentMessage = [];
    this.toolCalls = [];
    this.stderr = "";
    this.sessionId = null;
    this.initResult = null;
    this.configOptions = null;
  }

  async start() {
    this.proc = this.spawnFn(this.kimiBin, {
      cwd: this.cwd,
      ...(this.spawnArgs || {}),
    });
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk) => {
      this.stderr += chunk;
      if (this.stderr.length > 200_000) {
        this.stderr = this.stderr.slice(-100_000);
      }
    });
    this.proc.on("error", (err) => this.#failAllPending(err));
    this.proc.on("exit", (code, signal) => {
      this.closed = true;
      this.#failAllPending(
        new Error(
          `kimi acp exited (${signal ? `signal ${signal}` : `code ${code}`}).` +
            (this.stderr ? `\n${this.stderr.slice(-2000)}` : ""),
        ),
      );
    });

    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this.#handleLine(line));

    this.initResult = await this.request(
      "initialize",
      {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
        },
        clientInfo: { name: "kimi-plugin-codex", version: PLUGIN_VERSION },
      },
      INIT_TIMEOUT_MS,
    );
    return this.initResult;
  }

  async newSession() {
    const result = await this.request(
      "session/new",
      { cwd: this.cwd, mcpServers: this.mcpServers },
      INIT_TIMEOUT_MS,
    );
    this.sessionId = result.sessionId;
    this.configOptions = result.configOptions || null;
    await this.#applySessionConfig();
    return result;
  }

  /**
   * Load on-disk session and replay history (ACP session/load).
   * @param {string} sessionId
   */
  async loadSession(sessionId) {
    const result = await this.request(
      "session/load",
      {
        cwd: this.cwd,
        sessionId,
        mcpServers: this.mcpServers,
      },
      INIT_TIMEOUT_MS,
    );
    this.sessionId = sessionId;
    this.configOptions = result.configOptions || null;
    await this.#applySessionConfig();
    return result;
  }

  /**
   * Resume without replaying history (ACP session/resume).
   * @param {string} sessionId
   */
  async resumeSession(sessionId) {
    const result = await this.request(
      "session/resume",
      {
        cwd: this.cwd,
        sessionId,
        mcpServers: this.mcpServers,
      },
      INIT_TIMEOUT_MS,
    );
    this.sessionId = sessionId;
    this.configOptions = result.configOptions || null;
    await this.#applySessionConfig();
    return result;
  }

  /**
   * @param {{ cwd?: string|null }} [opts]
   */
  async listSessions(opts = {}) {
    const params = {};
    if (opts.cwd) {
      params.cwd = opts.cwd;
    } else if (opts.cwd !== null) {
      params.cwd = this.cwd;
    }
    return this.request("session/list", params, INIT_TIMEOUT_MS);
  }

  /**
   * @param {string} text
   * @param {{ extraBlocks?: object[] }} [extra]
   */
  async prompt(text, extra = {}) {
    if (!this.sessionId) {
      throw new Error("No ACP session. Call newSession/loadSession/resumeSession first.");
    }
    this.agentMessage = [];
    this.toolCalls = [];

    const prompt = [];
    if (Array.isArray(extra.extraBlocks)) {
      prompt.push(...extra.extraBlocks);
    }
    if (text) {
      prompt.push({ type: "text", text });
    }
    if (!prompt.length) {
      throw new Error("prompt is empty");
    }

    const result = await this.request("session/prompt", {
      sessionId: this.sessionId,
      prompt,
    });

    return {
      stopReason: result?.stopReason ?? null,
      text: this.agentMessage.join(""),
      toolCalls: [...this.toolCalls],
      sessionId: this.sessionId,
      raw: result,
    };
  }

  async cancel() {
    if (!this.sessionId || this.closed) {
      return;
    }
    this.notify("session/cancel", { sessionId: this.sessionId });
  }

  async close() {
    this.closed = true;
    try {
      this.rl?.close();
    } catch {
      // ignore
    }
    this.rl = null;
    terminateProcessTree(this.proc);
    this.proc = null;
  }

  request(method, params, timeoutMs = this.requestTimeoutMs) {
    if (this.closed || !this.proc) {
      return Promise.reject(new Error("kimi acp client is closed."));
    }
    const id = this.nextId++;
    const limitMs = normalizeRequestTimeoutMs(timeoutMs);
    return new Promise((resolve, reject) => {
      let timer = null;
      if (limitMs != null) {
        timer = setTimeout(() => {
          if (!this.pending.has(id)) {
            return;
          }
          this.pending.delete(id);
          const tail = this.stderr
            ? `\nstderr tail:\n${this.stderr.slice(-2000)}`
            : "";
          const err = new Error(
            `ACP request timed out after ${limitMs}ms: ${method}${tail}`,
          );
          // Keep the session resumable: cancel the in-flight turn instead of
          // killing the process, and surface the session id so the caller can
          // --resume the same session afterwards.
          if (this.sessionId) {
            err.sessionId = this.sessionId;
            try {
              this.notify("session/cancel", { sessionId: this.sessionId });
            } catch {
              // best-effort; close() still tears the process down
            }
          }
          reject(err);
        }, limitMs);
      }

      this.pending.set(id, {
        resolve: (value) => {
          if (timer) clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
        method,
      });
      try {
        this.#send({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        if (timer) clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params) {
    if (this.closed || !this.proc) {
      return;
    }
    this.#send({ jsonrpc: "2.0", method, params });
  }

  async #applySessionConfig() {
    await this.#setConfigRequired("mode", this.mode);
    if (this.model) {
      await this.#setConfigRequired("model", this.model);
    }
    if (this.thinking) {
      await this.#setConfigRequired("thinking", this.thinking);
    }
  }

  async #setConfigRequired(configId, value) {
    try {
      await this.request(
        "session/set_config_option",
        { sessionId: this.sessionId, configId, value },
        INIT_TIMEOUT_MS,
      );
      this.onLog(`set_config_option ${configId}=${value}`);
      return;
    } catch (primaryError) {
      if (configId === "mode") {
        try {
          await this.request(
            "session/set_mode",
            { sessionId: this.sessionId, modeId: value },
            INIT_TIMEOUT_MS,
          );
          this.onLog(`session/set_mode ${value}`);
          return;
        } catch (fallbackError) {
          throw new Error(
            `Failed to set ACP mode=${value}: ${fallbackError?.message || fallbackError}` +
              ` (also: ${primaryError?.message || primaryError})`,
          );
        }
      }
      throw new Error(
        `Failed to set ACP ${configId}=${value}: ${primaryError?.message || primaryError}`,
      );
    }
  }

  #send(msg) {
    if (!this.proc?.stdin?.writable) {
      throw new Error("kimi acp stdin is not writable");
    }
    this.proc.stdin.write(`${JSON.stringify(msg)}\n`);
  }

  #failAllPending(err) {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  #handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      this.onLog(`non-json line from kimi acp: ${trimmed.slice(0, 200)}`);
      return;
    }

    if (msg.id != null && this.pending.has(msg.id) && (msg.result !== undefined || msg.error)) {
      const pending = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) {
        const err = new Error(msg.error.message || JSON.stringify(msg.error));
        err.data = msg.error;
        pending.reject(err);
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (msg.method && msg.id != null) {
      try {
        this.#handleReverseRequest(msg);
      } catch (error) {
        this.#send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32000, message: String(error?.message || error) },
        });
      }
      return;
    }

    if (msg.method === "session/update") {
      this.#handleSessionUpdate(msg.params);
    }
  }

  #handleReverseRequest(msg) {
    if (msg.method === "session/request_permission") {
      const optionId = pickPermissionOptionId(msg.params?.options || [], {
        policy: this.permissionPolicy,
        toolCall: msg.params?.toolCall,
      });
      this.#send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { outcome: { outcome: "selected", optionId } },
      });
      return;
    }

    if (msg.method === "fs/read_text_file" || msg.method === "fs/write_text_file") {
      this.#send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32601,
          message: "kimi-plugin-codex does not bridge editor buffers; use agent-local FS",
        },
      });
      return;
    }

    this.#send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `unsupported reverse method: ${msg.method}` },
    });
  }

  #handleSessionUpdate(params) {
    if (!params?.update) {
      return;
    }
    const update = params.update;
    this.onUpdate(update);

    const kind = update.sessionUpdate;
    if (kind === "agent_message_chunk") {
      const text = update.content?.text;
      if (text) {
        this.agentMessage.push(text);
      }
      return;
    }
    if (kind === "tool_call") {
      this.toolCalls.push({
        phase: "start",
        title: update.title || update.toolCallId || "tool",
        toolCallId: update.toolCallId || null,
        status: update.status || null,
        kind: update.kind || null,
      });
      return;
    }
    if (kind === "tool_call_update") {
      this.toolCalls.push({
        phase: "update",
        title: update.title || update.toolCallId || "tool",
        toolCallId: update.toolCallId || null,
        status: update.status || null,
        kind: update.kind || null,
      });
    }
  }
}

/**
 * One-shot or resume turn.
 *
 * Mode A: empty end_turn (no text, no tools) → fresh-session retry (new only).
 * Mode B: plan/read-only premature stop on action tasks → same-session continue nudge.
 *
 * @param {object} opts
 * @param {'new'|'load'|'resume'} [opts.sessionMode]
 * @param {string|null} [opts.sessionId]
 * @param {object[]} [opts.extraBlocks]
 * @param {boolean} [opts.asGoal]
 * @param {boolean} [opts.forceContinue] - override Mode B (default: env / on)
 */
export async function runKimiAcpTurn(opts) {
  const {
    kimiBin,
    cwd,
    prompt,
    mode = "yolo",
    model = null,
    thinking = null,
    requestTimeoutMs,
    sessionMode = "new",
    sessionId = null,
    extraBlocks = [],
    mcpServers = [],
    asGoal = false,
    forceContinue,
    emptyRetries,
    spawnFn,
    spawnArgs,
    onLog,
    onUpdate,
  } = opts;

  const clientOpts = {
    kimiBin,
    cwd,
    mode,
    model,
    thinking,
    permissionPolicy: permissionPolicyForMode(mode),
    requestTimeoutMs,
    mcpServers,
    spawnFn,
    spawnArgs,
    onLog,
    onUpdate,
  };

  /** @type {KimiAcpClient|null} */
  let client = new KimiAcpClient(clientOpts);

  try {
    let initOut = await client.start();
    if (sessionMode === "load") {
      if (!sessionId) {
        throw new Error("sessionMode=load requires sessionId");
      }
      await client.loadSession(sessionId);
    } else if (sessionMode === "resume") {
      if (!sessionId) {
        throw new Error("sessionMode=resume requires sessionId");
      }
      await client.resumeSession(sessionId);
    } else {
      await client.newSession();
    }

    let result = await client.prompt(prompt, { extraBlocks });
    let configOptions = client.configOptions;
    let stderrTail = client.stderr.slice(-4000);
    let emptyRetried = false;
    let emptyRecoveryNudged = false;
    let continueCount = 0;
    let incompleteContinued = false;
    /** @type {string|null} */
    let incompleteReason = null;

    // ── Mode A: empty completion ──────────────────────────────────────────
    // Kimi Code intermittently returns stopReason=end_turn with *zero*
    // agent_message_chunk / tool_call events (Moonshot #1485). Instrumented
    // runs: empty turns only see available_commands_update + config_option_update.
    // Not a host readline race. Retry on a brand-new session (new only).
    // Peer note: Claude ACP can reassemble message.result; Kimi empty turns
    // have no recoverable body — only retry + same-session recovery nudge.
    const retryBudget = resolveEmptyRetries(emptyRetries);
    if (isEmptyTurn(result) && sessionMode === "new" && retryBudget > 0) {
      for (
        let attempt = 1;
        attempt <= retryBudget && isEmptyTurn(result);
        attempt++
      ) {
        emptyRetried = true;
        onLog?.(
          `empty ACP agent text (no agent_message_chunk); retry ${attempt}/${retryBudget} on a new session`,
        );
        await client.close();
        client = new KimiAcpClient(clientOpts);
        initOut = await client.start();
        await client.newSession();
        // Media blocks re-sent on each fresh session (new session has no prior context).
        result = await client.prompt(prompt, { extraBlocks });
        configOptions = client.configOptions;
        stderrTail = client.stderr.slice(-4000);
      }

      // Same-session recovery (Copilot/OpenDev-style synthetic continue for empty).
      // Only after fresh-session retries still empty; one shot, then surface failure.
      if (isEmptyTurn(result) && client && !client.closed) {
        emptyRecoveryNudged = true;
        onLog?.(
          "empty ACP agent text after fresh-session retries; same-session empty recovery nudge",
        );
        const recovered = await client.prompt(buildEmptyRecoveryNudge());
        stderrTail = client.stderr.slice(-4000);
        result = mergeTurnResults(result, recovered);
        // If still empty after merge, keep empty signature for host.
        if (
          !String(result.text || "").trim() &&
          (!result.toolCalls || result.toolCalls.length === 0)
        ) {
          result = {
            ...result,
            text: "",
            toolCalls: result.toolCalls || [],
            stopReason: result.stopReason || "end_turn",
          };
        }
      }
    }

    // ── Mode B: force continue on incomplete action work ──────────────────
    // Same session (not fresh): peers inject a synthetic nudge when the model
    // stops after plan text or read-only tools without mutating the workspace.
    // Skip plan mode (plan text is the deliverable). Disable via forceContinue:false
    // or KIMI_FORCE_CONTINUE=0.
    const modeBCtx = {
      prompt,
      mode,
      asGoal,
      enabled: forceContinue,
    };
    let incomplete = looksIncompleteTurn(result, modeBCtx);
    while (
      incomplete.incomplete &&
      continueCount < MAX_CONTINUE_NUDGES &&
      client &&
      !client.closed
    ) {
      incompleteReason = incomplete.reason;
      const prevSnapshot = {
        text: result.text,
        toolCalls: result.toolCalls,
      };
      continueCount += 1;
      incompleteContinued = true;
      const nudge = buildContinueNudge(incomplete.reason);
      onLog?.(
        `incomplete ACP turn (${incomplete.reason}); continue nudge ${continueCount}/${MAX_CONTINUE_NUDGES}`,
      );
      const next = await client.prompt(nudge);
      stderrTail = client.stderr.slice(-4000);
      if (isContinueStagnant(prevSnapshot, next)) {
        onLog?.("continue nudge stagnant (no new tools / no progress); stop Mode B");
        result = mergeTurnResults(result, next);
        break;
      }
      result = mergeTurnResults(result, next);
      incomplete = looksIncompleteTurn(result, modeBCtx);
      if (!incomplete.incomplete) {
        incompleteReason = null;
      }
    }

    if (incomplete.incomplete && incomplete.reason) {
      incompleteReason = incomplete.reason;
    }

    return {
      init: initOut,
      ...result,
      configOptions,
      mode,
      sessionMode,
      emptyAgentText: isEmptyTurn(result),
      emptyRetried,
      emptyRecoveryNudged,
      incompleteContinued,
      continueCount,
      incompleteReason,
      stderrTail,
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * List sessions only (short-lived ACP process).
 */
export async function listKimiSessions({ kimiBin, cwd }) {
  const client = new KimiAcpClient({
    kimiBin,
    cwd,
    mode: "default",
  });
  try {
    await client.start();
    return await client.listSessions({ cwd });
  } finally {
    await client.close();
  }
}
