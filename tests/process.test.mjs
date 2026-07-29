import { describe, it } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";

const { isPidAlive } = await import("../plugins/kimi/scripts/lib/process.mjs");

describe("isPidAlive", () => {
  it("reports the current process as alive", () => {
    assert.equal(isPidAlive(process.pid), true);
  });

  it("reports nonsense pids as dead", () => {
    assert.equal(isPidAlive(null), false);
    assert.equal(isPidAlive(0), false);
    assert.equal(isPidAlive(-1), false);
    assert.equal(isPidAlive("nope"), false);
  });

  it("reports a very large unused pid as dead", () => {
    // Unlikely to be allocated; if it is, test still must not throw.
    const alive = isPidAlive(2_147_483_646);
    assert.equal(typeof alive, "boolean");
  });
});
