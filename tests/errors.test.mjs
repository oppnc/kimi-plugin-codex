import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_CODES,
  binaryNotFoundError,
  compatNotes,
  formatPluginError,
  mediaNotFoundError,
  taskPromptRequiredError,
} from "../plugins/kimi/scripts/lib/errors.mjs";

describe("errors", () => {
  it("formatPluginError includes code and Fix list", () => {
    const msg = formatPluginError({
      code: ERROR_CODES.GENERIC,
      title: "test",
      detail: "detail line",
      fixes: ["do a", "do b"],
    });
    assert.match(msg, /\[kimi-plugin\] GENERIC: test/);
    assert.match(msg, /detail line/);
    assert.match(msg, /1\. do a/);
    assert.match(msg, /2\. do b/);
  });

  it("binaryNotFoundError is actionable", () => {
    const msg = binaryNotFoundError();
    assert.match(msg, /BINARY_NOT_FOUND/);
    assert.match(msg, /KIMI_CLI_PATH/);
    assert.match(msg, /kimi login/);
  });

  it("mediaNotFoundError includes cwd and tried", () => {
    const msg = mediaNotFoundError("shot.png", "/tmp/shot.png", {
      cwd: "/ws",
      tried: ["/ws/shot.png", "/tmp/shot.png"],
    });
    assert.match(msg, /MEDIA_NOT_FOUND/);
    assert.match(msg, /cwd=\/ws/);
    assert.match(msg, /shot\.png/);
  });

  it("taskPromptRequiredError mentions example", () => {
    assert.match(taskPromptRequiredError(), /TASK_PROMPT_REQUIRED/);
  });

  it("compatNotes returns level", () => {
    const ok = compatNotes("kimi 1.2.3", "0.1.1");
    assert.equal(ok.level, "ok");
    const unknown = compatNotes(null, "0.1.1");
    assert.equal(unknown.level, "unknown");
  });
});
