/**
 * @file Theme scenarios — verify the three-way toggle (Light / System / Dark)
 * actually flips the `.dark` class on `<html>` and persists the preference.
 *
 * The Header's `ThemeToggle` uses `role="radiogroup"` with three `role="radio"`
 * buttons named "Light theme", "System theme", "Dark theme", which makes them
 * easy to address via the snapshot tree.
 */

import { assert, assertEqual, group, scenario } from "../lib/harness.mjs";
import { clickByRole, evaluate, waitForRender } from "../lib/helpers.mjs";

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 */
export async function themeScenarios(mcp) {
  group("theme");

  await scenario("light theme removes the .dark class from <html>", async () => {
    await clickByRole(mcp, "radio", "Light theme");
    await waitForRender(mcp);
    const isDark = await evaluate(mcp, () => document.documentElement.classList.contains("dark"));
    assertEqual(isDark, false, "expected <html> to NOT carry .dark");
  });

  await scenario("dark theme adds the .dark class to <html>", async () => {
    await clickByRole(mcp, "radio", "Dark theme");
    await waitForRender(mcp);
    const isDark = await evaluate(mcp, () => document.documentElement.classList.contains("dark"));
    assertEqual(isDark, true, "expected <html> to carry .dark");
  });

  await scenario("preference persists to localStorage", async () => {
    const stored = await evaluate(mcp, () => localStorage.getItem("nimbus.theme"));
    assertEqual(stored, "dark");
  });

  await scenario("system theme defers to the OS preference", async () => {
    await clickByRole(mcp, "radio", "System theme");
    await waitForRender(mcp);
    const stored = await evaluate(mcp, () => localStorage.getItem("nimbus.theme"));
    assertEqual(stored, "system");
    // We don't assert .dark here because it depends on the host OS; the
    // important contract is that "System" was recorded as the preference.
    const radioChecked = await evaluate(
      mcp,
      () => document.querySelector('[role="radio"][aria-label="System theme"]')?.ariaChecked,
    );
    assert(radioChecked === "true", "the System radio should be aria-checked");
  });
}
