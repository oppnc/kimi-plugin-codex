/**
 * Optional git context attachment (not a review rubric — raw facts for Kimi).
 */

import { spawnSync } from "node:child_process";

function runGit(cwd, args, maxChars = 80_000) {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
  if (r.status !== 0) {
    return { ok: false, text: (r.stderr || r.stdout || "").trim() };
  }
  let text = (r.stdout || "").trim();
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n…[truncated ${text.length - maxChars} chars]`;
  }
  return { ok: true, text };
}

/**
 * @param {string} cwd
 * @param {{ base?: string|null }} [opts]
 * @returns {string} markdown/text block or empty string
 */
export function collectGitContext(cwd, opts = {}) {
  const inside = runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.text !== "true") {
    return "";
  }

  const parts = ["<git-context>"];
  const status = runGit(cwd, ["status", "--short", "--untracked-files=all"]);
  if (status.ok) {
    parts.push("## git status --short");
    parts.push(status.text || "(clean)");
  }

  const base = opts.base?.trim();
  if (base) {
    const diff = runGit(cwd, ["diff", `${base}...HEAD`, "--stat"]);
    const diffFull = runGit(cwd, ["diff", `${base}...HEAD`], 120_000);
    if (diff.ok) {
      parts.push(`## git diff --stat ${base}...HEAD`);
      parts.push(diff.text || "(empty)");
    }
    if (diffFull.ok && diffFull.text) {
      parts.push(`## git diff ${base}...HEAD`);
      parts.push(diffFull.text);
    }
  } else {
    const staged = runGit(cwd, ["diff", "--cached"], 60_000);
    const unstaged = runGit(cwd, ["diff"], 60_000);
    if (staged.ok && staged.text) {
      parts.push("## git diff --cached");
      parts.push(staged.text);
    }
    if (unstaged.ok && unstaged.text) {
      parts.push("## git diff");
      parts.push(unstaged.text);
    }
  }

  parts.push("</git-context>");
  if (parts.length <= 2) {
    return "";
  }
  return parts.join("\n");
}
