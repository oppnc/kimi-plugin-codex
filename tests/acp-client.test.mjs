/**
 * ACP client behavior with a fake `kimi acp` binary:
 *  - request timeout keeps the session resumable (err.sessionId) and sends
 *    session/cancel instead of silently dropping the thread;
 *  - Mode A empty-turn retry budget is configurable (emptyRetries).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { KimiAcpClient, runKimiAcpTurn } from "../plugins/kimi/scripts/lib/acp-client.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "fake-kimi-acp.mjs");

function makeSpawn(env = {}) {
  return (bin, opts) =>
    spawn(bin, [FIXTURE], {
      ...opts,
      env: { ...opts.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Poll for a file up to timeoutMs (fixed sleeps are racy on CI runners). */
async function waitForFile(file, timeoutMs = 3000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return fs.existsSync(file);
}

test("request timeout: keeps session resumable and cancels the in-flight turn", async () => {
  const tmp = tmpDir("kimi-acp-timeout-");
  const cancelFile = path.join(tmp, "cancel.txt");
  // Use the raw client (not runKimiAcpTurn) so teardown stays in this test's
  // hands: after the timeout the child needs a moment to process the
  // session/cancel line before we close the process (kill would race it).
  const client = new KimiAcpClient({
    kimiBin: process.execPath,
    cwd: tmp,
    mode: "yolo",
    requestTimeoutMs: 400,
    spawnFn: makeSpawn({ TIMEOUT_PROMPT: "1", CANCEL_FILE: cancelFile }),
  });
  try {
    await client.start();
    await client.newSession();
    await assert.rejects(
      client.prompt("hello"),
      (err) => {
        assert.match(err.message, /timed out after 400ms/);
        // The ACP session survives the timeout → caller can --resume it.
        assert.equal(err.sessionId, "session_test_1");
        return true;
      },
    );
    // The client must have told Kimi to cancel the turn before tearing down.
    assert.ok(await waitForFile(cancelFile), "session/cancel should be sent on timeout");
    assert.match(fs.readFileSync(cancelFile, "utf8"), /cancel/);
  } finally {
    await client.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("emptyRetries budget: empty turns retried on fresh sessions, then recovered", async () => {
  const tmp = tmpDir("kimi-acp-retry-");
  const counter = path.join(tmp, "counter.txt");
  try {
    const result = await runKimiAcpTurn({
      kimiBin: process.execPath,
      cwd: tmp,
      prompt: "hello",
      mode: "yolo",
      sessionMode: "new",
      emptyRetries: 2,
      spawnFn: makeSpawn({ EMPTY_TURNS: "2", COUNTER_FILE: counter }),
    });
    assert.equal(result.emptyRetried, true);
    assert.equal(result.emptyAgentText, false);
    assert.match(result.text, /fake done/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("emptyRetries=0 disables Mode A retry entirely", async () => {
  const tmp = tmpDir("kimi-acp-noretry-");
  try {
    const result = await runKimiAcpTurn({
      kimiBin: process.execPath,
      cwd: tmp,
      prompt: "hello",
      mode: "yolo",
      sessionMode: "new",
      emptyRetries: 0,
      spawnFn: makeSpawn({ EMPTY_TURNS: "999" }),
    });
    assert.equal(result.emptyRetried, false);
    assert.equal(result.emptyAgentText, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
