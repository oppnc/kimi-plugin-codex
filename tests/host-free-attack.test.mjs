/**
 * Multi-angle host-free attack on shipped Mode A/B surface.
 * Vectors: (a) policy predicates (b) dual-package core iso (c) companion acceptance flags/exit.
 * Imports real modules only — no reimplemented heuristics.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { companionTaskAcceptance } from "../plugins/kimi/scripts/lib/acceptance.mjs";
import { renderTaskResult } from "../plugins/kimi/scripts/lib/render.mjs";
import {
  isEmptyTurn,
  isReplyOnlyPrompt,
  looksIncompleteTurn,
  looksLikeActionPrompt,
  MAX_CONTINUE_NUDGES,
  MAX_EMPTY_RETRIES,
} from "../plugins/kimi/scripts/lib/turn-policy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, "..");
const LIB = path.join(PKG_ROOT, "plugins/kimi/scripts/lib");
const SIBLING_LIB = path.resolve(PKG_ROOT, "../kimi-plugin-cc/plugins/kimi/scripts/lib");

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

// ── (a) Policy attack matrix ──────────────────────────────────────────────

test("attack (a): Mode A empty predicates", () => {
  assert.equal(
    isEmptyTurn({ text: "", toolCalls: [], stopReason: "end_turn" }),
    true,
  );
  assert.equal(
    isEmptyTurn({ text: "x", toolCalls: [], stopReason: "end_turn" }),
    false,
  );
  assert.equal(
    looksIncompleteTurn(
      { text: "", toolCalls: [], stopReason: "end_turn" },
      { prompt: "Implement dark mode", mode: "yolo" },
    ).incomplete,
    false,
  );
});

test("attack (a): Mode B incomplete + exemptions", () => {
  const action = "Implement responsive header";
  assert.equal(
    looksIncompleteTurn(
      {
        text: "I will plan the layout first.",
        toolCalls: [],
        stopReason: "end_turn",
      },
      { prompt: action, mode: "yolo" },
    ).incomplete,
    true,
  );
  assert.equal(
    looksIncompleteTurn(
      {
        text: "looked",
        toolCalls: [{ title: "Read" }],
        stopReason: "end_turn",
      },
      { prompt: action, mode: "yolo" },
    ).reason,
    "read_only_tools",
  );
  assert.equal(
    looksIncompleteTurn(
      { text: "plan", toolCalls: [], stopReason: "end_turn" },
      { prompt: action, mode: "plan" },
    ).incomplete,
    false,
  );
  assert.equal(looksLikeActionPrompt("How do I implement dark mode?"), false);
  assert.equal(isReplyOnlyPrompt("Reply with exactly: kimi-bridge-ok"), true);
  assert.equal(
    looksIncompleteTurn(
      { text: "kimi-bridge-ok", toolCalls: [], stopReason: "end_turn" },
      { prompt: "Reply with exactly: kimi-bridge-ok", mode: "yolo" },
    ).incomplete,
    false,
  );
  assert.equal(looksLikeActionPrompt("实现深色模式开关并改CSS"), true);
  assert.equal(
    looksIncompleteTurn(
      {
        text: "Done: implemented the header.",
        toolCalls: [],
        stopReason: "end_turn",
      },
      { prompt: action, mode: "yolo" },
    ).incomplete,
    false,
  );
  assert.ok(MAX_EMPTY_RETRIES >= 1);
  assert.ok(MAX_CONTINUE_NUDGES >= 1);
});

// ── (b) Dual-package isomorphism ──────────────────────────────────────────
// These checks require the sibling kimi-plugin-cc checkout (monorepo layout).
// In CI (single-repo checkout) they skip instead of failing.

const HAS_SIBLING = fs.existsSync(path.join(SIBLING_LIB, "turn-policy.mjs"));

test("attack (b): turn-policy isomorphic with sibling cc package", { skip: !HAS_SIBLING && "sibling kimi-plugin-cc not checked out" }, () => {
  const local = path.join(LIB, "turn-policy.mjs");
  const sibling = path.join(SIBLING_LIB, "turn-policy.mjs");
  assert.ok(fs.existsSync(local), "local turn-policy");
  assert.ok(fs.existsSync(sibling), "sibling turn-policy (monorepo layout)");
  assert.equal(sha256File(local), sha256File(sibling), "turn-policy byte-identical");
});

test("attack (b): acceptance.mjs isomorphic with sibling cc package", { skip: !HAS_SIBLING && "sibling kimi-plugin-cc not checked out" }, () => {
  const local = path.join(LIB, "acceptance.mjs");
  const sibling = path.join(SIBLING_LIB, "acceptance.mjs");
  assert.ok(fs.existsSync(local));
  assert.ok(fs.existsSync(sibling), "sibling acceptance.mjs must exist");
  assert.equal(sha256File(local), sha256File(sibling));
});

test("attack (b): acp-client isomorphic after identity normalize", { skip: !HAS_SIBLING && "sibling kimi-plugin-cc not checked out" }, () => {
  const local = fs
    .readFileSync(path.join(LIB, "acp-client.mjs"), "utf8")
    .replaceAll("kimi-plugin-codex", "PKG");
  const sibling = fs
    .readFileSync(path.join(SIBLING_LIB, "acp-client.mjs"), "utf8")
    .replaceAll("kimi-plugin-cc", "PKG");
  assert.equal(local, sibling, "acp-client logic identical except client name");
});

// ── (c) Companion JSON / exit-code contract (shipped acceptance.mjs) ──────

test("attack (c): empty handoff → ok:false exit 1 failed job", () => {
  const acc = companionTaskAcceptance({
    emptyAgentText: true,
    emptyRetried: true,
    emptyRecoveryNudged: true,
    text: "",
    stopReason: "end_turn",
  });
  assert.equal(acc.ok, false);
  assert.equal(acc.exitCode, 1);
  assert.equal(acc.jobStatus, "failed");
  assert.equal(acc.emptyAgentText, true);
  assert.equal(acc.emptyRetried, true);
  assert.equal(acc.emptyRecoveryNudged, true);
  assert.match(acc.jobError || "", /empty ACP completion/);
});

test("attack (c): success handoff → ok:true exit 0 completed", () => {
  const acc = companionTaskAcceptance({
    emptyAgentText: false,
    emptyRetried: true,
    text: "kimi-bridge-ok",
    stopReason: "end_turn",
    incompleteContinued: false,
  });
  assert.equal(acc.ok, true);
  assert.equal(acc.exitCode, 0);
  assert.equal(acc.jobStatus, "completed");
  assert.equal(acc.jobError, null);
  assert.equal(acc.emptyRetried, true);
});

test("attack (c): render empty note mentions fail-loud / non-zero exit", () => {
  const text = renderTaskResult({
    stopReason: "end_turn",
    text: "",
    emptyAgentText: true,
    emptyRetried: true,
    emptyRecoveryNudged: true,
  });
  assert.match(text, /\(no agent text\)/);
  assert.match(text, /empty completion|non-zero|re-dispatch|failed handoff/i);
});

test("attack (c): companion wires acceptance (static source contract)", () => {
  const companion = fs.readFileSync(
    path.join(PKG_ROOT, "plugins/kimi/scripts/kimi-companion.mjs"),
    "utf8",
  );
  assert.match(companion, /companionTaskAcceptance/);
  assert.match(companion, /from "\.\/lib\/acceptance\.mjs"/);
  assert.match(companion, /acc\.exitCode/);
  assert.match(companion, /acc\.ok/);
});
