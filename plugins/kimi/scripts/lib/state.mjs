import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function defaultDataDir() {
  return path.join(os.homedir(), ".kimi-plugin-codex");
}

export function getDataDir() {
  return process.env.KIMI_PLUGIN_CODEX_DATA_DIR?.trim() || defaultDataDir();
}

export function getJobsDir() {
  return path.join(getDataDir(), "jobs");
}

export function getLogsDir() {
  return path.join(getDataDir(), "logs");
}

export function ensureDataDirs() {
  fs.mkdirSync(getJobsDir(), { recursive: true });
  fs.mkdirSync(getLogsDir(), { recursive: true });
}

export function jobLogPath(jobId) {
  const safe = String(jobId).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== jobId) {
    throw new Error(`Invalid job id: ${jobId}`);
  }
  return path.join(getLogsDir(), `${safe}.log`);
}

export function generateJobId() {
  return `job-${crypto.randomBytes(6).toString("hex")}`;
}

export function jobPath(jobId) {
  // Prevent path traversal via job id
  const safe = String(jobId).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== jobId) {
    throw new Error(`Invalid job id: ${jobId}`);
  }
  return path.join(getJobsDir(), `${safe}.json`);
}

export function writeJob(job) {
  ensureDataDirs();
  const file = jobPath(job.id);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(job, null, 2), "utf8");
  fs.renameSync(tmp, file);
  pruneJobs();
  return file;
}

/** Keep the jobs dir bounded (best-effort, newest N by mtime survive). */
const MAX_JOB_FILES = 100;
/** Throttle prune scans so frequent writes (heartbeats) stay cheap. */
const PRUNE_THROTTLE_MS = 30_000;
let lastPruneAt = 0;

/**
 * Prune the oldest job files (and their log files) past MAX_JOB_FILES.
 * Best-effort; throttled to at most one scan per PRUNE_THROTTLE_MS unless
 * `force` is set (used by tests / explicit maintenance).
 * @param {boolean} [force]
 */
export function pruneJobs(force = false) {
  try {
    const now = Date.now();
    if (!force && now - lastPruneAt < PRUNE_THROTTLE_MS) {
      return;
    }
    lastPruneAt = now;
    const dir = getJobsDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (files.length <= MAX_JOB_FILES) {
      return;
    }
    const byMtime = files
      .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const old of byMtime.slice(MAX_JOB_FILES)) {
      fs.rmSync(path.join(dir, old.f), { force: true });
      // Remove the matching runner log so ~/.kimi-plugin-*/logs stays bounded too.
      const log = path.join(getLogsDir(), old.f.replace(/\.json$/, ".log"));
      fs.rmSync(log, { force: true });
    }
  } catch {
    // best-effort
  }
}

export function readJob(jobId) {
  try {
    const file = jobPath(jobId);
    if (!fs.existsSync(file)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function listJobs({ cwd, limit = 20 } = {}) {
  ensureDataDirs();
  const dir = getJobsDir();
  let files = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }

  const jobs = [];
  for (const file of files) {
    try {
      const job = JSON.parse(fs.readFileSync(file, "utf8"));
      if (cwd && job.cwd && path.resolve(job.cwd) !== path.resolve(cwd)) {
        continue;
      }
      jobs.push(job);
    } catch {
      // skip corrupt
    }
  }
  jobs.sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")),
  );
  return jobs.slice(0, limit);
}

export function nowIso() {
  return new Date().toISOString();
}
