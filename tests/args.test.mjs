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
});
