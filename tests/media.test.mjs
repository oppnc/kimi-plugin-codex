import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildMediaPromptParts,
  isImagePath,
  isVideoPath,
} from "../plugins/kimi/scripts/lib/media.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kimi-media-"));

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("media helpers", () => {
  it("detects image and video extensions", () => {
    assert.equal(isImagePath("a.PNG"), true);
    assert.equal(isVideoPath("b.webm"), true);
    assert.equal(isImagePath("c.mp4"), false);
  });

  it("embeds small png as image block", () => {
    // 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const p = path.join(tmp, "dot.png");
    fs.writeFileSync(p, png);
    const { blocks, errors } = buildMediaPromptParts([p]);
    assert.equal(errors.length, 0);
    assert.equal(blocks[0].type, "image");
    assert.equal(blocks[0].mimeType, "image/png");
    assert.ok(blocks[0].data.length > 10);
  });

  it("turns video into path text for ReadMediaFile", () => {
    const p = path.join(tmp, "clip.mp4");
    fs.writeFileSync(p, Buffer.from("not-a-real-video"));
    const { blocks, notes, errors } = buildMediaPromptParts([p]);
    assert.equal(errors.length, 0);
    assert.equal(blocks[0].type, "text");
    assert.match(blocks[0].text, /ReadMediaFile/);
    assert.ok(notes.some((n) => n.includes("video")));
  });

  it("reports missing files", () => {
    const { errors } = buildMediaPromptParts([path.join(tmp, "nope.png")]);
    assert.ok(errors[0].includes("not found"));
  });
});
