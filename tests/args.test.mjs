import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  parseTaskArgs,
  splitRawArgumentString,
} from "../plugins/kimi/scripts/lib/args.mjs";

describe("splitRawArgumentString", () => {
  it("splits simple tokens", () => {
    assert.deepEqual(splitRawArgumentString("--mode yolo fix navbar"), [
      "--mode",
      "yolo",
      "fix",
      "navbar",
    ]);
  });

  it("keeps quoted segments", () => {
    assert.deepEqual(splitRawArgumentString(`--mode plan "do the thing"`), [
      "--mode",
      "plan",
      "do the thing",
    ]);
  });

  it("unwraps escaped quotes and backslashes inside quotes", () => {
    assert.deepEqual(
      splitRawArgumentString(`-- "say \\"hi\\" and C:\\\\tmp"`),
      ["--", 'say "hi" and C:\\tmp'],
    );
  });

  it("keeps backslashes outside quotes literal (Windows paths)", () => {
    assert.deepEqual(splitRawArgumentString(`C:\\Users\\x\\file.png`), [
      "C:\\Users\\x\\file.png",
    ]);
  });
});

describe("parseArgs", () => {
  it("parses flags and options", () => {
    const parsed = parseArgs(["--mode", "yolo", "--json", "hello", "world"], {
      flags: new Set(["json"]),
      options: new Set(["mode"]),
    });
    assert.equal(parsed.flags.json, true);
    assert.equal(parsed.options.mode, "yolo");
    assert.deepEqual(parsed._, ["hello", "world"]);
  });

  it("supports -- separator", () => {
    const parsed = parseArgs(["--mode", "plan", "--", "fix --flag"], {
      flags: new Set(),
      options: new Set(["mode"]),
    });
    assert.equal(parsed.options.mode, "plan");
    assert.equal(parsed.rawAfterDashDash, "fix --flag");
  });

  it("collects multi options", () => {
    const parsed = parseArgs(["--image", "a.png", "--image", "b.png"], {
      multiOptions: new Set(["image"]),
    });
    assert.deepEqual(parsed.multi.image, ["a.png", "b.png"]);
  });
});

describe("parseTaskArgs", () => {
  it("extracts prompt and mode", () => {
    const t = parseTaskArgs(["--mode", "yolo", "hello", "world"]);
    assert.equal(t.mode, "yolo");
    assert.equal(t.prompt, "hello world");
  });

  it("parses media and resume flags", () => {
    const t = parseTaskArgs([
      "--resume",
      "--image",
      "shot.png",
      "--video",
      "rec.mp4",
      "--goal",
      "--",
      "fix UI",
    ]);
    assert.equal(t.resume, true);
    assert.equal(t.asGoal, true);
    assert.deepEqual(t.mediaPaths, ["shot.png", "rec.mp4"]);
    assert.equal(t.prompt, "fix UI");
  });

  it("supports -- prompt with dashes", () => {
    const t = parseTaskArgs(["--mode", "yolo", "--", "fix --the thing"]);
    assert.equal(t.prompt, "fix --the thing");
  });

  it("rejects unknown flags instead of leaking them into the prompt", () => {
    assert.throws(
      () => parseTaskArgs(["--mode", "yolo", "--backgroundd", "Fix the navbar"]),
      /Unknown task option\(s\): --backgroundd/,
    );
    assert.throws(
      () => parseTaskArgs(["--mode", "yolo", "--wait=1", "fix it"]),
      /Unknown task option\(s\): --wait=1/,
    );
    // After "--", flag-looking words are task text, not options.
    const t = parseTaskArgs(["--mode", "yolo", "--", "fix --the thing --weird"]);
    assert.equal(t.prompt, "fix --the thing --weird");
  });

  it("parses --empty-retries", () => {
    const t = parseTaskArgs(["--empty-retries", "3", "--", "fix it"]);
    assert.equal(t.emptyRetries, 3);
    assert.equal(parseTaskArgs(["--", "fix it"]).emptyRetries, null);
  });
});
