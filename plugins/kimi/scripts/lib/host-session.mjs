/**
 * Best-effort host session id for job scoping (Codex / generic).
 */
import process from "node:process";

export function getHostSessionId() {
  return (
    process.env.CODEX_SESSION_ID ||
    process.env.CODEX_THREAD_ID ||
    process.env.CODEX_SESSION ||
    // Hooks inject session_id on stdin; callers may re-export as:
    process.env.KIMI_PLUGIN_CODEX_HOST_SESSION ||
    // Compat if a host reuses Claude-style vars
    process.env.CLAUDE_SESSION_ID ||
    process.env.CLAUDE_CODE_SESSION_ID ||
    null
  );
}
