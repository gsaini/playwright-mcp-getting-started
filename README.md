# Validating a frontend with Playwright MCP — no LLM in the loop

![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?style=for-the-badge&logo=pnpm&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright_MCP-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Compatible-1F6FEB?style=for-the-badge&logo=anthropic&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-Linted-60A5FA?style=for-the-badge&logo=biome&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-9_passing-2EA043?style=for-the-badge&logo=githubactions&logoColor=white)

This demo shows that the **Model Context Protocol** is a transport, not a
runtime detail of any particular AI. Anything that speaks MCP can drive an MCP
server. Here, a plain Node.js script — no Claude, no OpenAI, no inference of
any kind — drives [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp)
to run an end-to-end validation of a small frontend.

```text
 ┌──────────────────────┐     stdio / JSON-RPC      ┌──────────────────────┐
 │  validator/run.mjs   │ ────────────────────────► │  @playwright/mcp     │
 │  (deterministic)     │ ◄──────────────────────── │  (Chromium driver)   │
 └──────────────────────┘   tools/list, tools/call  └──────────────────────┘
            │                                                  │
            │  asserts on returned text / JSON                 │  navigates,
            ▼                                                  ▼  clicks, types
   PASS / FAIL summary                              http://localhost:5173
                                                    (the demo app)
```

The validator decides which tool to call next using ordinary control flow
(loops, if-statements, regex), exactly as a hand-written E2E test would. The
MCP server is the only "smart" piece — it knows how to drive Chromium.

## Layout

| Path | What it is |
| --- | --- |
| [app/index.html](app/index.html), [app/app.js](app/app.js), [app/styles.css](app/styles.css) | The frontend under test: a tiny login + todo app, no framework |
| [app/server.mjs](app/server.mjs) | Zero-dependency static file server on port 5173 |
| [validator/mcp-client.mjs](validator/mcp-client.mjs) | Wraps the official `@modelcontextprotocol/sdk` `Client` |
| [validator/snapshot.mjs](validator/snapshot.mjs) | Parses the YAML-ish accessibility tree returned by `browser_snapshot` |
| [validator/run.mjs](validator/run.mjs) | Scenario runner — connects, lists tools, asserts |
| [biome.json](biome.json) | Biome config (lint + format) |

## Quick start

```bash
pnpm install
pnpm exec playwright install chromium   # one-time, ~150 MB
pnpm demo                               # spawns the app, runs all scenarios, tears down
```

If Chromium is already installed and you just want to iterate:

```bash
pnpm app          # terminal 1
pnpm validate     # terminal 2
```

Pass `--headed` to watch the browser:

```bash
node validator/run.mjs --start-app --headed
```

### Lint & format

[Biome](https://biomejs.dev) handles both linting and formatting:

```bash
pnpm lint         # report issues
pnpm lint:fix     # auto-fix what's safe
pnpm format       # rewrite files to the canonical style
pnpm check        # lint + format check, CI-friendly
```

A screenshot of the final state lands in [screenshots/final-state.png](screenshots/).

## What the demo validates

Every scenario in [validator/run.mjs](validator/run.mjs:90) is a deterministic
assertion against the running app:

1. **Login screen renders** — checks the snapshot tree contains the right
   heading, textboxes, and button.
2. **Bad credentials rejected** — types `demo / wrong`, waits for the error
   text, asserts the view didn't change.
3. **Good credentials accepted** — types `demo / demo`, submits via the
   keyboard, asserts the logged-in username comes back as `"demo"`.
4. **Adds three todos** — submits each via the form, then reads
   `window.__APP__.getState()` through `browser_evaluate` to compare arrays.
5. **Toggles a checkbox** — clicks via the `aria-label`, asserts the state
   mirror and the "items left" counter both update.
6. **Active filter** — clicks the filter button, asserts the visible list
   matches expectations.
7. **Clear completed** — asserts only the two active todos remain.
8. **Screenshot** — captures `screenshots/final-state.png`.
9. **Sign out** — asserts the app returns to the login heading.

## Three patterns for asserting state

The runner deliberately mixes three styles so you can pick whichever fits your
own app:

**1. Snapshot tree assertions** — `browser_snapshot` returns an ARIA-style
tree. Find a node by `role` + `name`. Resilient to layout/CSS changes.

```js
const { nodes } = await snapshot(mcp);
findOne(nodes, "heading", "Sign in");        // throws if missing
```

**2. Interaction by ref or CSS selector** — every visible node has a `ref`
(`e1`, `e2`, …). The `target` parameter on `browser_click` / `browser_type`
accepts *either* a snapshot ref *or* any unique CSS selector. Refs are great
when you've just taken a snapshot; selectors are great when you already know
the element.

```js
// Via snapshot ref:
const node = findOne(nodes, "button", "Sign in");
await mcp.call("browser_click", { element: 'button "Sign in"', target: node.ref });

// Via CSS selector:
await mcp.call("browser_click", { element: "Buy milk checkbox", target: '#todo-list input[type=checkbox]' });
```

**3. Page evaluate** — for precise, JSON-shaped assertions, run JS in the
page via `browser_evaluate`:

```js
const todos = await evaluate(mcp, () => window.__APP__.getState().todos.map(t => t.text));
assertEqual(todos, ["Buy milk", "Write report", "Call dentist"]);
```

## Why "no LLM"?

A few practical reasons to drive Playwright MCP from a non-AI client:

- **CI determinism** — the same inputs always run the same scenarios. No
  sampling, no token budget, no "the agent decided to skip a step today."
- **Cost & speed** — no inference calls. Each scenario here finishes in tens
  of milliseconds plus browser time.
- **Auditability** — the test file *is* the spec. Reviewers see exactly what
  ran, in what order, with what assertions.
- **MCP server reuse** — your team already runs `@playwright/mcp` for an AI
  agent? The exact same server now also powers your test suite.

LLM-driven exploration is great for *finding* bugs you didn't know to look
for. Deterministic MCP clients are great for *preventing regressions* on bugs
you already fixed. They are complementary, not alternatives.

## Extending

- Add a scenario: append another `await scenario("…", async () => { … })`
  block in [validator/run.mjs](validator/run.mjs).
- Add a helper: more tool wrappers belong next to `clickByRole` / `typeInto`
  near the top of `run.mjs`.
- Validate a different app: change `APP_URL` (or set the env var) and rewrite
  the scenarios — none of the plumbing in `mcp-client.mjs` / `snapshot.mjs`
  is app-specific.
