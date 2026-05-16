/**
 * @file Visual snapshots — captures full-page PNGs at three points in the
 * flow. There's no DOM-level assertion here; the artefacts are for humans
 * (or for diffing against a baseline if you wire that in later).
 */

import { join } from "node:path";

import { group, scenario } from "../lib/harness.mjs";
import { clickByRole, evaluate, navigate, screenshot, waitForText } from "../lib/helpers.mjs";

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 * @param {string} APP_URL
 * @param {string} SHOTS_DIR  Absolute output directory.
 */
export async function visualScenarios(mcp, APP_URL, SHOTS_DIR) {
  group("visual");

  await scenario("catalogue in light theme", async () => {
    await navigate(mcp, APP_URL);
    await clickByRole(mcp, "radio", "Light theme");
    await waitForText(mcp, "Catalogue");
    await screenshot(mcp, join(SHOTS_DIR, "catalog-light.png"));
  });

  await scenario("catalogue in dark theme", async () => {
    await clickByRole(mcp, "radio", "Dark theme");
    // small wait for the color transition to settle
    await evaluate(mcp, () => new Promise((r) => requestAnimationFrame(r)));
    await screenshot(mcp, join(SHOTS_DIR, "catalog-dark.png"));
  });

  await scenario("product detail page", async () => {
    await clickByRole(mcp, "link", "Luna Studio Headphones");
    await waitForText(mcp, "planar-magnetic");
    await screenshot(mcp, join(SHOTS_DIR, "product-detail.png"));
  });
}
