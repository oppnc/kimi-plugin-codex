import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPROVE_ALWAYS,
  APPROVE_ONCE,
  REJECT,
  pickPermissionOptionId,
  permissionPolicyForMode,
} from "../plugins/kimi/scripts/lib/permissions.mjs";

const CANONICAL = [
  { optionId: APPROVE_ONCE, name: "Approve once", kind: "allow_once" },
  { optionId: APPROVE_ALWAYS, name: "Approve for this session", kind: "allow_always" },
  { optionId: REJECT, name: "Reject", kind: "reject_once" },
];

describe("permissionPolicyForMode", () => {
  it("maps plan → plan and others → auto", () => {
    assert.equal(permissionPolicyForMode("plan"), "plan");
    assert.equal(permissionPolicyForMode("yolo"), "auto");
    assert.equal(permissionPolicyForMode("auto"), "auto");
    assert.equal(permissionPolicyForMode("default"), "auto");
  });
});

describe("pickPermissionOptionId", () => {
  it("auto prefers approve_always", () => {
    assert.equal(pickPermissionOptionId(CANONICAL, { policy: "auto" }), APPROVE_ALWAYS);
  });

  it("reject picks reject", () => {
    assert.equal(pickPermissionOptionId(CANONICAL, { policy: "reject" }), REJECT);
  });

  it("plan rejects Write tool", () => {
    assert.equal(
      pickPermissionOptionId(CANONICAL, {
        policy: "plan",
        toolCall: { title: "Write" },
      }),
      REJECT,
    );
  });

  it("plan allows Read with approve_once", () => {
    assert.equal(
      pickPermissionOptionId(CANONICAL, {
        policy: "plan",
        toolCall: { title: "Read" },
      }),
      APPROVE_ONCE,
    );
  });

  it("plan declines ExitPlanMode instead of approving execution", () => {
    const PLAN_OPTIONS = [
      { optionId: "plan_approve", name: "Approve", kind: "allow_once" },
      { optionId: "plan_revise", name: "Revise", kind: "reject_once" },
      { optionId: "plan_reject_and_exit", name: "Reject and Exit", kind: "reject_once" },
    ];
    assert.equal(
      pickPermissionOptionId(PLAN_OPTIONS, {
        policy: "plan",
        toolCall: { title: "ExitPlanMode" },
      }),
      "plan_reject_and_exit",
    );
  });

  it("plan ExitPlanMode falls back to reject without plan options", () => {
    assert.equal(
      pickPermissionOptionId(CANONICAL, {
        policy: "plan",
        toolCall: { title: "ExitPlanMode" },
      }),
      REJECT,
    );
  });

  it("handles empty options safely", () => {
    assert.equal(pickPermissionOptionId([], { policy: "auto" }), APPROVE_ALWAYS);
    assert.equal(pickPermissionOptionId([], { policy: "reject" }), REJECT);
  });
});
