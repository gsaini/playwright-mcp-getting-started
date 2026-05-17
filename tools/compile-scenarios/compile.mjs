#!/usr/bin/env node
/**
 * @file Compile Gherkin-style .feature files into Playwright MCP scenario
 * modules. Authoring time uses an LLM; runtime (`pnpm demo`) does not.
 *
 * SDK-agnostic: every model call goes through plain `fetch` so this tool runs
 * on any modern Node without an Anthropic / OpenAI / Ollama SDK installed.
 *
 *   pnpm spec:compile                          # Anthropic (default)
 *   pnpm spec:compile --provider=ollama        # Ollama at http://127.0.0.1:11434
 *   pnpm spec:compile --only=auth,catalog      # subset of features
 *   pnpm spec:compile --dry-run                # print prompt, no API call
 *
 * Environment:
 *   ANTHROPIC_API_KEY   required for --provider=anthropic
 *   OLLAMA_HOST         override default http://127.0.0.1:11434
 *
 * @module tools/compile-scenarios/compile
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(HERE));
const SCENARIOS_DIR = join(ROOT, "validator/scenarios");
const HELPERS_PATH = join(ROOT, "validator/lib/helpers.mjs");
const HARNESS_PATH = join(ROOT, "validator/lib/harness.mjs");
const SNAPSHOT_PATH = join(ROOT, "validator/lib/snapshot.mjs");
const EXAMPLE_FEATURE = join(HERE, "example.feature");
const EXAMPLE_MJS = join(HERE, "example.mjs");

// ───── CLI ─────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    provider: { type: "string", default: "anthropic" },
    model: { type: "string" },
    only: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(`
compile-scenarios — turn .feature specs into Playwright MCP .mjs files.

Usage:
  node tools/compile-scenarios/compile.mjs [options]

Options:
  --provider=<name>   "anthropic" (default) or "ollama"
  --model=<id>        Override the default model for the chosen provider
  --only=<list>       Comma-separated list of feature names (no extension)
  --dry-run           Print the system prompt and target list, no API call
  -h, --help          Show this help

Defaults:
  anthropic → claude-opus-4-7   (needs ANTHROPIC_API_KEY)
  ollama    → qwen2.5-coder:14b (needs Ollama running on OLLAMA_HOST,
                                 default http://127.0.0.1:11434)
`);
  process.exit(0);
}

// ───── Prompt construction ─────────────────────────────────────────────────

const INSTRUCTIONS = `You are a deterministic compiler. Your job is to translate a single
Gherkin-style .feature file into a JavaScript ES module that drives the
Playwright MCP server.

You will be shown the helper vocabulary (validator/lib/*.mjs) and exactly
one worked example (example.feature → example.mjs). Use the same helpers,
the same import shape, and the same file header style.

Hard rules
──────────
1. Output ONLY the JavaScript code, wrapped in a single \`\`\`js …\`\`\` fence.
   No prose, no preamble, no trailing commentary. The fence must be the
   first and last thing in your reply.
2. Import only from these paths:
     "../lib/harness.mjs"   → group, scenario, assert, assertEqual, assertContains
     "../lib/helpers.mjs"   → clickByRole, clickSelector, typeInto, typeSelector,
                              setReactInputValue, evaluate, screenshot, snapshot,
                              navigate, waitForText, waitForTextGone, waitForRender,
                              currentUrl
     "../lib/snapshot.mjs"  → findOne (only when the snapshot tree is parsed)
3. The exported function name is \`<group>Scenarios\` where <group> is the
   "Group:" field from the feature file. Signature is normally
   \`(mcp, APP_URL)\`; drop APP_URL if the feature never references it.
4. Start every group function with \`group("<group-name>");\`.
5. Each "Scenario:" in the feature becomes one \`await scenario("…", async () => { … });\`.
6. Prefer the helpers, in this rough order:
     - clickByRole / typeInto when the element has a clean ARIA name
     - clickSelector / typeSelector / setReactInputValue when given a CSS selector
     - evaluate when the assertion needs structured data
     - waitForText (specific text) over waitForRender (generic two-frame yield)
7. For React-controlled inputs, NEVER assign \`el.value = …\` directly inside
   an evaluate. Use setReactInputValue, which uses HTMLInputElement.prototype's
   native value setter so React's onChange fires.
8. Do not invent helpers, do not import from anywhere else, do not add CLI
   handling. The runtime entrypoint already does that.

File header
───────────
Begin every output file with this JSDoc, replacing <name> with the feature's
group name:

  /**
   * @file Compiled from scenarios/<name>.feature.
   * Edit the .feature and re-run \`pnpm spec:compile\`; do not hand-edit.
   */

Helper vocabulary (verbatim)
────────────────────────────
{{HELPERS}}

Harness vocabulary (verbatim)
─────────────────────────────
{{HARNESS}}

Snapshot helper (verbatim)
──────────────────────────
{{SNAPSHOT}}

Worked example
──────────────
INPUT (example.feature):

{{EXAMPLE_FEATURE}}

OUTPUT (example.mjs):

\`\`\`js
{{EXAMPLE_MJS}}
\`\`\``;

async function buildSystemPrompt() {
  const [helpers, harness, snapshot, exampleFeature, exampleMjs] = await Promise.all([
    readFile(HELPERS_PATH, "utf8"),
    readFile(HARNESS_PATH, "utf8"),
    readFile(SNAPSHOT_PATH, "utf8"),
    readFile(EXAMPLE_FEATURE, "utf8"),
    readFile(EXAMPLE_MJS, "utf8"),
  ]);
  return INSTRUCTIONS.replace("{{HELPERS}}", helpers)
    .replace("{{HARNESS}}", harness)
    .replace("{{SNAPSHOT}}", snapshot)
    .replace("{{EXAMPLE_FEATURE}}", exampleFeature)
    .replace("{{EXAMPLE_MJS}}", exampleMjs);
}

// ───── Providers (raw fetch, no SDK) ───────────────────────────────────────

/**
 * @typedef {object} CompileResult
 * @property {string}  code                Extracted JS source (no fence).
 * @property {boolean} [cacheHit]          True if the provider reports a cache read.
 * @property {number}  [outputTokens]      Tokens produced.
 */

/**
 * Call the Anthropic Messages API directly. The system prompt is wrapped in
 * a single content block with `cache_control: ephemeral` so the (large)
 * helper vocabulary is paid for once and read from cache for files 2..N.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} model
 * @returns {Promise<CompileResult>}
 */
async function callAnthropic(systemPrompt, userPrompt, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Export it or pass --provider=ollama.");
  }

  const body = {
    model,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${detail.slice(0, 500)}`);
  }
  const data = await resp.json();
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    code: extractCode(text),
    cacheHit: (data.usage?.cache_read_input_tokens ?? 0) > 0,
    outputTokens: data.usage?.output_tokens,
  };
}

/**
 * Call a local Ollama instance. No caching (everything is local) and no
 * thinking parameter — Ollama models with reasoning support it as part of
 * the response stream, which we don't need here.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} model
 * @returns {Promise<CompileResult>}
 */
async function callOllama(systemPrompt, userPrompt, model) {
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const resp = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: { temperature: 0.1 },
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Ollama API ${resp.status}: ${detail.slice(0, 500)}`);
  }
  const data = await resp.json();
  return {
    code: extractCode(data.message?.content ?? ""),
    outputTokens: data.eval_count,
  };
}

/**
 * Extract the JS code from the model's response. The system prompt mandates
 * a single ```js …``` fence; if the model ignored that, fall back to the
 * whole string.
 *
 * @param {string} text
 * @returns {string}
 */
function extractCode(text) {
  const m = text.match(/```(?:js|javascript|mjs)?\s*\n([\s\S]*?)\n```/);
  return (m ? m[1] : text).trim();
}

// ───── Main ────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(SCENARIOS_DIR)) {
    throw new Error(`scenarios directory not found: ${SCENARIOS_DIR}`);
  }
  const allFeatures = (await readdir(SCENARIOS_DIR)).filter((f) => f.endsWith(".feature"));
  if (allFeatures.length === 0) {
    console.log("No .feature files found in validator/scenarios/.");
    return;
  }

  /** @type {Set<string> | null} */
  const filter = values.only ? new Set(values.only.split(",").map((s) => s.trim())) : null;
  const targets = allFeatures.filter((f) => !filter || filter.has(basename(f, ".feature")));

  if (targets.length === 0) {
    console.log(`No .feature files match --only=${values.only}.`);
    return;
  }

  const model =
    values.model ?? (values.provider === "anthropic" ? "claude-opus-4-7" : "qwen2.5-coder:14b");

  console.log(`Compiling ${targets.length} feature file(s) via ${values.provider} (${model})...`);
  const systemPrompt = await buildSystemPrompt();

  if (values["dry-run"]) {
    console.log(`\nSystem prompt: ${systemPrompt.length} characters`);
    console.log(`Targets:`);
    for (const f of targets) console.log(`  - ${f}`);
    console.log(`\nFirst 600 chars of system prompt:\n${systemPrompt.slice(0, 600)}…`);
    return;
  }

  await mkdir(SCENARIOS_DIR, { recursive: true });

  for (const featureFile of targets) {
    const name = basename(featureFile, ".feature");
    const featureText = await readFile(join(SCENARIOS_DIR, featureFile), "utf8");
    const userPrompt = `Compile this feature file into a Playwright MCP scenario module.\n\nFEATURE FILE: scenarios/${featureFile}\n\n${featureText}`;

    process.stdout.write(`  • ${featureFile} → ${name}.mjs ... `);
    const started = Date.now();
    const result =
      values.provider === "anthropic"
        ? await callAnthropic(systemPrompt, userPrompt, model)
        : values.provider === "ollama"
          ? await callOllama(systemPrompt, userPrompt, model)
          : (() => {
              throw new Error(`Unknown provider: ${values.provider}`);
            })();
    const ms = Date.now() - started;

    const header = `/**
 * @file AUTO-GENERATED from scenarios/${featureFile} by tools/compile-scenarios.
 * DO NOT EDIT BY HAND. Edit the .feature file and re-run \`pnpm spec:compile\`.
 *
 * Compiled: ${new Date().toISOString()}
 * Provider: ${values.provider}
 * Model:    ${model}
 */

`;
    // Drop any duplicate header the model emitted, then prepend ours.
    const stripped = result.code.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*\n+/, "");
    await writeFile(join(SCENARIOS_DIR, `${name}.mjs`), header + stripped + "\n");

    const tags = [
      `${ms}ms`,
      result.cacheHit === true ? "cache hit" : result.cacheHit === false ? "cache write" : null,
      result.outputTokens != null ? `${result.outputTokens} tok` : null,
    ].filter(Boolean);
    process.stdout.write(`done (${tags.join(", ")})\n`);
  }
  console.log("\nAll done. Run `pnpm demo` to verify the compiled scenarios.");
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
