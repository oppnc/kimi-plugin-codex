#!/usr/bin/env node
/**
 * Lightweight smoke: companion --help + skill contracts (no kimi login required).
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const companion = join(root, "plugins", "kimi", "scripts", "kimi-companion.mjs");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
      }
    });
  });
}

await run(process.execPath, [companion, "--help"]);
await run(process.execPath, [
  "--test",
  join(root, "tests", "skills-contracts.test.mjs"),
  join(root, "tests", "prompt.test.mjs"),
]);
console.log("smoke ok (run companion setup with kimi login for full ACP probe)");
