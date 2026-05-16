/**
 * @file Checkout scenarios — form validation surfaces every field error,
 * happy-path submission ends on `/checkout/success` with an order number.
 *
 * Starting state: we arrived from the cart scenarios with one Aurora
 * headphones line item ($199 + $12 shipping = $211).
 */

import { assert, assertContains, assertEqual, group, scenario } from "../lib/harness.mjs";
import {
  clickByRole,
  currentUrl,
  evaluate,
  setReactInputValue,
  typeSelector,
  waitForRender,
  waitForText,
} from "../lib/helpers.mjs";

/**
 * Read every visible `role="alert"` message on the page.
 *
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 * @returns {Promise<string[]>}
 */
function readErrors(mcp) {
  return evaluate(mcp, () =>
    Array.from(document.querySelectorAll('[role="alert"]')).map((el) => el.textContent.trim()),
  );
}

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 */
export async function checkoutScenarios(mcp) {
  group("checkout");

  await scenario("submitting an empty form surfaces every required-field error", async () => {
    await clickByRole(mcp, "button", "Place order");
    await waitForText(mcp, "Name is required");
    const errs = await readErrors(mcp);
    assertEqual(errs.sort(), [
      "CVV must be 3 digits",
      "Card number must be 16 digits",
      "Email is required",
      "Expiry must be MM/YY",
      "Name is required",
      "Shipping address is required",
    ]);
  });

  await scenario("an invalid email yields a format-specific error", async () => {
    await typeSelector(mcp, "#field-fullName", "Demo Shopper");
    await typeSelector(mcp, "#field-email", "not-an-email");
    await typeSelector(mcp, "#field-address", "123 Cloud St");
    await typeSelector(mcp, "#field-card", "4242424242424242");
    await typeSelector(mcp, "#field-expiry", "12/29");
    await typeSelector(mcp, "#field-cvv", "123");

    await clickByRole(mcp, "button", "Place order");
    await waitForText(mcp, "Enter a valid email address");
    const errs = await readErrors(mcp);
    assertEqual(errs, ["Enter a valid email address"]);
  });

  await scenario("valid form submission completes and redirects", async () => {
    // Replace invalid email with a valid one via the React-aware setter.
    await setReactInputValue(mcp, "#field-email", "demo@nimbus.gear");
    await clickByRole(mcp, "button", "Place order");
    // The button's transient "Placing order…" label is intentionally not
    // asserted on — its lifetime (the 600 ms checkout delay) is too short
    // to observe reliably through a remote driver. The success page
    // appearing is the meaningful contract.
    await waitForText(mcp, "Order placed");
  });

  await scenario("success page shows a Nimbus-formatted order number", async () => {
    const url = await currentUrl(mcp);
    assert(url.endsWith("/checkout/success"), `expected /checkout/success, got ${url}`);
    const orderNumber = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="order-number"]')?.textContent,
    );
    assert(orderNumber, "order number element should exist");
    assertContains(orderNumber, "NMB-", "order number should start with NMB-");
    // Format: NMB-XXXX-XXXX (4 + 4 trailing chars).
    assert(
      /^NMB-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(orderNumber),
      `order number "${orderNumber}" doesn't match NMB-XXXX-XXXX`,
    );
  });

  await scenario("cart is empty after a successful order", async () => {
    await waitForRender(mcp);
    const badgeVisible = await evaluate(
      mcp,
      () => !!document.querySelector('[data-testid="cart-badge"]'),
    );
    assert(!badgeVisible, "cart badge should be hidden when empty");
  });
}
