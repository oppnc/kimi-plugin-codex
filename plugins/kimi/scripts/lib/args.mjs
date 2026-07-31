/**
 * Argv / raw-argument parsing for kimi-companion.
 */

export function splitRawArgumentString(raw) {
  if (raw == null) {
    return [];
  }
  const s = String(raw).trim();
  if (!s) {
    return [];
  }
  const tokens = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      // Inside quotes, backslash escapes the quote char or another backslash.
      // Other backslashes stay literal so Windows paths survive intact.
      if (ch === "\\" && (s[i + 1] === quote || s[i + 1] === "\\")) {
        cur += s[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur) {
    tokens.push(cur);
  }
  return tokens;
}

/**
 * @param {string[]} argv
 * @param {{ flags?: Set<string>, options?: Set<string>, multiOptions?: Set<string> }} spec
 * multiOptions: --image a --image b → arrays
 */
export function parseArgs(argv, spec = {}) {
  const flags = spec.flags || new Set();
  const options = spec.options || new Set();
  const multiOptions = spec.multiOptions || new Set();
  const out = {
    _: [],
    flags: {},
    options: {},
    multi: {},
    rawAfterDashDash: null,
    unknownFlags: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--") {
      out.rawAfterDashDash = argv.slice(i + 1).join(" ");
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      if (eq !== -1) {
        const key = tok.slice(2, eq);
        const val = tok.slice(eq + 1);
        if (flags.has(key) || options.has(key) || multiOptions.has(key)) {
          assignOption(out, key, val, flags, options, multiOptions);
        } else {
          out.unknownFlags.push(tok);
        }
        continue;
      }
      const key = tok.slice(2);
      if (flags.has(key)) {
        out.flags[key] = true;
        continue;
      }
      if (options.has(key) || multiOptions.has(key)) {
        const val = argv[i + 1];
        if (val == null || (val.startsWith("--") && val !== "--")) {
          assignOption(out, key, "", flags, options, multiOptions);
        } else {
          assignOption(out, key, val, flags, options, multiOptions);
          i += 1;
        }
        continue;
      }
      out.unknownFlags.push(tok);
      continue;
    }
    out._.push(tok);
  }
  return out;
}

function assignOption(out, key, val, flags, options, multiOptions) {
  if (multiOptions.has(key)) {
    if (!out.multi[key]) {
      out.multi[key] = [];
    }
    out.multi[key].push(val);
    return;
  }
  if (options.has(key)) {
    out.options[key] = val;
    return;
  }
  if (flags.has(key)) {
    out.flags[key] = val !== "false" && val !== "0";
  }
}

/**
 * Parse `task` / `goal` argv.
 * @param {string[]} argv
 */
export function parseTaskArgs(argv) {
  let tokens = argv;
  // Host agents sometimes hand the whole flag string over as one blob; only
  // treat it as such when it actually starts with a flag, so prompts that
  // merely contain `--` are not mangled.
  if (tokens.length === 1 && tokens[0].trimStart().startsWith("--")) {
    tokens = splitRawArgumentString(tokens[0]);
  }

  const parsed = parseArgs(tokens, {
    flags: new Set([
      "json",
      "background",
      "bg",
      "write",
      "read-only",
      "resume",
      "resume-last",
      "fresh",
      "goal",
      "git",
      "with-git",
    ]),
    options: new Set([
      "mode",
      "model",
      "thinking",
      "cwd",
      "prompt",
      "timeout",
      "session",
      "base",
      "empty-retries",
    ]),
    multiOptions: new Set(["image", "video", "media", "file"]),
  });

  if (parsed.unknownFlags.length) {
    throw new Error(
      `Unknown task option(s): ${parsed.unknownFlags.join(", ")}. ` +
        `Supported: --mode --model --thinking --cwd --prompt --timeout --session --base ` +
        `--empty-retries --image --video --media --file --json --background --resume --fresh ` +
        `--goal --git. Put the task text after "--" so flag-like words are not parsed as options.`,
    );
  }

  let prompt = "";
  if (parsed.options.prompt) {
    prompt = String(parsed.options.prompt).trim();
  } else if (parsed.rawAfterDashDash != null) {
    prompt = parsed.rawAfterDashDash.trim();
  } else {
    prompt = parsed._.join(" ").trim();
  }

  const mediaPaths = [
    ...(parsed.multi.image || []),
    ...(parsed.multi.video || []),
    ...(parsed.multi.media || []),
    ...(parsed.multi.file || []),
  ];

  return {
    asJson: Boolean(parsed.flags.json),
    background: Boolean(parsed.flags.background || parsed.flags.bg),
    resume: Boolean(parsed.flags.resume || parsed.flags["resume-last"]),
    fresh: Boolean(parsed.flags.fresh),
    asGoal: Boolean(parsed.flags.goal),
    withGit: Boolean(parsed.flags.git || parsed.flags["with-git"]),
    mode: parsed.options.mode || null,
    model: parsed.options.model || null,
    thinking: parsed.options.thinking || null,
    cwd: parsed.options.cwd || null,
    session: parsed.options.session || null,
    base: parsed.options.base || null,
    emptyRetries: parsed.options["empty-retries"] != null
      ? Number(parsed.options["empty-retries"])
      : null,
    timeoutMs: parsed.options.timeout ? Number(parsed.options.timeout) : null,
    mediaPaths,
    prompt,
    parsed,
  };
}
