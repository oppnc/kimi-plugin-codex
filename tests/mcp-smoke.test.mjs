import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const mcpScript = join(root, "..", "plugins", "kimi", "scripts", "kimi-mcp.mjs");

function encodeMessage(obj) {
  const body = JSON.stringify(obj);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function readMessages(buf) {
  const messages = [];
  let buffer = buf;
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      break;
    }
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) {
      break;
    }
    const body = buffer.slice(bodyStart, bodyStart + len).toString("utf8");
    buffer = buffer.slice(bodyStart + len);
    messages.push(JSON.parse(body));
  }
  return { messages, rest: buffer };
}

test("mcp server initialize + tools/list", async () => {
  const child = spawn(process.execPath, [mcpScript], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let stdout = Buffer.alloc(0);
  child.stdout.on("data", (c) => {
    stdout = Buffer.concat([stdout, c]);
  });

  child.stdin.write(
    encodeMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    }),
  );
  child.stdin.write(
    encodeMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  );

  await new Promise((r) => setTimeout(r, 500));
  child.stdin.end();
  await new Promise((resolve) => child.on("close", resolve));

  const { messages } = readMessages(stdout);
  assert.ok(messages.length >= 2, `expected >=2 messages, got ${messages.length}: ${stdout.toString("utf8").slice(0, 500)}`);
  const init = messages.find((m) => m.id === 1);
  const list = messages.find((m) => m.id === 2);
  assert.equal(init?.result?.serverInfo?.name, "kimi-plugin-codex");
  const names = (list?.result?.tools || []).map((t) => t.name);
  assert.ok(names.includes("kimi_rescue"));
  assert.ok(names.includes("kimi_task_start"));
  assert.ok(names.includes("kimi_setup"));
  assert.ok(names.includes("kimi_result"));
});
