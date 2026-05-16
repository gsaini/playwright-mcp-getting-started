/**
 * @file Cart scenarios — add from detail page, quantity stepper, remove
 * line item, badge sync, totals math.
 *
 * Starting state assumption: we land on `/product/headphones-aurora` after
 * the catalog scenarios. The cart is empty (sessionStorage is cleared at
 * the start of each `pnpm demo` run).
 */

import { assert, assertEqual, group, scenario } from "../lib/harness.mjs";
import {
  clickByRole,
  clickSelector,
  currentUrl,
  evaluate,
  navigate,
  waitForRender,
  waitForText,
} from "../lib/helpers.mjs";

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 * @param {string} APP_URL
 */
export async function cartScenarios(mcp, APP_URL) {
  group("cart");

  await scenario("adds a product to the cart and shows a toast", async () => {
    // Bump quantity to 2 first.
    await clickByRole(mcp, "button", "Increase quantity");
    await waitForRender(mcp);
    const qty = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="quantity-value"]').textContent,
    );
    assertEqual(qty, "2");
    await clickByRole(mcp, "button", "Add to cart");
    await waitForText(mcp, "Added to cart");
  });

  await scenario("cart badge updates with the new item count", async () => {
    await waitForRender(mcp);
    const badge = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="cart-badge"]')?.textContent,
    );
    assertEqual(badge, "2", "badge should read 2 after adding qty=2");
  });

  await scenario("adding a second product compounds the badge count", async () => {
    await clickByRole(mcp, "link", "Catalog");
    await waitForText(mcp, "Catalogue");
    await clickByRole(mcp, "link", "Polaris Mechanical Keyboard");
    await waitForText(mcp, "Hot-swappable");
    await clickByRole(mcp, "button", "Add to cart");
    await waitForText(mcp, "Added to cart");
    await waitForRender(mcp);

    const badge = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="cart-badge"]')?.textContent,
    );
    assertEqual(badge, "3", "badge should now read 3 (2 headphones + 1 keyboard)");
  });

  await scenario("cart page lists every line item with correct totals", async () => {
    await navigate(mcp, `${APP_URL}cart`);
    await waitForText(mcp, "Your cart");

    const lines = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="cart-line"]')).map((li) => ({
        id: li.dataset.productId,
        qty: Number(li.querySelector('[data-testid="line-qty"]').textContent),
      })),
    );
    assertEqual(lines, [
      { id: "headphones-aurora", qty: 2 },
      { id: "keyboard-polaris", qty: 1 },
    ]);

    const subtotal = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="cart-subtotal"]').textContent,
    );
    // 2 × $199 + 1 × $149 = $547
    assertEqual(subtotal, "$547");

    const total = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="cart-total"]').textContent,
    );
    // subtotal $547 + shipping $12 = $559
    assertEqual(total, "$559");
  });

  await scenario("decreasing a line quantity updates totals", async () => {
    await clickSelector(
      mcp,
      '[data-testid="cart-line"][data-product-id="headphones-aurora"] button[aria-label^="Decrease"]',
      "decrease Aurora headphones",
    );
    await waitForText(mcp, "$348"); // new subtotal
    const lines = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="cart-line"]')).map((li) => ({
        id: li.dataset.productId,
        qty: Number(li.querySelector('[data-testid="line-qty"]').textContent),
      })),
    );
    assertEqual(lines, [
      { id: "headphones-aurora", qty: 1 },
      { id: "keyboard-polaris", qty: 1 },
    ]);
  });

  await scenario("removing a line drops it from the cart", async () => {
    await clickByRole(mcp, "button", "Remove Polaris Mechanical Keyboard");
    await waitForRender(mcp);
    const ids = await evaluate(mcp, () =>
      Array.from(document.querySelectorAll('[data-testid="cart-line"]')).map(
        (li) => li.dataset.productId,
      ),
    );
    assertEqual(ids, ["headphones-aurora"]);
    const badge = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="cart-badge"]')?.textContent,
    );
    assertEqual(badge, "1", "badge should reflect the remaining single item");
  });

  await scenario("checkout CTA navigates to /checkout", async () => {
    await clickByRole(mcp, "button", "Checkout");
    await waitForText(mcp, "Place order");
    const url = await currentUrl(mcp);
    assert(url.endsWith("/checkout"), `expected /checkout, got ${url}`);
  });
}
