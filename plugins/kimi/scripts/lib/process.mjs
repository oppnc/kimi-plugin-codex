import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Resolve the Kimi CLI executable.
 * Order: KIMI_CLI_PATH → (win32: known install dirs) → PATH `kimi` → install dirs.
 * On Windows, PATH hits may be `.ps1`/`.cmd` shims that `spawn` cannot exec
 * directly — prefer real `.exe` installs, keep a `.cmd` only as last resort
 * (spawnKimiAcp runs those via the shell).
 */
export function resolveKimiBinary() {
  const fromEnv = process.env.KIMI_CLI_PATH?.trim();
  if (fromEnv) {
    if (fs.existsSync(fromEnv)) {
      return path.resolve(fromEnv);
    }
    return null;
  }

  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    path.join(home, ".kimi-code", "bin", process.platform === "win32" ? "kimi.exe" : "kimi"),
    path.join(home, ".local", "bin", "kimi"),
  ];

  // Windows first: the native installer layout avoids PATH shims entirely.
  if (process.platform === "win32") {
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  }

  const which = process.platform === "win32" ? "where.exe" : "which";
  const probe = spawnSync(which, ["kimi"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (probe.status === 0) {
    const hits = probe.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && fs.existsSync(l));
    if (process.platform === "win32") {
      const exe = hits.find((h) => /\.exe$/i.test(h));
      if (exe) {
        return exe;
      }
      const cmd = hits.find((h) => /\.cmd$/i.test(h));
      if (cmd) {
        return cmd;
      }
      // .ps1 and extension-less shims are not spawnable — fall through.
    } else if (hits.length) {
      return hits[0];
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

export function binaryAvailable(cmd, args = ["--version"]) {
  const isCmdShim = process.platform === "win32" && /\.cmd$/i.test(cmd);
  try {
    const result = isCmdShim
      ? spawnSync(`"${cmd}" ${args.join(" ")}`, {
          encoding: "utf8",
          windowsHide: true,
          timeout: 20000,
          shell: true,
        })
      : spawnSync(cmd, args, {
          encoding: "utf8",
          windowsHide: true,
          timeout: 20000,
        });
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
    };
  } catch (error) {
    return { ok: false, status: -1, stdout: "", stderr: String(error) };
  }
}

export function spawnKimiAcp(kimiBin, { cwd, env } = {}) {
  const isCmdShim = process.platform === "win32" && /\.cmd$/i.test(kimiBin);
  if (isCmdShim) {
    // .cmd shims need cmd.exe; quote manually since shell:true joins unquoted.
    return spawn(`"${kimiBin}" acp`, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: true,
    });
  }
  return spawn(kimiBin, ["acp"], {
    cwd: cwd || process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    // POSIX: own process group so killPidTree can take down the whole tree.
    detached: process.platform !== "win32",
  });
}

/** Kill a child process and its descendants (best-effort). */
export function terminateProcessTree(proc) {
  if (!proc) {
    return;
  }
  const pid = proc.pid;
  if (pid) {
    killPidTree(pid);
  }
  try {
    if (!proc.killed) {
      proc.kill("SIGKILL");
    }
  } catch {
    // ignore
  }
}

export function killPidTree(pid) {
  if (!pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Best-effort liveness probe (signal 0).
 * EPERM ⇒ process exists but is not signalable by this user.
 */
export function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) {
    return false;
  }
  try {
    process.kill(n, 0);
    return true;
  } catch (error) {
    if (error && error.code === "EPERM") {
      return true;
    }
    return false;
  }
}
