/**
 * Standardized, actionable errors for agents and humans.
 * Keep messages short, fixes numbered, and stable codes for JSON consumers.
 */

export const ERROR_CODES = {
  BINARY_NOT_FOUND: "BINARY_NOT_FOUND",
  BINARY_BAD: "BINARY_BAD",
  NODE_TOO_OLD: "NODE_TOO_OLD",
  ACP_FAILED: "ACP_FAILED",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  MEDIA_NOT_FOUND: "MEDIA_NOT_FOUND",
  MEDIA_NOT_FILE: "MEDIA_NOT_FILE",
  TASK_PROMPT_REQUIRED: "TASK_PROMPT_REQUIRED",
  RESUME_SESSION: "RESUME_SESSION",
  INVALID_MODE: "INVALID_MODE",
  GENERIC: "GENERIC",
};

/**
 * @param {{
 *   code: string,
 *   title: string,
 *   detail?: string,
 *   fixes?: string[],
 * }} opts
 */
export function formatPluginError(opts) {
  const { code, title, detail, fixes } = opts;
  const lines = [`[kimi-plugin] ${code}: ${title}`];
  if (detail) {
    lines.push(detail);
  }
  if (fixes?.length) {
    lines.push("Fix:");
    fixes.forEach((f, i) => lines.push(`  ${i + 1}. ${f}`));
  }
  return lines.join("\n");
}

export function binaryNotFoundError() {
  return formatPluginError({
    code: ERROR_CODES.BINARY_NOT_FOUND,
    title: "kimi binary not found",
    detail: "Tried KIMI_CLI_PATH, ~/.kimi-code/bin, and PATH.",
    fixes: [
      "Install Kimi Code: https://github.com/MoonshotAI/kimi-code",
      "In a normal terminal run: kimi login",
      "If PATH is incomplete (common on Windows), set KIMI_CLI_PATH to the full path of kimi/kimi.exe",
      "Re-run setup (kimi_setup MCP tool or companion setup)",
    ],
  });
}

export function binaryBadError(versionOut) {
  return formatPluginError({
    code: ERROR_CODES.BINARY_BAD,
    title: "kimi --version failed",
    detail: versionOut ? `Output: ${String(versionOut).slice(0, 200)}` : undefined,
    fixes: [
      "Reinstall Kimi Code CLI",
      "Point KIMI_CLI_PATH at a working kimi/kimi.exe (not a broken shim)",
      "On Windows prefer %USERPROFILE%\\.kimi-code\\bin\\kimi.exe",
    ],
  });
}

export function nodeTooOldError(current) {
  return formatPluginError({
    code: ERROR_CODES.NODE_TOO_OLD,
    title: `Node.js ${current} is too old`,
    detail: "This plugin requires Node.js >= 18.18.",
    fixes: ["Install a current Node LTS and reopen the host terminal/app"],
  });
}

export function acpFailedError(message) {
  const msg = String(message || "ACP probe failed");
  const loginish = /login|auth|unauthor|401|403|not logged|credential/i.test(msg);
  return formatPluginError({
    code: loginish ? ERROR_CODES.LOGIN_REQUIRED : ERROR_CODES.ACP_FAILED,
    title: loginish ? "Kimi Code login / provider issue" : "ACP handshake failed",
    detail: msg,
    fixes: [
      "In a normal terminal (not the agent sandbox) run: kimi login",
      "Confirm `kimi acp` waits on stdin when launched alone",
      "Re-run setup after login",
      "If the binary is wrong, set KIMI_CLI_PATH and retry",
    ],
  });
}

export function mediaNotFoundError(raw, resolved, { cwd, tried } = {}) {
  const tryList = (tried?.length ? tried : [resolved]).join(" | ");
  return formatPluginError({
    code: ERROR_CODES.MEDIA_NOT_FOUND,
    title: "media file not found",
    detail: `input=${raw}  cwd=${cwd || "(unknown)"}  tried=${tryList}`,
    fixes: [
      "Pass an absolute path, or a path relative to the workspace root Kimi will use",
      "For screenshots/recordings, keep the real file on disk before calling the plugin",
      "Do not describe pixels in prose when a path is available — forward image/video paths",
    ],
  });
}

export function mediaNotFileError(resolved) {
  return formatPluginError({
    code: ERROR_CODES.MEDIA_NOT_FILE,
    title: "media path is not a file",
    detail: resolved,
    fixes: ["Point image/video/media at a file, not a directory"],
  });
}

export function taskPromptRequiredError() {
  return formatPluginError({
    code: ERROR_CODES.TASK_PROMPT_REQUIRED,
    title: "task needs a prompt or media",
    detail: 'Example: task --mode yolo -- "Fix the navbar"',
    fixes: [
      "Provide a user task string after --",
      "Or attach --image / --video / --media",
    ],
  });
}

export function resumeSessionError() {
  return formatPluginError({
    code: ERROR_CODES.RESUME_SESSION,
    title: "no resumable Kimi session for this workspace",
    detail: "No completed job with a session id was found for the current cwd/host session.",
    fixes: [
      "Omit resume and start a new handoff",
      "Or pass session <id> from a prior status/result",
      "List sessions: companion sessions",
    ],
  });
}

export function invalidModeError(raw) {
  return formatPluginError({
    code: ERROR_CODES.INVALID_MODE,
    title: `invalid --mode ${raw}`,
    detail: "Use default | plan | auto | yolo",
    fixes: ["Default for implement/rescue is yolo; use plan for plan-only"],
  });
}

/**
 * Soft compatibility note from kimi --version string (never hard-fails).
 * @param {string|null} versionText
 * @param {string} pluginVersion
 */
export function compatNotes(versionText, pluginVersion) {
  const notes = [];
  notes.push(`Plugin ${pluginVersion} expects a Kimi Code CLI that supports \`kimi acp\` (NDJSON JSON-RPC).`);
  if (!versionText) {
    notes.push("Could not read kimi --version; treat compatibility as unknown.");
    return { level: "unknown", notes };
  }
  if (/\b0\.0\./.test(versionText) || /alpha\.0\b/i.test(versionText)) {
    notes.push(`kimi reports "${versionText.trim()}" — if ACP fails, upgrade Kimi Code.`);
    return { level: "warn", notes };
  }
  notes.push(`kimi reports: ${versionText.trim()}`);
  return { level: "ok", notes };
}
