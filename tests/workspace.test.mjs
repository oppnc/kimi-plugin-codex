import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HOST_CWD_ENV,
  describeWorkspaceRoot,
  resolveWorkspaceRoot,
} from "../plugins/kimi/scripts/lib/workspace.mjs";

describe("workspace", () => {
  it("explicit cwd wins", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-ws-"));
    try {
      const abs = resolveWorkspaceRoot(dir);
      assert.equal(abs, path.resolve(dir));
      const info = describeWorkspaceRoot(dir);
      assert.equal(info.source, "explicit");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to process.cwd when no host env", () => {
    const keys = HOST_CWD_ENV;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      for (const k of keys) delete process.env[k];
      const abs = resolveWorkspaceRoot(null);
      assert.equal(abs, path.resolve(process.cwd()));
      assert.equal(describeWorkspaceRoot(null).source, "process.cwd");
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it("uses KIMI_WORKSPACE when set to a directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-ws-env-"));
    const prev = process.env.KIMI_WORKSPACE;
    try {
      process.env.KIMI_WORKSPACE = dir;
      assert.equal(resolveWorkspaceRoot(null), path.resolve(dir));
      assert.equal(describeWorkspaceRoot(null).envKey, "KIMI_WORKSPACE");
    } finally {
      if (prev === undefined) delete process.env.KIMI_WORKSPACE;
      else process.env.KIMI_WORKSPACE = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
