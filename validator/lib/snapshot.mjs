/**
 * @file Lightweight parser for the YAML-ish accessibility tree returned by the
 * Playwright MCP `browser_snapshot` tool.
 *
 * The snapshot's body looks like a nested list of elements with their ARIA
 * role, accessible name and a stable reference ID — for example:
 *
 * ```yaml
 * - main [ref=e2]:
 *   - heading "Sign in" [level=1] [ref=e4]
 *   - textbox "Username" [ref=e7]
 *   - button "Sign in" [ref=e10]
 * ```
 *
 * We do NOT need a full YAML parser — the only fields the validator cares
 * about (role, accessible name, ref) live on a single line, so a flat
 * line-by-line regex pass is sufficient and far less brittle than tracking
 * indentation. Indentation is still captured as a `depth` field in case
 * future scenarios need to reason about hierarchy.
 *
 * @module validator/snapshot
 */

/**
 * Regex that recognises a single node line in the snapshot.
 *
 * Captured groups:
 *   1. leading whitespace (used to compute `depth`)
 *   2. ARIA role (e.g. `button`, `textbox`, `heading`)
 *   3. accessible name (optional, may be empty for unnamed nodes)
 *   4. ref identifier (e.g. `e7`)
 *
 * The middle `.*?` is intentionally lazy so modifiers between the name and
 * the ref (`[level=1]`, `[cursor=pointer]`, `[checked]`, …) don't interfere.
 *
 * @type {RegExp}
 */
const LINE = /^(\s*)-\s+(\w+)(?:\s+"((?:[^"\\]|\\.)*)")?.*?\[ref=(e\d+)\]/;

/**
 * A single parsed node from the accessibility snapshot.
 *
 * @typedef {object} SnapshotNode
 * @property {string} role     ARIA role as reported by Playwright.
 * @property {string} name     Accessible name, or `""` if the node had none.
 * @property {string} ref      Stable identifier (`"e1"`, `"e2"`, …) suitable
 *                             for the `target` argument of interactive tools.
 * @property {number} depth    Number of leading-space characters before the
 *                             `-` bullet — proxy for nesting level.
 * @property {string} line     Original line, trimmed. Useful when surfacing
 *                             diagnostics.
 */

/**
 * Predicate the lookup helpers accept for matching a node's accessible name.
 * `null` or `undefined` means "any name accepted". A plain string requires an
 * exact match. A `RegExp` is `.test()`-ed against the name.
 *
 * @typedef {string | RegExp | null | undefined} NameMatcher
 */

/**
 * Parse a `browser_snapshot` result body into a flat list of nodes.
 *
 * Lines that don't match the node pattern (markdown headings, fenced-code
 * delimiters, blank lines, the `Page URL:` / `Page Title:` lines, etc.) are
 * silently ignored — callers should not assume `nodes.length` equals the
 * snapshot's line count.
 *
 * @param {string} text   Full text returned by the `browser_snapshot` tool.
 * @returns {SnapshotNode[]}  Nodes in document order.
 */
export function parseSnapshot(text) {
  /** @type {SnapshotNode[]} */
  const nodes = [];
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const [, indent, role, rawName, ref] = m;
    nodes.push({
      role,
      name: rawName ? rawName.replace(/\\"/g, '"') : "",
      ref,
      depth: indent.length,
      line: line.trim(),
    });
  }
  return nodes;
}

/**
 * Find the first node whose role matches `role` and whose accessible name
 * satisfies `name`. Throws a descriptive error if nothing matches, including
 * up to five same-role candidates to make debugging easier.
 *
 * @param {SnapshotNode[]} nodes   Nodes produced by {@link parseSnapshot}.
 * @param {string} role            Required ARIA role.
 * @param {NameMatcher} [name]     Optional accessible-name matcher.
 * @returns {SnapshotNode}         The first matching node.
 * @throws {Error}                 When no node matches.
 *
 * @example
 *   const node = findOne(nodes, "button", "Sign in");
 *   await mcp.call("browser_click", { element: 'button "Sign in"', target: node.ref });
 */
export function findOne(nodes, role, name) {
  const match = nodes.find((n) => matches(n, role, name));
  if (!match) {
    const sample = nodes
      .filter((n) => n.role === role)
      .slice(0, 5)
      .map((n) => `  ${n.role} "${n.name}"`)
      .join("\n");
    throw new Error(
      `no ${role} matching ${name instanceof RegExp ? name : JSON.stringify(name)}\n` +
        `seen ${role}s:\n${sample || "  (none)"}`,
    );
  }
  return match;
}

/**
 * Find every node whose role matches `role` and whose accessible name
 * satisfies `name`. Returns an empty array when nothing matches — unlike
 * {@link findOne} this is never an error condition.
 *
 * @param {SnapshotNode[]} nodes   Nodes produced by {@link parseSnapshot}.
 * @param {string} role            Required ARIA role.
 * @param {NameMatcher} [name]     Optional accessible-name matcher.
 * @returns {SnapshotNode[]}       All matching nodes, in document order.
 */
export function findAll(nodes, role, name) {
  return nodes.filter((n) => matches(n, role, name));
}

/**
 * Shared predicate used by {@link findOne} and {@link findAll}.
 *
 * @private
 * @param {SnapshotNode} node
 * @param {string} role
 * @param {NameMatcher} [name]
 * @returns {boolean}
 */
function matches(node, role, name) {
  if (node.role !== role) return false;
  if (name == null) return true;
  if (name instanceof RegExp) return name.test(node.name);
  return node.name === name;
}
