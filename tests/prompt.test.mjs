import assert from "node:assert/strict";
import test from "node:test";

import {
  bridgeNotesEnabled,
  buildUserPrompt,
} from "../plugins/kimi/scripts/lib/prompt.mjs";

test("buildUserPrompt defaults to bare task text (no host handoff)", () => {
  const out = buildUserPrompt({ prompt: "Make the header responsive" });
  assert.equal(out, "Make the header responsive");
  assert.doesNotMatch(out, /Host handoff/);
});

test("buildUserPrompt may attach git facts only", () => {
  const out = buildUserPrompt({
    prompt: "fix layout",
    gitContext: "<git-context>\nok\n</git-context>",
  });
  assert.match(out, /<git-context>/);
  assert.match(out, /fix layout/);
  assert.doesNotMatch(out, /Host handoff/);
});

test("buildUserPrompt goal framing is opt-in via asGoal", () => {
  const out = buildUserPrompt({ prompt: "Ship dark mode", asGoal: true });
  assert.match(out, /Objective: Ship dark mode/);
  assert.match(out, /CreateGoal/);
  assert.doesNotMatch(out, /Host handoff/);
});

test("bridge notes only when requested", () => {
  const out = buildUserPrompt({
    prompt: "hi",
    bridgeNotes: true,
  });
  assert.match(out, /Host handoff/);
});

test("bridgeNotesEnabled reads env", () => {
  assert.equal(bridgeNotesEnabled({}), false);
  assert.equal(bridgeNotesEnabled({ KIMI_BRIDGE_HANDOFF: "1" }), true);
  assert.equal(bridgeNotesEnabled({ KIMI_BRIDGE_HANDOFF: "true" }), true);
  assert.equal(bridgeNotesEnabled({ KIMI_BRIDGE_HANDOFF: "no" }), false);
});
