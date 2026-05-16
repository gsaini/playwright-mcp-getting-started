/**
 * @file Deterministic frontend validator driven via Playwright MCP.
 *
 * This script is the demo's entrypoint. It connects to a `@playwright/mcp`
 * server over stdio (no LLM), runs a fixed list of scenarios against the
 * demo app at {@link APP_URL}, and prints a pass/fail summary.
 *
 * Three assertion styles are intentionally mixed across the scenarios so the
 * file doubles as a teaching example:
 *
 *  1. **Snapshot tree** — call `browser_snapshot`, parse with
 *     {@link parseSnapshot}, look up nodes by ARIA role + name.
 *  2. **CSS selector** — the `target` argument of `browser_click` /
 *     `browser_type` accepts any unique selector in addition to snapshot
 *     refs, which is handy when the snapshot tree is noisy.
 *  3. **Page evaluate** — run arbitrary JS in the page via `browser_evaluate`
 *     and JSON-decode the result for precise structural assertions.
 *
 * CLI flags:
 *   --start-app   Spawn the demo app as a child process before running and
 *                 tear it down afterwards. Without this flag the app must
 *                 already be reachable at {@link APP_URL}.
 *   --headed      Launch Chromium with a visible window. Useful for demos
 *                 and for debugging unexpected scenario failures.
 *
 * Environment variables:
 *   APP_URL       Override the default `http://localhost:5173/`.
 *
 * @module validator/run
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { connectPlaywrightMcp } from "./mcp-client.mjs";
import { findOne, parseSnapshot } from "./snapshot.mjs";

/** Directory containing this script. @type {string} */
const HERE = dirname(fileURLToPath(import.meta.url));

/** Project root (one level up from {@link HERE}). @type {string} */
const ROOT = dirname(HERE);

/** URL where the demo app is expected to be reachable. @type {string} */
const APP_URL = process.env.APP_URL ?? "http://localhost:5173/";

/** Output directory for screenshots captured during scenarios. @type {string} */
const SHOTS = join(ROOT, "screenshots");

// ---------------------------------------------------------------------------
// Tiny in-file test harness
// ---------------------------------------------------------------------------

/**
 * Recorded outcome of a single scenario run.
 *
 * @typedef {object} ScenarioResult
 * @property {string}   name   Scenario name (matches the `scenario()` label).
 * @property {boolean}  ok     `true` if the scenario completed without throwing.
 * @property {number}   ms     Wall-clock duration in milliseconds.
 * @property {unknown} [error] The thrown error, if any.
 */

/** Accumulated results, populated by {@link scenario}. @type {ScenarioResult[]} */
const results = [];

/**
 * Run a single named scenario and record its result.
 *
 * Any thrown error — assertion failure, tool error, parser miss — is caught
 * and reported inline rather than aborting the run, so the operator sees the
 * full pass/fail picture in one go.
 *
 * @param {string} name                       Human-readable scenario label.
 * @param {() => Promise<void>} fn            Async body containing tool calls
 *                                            and assertions.
 * @returns {Promise<void>}
 */
async function scenario(name, fn) {
  const started = Date.now();
  process.stdout.write(`  • ${name} ... `);
  try {
    await fn();
    const ms = Date.now() - started;
    console.log(`\x1b[32mPASS\x1b[0m (${ms}ms)`);
    results.push({ name, ok: true, ms });
  } catch (err) {
    const ms = Date.now() - started;
    console.log(`\x1b[31mFAIL\x1b[0m (${ms}ms)`);
    console.log(indent(String(err.stack ?? err.message ?? err), "      "));
    results.push({ name, ok: false, ms, error: err });
  }
}

/**
 * Assert that `cond` is truthy, otherwise throw with the supplied message.
 *
 * @param {unknown} cond   Condition to test.
 * @param {string}  msg    Description of what should have been true.
 * @returns {void}
 * @throws {Error}         When the condition is falsy.
 */
function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

/**
 * Assert deep-equality between two JSON-serialisable values. The comparison
 * is performed via `JSON.stringify` so it correctly handles plain objects,
 * arrays and primitives but ignores key insertion order differences in
 * objects (because `JSON.stringify` is order-sensitive — callers should keep
 * fixtures consistent).
 *
 * @template T
 * @param {T}      actual    Value produced by the scenario.
 * @param {T}      expected  Expected value.
 * @param {string} [msg]     Optional preamble for the failure message.
 * @returns {void}
 * @throws {Error}           When the two values stringify differently.
 */
function assertEqual(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || "values differ"}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

/**
 * Indent every line of a multi-line string by a fixed prefix. Used to
 * pretty-print stack traces under their parent scenario.
 *
 * @param {string} text
 * @param {string} pad
 * @returns {string}
 */
function indent(text, pad) {
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}

// ---------------------------------------------------------------------------
// MCP helpers built on top of the raw tools
// ---------------------------------------------------------------------------

/**
 * @typedef {import("./mcp-client.mjs").PlaywrightMcp} PlaywrightMcp
 * @typedef {import("./snapshot.mjs").SnapshotNode}    SnapshotNode
 */

/**
 * Combined result of taking a snapshot and parsing it. Both shapes are
 * returned because some callers want the raw text (for logging) while others
 * just want the parsed nodes (for lookups).
 *
 * @typedef {object} ParsedSnapshot
 * @property {string}         text   Raw text returned by `browser_snapshot`.
 * @property {SnapshotNode[]} nodes  Parsed nodes ready for {@link findOne}.
 */

/**
 * Take a fresh accessibility snapshot of the current page and parse it.
 *
 * @param {PlaywrightMcp} mcp
 * @returns {Promise<ParsedSnapshot>}
 */
async function snapshot(mcp) {
  const { text } = await mcp.call("browser_snapshot");
  return { text, nodes: parseSnapshot(text) };
}

/**
 * Click the first element matching an ARIA role + accessible name pair,
 * resolved via the most recent page snapshot.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} role            ARIA role (`"button"`, `"link"`, ...).
 * @param {string | RegExp} name   Accessible name to match.
 * @returns {Promise<void>}
 */
async function clickByRole(mcp, role, name) {
  const { nodes } = await snapshot(mcp);
  const node = findOne(nodes, role, name);
  await mcp.call("browser_click", {
    element: `${role} "${node.name}"`,
    target: node.ref,
  });
}

/**
 * Type text into a textbox identified by its accessible name. If `submit` is
 * `true`, an Enter keystroke is appended (useful for forms that submit on
 * Enter rather than via a button click).
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} name              Accessible name of the textbox.
 * @param {string} text              Text to enter.
 * @param {object} [options]
 * @param {boolean} [options.submit=false]
 * @returns {Promise<void>}
 */
async function typeInto(mcp, name, text, { submit = false } = {}) {
  const { nodes } = await snapshot(mcp);
  const node = findOne(nodes, "textbox", name);
  await mcp.call("browser_type", {
    element: `textbox "${node.name}"`,
    target: node.ref,
    text,
    submit,
  });
}

/**
 * Click the element matched by a CSS selector. The `target` argument of
 * `browser_click` accepts CSS selectors in addition to snapshot refs, which
 * is the cleanest option when the element is easy to address by ID/class
 * but awkward to address by ARIA name.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} selector         Unique CSS selector.
 * @param {string} [description]    Human-readable description for the tool's
 *                                  permission/audit log. Defaults to the
 *                                  selector itself.
 * @returns {Promise<void>}
 */
async function clickSelector(mcp, selector, description = selector) {
  await mcp.call("browser_click", { element: description, target: selector });
}

/**
 * Run a JavaScript function inside the page and JSON-decode its result.
 *
 * The `browser_evaluate` tool returns a markdown-formatted text envelope:
 *
 * ```
 * ### Result
 * <JSON value>
 * ### Ran Playwright code
 * ```js
 * ...
 * ```
 * ```
 *
 * We extract the value between the `### Result` heading and the next `###`
 * heading (or end of string) and `JSON.parse` it. Strings that fail to parse
 * are returned verbatim, which keeps the helper useful when the page returns
 * plain text or a non-JSON literal.
 *
 * @template T
 * @param {PlaywrightMcp} mcp
 * @param {(...args: unknown[]) => T} fn   Function to evaluate in the page.
 *                                         Must reference only globals
 *                                         available to the page; closures
 *                                         over Node-side state will NOT work.
 * @param {...unknown} args                 Arguments forwarded to `fn`. Must
 *                                          be JSON-serialisable.
 * @returns {Promise<T>}                    The decoded return value.
 */
async function evaluate(mcp, fn, ...args) {
  const body = `(${fn.toString()}).apply(null, ${JSON.stringify(args)})`;
  const { text } = await mcp.call("browser_evaluate", { function: `() => ${body}` });

  const match = text.match(/###\s*Result\s*\n([\s\S]*?)(?:\n###|\s*$)/);
  const payload = (match ? match[1] : text).trim();
  if (payload === "" || payload === "undefined") return /** @type {T} */ (undefined);
  try {
    return JSON.parse(payload);
  } catch {
    return /** @type {T} */ (payload);
  }
}

/**
 * Capture a full-page screenshot to {@link SHOTS}.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} filename   File name (relative or absolute). Use a `.png`
 *                            suffix to match the `type: "png"` requested.
 * @returns {Promise<void>}
 */
async function screenshot(mcp, filename) {
  await mcp.call("browser_take_screenshot", {
    type: "png",
    filename: join(SHOTS, filename),
    fullPage: true,
  });
}

// ---------------------------------------------------------------------------
// The actual validation flow
// ---------------------------------------------------------------------------

/**
 * Entrypoint. Orchestrates: optional app spawn → MCP connect → scenarios →
 * summary → teardown. Sets `process.exitCode = 1` when any scenario fails so
 * CI pipelines can treat the run as a failure.
 *
 * @returns {Promise<void>}
 */
async function main() {
  await mkdir(SHOTS, { recursive: true });

  /** @type {import("node:child_process").ChildProcess | undefined} */
  let appProc;
  if (process.argv.includes("--start-app")) {
    console.log("Starting demo app...");
    appProc = spawn("node", [join(ROOT, "app", "server.mjs")], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    await waitForUrl(APP_URL, 5000);
  }

  console.log("Connecting to Playwright MCP server...");
  const mcp = await connectPlaywrightMcp({
    headless: !process.argv.includes("--headed"),
  });

  try {
    const tools = await mcp.listTools();
    console.log(`Connected. ${tools.length} tools available:`);
    for (const t of tools.slice(0, 8)) console.log(`    - ${t.name}`);
    if (tools.length > 8) console.log(`    … and ${tools.length - 8} more`);
    console.log();

    console.log("Running scenarios:");

    // Scenario 1 — Sanity check: page loads and renders the expected
    // accessibility tree. Uses pattern (1): snapshot lookups.
    await scenario("loads the login screen", async () => {
      await mcp.call("browser_navigate", { url: APP_URL });
      const { nodes } = await snapshot(mcp);
      findOne(nodes, "heading", "Sign in");
      findOne(nodes, "textbox", "Username");
      findOne(nodes, "textbox", "Password");
      findOne(nodes, "button", "Sign in");
    });

    // Scenario 2 — Negative auth: wrong password must surface the error and
    // keep us on the login view.
    await scenario("rejects bad credentials", async () => {
      await typeInto(mcp, "Username", "demo");
      await typeInto(mcp, "Password", "wrong");
      await clickByRole(mcp, "button", "Sign in");
      await mcp.call("browser_wait_for", { text: "Invalid username or password" });
      const stillOnLogin = await evaluate(mcp, () => {
        const el = document.getElementById("login-view");
        return !!el && !el.hidden;
      });
      assert(stillOnLogin, "should still be on login view");
    });

    // Scenario 3 — Positive auth: clear the password, retry with the
    // correct one, submit via Enter (the `submit: true` flag).
    await scenario("accepts valid credentials", async () => {
      await evaluate(mcp, () => {
        document.getElementById("password").value = "";
      });
      await typeInto(mcp, "Password", "demo", { submit: true });
      await mcp.call("browser_wait_for", { text: "Todos" });
      const who = await evaluate(mcp, () => document.getElementById("who").textContent);
      assertEqual(who, "demo", "logged-in username should be 'demo'");
    });

    // Scenario 4 — Bulk create: three todos in a row, asserted against the
    // app's read-only state mirror plus the rendered counter.
    await scenario("adds three todos", async () => {
      for (const text of ["Buy milk", "Write report", "Call dentist"]) {
        await typeInto(mcp, "New todo", text, { submit: true });
      }
      const todos = await evaluate(mcp, () => window.__APP__.getState().todos.map((t) => t.text));
      assertEqual(todos, ["Buy milk", "Write report", "Call dentist"]);
      const count = await evaluate(mcp, () => document.getElementById("count").textContent);
      assertEqual(count, "3 items left");
    });

    // Scenario 5 — Pattern (2): address the checkbox by CSS selector. The
    // dynamic aria-label embeds the todo text, which is awkward to express
    // via snapshot lookups but trivial as a selector.
    await scenario("toggles completion via the checkbox", async () => {
      await clickSelector(
        mcp,
        '#todo-list li[data-id] input[type=checkbox][aria-label*="Buy milk"]',
        'checkbox for "Buy milk"'
      );
      const state = await evaluate(mcp, () => window.__APP__.getState());
      const milk = state.todos.find((t) => t.text === "Buy milk");
      assert(milk.done, "Buy milk should be marked done");
      const count = await evaluate(mcp, () => document.getElementById("count").textContent);
      assertEqual(count, "2 items left");
    });

    // Scenario 6 — Filtering: clicking the "Active" filter button hides the
    // completed todo and updates the active-class indicator.
    await scenario("filters down to active todos", async () => {
      await clickByRole(mcp, "button", "Active");
      const visible = await evaluate(mcp, () =>
        Array.from(document.querySelectorAll("#todo-list li span")).map((n) => n.textContent)
      );
      assertEqual(visible, ["Write report", "Call dentist"]);
      const activeFilter = await evaluate(
        mcp,
        () => document.querySelector("#filters button.active").dataset.filter
      );
      assertEqual(activeFilter, "active");
    });

    // Scenario 7 — Bulk delete via "Clear completed".
    await scenario("clears completed todos", async () => {
      await clickByRole(mcp, "button", "All");
      await clickByRole(mcp, "button", "Clear completed");
      const remaining = await evaluate(mcp, () =>
        window.__APP__.getState().todos.map((t) => t.text)
      );
      assertEqual(remaining, ["Write report", "Call dentist"]);
    });

    // Scenario 8 — Capture an artefact for humans. No assertion beyond
    // "screenshot tool didn't throw"; the file is left in screenshots/.
    await scenario("captures a screenshot of the final state", async () => {
      await screenshot(mcp, "final-state.png");
    });

    // Scenario 9 — Sign out cleans up state and returns to login.
    await scenario("signs out and returns to login", async () => {
      await clickByRole(mcp, "button", "Sign out");
      await mcp.call("browser_wait_for", { text: "Sign in" });
      const { nodes } = await snapshot(mcp);
      findOne(nodes, "heading", "Sign in");
    });

    // ---------- final report ----------
    console.log();
    const passed = results.filter((r) => r.ok).length;
    const failed = results.length - passed;
    const total = results.reduce((s, r) => s + r.ms, 0);
    console.log(
      `Summary: \x1b[32m${passed} passed\x1b[0m, ` +
        (failed ? `\x1b[31m${failed} failed\x1b[0m, ` : "") +
        `${total}ms total`
    );
    if (failed) process.exitCode = 1;
  } finally {
    await mcp.close().catch(() => {});
    if (appProc) appProc.kill();
  }
}

/**
 * Poll a URL until it responds with a 2xx status or the deadline elapses.
 * Used to wait for the demo app's static server to come up after spawn.
 *
 * @param {string} url            URL to probe.
 * @param {number} timeoutMs      Maximum total wait, in milliseconds.
 * @returns {Promise<void>}
 * @throws {Error}                When the deadline passes without success.
 */
async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet — retry after a short pause
    }
    await sleep(100);
  }
  throw new Error(`app did not become ready at ${url} within ${timeoutMs}ms`);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
