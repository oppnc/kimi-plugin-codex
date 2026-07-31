import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-plugin-cc-state-"));
process.env.KIMI_PLUGIN_CC_DATA_DIR = tmpRoot;

const {
  generateJobId,
  writeJob,
  readJob,
  listJobs,
  jobPath,
  getJobsDir,
  getLogsDir,
  jobLogPath,
  ensureDataDirs,
  pruneJobs,
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

  it("prune removes oldest jobs AND their log files", () => {
    ensureDataDirs();
    // Reset both dirs so only this test's files exist.
    for (const f of fs.readdirSync(getJobsDir())) {
      fs.rmSync(path.join(getJobsDir(), f), { force: true });
    }
    for (const f of fs.readdirSync(getLogsDir())) {
      fs.rmSync(path.join(getLogsDir(), f), { force: true });
    }
    // MAX_JOB_FILES is 100 — write 104 so the 4 oldest get pruned, together
    // with their log files; the 100 newest survive.
    const ids = [];
    for (let i = 0; i < 104; i += 1) {
      const id = generateJobId();
      ids.push(id);
      fs.writeFileSync(jobLogPath(id), "log", "utf8");
      writeJob({
        id,
        status: "completed",
        cwd: tmpRoot,
        createdAt: `t${i}`,
        updatedAt: `t${i}`,
      });
    }
    // Make the first 4 oldest deterministically (older mtime) and the rest newer.
    const old = new Date(Date.now() - 60_000);
    const fresh = new Date(Date.now() + 60_000);
    for (let i = 0; i < ids.length; i += 1) {
      const t = i < 4 ? old : fresh;
      fs.utimesSync(jobPath(ids[i]), t, t);
      fs.utimesSync(jobLogPath(ids[i]), t, t);
    }
    pruneJobs(true);
    for (let i = 4; i < ids.length; i += 1) {
      assert.ok(fs.existsSync(jobPath(ids[i])), `kept job ${ids[i]} should exist`);
      assert.ok(fs.existsSync(jobLogPath(ids[i])), `kept log ${ids[i]} should exist`);
    }
    for (let i = 0; i < 4; i += 1) {
      assert.ok(!fs.existsSync(jobPath(ids[i])), `pruned job ${ids[i]} should be gone`);
      assert.ok(!fs.existsSync(jobLogPath(ids[i])), `pruned log ${ids[i]} should be gone`);
    }
  });

  it("prune is throttled unless forced (heartbeat writes stay cheap)", () => {
    ensureDataDirs();
    // Clear any stale files, then MAX_JOB_FILES (100) + 25 extra.
    for (const f of fs.readdirSync(getJobsDir())) {
      fs.rmSync(path.join(getJobsDir(), f), { force: true });
    }
    for (let i = 0; i < 125; i += 1) {
      const id = generateJobId();
      writeJob({
        id,
        status: "completed",
        cwd: tmpRoot,
        createdAt: `t${i}`,
        updatedAt: `t${i}`,
      });
    }
    assert.equal(
      fs.readdirSync(getJobsDir()).filter((f) => f.endsWith(".json")).length,
      125,
    );
    // Non-forced call within the throttle window must not scan/prune.
    pruneJobs(false);
    assert.equal(
      fs.readdirSync(getJobsDir()).filter((f) => f.endsWith(".json")).length,
      125,
    );
    // Forced call prunes down to the cap.
    pruneJobs(true);
    assert.ok(
      fs.readdirSync(getJobsDir()).filter((f) => f.endsWith(".json")).length <= 100,
      "forced prune should respect MAX_JOB_FILES",
    );
  });
});
