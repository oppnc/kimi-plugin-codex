import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-plugin-codex-state-"));
process.env.KIMI_PLUGIN_CODEX_DATA_DIR = tmpRoot;

const {
  generateJobId,
  writeJob,
  readJob,
  listJobs,
  jobPath,
  getLogsDir,
  jobLogPath,
  ensureDataDirs,
} = await import("../plugins/kimi/scripts/lib/state.mjs");

describe("state jobs", () => {
  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("writes and reads a job atomically", () => {
    const id = generateJobId();
    writeJob({
      id,
      status: "completed",
      cwd: tmpRoot,
      createdAt: "t0",
      updatedAt: "t1",
    });
    const job = readJob(id);
    assert.equal(job.id, id);
    assert.equal(job.status, "completed");
    assert.ok(fs.existsSync(jobPath(id)));
  });

  it("rejects path-traversal job ids", () => {
    assert.throws(() => jobPath("../evil"), /Invalid job id/);
  });

  it("lists newest first filtered by cwd", () => {
    const cwdA = path.join(tmpRoot, "proj-a");
    const cwdB = path.join(tmpRoot, "proj-b");
    const a = generateJobId();
    const b = generateJobId();
    writeJob({ id: a, status: "completed", cwd: cwdA, createdAt: "1", updatedAt: "1" });
    writeJob({ id: b, status: "completed", cwd: cwdB, createdAt: "2", updatedAt: "9" });
    const onlyB = listJobs({ cwd: cwdB, limit: 10 });
    assert.ok(onlyB.length >= 1);
    assert.ok(onlyB.every((j) => path.resolve(j.cwd) === path.resolve(cwdB)));
  });

  it("creates logs dir and job log path under data dir", () => {
    ensureDataDirs();
    assert.ok(fs.existsSync(getLogsDir()));
    const id = generateJobId();
    assert.ok(jobLogPath(id).includes(id));
    assert.ok(jobLogPath(id).endsWith(".log"));
  });
});
