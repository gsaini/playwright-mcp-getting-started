/**
 * @file Higher-level helpers built on top of the raw MCP tools.
 *
 * Scenario files should reach for these instead of calling
 * `mcp.call("browser_…")` directly — they encapsulate the snapshot lookup
 * → ref translation, the page-evaluate envelope parsing, and the common
 * "navigate + wait" / "click + assert" patterns.
 *
 * Three interaction styles are supported:
 *
 *  • {@link clickByRole} / {@link typeInto} — resolve the element via a
 *    fresh accessibility snapshot. Best when the element has a clean ARIA
 *    name and you want resilience to layout changes.
 *
 *  • {@link clickSelector} / {@link typeSelector} — address the element via
 *    a CSS selector. Best when the element has a stable id / data-testid
 *    and the snapshot tree would be noisy or expensive to lookup.
 *
 *  • {@link evaluate} — run arbitrary JS in the page and JSON-decode the
 *    return value. Best when you need precise structural assertions or
 *    when there's no clean way to address state via the DOM alone.
 *
 * @module validator/lib/helpers
 */

import { findOne, parseSnapshot } from "./snapshot.mjs";

/**
 * @typedef {import("./mcp-client.mjs").PlaywrightMcp} PlaywrightMcp
 * @typedef {import("./snapshot.mjs").SnapshotNode}    SnapshotNode
 */

/**
 * Combined result of taking a snapshot and parsing it.
 *
 * @typedef {object} ParsedSnapshot
 * @property {string}         text
 * @property {SnapshotNode[]} nodes
 */

/**
 * Take a fresh accessibility snapshot and parse it.
 *
 * @param {PlaywrightMcp} mcp
 * @returns {Promise<ParsedSnapshot>}
 */
export async function snapshot(mcp) {
  const { text } = await mcp.call("browser_snapshot");
  return { text, nodes: parseSnapshot(text) };
}

/**
 * Navigate to a URL.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function navigate(mcp, url) {
  await mcp.call("browser_navigate", { url });
}

/**
 * Wait for the given text to appear in the page. Convenience wrapper around
 * `browser_wait_for` so scenario code reads cleanly.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function waitForText(mcp, text) {
  await mcp.call("browser_wait_for", { text });
}

/**
 * Wait for the given text to disappear from the page.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function waitForTextGone(mcp, text) {
  await mcp.call("browser_wait_for", { textGone: text });
}

/**
 * Click the first element matching an ARIA role + accessible name pair.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} role             ARIA role.
 * @param {string | RegExp} name    Accessible name.
 * @returns {Promise<void>}
 */
export async function clickByRole(mcp, role, name) {
  const { nodes } = await snapshot(mcp);
  const node = findOne(nodes, role, name);
  await mcp.call("browser_click", {
    element: `${role} "${node.name}"`,
    target: node.ref,
  });
}

/**
 * Type text into a textbox identified by its accessible name.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} name
 * @param {string} text
 * @param {{ submit?: boolean, slowly?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function typeInto(mcp, name, text, { submit = false, slowly = false } = {}) {
  const { nodes } = await snapshot(mcp);
  const node = findOne(nodes, "textbox", name);
  await mcp.call("browser_type", {
    element: `textbox "${node.name}"`,
    target: node.ref,
    text,
    submit,
    slowly,
  });
}

/**
 * Click the element matched by a CSS selector.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} selector
 * @param {string} [description]
 * @returns {Promise<void>}
 */
export async function clickSelector(mcp, selector, description = selector) {
  await mcp.call("browser_click", { element: description, target: selector });
}

/**
 * Type into the element matched by a CSS selector. Useful when an input has
 * no accessible name or when the snapshot has many similar textboxes.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} selector
 * @param {string} text
 * @param {{ submit?: boolean, description?: string }} [options]
 * @returns {Promise<void>}
 */
export async function typeSelector(mcp, selector, text, { submit = false, description } = {}) {
  await mcp.call("browser_type", {
    element: description ?? selector,
    target: selector,
    text,
    submit,
  });
}

/**
 * Run a JavaScript function inside the page and JSON-decode its result.
 *
 * The `browser_evaluate` tool wraps results in a markdown envelope:
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
 * We extract the value between `### Result` and the next `###` heading
 * (or end of string) and `JSON.parse` it. Strings that fail to parse are
 * returned verbatim.
 *
 * @template T
 * @param {PlaywrightMcp} mcp
 * @param {(...args: unknown[]) => T} fn
 * @param {...unknown} args   Forwarded to `fn`. Must be JSON-serialisable.
 * @returns {Promise<T>}
 */
export async function evaluate(mcp, fn, ...args) {
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
 * Yield to the browser for two animation frames — long enough for React 19
 * to commit a state update and flush effects.
 *
 * Use this when a click triggers a state change that you want to assert on,
 * but there's no specific text/element you can usefully wait for (e.g. the
 * page text doesn't change, just internal state). When there *is* an obvious
 * indicator, prefer {@link waitForText} over this helper.
 *
 * @param {PlaywrightMcp} mcp
 * @returns {Promise<void>}
 */
export async function waitForRender(mcp) {
  await evaluate(
    mcp,
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
      }),
  );
}

/**
 * Programmatically set the value of a React-controlled `<input>` or
 * `<select>` and dispatch the appropriate change event.
 *
 * Direct `el.value = x` bypasses React's internal value tracker, so when the
 * input event fires, React thinks nothing changed and skips its onChange.
 * The well-known workaround is to call the value setter from
 * `HTMLInputElement.prototype` / `HTMLSelectElement.prototype` — that invokes
 * React's monkey-patched setter and bumps the tracker.
 *
 * Use this any time you need to set a value without simulating keystrokes
 * (e.g. to clear a field, or to set a `<select>` whose options aren't
 * easy to address via the snapshot).
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} selector            CSS selector for the input or select.
 * @param {string} value
 * @param {"input" | "change"} [eventType="input"]
 * @returns {Promise<void>}
 */
export async function setReactInputValue(mcp, selector, value, eventType = "input") {
  await evaluate(
    mcp,
    (sel, val, evType) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`element not found: ${sel}`);
      const proto =
        el.tagName === "SELECT"
          ? window.HTMLSelectElement.prototype
          : el.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, val);
      el.dispatchEvent(new Event(evType, { bubbles: true }));
    },
    selector,
    value,
    eventType,
  );
}

/**
 * Capture a full-page screenshot.
 *
 * @param {PlaywrightMcp} mcp
 * @param {string} filename   Absolute or relative `.png` path.
 * @returns {Promise<void>}
 */
export async function screenshot(mcp, filename) {
  await mcp.call("browser_take_screenshot", {
    type: "png",
    filename,
    fullPage: true,
  });
}

/**
 * Read the current page URL via `browser_evaluate`. Handy for asserting on
 * navigation outcomes when no specific text is unique to the new page.
 *
 * @param {PlaywrightMcp} mcp
 * @returns {Promise<string>}
 */
export async function currentUrl(mcp) {
  return evaluate(mcp, () => window.location.href);
}
