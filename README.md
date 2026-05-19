# Validating a frontend with Playwright MCP — no LLM in the loop

![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?style=for-the-badge&logo=pnpm&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright_MCP-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Compatible-1F6FEB?style=for-the-badge&logo=anthropic&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-Linted-60A5FA?style=for-the-badge&logo=biome&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-32_passing-2EA043?style=for-the-badge&logo=githubactions&logoColor=white)

This demo shows that the **Model Context Protocol** is a transport, not a
runtime detail of any particular AI. Anything that speaks MCP can drive an MCP
server. Here, a plain Node.js script — no Claude, no OpenAI, no inference of
any kind — drives [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp)
to run an end-to-end validation of **Nimbus Gear**, a React + Tailwind 4 demo
store.

```text
 ┌──────────────────────┐     stdio / JSON-RPC      ┌──────────────────────┐
 │  validator/run.mjs   │ ────────────────────────► │  @playwright/mcp     │
 │  (deterministic)     │ ◄──────────────────────── │  (Chromium driver)   │
 └──────────────────────┘   tools/list, tools/call  └──────────────────────┘
            │                                                  │
            │  asserts on returned text / JSON                 │  navigates,
            ▼                                                  ▼  clicks, types
   PASS / FAIL summary                              Vite dev server :5173
                                                    (React 19 + Tailwind 4)
```

The validator decides which tool to call next using ordinary control flow,
exactly as a hand-written E2E test would. The MCP server is the only "smart"
piece — it knows how to drive Chromium.

## The demo app — Nimbus Gear

A small React storefront with:

- Mock username/password auth (demo / demo) with protected routes
- Product catalogue with **search**, **category filter**, and **sort**
- Product detail pages with quantity stepper, "Add to cart", "Buy now"
- Shopping cart with line-quantity controls, subtotals, and a Remove action
- Multi-field **checkout** with inline validation
- Order success page with generated order number
- **Light / System / Dark** theme toggle (persisted to localStorage)

Built with React 19, React Router 7, Vite 8, and Tailwind CSS 4 (CSS-only
theming via `@theme` + a `dark` custom variant).

## Layout

| Path | What it is |
| --- | --- |
| [app/index.html](app/index.html), [app/vite.config.js](app/vite.config.js) | Vite entrypoint + config |
| [app/src/main.jsx](app/src/main.jsx) | React root, provider tree |
| [app/src/App.jsx](app/src/App.jsx) | Router with protected routes |
| [app/src/routes/](app/src/routes/) | 6 route components (Login, Catalog, ProductDetail, Cart, Checkout, OrderSuccess) |
| [app/src/components/](app/src/components/) | Header, ThemeToggle, ProductCard, ProtectedRoute |
| [app/src/hooks/](app/src/hooks/) | `useAuth`, `useCart`, `useTheme` contexts |
| [app/src/data/products.js](app/src/data/products.js) | In-memory product catalogue |
| [app/src/styles.css](app/src/styles.css) | Tailwind import + theme tokens (light/dark) |
| [validator/run.mjs](validator/run.mjs) | Orchestrator — connect, run groups, summarise |
| [validator/lib/mcp-client.mjs](validator/lib/mcp-client.mjs) | Wraps the official `@modelcontextprotocol/sdk` `Client` |
| [validator/lib/snapshot.mjs](validator/lib/snapshot.mjs) | Parses the YAML-ish accessibility tree returned by `browser_snapshot` |
| [validator/lib/helpers.mjs](validator/lib/helpers.mjs) | High-level helpers — `clickByRole`, `typeSelector`, `evaluate`, `setReactInputValue`, … |
| [validator/lib/harness.mjs](validator/lib/harness.mjs) | Scenario runner + assertions (`assert`, `assertEqual`, `assertContains`) |
| [validator/scenarios/auth.mjs](validator/scenarios/auth.mjs) | Login, validation, redirect |
| [validator/scenarios/catalog.mjs](validator/scenarios/catalog.mjs) | Search, filter, sort, navigation |
| [validator/scenarios/cart.mjs](validator/scenarios/cart.mjs) | Add, quantity, remove, totals |
| [validator/scenarios/checkout.mjs](validator/scenarios/checkout.mjs) | Form validation, happy path, order number |
| [validator/scenarios/theme.mjs](validator/scenarios/theme.mjs) | Light / dark / system, persistence |
| [validator/scenarios/visual.mjs](validator/scenarios/visual.mjs) | Full-page screenshots |
| [validator/features/*.feature](validator/features/) | Plain-English specs (hand-written) — compile to `.mjs` via `pnpm spec:compile` |
| [tools/compile-scenarios/](tools/compile-scenarios/) | LLM-powered `.feature` → `.mjs` compiler (Anthropic / Ollama) |
| [biome.json](biome.json) | Biome config (lint + format) |

## Quick start

```bash
pnpm install
pnpm exec playwright install chromium   # one-time, ~150 MB
pnpm demo                               # spawns Vite, runs all scenarios, tears down
```

If Vite is already running and you just want to iterate on tests:

```bash
pnpm app          # terminal 1
pnpm validate     # terminal 2
```

Pass `--headed` to watch the browser:

```bash
node validator/run.mjs --start-app --headed
```

Screenshots land in [screenshots/](screenshots/) (catalogue in light + dark
themes, plus a product-detail capture).

### Plain-English specs (optional)

Two directories, two responsibilities:

```text
validator/features/   intent-level .feature specs   (hand-written; source of truth)
validator/scenarios/  generated .mjs scenarios      (committed; CI runs these)
```

The compiler is an **agentic LLM** that drives the live app via Playwright
MCP at *compile time* to discover the real DOM, then emits a deterministic
`.mjs`. At *runtime* (`pnpm demo`) the saved `.mjs` runs with no LLM —
that's the whole point.

```text
COMPILE TIME (occasional)                   RUNTIME (every pnpm demo / CI run)
┌────────────┐                              ┌──────────────┐
│ .feature   │ ─────┐                       │ scenarios/   │
│ (intent)   │      ▼                       │ *.mjs        │
└────────────┘  ┌────────┐                  │ (committed)  │
                │  LLM   │                  └──────┬───────┘
                │ + tools│                         │
                └───┬────┘                         ▼
                    │ browser_navigate,    ┌──────────────────┐
                    ▼ snapshot, click…    │  validator/run   │
       ┌──────────────────────┐            │  (deterministic) │
       │  @playwright/mcp     │ ◄───────── └─────┬────────────┘
       │  ↳ Vite app on :5173 │                  │ same MCP server
       └──────────────────────┘ ◄────────────────┘ same tools
                    │
                    ▼ write_scenario(code)
              scenarios/*.mjs
```

#### Compiling

```bash
# Anthropic (default)
ANTHROPIC_API_KEY=sk-... pnpm spec:compile

# Local Ollama (no API key, no network egress; needs a tool-use-capable model)
pnpm spec:compile:ollama --model=qwen2.5-coder:14b

# Print the plan only — no Vite spawn, no model call
pnpm spec:compile:dry-run

# Subset of features
pnpm spec:compile --only=auth,catalog

# Raise the per-feature tool-use cap if a complex feature needs it
pnpm spec:compile --max-turns=80
```

The compiler is intentionally **SDK-agnostic** — it speaks raw HTTP to both
providers, so the project carries no `@anthropic-ai/sdk` / `ollama` package
to track or upgrade.

#### What the compiler does, step by step

1. Spawns `vite app` (the demo app) and `@playwright/mcp` (the browser
   driver).
2. For each `.feature` file, navigates the browser to a fresh state and
   hands the LLM a tool-use loop with these tools:
   - `browser_navigate`, `browser_snapshot`, `browser_click`,
     `browser_type`, `browser_press_key`, `browser_wait_for`,
     `browser_evaluate` — proxied straight through to MCP.
   - `write_scenario({ code })` — terminal tool. The LLM calls this exactly
     once when it has explored enough to write a complete `.mjs`.
3. Captures the `code` argument, prepends an `AUTO-GENERATED` header, and
   writes `validator/scenarios/<name>.mjs`.
4. Tears down Vite + MCP.

#### Determinism trade-offs

- **At compile time** the LLM observes a *live* browser. JSX with dynamic
  classNames, conditional rendering, computed `aria-label` strings — all
  resolved. The model writes selectors against what it *saw*, not what
  the source code *says*.
- **At runtime** the generated `.mjs` is plain code. Same Playwright MCP
  server, same helpers, no model — every run is identical given the same
  app build.
- **Cost** is paid once per compile and amortized over every CI run.
  Anthropic-side caching makes files 2–N in a batch ~10× cheaper than file 1
  (look for `cache hit` in the per-feature log line).

Edit the `.feature` and recompile — do not hand-edit the generated `.mjs`.

### Lint & format

[Biome](https://biomejs.dev) handles JS / JSX / JSON;
[markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) handles
Markdown.

```bash
pnpm lint         # Biome lint
pnpm lint:fix     # Biome lint + autofix
pnpm lint:md      # markdownlint
pnpm lint:md:fix  # markdownlint + autofix
pnpm format       # Biome format (rewrites to canonical style)
pnpm check        # Biome check + markdownlint — CI-friendly, runs both gates
```

Rule configuration:

- Biome: [biome.json](biome.json) — JSX-aware, ES module style, 100-col wrap.
- markdownlint: [.markdownlint-cli2.jsonc](.markdownlint-cli2.jsonc) — default
  rule set with `MD013` (line length) and `MD033` (inline HTML) disabled
  because the README intentionally uses wide prose and shields.io badge
  markup. `MD024` is restricted to `siblings_only` so the same heading
  text can appear under different parents.

## What the demo validates

Six feature groups, **32 scenarios** total:

| Group | Scenarios | Coverage |
| --- | --- | --- |
| `auth` | 4 | Redirect on no-auth, form fields render, bad creds rejected, good creds redirect |
| `catalog` | 9 | Initial render, filter pill, search, empty state, sort, out-of-stock badge, deep link |
| `cart` | 7 | Quantity stepper, add toast, badge sync, multi-product cart, totals math, remove, checkout CTA |
| `checkout` | 5 | All-empty errors, email format error, valid submission, order number format, cart cleared |
| `theme` | 4 | Light removes `.dark`, Dark adds it, persistence, System defers to OS |
| `visual` | 3 | Light + dark catalogue screenshots, product detail screenshot |

## Three patterns for asserting state

The helpers in [validator/lib/helpers.mjs](validator/lib/helpers.mjs) deliberately
support three interaction styles. Pick whichever fits the element at hand:

**1. Snapshot tree** — `browser_snapshot` returns an ARIA-style tree. Find a
node by `role` + `name`. Resilient to layout/CSS changes.

```js
const { nodes } = await snapshot(mcp);
findOne(nodes, "heading", "Welcome back");
await clickByRole(mcp, "button", "Sign in");
```

**2. CSS selector via `target`** — every interactive tool's `target` parameter
also accepts a unique selector. Useful when an element has a stable
`id` / `data-testid` but a noisy accessible name.

```js
await clickSelector(mcp, '#filters button[aria-pressed="false"]:nth-child(2)');
await typeSelector(mcp, "#field-email", "demo@nimbus.gear");
```

**3. Page evaluate** — run JS in the page and JSON-decode the result. Best
for precise, structural assertions.

```js
const lines = await evaluate(mcp, () =>
  Array.from(document.querySelectorAll('[data-testid="cart-line"]')).map((li) => ({
    id: li.dataset.productId,
    qty: Number(li.querySelector('[data-testid="line-qty"]').textContent),
  }))
);
assertEqual(lines, [{ id: "headphones-aurora", qty: 2 }]);
```

A fourth helper, `setReactInputValue`, uses the native value setter from
`HTMLInputElement.prototype` so programmatic value changes correctly trigger
React's controlled-input tracker (a well-known React quirk that bites people
trying to clear an input via `el.value = ""`).

## Why "no LLM"?

A few practical reasons to drive Playwright MCP from a non-AI client:

- **CI determinism** — the same inputs always run the same scenarios. No
  sampling, no token budget, no "the agent decided to skip a step today."
- **Cost & speed** — no inference calls. The full 32-scenario suite runs in
  about 70 seconds, most of which is real browser time.
- **Auditability** — the test file *is* the spec. Reviewers see exactly what
  ran, in what order, with what assertions.
- **MCP server reuse** — your team already runs `@playwright/mcp` for an AI
  agent? The exact same server now also powers your test suite.

LLM-driven exploration is great for *finding* bugs you didn't know to look
for. Deterministic MCP clients are great for *preventing regressions* on bugs
you already fixed. They are complementary, not alternatives.

## Extending

- **Add a scenario**: append another `await scenario("…", …)` block in the
  appropriate file under [validator/scenarios/](validator/scenarios/).
- **Add a feature group**: create `validator/scenarios/myFeature.mjs`, export
  a `myFeatureScenarios(mcp, …)` function, re-export it from
  [validator/scenarios/index.mjs](validator/scenarios/index.mjs), and call
  it from [validator/run.mjs](validator/run.mjs).
- **Add a helper**: drop it in [validator/lib/helpers.mjs](validator/lib/helpers.mjs).
  Keep it generic — anything app-specific belongs in the scenario file.
- **Validate a different app**: change `APP_URL` (or set the env var) and
  rewrite the scenarios. None of the plumbing in `lib/` is app-specific.
