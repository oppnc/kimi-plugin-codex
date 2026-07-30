import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POLL_WAIT_MS,
  DEFAULT_RESCUE_WAIT_MS,
  MAX_RESCUE_WAIT_MS,
  resolveWaitMs,
} from "../plugins/kimi/scripts/lib/wait.mjs";

test("resolveWaitMs defaults to first rescue slice", () => {
  assert.equal(resolveWaitMs(undefined), DEFAULT_RESCUE_WAIT_MS);
  assert.equal(resolveWaitMs(null), DEFAULT_RESCUE_WAIT_MS);
  assert.equal(resolveWaitMs(0), DEFAULT_RESCUE_WAIT_MS);
});

test("resolveWaitMs clamps and floors positive values", () => {
  assert.equal(resolveWaitMs(1), 1);
  assert.equal(resolveWaitMs(90_000), 90_000);
  assert.equal(resolveWaitMs(MAX_RESCUE_WAIT_MS + 1), MAX_RESCUE_WAIT_MS);
  assert.equal(resolveWaitMs(12.9), 12);
});

test("resolveWaitMs accepts alternate default for poll slices", () => {
  assert.equal(resolveWaitMs(undefined, DEFAULT_POLL_WAIT_MS), DEFAULT_POLL_WAIT_MS);
});
