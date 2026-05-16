/**
 * @file Tiny in-file test harness — scenario runner + assertions.
 *
 * Kept dependency-free on purpose. Mocha/Vitest would also work but they
 * obscure what's happening, which is the opposite of what this demo wants:
 * the whole point is for a reader to see exactly how an MCP-driven test
 * flow is structured.
 *
 * Results accumulate in a module-level array via {@link scenario}, then
 * {@link report} prints the summary and sets `process.exitCode = 1` if any
 * scenario failed.
 *
 * @module validator/lib/harness
 */

/**
 * Recorded outcome of a single scenario run.
 *
 * @typedef {object} ScenarioResult
 * @property {string}   group  Logical grouping (e.g. `"auth"`, `"cart"`).
 * @property {string}   name   Scenario label.
 * @property {boolean}  ok     `true` if the body completed without throwing.
 * @property {number}   ms     Wall-clock duration in milliseconds.
 * @property {unknown} [error] The thrown error, if any.
 */

/** @type {ScenarioResult[]} */
const results = [];

/** @type {string} Currently active scenario group, set by {@link group}. */
let currentGroup = "general";

/**
 * Enter a named group. Subsequent {@link scenario} calls attribute their
 * results to this group until another `group()` call.
 *
 * @param {string} name
 * @returns {void}
 */
export function group(name) {
  currentGroup = name;
  console.log(`\n  \x1b[1m${name}\x1b[0m`);
}

/**
 * Run a single named scenario and record its result.
 *
 * Any thrown error — assertion failure, tool error, parser miss — is caught
 * and logged inline rather than aborting the run, so the operator sees the
 * full pass/fail picture in one go.
 *
 * @param {string} name                Scenario label.
 * @param {() => Promise<void>} fn     Async body containing tool calls and
 *                                     assertions.
 * @returns {Promise<void>}
 */
export async function scenario(name, fn) {
  const started = Date.now();
  process.stdout.write(`    • ${name} ... `);
  try {
    await fn();
    const ms = Date.now() - started;
    console.log(`\x1b[32mPASS\x1b[0m (${ms}ms)`);
    results.push({ group: currentGroup, name, ok: true, ms });
  } catch (err) {
    const ms = Date.now() - started;
    console.log(`\x1b[31mFAIL\x1b[0m (${ms}ms)`);
    console.log(indent(String(err.stack ?? err.message ?? err), "        "));
    results.push({ group: currentGroup, name, ok: false, ms, error: err });
  }
}

/**
 * Print a pass/fail summary and set `process.exitCode = 1` if any scenario
 * failed. Returns the counts in case the caller wants to do anything else.
 *
 * @returns {{ passed: number, failed: number, total: number, ms: number }}
 */
export function report() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const ms = results.reduce((s, r) => s + r.ms, 0);

  console.log();
  console.log(
    `Summary: \x1b[32m${passed} passed\x1b[0m, ` +
      (failed ? `\x1b[31m${failed} failed\x1b[0m, ` : "") +
      `${results.length} total in ${ms}ms`,
  );
  if (failed) process.exitCode = 1;
  return { passed, failed, total: results.length, ms };
}

/**
 * Assert that a condition is truthy.
 *
 * @param {unknown} cond
 * @param {string}  msg   Description of what was expected.
 * @returns {void}
 * @throws {Error}        When `cond` is falsy.
 */
export function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

/**
 * Assert two JSON-serialisable values are deep-equal. Uses `JSON.stringify`
 * so key order matters for objects — keep fixtures consistent.
 *
 * @template T
 * @param {T}      actual
 * @param {T}      expected
 * @param {string} [msg]
 * @returns {void}
 * @throws {Error}
 */
export function assertEqual(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || "values differ"}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

/**
 * Assert that a string contains a substring.
 *
 * @param {string} haystack
 * @param {string} needle
 * @param {string} [msg]
 * @returns {void}
 * @throws {Error}
 */
export function assertContains(haystack, needle, msg = "") {
  if (typeof haystack !== "string" || !haystack.includes(needle)) {
    throw new Error(
      `${msg || "substring not found"}\n  expected to contain: ${JSON.stringify(needle)}\n  in: ${JSON.stringify(haystack)}`,
    );
  }
}

/**
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
