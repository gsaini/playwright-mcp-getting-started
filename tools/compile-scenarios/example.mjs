/**
 * @file Reference output for tools/compile-scenarios/example.feature.
 * Used as a few-shot example in the compiler's system prompt — it shows the
 * model the exact import shape, header docstring, scenario layout, and helper
 * vocabulary to use.
 */

import { assertEqual, group, scenario } from "../lib/harness.mjs";
import { clickByRole, evaluate, waitForRender } from "../lib/helpers.mjs";

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 */
export async function counterScenarios(mcp) {
  group("counter");

  await scenario("clicking Increment three times raises the value to 3", async () => {
    for (let i = 0; i < 3; i++) {
      await clickByRole(mcp, "button", "Increment");
    }
    await waitForRender(mcp);
    const value = await evaluate(
      mcp,
      () => document.querySelector("[data-testid=counter]").textContent,
    );
    assertEqual(value, "3");
  });

  await scenario("clicking Reset returns the value to 0", async () => {
    await clickByRole(mcp, "button", "Reset");
    await waitForRender(mcp);
    const value = await evaluate(
      mcp,
      () => document.querySelector("[data-testid=counter]").textContent,
    );
    assertEqual(value, "0");
  });
}
