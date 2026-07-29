/**
 * Load local media files into ACP prompt content blocks.
 * Images → { type: 'image', mimeType, data (base64) }
 * Video/other → text path hint so Kimi can ReadMediaFile (ACP image-only for binary).
 */

import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".bmp", "image/bmp"],
]);

const VIDEO_EXT = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".avi",
  ".m4v",
]);

/** Default max image bytes to embed as base64 (~4MB raw). */
const DEFAULT_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXT.has(ext)) {
    return IMAGE_EXT.get(ext);
  }
  if (VIDEO_EXT.has(ext)) {
    return "video/mp4";
  }
  return null;
}

export function isImagePath(filePath) {
  return IMAGE_EXT.has(path.extname(filePath).toLowerCase());
}

export function isVideoPath(filePath) {
  return VIDEO_EXT.has(path.extname(filePath).toLowerCase());
}

/**
 * @param {string[]} paths
 * @param {{ maxImageBytes?: number }} [opts]
 * @returns {{ blocks: object[], notes: string[], errors: string[] }}
 */
export function buildMediaPromptParts(paths, opts = {}) {
  const maxImageBytes = opts.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const blocks = [];
  const notes = [];
  const errors = [];

  for (const raw of paths || []) {
    const filePath = path.resolve(String(raw).trim());
    if (!fs.existsSync(filePath)) {
      errors.push(`media not found: ${filePath}`);
      continue;
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      errors.push(`not a file: ${filePath}`);
      continue;
    }

    if (isImagePath(filePath)) {
      if (stat.size > maxImageBytes) {
        // Too large to embed — point Kimi at the path instead.
        notes.push(
          `Image too large to embed (${stat.size} bytes): ${filePath}. Use ReadMediaFile on this path.`,
        );
        blocks.push({
          type: "text",
          text: `<media kind="image" path="${escapeAttr(filePath)}" bytes="${stat.size}" />\nPlease ReadMediaFile this image path.`,
        });
        continue;
      }
      const mime = guessMime(filePath) || "image/png";
      const data = fs.readFileSync(filePath).toString("base64");
      blocks.push({ type: "image", mimeType: mime, data });
      notes.push(`embedded image: ${filePath} (${mime})`);
      continue;
    }

    if (isVideoPath(filePath)) {
      // ACP promptCapabilities.image only — video goes as path for ReadMediaFile.
      notes.push(`video path for ReadMediaFile: ${filePath}`);
      blocks.push({
        type: "text",
        text:
          `<media kind="video" path="${escapeAttr(filePath)}" bytes="${stat.size}" />\n` +
          `A video file is attached at the absolute path above. Use ReadMediaFile (or equivalent) to inspect frames/content. This is important for UI/frontend visual debugging.`,
      });
      continue;
    }

    // SVG is an image but not reliably supported as an ACP image block —
    // hand Kimi the path instead of embedding base64.
    if (path.extname(filePath).toLowerCase() === ".svg") {
      notes.push(`svg path (not embedded): ${filePath}`);
      blocks.push({
        type: "text",
        text:
          `<media kind="image" path="${escapeAttr(filePath)}" bytes="${stat.size}" />\n` +
          `An SVG image is attached at the absolute path above. Read it from disk instead of expecting an inline image block.`,
      });
      continue;
    }

    // Generic file — resource-style text wrapper
    notes.push(`file path: ${filePath}`);
    blocks.push({
      type: "text",
      text: `<media kind="file" path="${escapeAttr(filePath)}" bytes="${stat.size}" />`,
    });
  }

  return { blocks, notes, errors };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
