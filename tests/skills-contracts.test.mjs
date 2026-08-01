/**
 * Skill contracts for the Codex host path (discover → route → pipe → Kimi).
 * Skills only — no MCP (aligned with cc-plugin-codex).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PLUGIN = path.join(ROOT, "plugins", "kimi");
const VERSION = "0.2.1";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readPlugin(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

const PUBLIC_SKILLS = [
  "rescue",
  "setup",
  "status",
  "result",
  "cancel",
  "plan",
  "goal",
  "task",
  "sessions",
];

test("public skills exist with SKILL.md and agents/openai.yaml", () => {
  for (const name of PUBLIC_SKILLS) {
    const skillPath = path.join(PLUGIN, "skills", name, "SKILL.md");
    const yamlPath = path.join(PLUGIN, "skills", name, "agents", "openai.yaml");
    assert.ok(fs.existsSync(skillPath), `missing ${name}/SKILL.md`);
    assert.ok(fs.existsSync(yamlPath), `missing ${name}/agents/openai.yaml`);
    const skill = fs.readFileSync(skillPath, "utf8");
    assert.match(skill, new RegExp(`^name:\\s*${name}\\s*$`, "m"), `${name} frontmatter name`);
    assert.match(skill, /two directories above/i, `${name} must resolve plugin-root`);
    assert.match(
      skill,
      /kimi-companion\.mjs/,
      `${name} must invoke kimi-companion.mjs`,
    );
    assert.doesNotMatch(skill, /Optional MCP|kimi_rescue|kimi_setup/i, `${name} must not advertise MCP`);
  }
});

test("MCP surface is removed", () => {
  assert.equal(fs.existsSync(path.join(PLUGIN, ".mcp.json")), false);
  assert.equal(fs.existsSync(path.join(PLUGIN, "scripts", "kimi-mcp.mjs")), false);
  assert.equal(fs.existsSync(path.join(PLUGIN, "scripts", "lib", "wait.mjs")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "tests", "mcp-smoke.test.mjs")), false);
});

test("legacy MCP-first skills are removed", () => {
  assert.equal(fs.existsSync(path.join(PLUGIN, "skills", "kimi-delegate")), false);
  assert.equal(fs.existsSync(path.join(PLUGIN, "skills", "kimi-setup")), false);
});

test("rescue skill encodes strict discover → route → pipe contract", () => {
  const rescue = readPlugin("skills/rescue/SKILL.md");
  assert.match(rescue, /MUST use proactively|you MUST hand off/i);
  assert.match(rescue, /orchestrator/i);
  assert.match(rescue, /frontend/i);
  assert.match(rescue, /built-in default/i);
  assert.match(rescue, /spawn_agent/i);
  assert.match(rescue, /Omit `agent_type`/i);
  assert.match(rescue, /fork_context:\s*false/i);
  assert.match(rescue, /nohup/);
  assert.match(rescue, /Never.*pass to companion|Parent only/i);
  assert.match(rescue, /verbatim/i);
  assert.match(rescue, /kimi-cli-runtime/);
  assert.match(rescue, /Skills only|no.*MCP/i);
  assert.match(rescue, /--background/);
  assert.match(rescue, /--wait/);
  // Empty / failed handoff → re-dispatch, never self-implement
  assert.match(rescue, /Acceptance/i);
  assert.match(rescue, /emptyAgentText|ok:\s*false|ok:false/i);
  assert.match(rescue, /re-dispatch/i);
  assert.match(rescue, /--fresh/);
});

test("rescue skill hard-codes plugin-root algorithm and forbids wrong cache paths", () => {
  const rescue = readPlugin("skills/rescue/SKILL.md");
  assert.match(rescue, /two directory levels above|two directories above/i);
  assert.match(rescue, /do not guess|Do not guess|do not invent/i);
  assert.match(rescue, /marketplace cache root|Missing `kimi\\<version>\\`|missing `kimi/i);
  assert.match(rescue, /kimi\\<version>\\scripts\\kimi-companion|kimi\/<version>\/scripts\/kimi-companion/i);
  assert.match(rescue, /Child message template|fully resolved absolute/i);
  assert.match(rescue, /Sanity check before spawn/i);
  // Must document the classic wrong path that free models invent
  assert.match(
    rescue,
    /kimi-plugin-codex\\scripts\\kimi-companion|kimi-plugin-codex\/scripts\/kimi-companion/,
  );
});

test("kimi-cli-runtime forbids wrong cache scripts path and re-derivation", () => {
  const runtime = readPlugin("skills/kimi-cli-runtime/SKILL.md");
  assert.match(runtime, /exactly one/i);
  assert.match(runtime, /Forbidden|forbidden/);
  assert.match(
    runtime,
    /kimi-plugin-codex\/scripts\/kimi-companion|kimi-plugin-codex\\scripts\\kimi-companion/,
  );
  assert.match(runtime, /Do not re-derive|do \*\*not\*\* re-derive|Do \*\*not\*\* re-derive/i);
  assert.match(runtime, /MODULE_NOT_FOUND|return the error/i);
  assert.match(runtime, /Acceptance|emptyAgentText|ok.*false/i);
  assert.match(runtime, /Exit \*\*≠ 0\*\*|Exit \*\*!= 0\*\*|exit ≠ 0|Exit \*\*≠ 0\*\*/i);
});

test("rescue and runtime mandate host shell timeout_ms 86400000 for companion ACP", () => {
  const rescue = readPlugin("skills/rescue/SKILL.md");
  const runtime = readPlugin("skills/kimi-cli-runtime/SKILL.md");
  assert.match(rescue, /86400000/);
  assert.match(rescue, /timeout_ms:\s*86400000/);
  assert.match(rescue, /14054|14\s*s|~14|timed out after/i);
  assert.match(rescue, /Prose is not enough|prose.*timeout|without setting/i);
  assert.match(rescue, /--background/);
  assert.match(runtime, /86400000/);
  assert.match(runtime, /timeout_ms:\s*86400000/);
  assert.match(runtime, /MANDATORY|REQUIRED|never omit/i);
  assert.match(runtime, /14054|14|timed out/i);
  // Companion itself should stay deadline-free by default in the contract text
  assert.match(rescue, /do \*\*not\*\* pass companion `--timeout`|Do NOT pass companion --timeout/i);
});

test("task skill steers frontend to rescue and is explicit-only", () => {
  const task = readPlugin("skills/task/SKILL.md");
  assert.match(task, /\$kimi:rescue/);
  assert.match(task, /frontend|UI/i);
  assert.match(task, /kimi-companion\.mjs" task/);
  assert.match(task, /verbatim|exactly as returned/i);
  const yaml = readPlugin("skills/task/agents/openai.yaml");
  assert.match(yaml, /allow_implicit_invocation:\s*false/);
});

test("goal skill routes large/UI work to rescue", () => {
  const goal = readPlugin("skills/goal/SKILL.md");
  assert.match(goal, /\$kimi:rescue/);
  assert.match(goal, /frontend|UI/i);
  assert.match(goal, /--goal/);
});

test("lifecycle skills disable implicit invocation; rescue does not", () => {
  for (const name of [
    "setup",
    "status",
    "result",
    "cancel",
    "plan",
    "goal",
    "task",
    "sessions",
    "kimi-cli-runtime",
  ]) {
    const yaml = readPlugin(`skills/${name}/agents/openai.yaml`);
    assert.match(
      yaml,
      /allow_implicit_invocation:\s*false/,
      `${name} must disable implicit invocation`,
    );
  }
  const rescueYaml = readPlugin("skills/rescue/agents/openai.yaml");
  assert.doesNotMatch(
    rescueYaml,
    /^\s*allow_implicit_invocation:\s*false\s*$/m,
    "rescue must remain implicitly invokable",
  );
  assert.doesNotMatch(rescueYaml, /^\s*policy:\s*$/m, "rescue must not set policy block");
});

test("internal runtime skill is a pure pipe", () => {
  const runtime = readPlugin("skills/kimi-cli-runtime/SKILL.md");
  assert.match(runtime, /pipe|forwarder/i);
  assert.match(runtime, /kimi-companion\.mjs" task/);
  assert.match(runtime, /(?:Never|Do \*\*not\*\*) call `setup`/i);
  assert.match(runtime, /Do \*\*not\*\* inspect the repo/i);
  assert.match(runtime, /byte-for-byte/i);
});

test("plugin.json is skills-only (no mcpServers)", () => {
  const plugin = JSON.parse(readPlugin(".codex-plugin/plugin.json"));
  assert.equal(plugin.name, "kimi");
  assert.equal(plugin.version, VERSION);
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.mcpServers, undefined);
  assert.equal(plugin.interface?.category, "Coding");
  const blob = JSON.stringify(plugin);
  assert.doesNotMatch(blob, /Optional MCP|mcpServers/i);
  const prompts = plugin.interface?.defaultPrompt || [];
  assert.ok(prompts.some((p) => /frontend|\$kimi:rescue/i.test(p)));
});

test(`version fields stay in sync at ${VERSION}`, () => {
  const pkg = JSON.parse(read("package.json"));
  const plugin = JSON.parse(readPlugin(".codex-plugin/plugin.json"));
  const companion = readPlugin("scripts/kimi-companion.mjs");
  const acp = readPlugin("scripts/lib/acp-client.mjs");

  assert.equal(pkg.version, VERSION);
  assert.equal(plugin.version, VERSION);
  assert.match(companion, new RegExp(`const VERSION = "${VERSION}"`));
  assert.match(acp, new RegExp(`const PLUGIN_VERSION = "${VERSION}"`));
  assert.doesNotMatch(pkg.description, /MCP optional/i);
});

test("AGENTS.md documents skills-only host path", () => {
  const agents = read("AGENTS.md");
  assert.match(agents, /built-in default subagent/i);
  assert.match(agents, /discover|frontend/i);
  assert.match(agents, /Skills only|no MCP/i);
  assert.match(agents, /\$kimi:rescue/);
  assert.match(agents, new RegExp(VERSION.replace(/\./g, "\\.")));
  assert.doesNotMatch(agents, /MCP is secondary|optional MCP/i);
});
