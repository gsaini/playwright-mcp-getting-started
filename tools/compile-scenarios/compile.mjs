#!/usr/bin/env node
/**
 * @file Compile intent-level .feature files into Playwright MCP scenario
 * modules — using an LLM that DRIVES the live app at compile time.
 *
 * At compile time the LLM:
 *   1. Reads a .feature file (plain-English intent).
 *   2. Uses Playwright MCP tools (navigate, snapshot, click, type, evaluate, …)
 *      to explore the actually-running app and learn the real selectors,
 *      ARIA names, route paths, and rendered text.
 *   3. Emits the final .mjs by calling a `write_scenario` tool with the
 *      complete file contents.
 *
 * At runtime (`pnpm demo`) the generated .mjs runs deterministically with
 * no LLM in the loop — the same Playwright MCP server is used, just by
 * deterministic JavaScript instead of by a model.
 *
 * Both Anthropic and Ollama are supported via raw HTTP — no SDK dependency.
 *
 *   ANTHROPIC_API_KEY=… pnpm spec:compile
 *   pnpm spec:compile --provider=ollama --model=qwen2.5-coder:14b
 *   pnpm spec:compile --only=auth,catalog
 *   pnpm spec:compile --dry-run            # describe the plan, don't call any model
 *
 * @module tools/compile-scenarios/compile
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { connectPlaywrightMcp } from "../../validator/lib/mcp-client.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(HERE));
const FEATURES_DIR = join(ROOT, "validator/features");
const SCENARIOS_DIR = join(ROOT, "validator/scenarios");
const HELPERS_PATH = join(ROOT, "validator/lib/helpers.mjs");
const HARNESS_PATH = join(ROOT, "validator/lib/harness.mjs");
const SNAPSHOT_PATH = join(ROOT, "validator/lib/snapshot.mjs");
const EXAMPLE_FEATURE = join(HERE, "example.feature");
const EXAMPLE_MJS = join(HERE, "example.mjs");

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:5173/";

/** Maximum tool-use rounds per feature before bailing out. */
const MAX_TURNS = 60;

/** Truncate large tool-result payloads (e.g. full-page snapshots). */
const TOOL_RESULT_CHAR_CAP = 6000;

// ─── CLI ──────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    provider: { type: "string", default: "anthropic" },
    model: { type: "string" },
    only: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "max-turns": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help) {
  console.log(`
compile-scenarios — turn intent-level .feature specs into Playwright MCP
                    scenario modules by having an LLM drive the live app.

Usage:
  node tools/compile-scenarios/compile.mjs [options]

Options:
  --provider=<name>    "anthropic" (default) or "ollama"
  --model=<id>         Override the default model for the chosen provider
  --only=<list>        Comma-separated feature names (no extension)
  --max-turns=<n>      Override the per-feature tool-use safety cap (${MAX_TURNS})
  --dry-run            Print the plan and skip every model call
  -h, --help           Show this help

Defaults:
  anthropic → claude-opus-4-7   (requires ANTHROPIC_API_KEY)
  ollama    → qwen2.5-coder:14b (requires Ollama running on OLLAMA_HOST,
                                 default http://127.0.0.1:11434, with a
                                 tool-use-capable model)
`);
  process.exit(0);
}

const MAX_TURNS_RUN = values["max-turns"] ? Number.parseInt(values["max-turns"], 10) : MAX_TURNS;

// ─── Tool catalogue ───────────────────────────────────────────────────────
//
// Canonical (internal) form is Anthropic-style: { name, description, input_schema }.
// Convert at the Ollama boundary in providers.ollama.send().

/** @type {Array<{ name: string, description: string, input_schema: object }>} */
const TOOLS = [
  {
    name: "browser_navigate",
    description: "Navigate the browser to a URL. Use this to reach a specific route.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "Absolute URL" } },
      required: ["url"],
    },
  },
  {
    name: "browser_snapshot",
    description:
      "Take an accessibility snapshot of the current page. Returns a YAML-ish tree " +
      "with each element's role, accessible name, and a ref id (e.g. [ref=e7]) you " +
      "can pass back as `target` to browser_click / browser_type.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "browser_click",
    description:
      "Click an element. `target` accepts either a snapshot ref ('e7') or a CSS " +
      "selector ('#submit-button'). `element` is a human-readable description used " +
      "only for the tool-call audit log.",
    input_schema: {
      type: "object",
      properties: {
        element: { type: "string" },
        target: { type: "string" },
      },
      required: ["element", "target"],
    },
  },
  {
    name: "browser_type",
    description:
      "Type text into an editable element. `target` is a snapshot ref or CSS " +
      "selector. Set `submit: true` to press Enter after typing.",
    input_schema: {
      type: "object",
      properties: {
        element: { type: "string" },
        target: { type: "string" },
        text: { type: "string" },
        submit: { type: "boolean" },
      },
      required: ["element", "target", "text"],
    },
  },
  {
    name: "browser_press_key",
    description: "Press a single key (e.g. 'Enter', 'Tab', 'Escape').",
    input_schema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
  },
  {
    name: "browser_wait_for",
    description:
      "Wait for text to appear (`text`), wait for text to disappear (`textGone`), " +
      "or wait a fixed duration in seconds (`time`).",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        textGone: { type: "string" },
        time: { type: "number" },
      },
    },
  },
  {
    name: "browser_evaluate",
    description:
      "Run a JS function in the page. Use this to read computed state " +
      "(localStorage, dataset attributes, .textContent of arbitrary elements). " +
      "The function signature must be '() => …' — no parameters.",
    input_schema: {
      type: "object",
      properties: { function: { type: "string", description: "JS function source" } },
      required: ["function"],
    },
  },
  {
    name: "write_scenario",
    description:
      "Save the final scenario module. Call this EXACTLY ONCE per feature, when " +
      "you've finished exploring and have a complete .mjs ready to ship. `code` " +
      "is the full file contents (no markdown fence — raw JS).",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", description: "Full .mjs file contents" } },
      required: ["code"],
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT_TEMPLATE = `You are an AI compiler. Each invocation, you are given ONE plain-English
.feature file. Your job is to:

  1. Use the browser_* tools to drive a live instance of the app and
     observe its real DOM (accessibility tree, computed state, route
     URLs). Do NOT rely on assumptions about selector names — verify
     them by snapshotting the page.

  2. Once you have enough information, call write_scenario EXACTLY ONCE
     with a complete .mjs file that implements the feature's scenarios.

  3. Do not call write_scenario more than once. Do not emit prose outside
     of tool calls.

The output .mjs is consumed by a deterministic runner — it must use only
the helpers listed below. Do not import from anywhere else, do not invent
helpers, do not write inline DOM-driving code.

══════════════════════════════════════════════════════════════════════════
Helpers vocabulary — validator/lib/helpers.mjs
══════════════════════════════════════════════════════════════════════════

{{HELPERS}}

══════════════════════════════════════════════════════════════════════════
Harness vocabulary — validator/lib/harness.mjs
══════════════════════════════════════════════════════════════════════════

{{HARNESS}}

══════════════════════════════════════════════════════════════════════════
Snapshot helper — validator/lib/snapshot.mjs
══════════════════════════════════════════════════════════════════════════

{{SNAPSHOT}}

══════════════════════════════════════════════════════════════════════════
Worked example (INPUT .feature → OUTPUT .mjs)
══════════════════════════════════════════════════════════════════════════

INPUT (example.feature):

{{EXAMPLE_FEATURE}}

OUTPUT (example.mjs) — exactly the shape the .mjs you write should take:

{{EXAMPLE_MJS}}

══════════════════════════════════════════════════════════════════════════
Hard rules for the generated .mjs
══════════════════════════════════════════════════════════════════════════

1. Imports — only from these paths:
     "../lib/harness.mjs"   group, scenario, assert, assertEqual, assertContains
     "../lib/helpers.mjs"   clickByRole, clickSelector, typeInto, typeSelector,
                            setReactInputValue, evaluate, screenshot, snapshot,
                            navigate, waitForText, waitForTextGone, waitForRender,
                            currentUrl
     "../lib/snapshot.mjs"  findOne (only when the snapshot tree is parsed)
   For visual scenarios add: import { join } from "node:path";

2. Exported function name is \`<group>Scenarios\` where <group> is the
   "Group:" field from the .feature. The signature is normally
   \`(mcp, APP_URL)\`; drop APP_URL if the scenarios never reference it.

3. Start the exported function with \`group("<group-name>");\`.

4. Each "Scenario:" in the .feature becomes one
   \`await scenario("<name>", async () => { … });\` block.

5. Prefer helpers in roughly this order:
     • clickByRole / typeInto    when the element has a clean ARIA name
     • clickSelector / typeSelector / setReactInputValue   for CSS selectors
     • evaluate                  for structured assertions
     • waitForText (specific text) over waitForRender (generic two-frame yield)

6. For React-controlled inputs, NEVER do \`el.value = …\` inside an evaluate
   — the controlled-input tracker won't fire onChange. Use setReactInputValue.

7. The generated file must begin with this exact JSDoc, with the feature
   filename interpolated:

     /**
      * @file Compiled from features/<name>.feature.
      * Edit the .feature and re-run \`pnpm spec:compile\`; do not hand-edit.
      */

══════════════════════════════════════════════════════════════════════════
Workflow expectations
══════════════════════════════════════════════════════════════════════════

• The browser starts at ${APP_URL}. Navigate from there as needed.

• Snapshot the page before clicking unfamiliar elements — the accessibility
  tree shows you the real ARIA names and refs.

• Verify text-based wait conditions by snapshotting after the wait. If
  text appears on multiple pages, pick a more specific anchor.

• Use evaluate sparingly. Prefer snapshot lookups when possible.

• If a tool call fails, read the error and adjust — don't repeat the same
  call hoping for a different result.

• Treat scenarios in the .feature as appearing in order; the runtime state
  carries from one scenario to the next within the group. Mirror that in
  your exploration and in the generated code.

• When you're done exploring, call write_scenario ONCE. The argument is
  the complete file contents starting with the JSDoc header. After that,
  end your turn — do not call any more tools.`;

async function buildSystemPrompt() {
  const [helpers, harness, snapshot, exampleFeature, exampleMjs] = await Promise.all([
    readFile(HELPERS_PATH, "utf8"),
    readFile(HARNESS_PATH, "utf8"),
    readFile(SNAPSHOT_PATH, "utf8"),
    readFile(EXAMPLE_FEATURE, "utf8"),
    readFile(EXAMPLE_MJS, "utf8"),
  ]);
  return SYSTEM_PROMPT_TEMPLATE.replace("{{HELPERS}}", helpers)
    .replace("{{HARNESS}}", harness)
    .replace("{{SNAPSHOT}}", snapshot)
    .replace("{{EXAMPLE_FEATURE}}", exampleFeature)
    .replace("{{EXAMPLE_MJS}}", exampleMjs);
}

// ─── Providers ────────────────────────────────────────────────────────────

/**
 * Provider interface. `send` takes a system prompt + canonical messages +
 * canonical tools and returns a canonical response with content blocks.
 *
 * @typedef {object} ProviderResponse
 * @property {Array<object>} content     Anthropic-shape content blocks.
 * @property {string} stop_reason         "tool_use" | "end_turn" | other
 * @property {{cacheHit?: boolean, outputTokens?: number}} [usage]
 */

/**
 * Anthropic. Raw HTTP to /v1/messages. The big static system prompt is
 * cached so files 2..N read at ~10% of input cost.
 */
const anthropicProvider = {
  name: "anthropic",
  defaultModel: "claude-opus-4-7",
  async send({ system, messages, tools, model }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Export it or pass --provider=ollama.",
      );
    }
    const body = {
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      tools,
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
      const detail = (await resp.text()).slice(0, 500);
      throw new Error(`Anthropic ${resp.status}: ${detail}`);
    }
    const data = await resp.json();
    return {
      content: data.content,
      stop_reason: data.stop_reason,
      usage: {
        cacheHit: (data.usage?.cache_read_input_tokens ?? 0) > 0,
        outputTokens: data.usage?.output_tokens,
      },
    };
  },
};

/**
 * Ollama (OpenAI-style chat completions). No prompt caching (local). Needs
 * a tool-use-capable model — qwen2.5-coder:14b, llama3.1:8b, llama3.2:3b
 * all work. The model must support `tools` in /api/chat — check `ollama
 * show <model>` for "tools" in the capabilities list.
 */
const ollamaProvider = {
  name: "ollama",
  defaultModel: "qwen2.5-coder:14b",
  async send({ system, messages, tools, model }) {
    const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
    const ollamaTools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    const ollamaMessages = [
      { role: "system", content: system },
      ...convertMessagesToOpenAI(messages),
    ];
    const resp = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: ollamaMessages,
        tools: ollamaTools,
        options: { temperature: 0.1, num_ctx: 32_768 },
      }),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 500);
      throw new Error(`Ollama ${resp.status}: ${detail}`);
    }
    const data = await resp.json();
    return convertOpenAIResponse(data);
  },
};

const PROVIDERS = { anthropic: anthropicProvider, ollama: ollamaProvider };

/**
 * Convert canonical (Anthropic-shape) messages to OpenAI/Ollama shape.
 * Anthropic encodes tool calls and tool results as content blocks inside
 * assistant/user messages; OpenAI promotes them to their own top-level
 * messages (tool_calls on assistant, separate role:"tool" entries for
 * results). We unpack accordingly.
 */
function convertMessagesToOpenAI(messages) {
  const out = [];
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (msg.role === "user") {
      const text = [];
      for (const block of msg.content) {
        if (block.type === "text") text.push(block.text);
        else if (block.type === "tool_result") {
          const content =
            typeof block.content === "string" ? block.content : JSON.stringify(block.content);
          out.push({ role: "tool", tool_call_id: block.tool_use_id, content });
        }
      }
      if (text.length > 0) out.push({ role: "user", content: text.join("\n") });
    } else if (msg.role === "assistant") {
      let text = "";
      const toolCalls = [];
      for (const block of msg.content) {
        if (block.type === "text") text += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: { name: block.name, arguments: JSON.stringify(block.input) },
          });
        }
      }
      const m = { role: "assistant", content: text };
      if (toolCalls.length > 0) m.tool_calls = toolCalls;
      out.push(m);
    }
  }
  return out;
}

/** Convert an Ollama /api/chat response to canonical (Anthropic-shape). */
function convertOpenAIResponse(data) {
  const msg = data.message ?? {};
  const content = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      const fn = tc.function ?? {};
      const args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
      content.push({
        type: "tool_use",
        id: tc.id ?? `toolu_${Math.random().toString(36).slice(2, 12)}`,
        name: fn.name,
        input: args ?? {},
      });
    }
  }
  const hasToolUse = content.some((b) => b.type === "tool_use");
  return {
    content,
    stop_reason: hasToolUse ? "tool_use" : "end_turn",
    usage: { outputTokens: data.eval_count },
  };
}

// ─── Agentic loop ─────────────────────────────────────────────────────────

/**
 * Compile one feature file. Runs the tool-use loop until the model calls
 * write_scenario, then returns the captured code.
 */
async function compileFeature({ name, featureText, mcp, systemPrompt, provider, model }) {
  // Reset state — start fresh at the home page so the model sees the
  // logged-out app. Auth scenarios begin from there; other groups will
  // sign in as part of their exploration via the Background context.
  await mcp.call("browser_navigate", { url: APP_URL });

  const userMessage =
    `Compile this feature into a Playwright MCP scenario module. The app is ` +
    `running at ${APP_URL}; the browser is already there. Explore freely with ` +
    `the browser_* tools, then call write_scenario ONCE with the complete .mjs.\n\n` +
    `FEATURE FILE: features/${name}.feature\n\n${featureText}`;

  const messages = [{ role: "user", content: userMessage }];
  let written = null;
  let toolCalls = 0;
  let cachedTurns = 0;

  for (let turn = 0; turn < MAX_TURNS_RUN; turn++) {
    const response = await provider.send({ system: systemPrompt, messages, tools: TOOLS, model });
    if (response.usage?.cacheHit) cachedTurns++;
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      if (written) break;
      throw new Error(
        `Model ended its turn without calling write_scenario (turn ${turn + 1}).`,
      );
    }

    const toolResults = [];
    for (const tu of toolUses) {
      toolCalls++;
      const argSummary = JSON.stringify(tu.input).slice(0, 80);
      process.stdout.write(`      → ${tu.name} ${argSummary} `);
      let resultContent;
      let isError = false;

      if (tu.name === "write_scenario") {
        if (written) {
          resultContent = "write_scenario was already called. Stop calling tools.";
          isError = true;
          process.stdout.write("× (duplicate)\n");
        } else {
          written = tu.input.code ?? "";
          resultContent =
            `Captured ${written.length} characters. Acknowledge and stop calling tools.`;
          process.stdout.write(`✓ (${written.length} chars)\n`);
        }
      } else if (tu.name.startsWith("browser_")) {
        try {
          const r = await mcp.call(tu.name, tu.input);
          resultContent =
            r.text.length > TOOL_RESULT_CHAR_CAP
              ? `${r.text.slice(0, TOOL_RESULT_CHAR_CAP)}\n…[truncated, ${r.text.length} total]`
              : r.text;
          process.stdout.write("✓\n");
        } catch (err) {
          resultContent = err.message;
          isError = true;
          process.stdout.write(`× ${err.message.split("\n")[0].slice(0, 60)}\n`);
        }
      } else {
        resultContent = `Unknown tool: ${tu.name}`;
        isError = true;
        process.stdout.write("× (unknown)\n");
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: resultContent,
        ...(isError && { is_error: true }),
      });
    }

    messages.push({ role: "user", content: toolResults });
    if (written) break;
  }

  if (!written) {
    throw new Error(`Max turns (${MAX_TURNS_RUN}) reached without write_scenario.`);
  }
  return { code: written, toolCalls, cachedTurns };
}

// ─── Infrastructure ───────────────────────────────────────────────────────

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`URL not ready: ${url}`);
}

async function startVite() {
  console.log(`Starting Vite at ${APP_URL}...`);
  const child = spawn("pnpm", ["app"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, BROWSER: "none" },
  });
  await waitForUrl(APP_URL, 30_000);
  return child;
}

function stripHeader(code) {
  // Drop any duplicate file-level JSDoc the model emitted — we prepend our own.
  return code.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*\n+/, "");
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(FEATURES_DIR)) throw new Error(`features dir missing: ${FEATURES_DIR}`);
  await mkdir(SCENARIOS_DIR, { recursive: true });

  const all = (await readdir(FEATURES_DIR)).filter((f) => f.endsWith(".feature")).sort();
  const filter = values.only ? new Set(values.only.split(",").map((s) => s.trim())) : null;
  const targets = all.filter((f) => !filter || filter.has(basename(f, ".feature")));

  if (targets.length === 0) {
    console.log("No .feature files match the filter.");
    return;
  }

  const provider = PROVIDERS[values.provider];
  if (!provider) {
    throw new Error(
      `Unknown provider: ${values.provider} (expected "anthropic" or "ollama").`,
    );
  }
  const model = values.model ?? provider.defaultModel;

  console.log(`Provider: ${provider.name} (${model})`);
  console.log(`Targets: ${targets.length} feature(s)`);
  for (const f of targets) console.log(`  • ${f}`);
  console.log();

  const systemPrompt = await buildSystemPrompt();
  console.log(`System prompt: ${systemPrompt.length.toLocaleString()} characters\n`);

  if (values["dry-run"]) {
    console.log("Dry run — no model call, no infrastructure spawn. Exiting.");
    return;
  }

  // Spin up app + Playwright MCP for the duration of the compile.
  const appProc = await startVite();
  let mcp;
  try {
    console.log("Connecting to Playwright MCP...");
    mcp = await connectPlaywrightMcp({ headless: true });
    console.log(`Connected (${(await mcp.listTools()).length} tools).\n`);

    for (const featureFile of targets) {
      const name = basename(featureFile, ".feature");
      const featureText = await readFile(join(FEATURES_DIR, featureFile), "utf8");

      console.log(`■ ${featureFile}`);
      const started = Date.now();
      const { code, toolCalls, cachedTurns } = await compileFeature({
        name,
        featureText,
        mcp,
        systemPrompt,
        provider,
        model,
      });
      const elapsed = Math.round((Date.now() - started) / 1000);

      const header =
        `/**\n` +
        ` * @file AUTO-GENERATED from features/${featureFile} by tools/compile-scenarios.\n` +
        ` * DO NOT EDIT BY HAND. Edit the .feature and re-run \`pnpm spec:compile\`.\n` +
        ` *\n` +
        ` * Compiled: ${new Date().toISOString()}\n` +
        ` * Provider: ${provider.name}\n` +
        ` * Model:    ${model}\n` +
        ` */\n\n`;

      await writeFile(join(SCENARIOS_DIR, `${name}.mjs`), header + stripHeader(code) + "\n");
      console.log(
        `    written → scenarios/${name}.mjs (${elapsed}s, ${toolCalls} tool calls, ` +
          `${cachedTurns} cache hit${cachedTurns === 1 ? "" : "s"})\n`,
      );
    }

    console.log("All compiled. Run `pnpm demo` to verify.");
  } finally {
    if (mcp) await mcp.close().catch(() => {});
    appProc.kill();
    await sleep(200);
  }
}

main().catch((err) => {
  console.error("\nFatal:", err.stack ?? err.message ?? err);
  process.exit(1);
});
