#!/usr/bin/env node
/**
 * Fake `kimi acp` NDJSON JSON-RPC server for tests. Emulates the ACP surface
 * the companion depends on:
 *   initialize / session/new / session/load / session/resume
 *   session/set_config_option / session/prompt / session/cancel (notification)
 *
 * Behavior is controlled by env:
 *   TIMEOUT_PROMPT=1   → never answer session/prompt (drives the request timeout path)
 *   EMPTY_TURNS=<n>    → answer the first <n> session/prompt calls with an empty
 *                        end_turn (no agent text), then stream real text. The
 *                        count is shared across spawned processes via COUNTER_FILE
 *                        so retry loops on fresh clients keep counting up.
 *   COUNTER_FILE=<path>  shared prompt counter (append-only int)
 *   CANCEL_FILE=<path>   append a line when session/cancel is received
 */
import readline from "node:readline";
import fs from "node:fs";

const SESSION_ID = process.env.SESSION_ID || "session_test_1";

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function respond(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function respondError(id, message) {
  send({ jsonrpc: "2.0", id, error: { code: -32601, message } });
}

function bumpCounter() {
  const file = process.env.COUNTER_FILE;
  if (!file) {
    return 1;
  }
  let n = 0;
  try {
    n = parseInt(fs.readFileSync(file, "utf8").trim(), 10) || 0;
  } catch {
    // first call
  }
  n += 1;
  fs.writeFileSync(file, String(n), "utf8");
  return n;
}

function noteCancel() {
  const file = process.env.CANCEL_FILE;
  if (file) {
    fs.appendFileSync(file, `cancel\n`, "utf8");
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  const method = msg.method;
  if (msg.id != null) {
    if (method === "initialize") {
      respond(msg.id, {
        protocolVersion: 1,
        agentInfo: { name: "fake-kimi", version: "1.0.0" },
        agentCapabilities: {},
      });
      return;
    }
    if (
      method === "session/new" ||
      method === "session/load" ||
      method === "session/resume"
    ) {
      respond(msg.id, { sessionId: SESSION_ID, configOptions: [] });
      return;
    }
    if (method === "session/set_config_option") {
      respond(msg.id, {});
      return;
    }
    if (method === "session/prompt") {
      if (process.env.TIMEOUT_PROMPT === "1") {
        // Never respond — the client's request deadline fires instead.
        return;
      }
      const count = bumpCounter();
      const emptyTurns = parseInt(process.env.EMPTY_TURNS || "0", 10);
      if (count <= emptyTurns) {
        // Empty end_turn: no agent_message_chunk update, no tools.
        respond(msg.id, { stopReason: "end_turn" });
        return;
      }
      send({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          update: { sessionUpdate: "agent_message_chunk", content: { text: "fake done" } },
        },
      });
      respond(msg.id, { stopReason: "end_turn" });
      return;
    }
    respondError(msg.id, `unsupported: ${method}`);
    return;
  }

  if (method === "session/cancel") {
    noteCancel();
  }
});
rl.on("close", () => process.exit(0));
