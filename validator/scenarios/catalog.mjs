/**
 * @file Catalog scenarios — search, category filter, sort, navigation,
 * inventory edge cases. Mixes all three assertion patterns:
 *
 *  1. Snapshot lookups for clicks (`clickByRole`).
 *  2. CSS selectors for keyboard/text inputs (`typeSelector`).
 *  3. `evaluate` for precise list comparisons.
 *
 * Pattern note: after every state-changing user action we explicitly
 * `waitForText` on the "Showing N of 8" counter. That counter updates on
 * every re-render of the catalog, so it's the cleanest "React has settled"
 * signal we can hook into without polling.
 */

import { assert, assertEqual, group, scenario } from "../lib/harness.mjs";
import {
  clickByRole,
  currentUrl,
  evaluate,
  setReactInputValue,
  typeSelector,
  waitForText,
} from "../lib/helpers.mjs";

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 */
export async function catalogScenarios(mcp) {
  group("catalog");

  await scenario("shows every product on first load", async () => {
    await waitForText(mcp, "Showing 8 of 8");
    const count = await evaluate(
      mcp,
      () => document.querySelectorAll('[data-testid="product-card"]').length,
    );
    assertEqual(count, 8, "catalogue should start with all 8 products visible");
  });

  await scenario("filters by category pill (Audio → 3 products)", async () => {
    await clickByRole(mcp, "button", "Audio");
    await waitForText(mcp, "Showing 3 of 8");
    const names = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="product-card"] h3 a')).map(
        (a) => a.textContent,
      ),
    );
    assertEqual(names, [
      "Aurora Wireless Headphones",
      "Luna Studio Headphones",
      "Nova Desktop Speakers",
    ]);
  });

  await scenario("clearing the category filter restores all products", async () => {
    await clickByRole(mcp, "button", "All");
    await waitForText(mcp, "Showing 8 of 8");
    const count = await evaluate(
      mcp,
      () => document.querySelectorAll('[data-testid="product-card"]').length,
    );
    assertEqual(count, 8);
  });

  await scenario("searching narrows the result set by name", async () => {
    await typeSelector(mcp, "#catalog-search", "wireless", {
      description: "search input",
    });
    await waitForText(mcp, "Showing 2 of 8");
    const names = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="product-card"] h3 a')).map(
        (a) => a.textContent,
      ),
    );
    assertEqual(names, ["Aurora Wireless Headphones", "Vega Wireless Mouse"]);
  });

  await scenario("a no-match search shows the empty state", async () => {
    // Replace the existing query (typing without clearing would append).
    await setReactInputValue(mcp, "#catalog-search", "kjasdf");
    await waitForText(mcp, "No matches");
    const visible = await evaluate(
      mcp,
      () => !!document.querySelector('[data-testid="empty-results"]'),
    );
    assert(visible, "empty-state panel should be rendered");
  });

  await scenario("clearing the search restores all products", async () => {
    await setReactInputValue(mcp, "#catalog-search", "");
    await waitForText(mcp, "Showing 8 of 8");
  });

  await scenario("sorting by price ascending orders products cheapest-first", async () => {
    await setReactInputValue(mcp, "#catalog-sort", "price-asc", "change");
    // No counter change for sort; wait briefly for the re-render to commit.
    await evaluate(mcp, () => new Promise((r) => requestAnimationFrame(r)));
    const prices = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="product-price"]')).map((el) =>
        Number(el.textContent.replace("$", "")),
      ),
    );
    const sorted = [...prices].sort((a, b) => a - b);
    assertEqual(prices, sorted, "prices should be in ascending order");
  });

  await scenario("the out-of-stock product carries a visible badge", async () => {
    const hasOutOfStock = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="product-card"]')).some((card) =>
        card.textContent.includes("Out of stock"),
      ),
    );
    assert(hasOutOfStock, "at least one card should be marked out of stock");
  });

  await scenario("clicking a product card opens its detail page", async () => {
    await clickByRole(mcp, "link", "Aurora Wireless Headphones");
    // Wait for an element that only exists on the detail page — the catalog
    // already shows the product summary, so "30-hour battery" appears in
    // both places and would let the wait return prematurely.
    await waitForText(mcp, "Quantity");
    const url = await currentUrl(mcp);
    assert(url.endsWith("/product/headphones-aurora"), `expected detail URL, got ${url}`);
  });
}
