/**
 * Resolve the workspace directory Kimi should edit.
 * Prefer explicit --cwd, then well-known host env vars, then process.cwd().
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/** Host env vars that often carry the project root (order = priority). */
const HOST_CWD_ENV = [
  "KIMI_WORKSPACE",
  "CODEX_WORKSPACE",
  "CODEX_CWD",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_CODE_CWD",
  "CLAUDE_CWD",
  "GROK_WORKSPACE",
  "GROK_CWD",
  "PWD",
];

function isDir(p) {
  try {
    return Boolean(p) && fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string|null|undefined} explicit
 * @returns {string}
 */
export function resolveWorkspaceRoot(explicit) {
  if (explicit) {
    return path.resolve(String(explicit));
  }
  for (const key of HOST_CWD_ENV) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const abs = path.resolve(raw);
    if (isDir(abs)) {
      return abs;
    }
  }
  return path.resolve(process.cwd());
}

/**
 * Debug/setup helper: which source won.
 * @param {string|null|undefined} explicit
 */
export function describeWorkspaceRoot(explicit) {
  if (explicit) {
    return {
      cwd: path.resolve(String(explicit)),
      source: "explicit",
      envKey: null,
    };
  }
  for (const key of HOST_CWD_ENV) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const abs = path.resolve(raw);
    if (isDir(abs)) {
      return { cwd: abs, source: "env", envKey: key };
    }
  }
  return {
    cwd: path.resolve(process.cwd()),
    source: "process.cwd",
    envKey: null,
  };
}
