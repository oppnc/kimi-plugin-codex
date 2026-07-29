import path from "node:path";
import process from "node:process";

export function resolveWorkspaceRoot(explicit) {
  if (explicit) {
    return path.resolve(explicit);
  }
  return path.resolve(process.cwd());
}
