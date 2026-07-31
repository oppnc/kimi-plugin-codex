/**
 * Companion CLI-level tests. No Kimi, no Claude Code, no Codex needed — they
 * drive the real kimi-companion.mjs binary against a throwaway data dir with
 * hand-written job files. Covers host-facing contracts that lib unit tests
 * cannot reach: status/result/cancel exit codes, --wait-timeout, orphan
 * reconciliation, cancel state preservation, and the failed-job resume hint.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const COMPANION = path.join(ROOT, "plugins", "kimi", "scripts", "kimi-companion.mjs");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-companion-cli-"));
const jobsDir = path.join(tmpRoot, "jobs");
fs.mkdirSync(jobsDir, { recursive: true });

function run(args, { cwd = tmpRoot } = {}) {
  const r = spawnSync(process.execPath, [COMPANION, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
    env: {
      ...process.env,
      // The cc package reads KIMI_PLUGIN_CC_DATA_DIR, the codex package reads
      // KIMI_PLUGIN_CODEX_DATA_DIR — set both so this test works against either.
      KIMI_PLUGIN_CC_DATA_DIR: tmpRoot,
      KIMI_PLUGIN_CODEX_DATA_DIR: tmpRoot,
      // Pin PWD so resolveWorkspaceRoot picks the temp dir, not the repo root.
      PWD: tmpRoot,
      KIMI_CLI_PATH: path.join(tmpRoot, "definitely-missing-kimi.exe"),
    },
  });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function writeJob(job) {
  const file = path.join(jobsDir, `${job.id}.json`);
  fs.writeFileSync(file, JSON.stringify(job, null, 2), "utf8");
}

function job(id, overrides = {}) {
  return {
    id,
    status: "completed",
    phase: "completed",
    cwd: tmpRoot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    prompt: "test job",
    promptPreview: "test job",
    sessionId: null,
    resultText: "done",
    stopReason: "end_turn",
    toolEventCount: 0,
    error: null,
    pid: null,
    ...overrides,
  };
}

test("--help exits 0 and documents --empty-retries and wait contract", () => {
  const r = run(["--help"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /--empty-retries <n>/);
  assert.match(r.stdout, /wait budget/);
  assert.match(r.stdout, /--wait-timeout/);
});

test("unknown task flag exits 1 with a clear message (no Kimi needed)", () => {
  const r = run(["task", "--mode", "yolo", "--backgroundd", "fix it"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr || r.stdout, /Unknown task option\(s\): --backgroundd/);
});

test("status on a completed job exits 0 and prints job fields", () => {
  writeJob(job("job-cli-completed"));
  const r = run(["status", "job-cli-completed", "--json"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /"status": "completed"/);
  assert.match(r.stdout, /"id": "job-cli-completed"/);
});

test("status on a missing job exits 1", () => {
  const r = run(["status", "job-cli-nope", "--json"]);
  assert.equal(r.code, 1);
});

test("result on a completed job exits 0 and includes the stored text", () => {
  writeJob(job("job-cli-result-ok"));
  const r = run(["result", "job-cli-result-ok"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /done/);
});

test("result on a failed job exits 1", () => {
  writeJob(job("job-cli-result-fail", { status: "failed", error: "boom" }));
  const r = run(["result", "job-cli-result-fail"]);
  assert.equal(r.code, 1);
});

test("status --wait returns 0 for a finished job", () => {
  writeJob(job("job-cli-wait-done", { status: "completed" }));
  const r = run(["status", "job-cli-wait-done", "--wait", "--wait-timeout", "1000"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /completed/);
});

test("status --wait exits 1 when the job is still running after the wait budget", () => {
  // pid null + freshly created → inside the orphan grace window, stays running.
  writeJob(
    job("job-cli-wait-running", {
      status: "running",
      phase: "running",
      pid: null,
      createdAt: new Date().toISOString(),
    }),
  );
  const r = run([
    "status",
    "job-cli-wait-running",
    "--wait",
    "--wait-timeout",
    "500",
    "--json",
  ]);
  assert.equal(r.code, 1, "wait timeout on a running job must be non-zero");
  assert.match(r.stdout, /"status": "running"/);
});

test("result --wait exits 1 when the job is still running after the wait budget", () => {
  writeJob(
    job("job-cli-result-wait-running", {
      status: "running",
      phase: "running",
      pid: null,
      createdAt: new Date().toISOString(),
    }),
  );
  const r = run(["result", "job-cli-result-wait-running", "--wait", "--wait-timeout", "500"]);
  assert.equal(r.code, 1, "result --wait on a still-running job must be non-zero");
});

test("orphan reconciliation: dead runner pid flips running → failed orphaned", () => {
  writeJob(
    job("job-cli-orphan", {
      status: "running",
      phase: "running",
      pid: 999999999, // guaranteed not alive
      createdAt: new Date(0).toISOString(), // outside the no-pid grace
    }),
  );
  // `status <id>` exists → exit 0; reconciliation rewrites the stored job.
  const r = run(["status", "job-cli-orphan", "--json"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /"status": "failed"/);
  assert.match(r.stdout, /"orphaned": true/);
  const file = JSON.parse(fs.readFileSync(path.join(jobsDir, "job-cli-orphan.json"), "utf8"));
  assert.equal(file.status, "failed");
  assert.equal(file.orphaned, true);
});

test("cancel flips running → cancelled and reconciliation never overwrites it", () => {
  // Freshly created + pid null → inside the orphan grace window, so the job is
  // still running when cancel runs (reconcile must not pre-flip it to failed).
  writeJob(
    job("job-cli-cancel", {
      status: "running",
      phase: "running",
      pid: null,
      createdAt: new Date().toISOString(),
    }),
  );
  const c = run(["cancel", "job-cli-cancel", "--json"]);
  assert.equal(c.code, 0);
  assert.match(c.stdout, /"status": "cancelled"/);
  const cancelled = JSON.parse(
    fs.readFileSync(path.join(jobsDir, "job-cli-cancel.json"), "utf8"),
  );
  assert.equal(cancelled.status, "cancelled");
  // Bump the job outside the grace window, then a status call triggers
  // reconcileStaleJobs — the cancelled job is terminal and must NOT be
  // overwritten to failed (the cancel-race guard).
  cancelled.createdAt = new Date(0).toISOString();
  fs.writeFileSync(
    path.join(jobsDir, "job-cli-cancel.json"),
    JSON.stringify(cancelled, null, 2),
    "utf8",
  );
  const s = run(["status", "job-cli-cancel", "--json"]);
  assert.equal(s.code, 0);
  assert.match(s.stdout, /"status": "cancelled"/);
  assert.doesNotMatch(s.stdout, /"status": "failed"/);
});

test("failed job that kept its session shows a resume hint in result", () => {
  writeJob(
    job("job-cli-resume-hint", {
      status: "failed",
      sessionId: "session_cli_1",
      error: "ACP request timed out after 1ms",
    }),
  );
  const r = run(["result", "job-cli-resume-hint"]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /kept its session/);
  assert.match(r.stdout, /--resume/);
});

test("status with no id lists recent jobs for the workspace", () => {
  writeJob(job("job-cli-list"));
  const r = run(["status"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /job-cli-list/);
});
