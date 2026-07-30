import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContinueNudge,
  buildEmptyRecoveryNudge,
  classifyToolTitle,
  forceContinueEnabled,
  hasMutatingOrExecuteWork,
  isContinueStagnant,
  isEmptyTurn,
  isReplyOnlyPrompt,
  looksIncompleteTurn,
  looksLikeActionPrompt,
  looksLikeCompletionClaim,
  looksLikePlanningText,
  mergeTurnResults,
} from "../plugins/kimi/scripts/lib/turn-policy.mjs";

test("isEmptyTurn: zero text and tools with end_turn", () => {
  assert.equal(isEmptyTurn({ text: "", toolCalls: [], stopReason: "end_turn" }), true);
  assert.equal(isEmptyTurn({ text: "  ", toolCalls: [], stopReason: null }), true);
  assert.equal(
    isEmptyTurn({ text: "hi", toolCalls: [], stopReason: "end_turn" }),
    false,
  );
  assert.equal(
    isEmptyTurn({
      text: "",
      toolCalls: [{ title: "Read" }],
      stopReason: "end_turn",
    }),
    false,
  );
});

test("classifyToolTitle buckets", () => {
  assert.equal(classifyToolTitle("Write"), "mutate");
  assert.equal(classifyToolTitle("Edit"), "mutate");
  assert.equal(classifyToolTitle("Bash"), "execute");
  assert.equal(classifyToolTitle("Read"), "read");
  assert.equal(classifyToolTitle("Glob"), "read");
  assert.equal(classifyToolTitle("MysteryTool"), "unknown");
});

test("hasMutatingOrExecuteWork", () => {
  assert.equal(hasMutatingOrExecuteWork([{ title: "Read" }, { title: "Glob" }]), false);
  assert.equal(hasMutatingOrExecuteWork([{ title: "Read" }, { title: "Write" }]), true);
  assert.equal(hasMutatingOrExecuteWork([{ title: "Bash" }]), true);
});

test("looksLikeActionPrompt: implement vs Q&A vs reply-only", () => {
  assert.equal(looksLikeActionPrompt("Implement a dark mode toggle"), true);
  assert.equal(looksLikeActionPrompt("Fix the CSS layout bug"), true);
  assert.equal(looksLikeActionPrompt("Make the settings page responsive"), true);
  assert.equal(looksLikeActionPrompt("实现深色模式开关并改CSS"), true);
  assert.equal(looksLikeActionPrompt("What is ACP?"), false);
  assert.equal(looksLikeActionPrompt("Explain how permissions work"), false);
  // Peer FP we fixed: how-to with implement verb
  assert.equal(looksLikeActionPrompt("How do I implement dark mode?"), false);
  assert.equal(looksLikeActionPrompt("hi"), false);
  assert.equal(looksLikeActionPrompt("ok"), false);
  // Live FP we fixed: bridge / circuit probes
  assert.equal(looksLikeActionPrompt("Reply with exactly: kimi-bridge-ok"), false);
  assert.equal(looksLikeActionPrompt("Reply with exactly: circuit-ok"), false);
  assert.equal(isReplyOnlyPrompt("Reply with exactly: circuit-ok"), true);
  assert.equal(looksLikeActionPrompt("anything", { asGoal: true }), true);
  assert.equal(
    looksLikeActionPrompt("Treat as Goal\n\nObjective: Ship dark mode"),
    true,
  );
  // File cue without English verb
  assert.equal(looksLikeActionPrompt("dark mode for settings.css please"), true);
});

test("looksIncompleteTurn Mode B: text-only and read-only", () => {
  const action = "Implement responsive header";
  assert.deepEqual(
    looksIncompleteTurn(
      { text: "I will plan the layout first.", toolCalls: [], stopReason: "end_turn" },
      { prompt: action, mode: "yolo" },
    ),
    { incomplete: true, reason: "text_only_no_tools" },
  );
  assert.deepEqual(
    looksIncompleteTurn(
      {
        text: "Looked at styles.",
        toolCalls: [{ title: "Read" }, { title: "Glob" }],
        stopReason: "end_turn",
      },
      { prompt: action, mode: "yolo" },
    ),
    { incomplete: true, reason: "read_only_tools" },
  );
  assert.equal(
    looksIncompleteTurn(
      {
        text: "Done",
        toolCalls: [{ title: "Write" }],
        stopReason: "end_turn",
      },
      { prompt: action, mode: "yolo" },
    ).incomplete,
    false,
  );
  // Completion claim without tools → do not force continue (trust claim)
  assert.equal(
    looksIncompleteTurn(
      {
        text: "Done: implemented the header styles.",
        toolCalls: [],
        stopReason: "end_turn",
      },
      { prompt: action, mode: "yolo" },
    ).incomplete,
    false,
  );
});

test("looksIncompleteTurn skips plan mode, Q&A, empty (Mode A), cancelled, reply-only", () => {
  assert.equal(
    looksIncompleteTurn(
      { text: "plan only", toolCalls: [], stopReason: "end_turn" },
      { prompt: "Implement X", mode: "plan" },
    ).incomplete,
    false,
  );
  assert.equal(
    looksIncompleteTurn(
      { text: "ACP is…", toolCalls: [], stopReason: "end_turn" },
      { prompt: "What is ACP?", mode: "yolo" },
    ).incomplete,
    false,
  );
  assert.equal(
    looksIncompleteTurn(
      { text: "", toolCalls: [], stopReason: "end_turn" },
      { prompt: "Implement X", mode: "yolo" },
    ).incomplete,
    false,
  );
  assert.equal(
    looksIncompleteTurn(
      { text: "bye", toolCalls: [], stopReason: "cancelled" },
      { prompt: "Implement X", mode: "yolo" },
    ).incomplete,
    false,
  );
  // bridge-ok must NOT Mode B
  assert.equal(
    looksIncompleteTurn(
      { text: "kimi-bridge-ok", toolCalls: [], stopReason: "end_turn" },
      { prompt: "Reply with exactly: kimi-bridge-ok", mode: "yolo" },
    ).incomplete,
    false,
  );
});

test("looksIncompleteTurn respects enabled=false", () => {
  assert.equal(
    looksIncompleteTurn(
      { text: "plan", toolCalls: [], stopReason: "end_turn" },
      { prompt: "Implement X", mode: "yolo", enabled: false },
    ).incomplete,
    false,
  );
});

test("forceContinueEnabled env", () => {
  assert.equal(forceContinueEnabled({}), true);
  assert.equal(forceContinueEnabled({ KIMI_FORCE_CONTINUE: "1" }), true);
  assert.equal(forceContinueEnabled({ KIMI_FORCE_CONTINUE: "0" }), false);
  assert.equal(forceContinueEnabled({ KIMI_FORCE_CONTINUE: "off" }), false);
});

test("buildContinueNudge and empty recovery nudge", () => {
  const n = buildContinueNudge("read_only_tools");
  assert.match(n, /Host continue/);
  assert.match(n, /Write\/Edit/);
  assert.match(n, /read\/search/);
  const e = buildEmptyRecoveryNudge();
  assert.match(e, /Host recovery/);
  assert.match(e, /zero agent text/);
});

test("planning vs completion text helpers", () => {
  assert.equal(looksLikePlanningText("I'll start by reading the files"), true);
  assert.equal(looksLikePlanningText("Done editing styles.css"), false);
  assert.equal(looksLikeCompletionClaim("Done editing styles.css"), true);
  assert.equal(looksLikeCompletionClaim("maybe later"), false);
});

test("isContinueStagnant", () => {
  assert.equal(
    isContinueStagnant({ text: "a" }, { text: "", toolCalls: [] }),
    true,
  );
  assert.equal(
    isContinueStagnant({ text: "a" }, { text: "a", toolCalls: [] }),
    true,
  );
  assert.equal(
    isContinueStagnant(
      { text: "a" },
      { text: "wrote files", toolCalls: [{ title: "Write" }] },
    ),
    false,
  );
});

test("mergeTurnResults concatenates text and tools", () => {
  const m = mergeTurnResults(
    {
      text: "plan",
      toolCalls: [{ title: "Read" }],
      stopReason: "end_turn",
      sessionId: "s1",
    },
    {
      text: "done",
      toolCalls: [{ title: "Write" }],
      stopReason: "end_turn",
      sessionId: "s1",
    },
  );
  assert.match(m.text, /plan/);
  assert.match(m.text, /done/);
  assert.equal(m.toolCalls.length, 2);
  assert.equal(m.toolCalls[1].title, "Write");
});
