/**
 * @file Auth scenarios — login form rendering, validation, and redirect.
 *
 * Demonstrates pattern (1): snapshot-tree lookups via ARIA role + name.
 */

import { assert, assertEqual, group, scenario } from "../lib/harness.mjs";
import {
  clickByRole,
  currentUrl,
  evaluate,
  navigate,
  setReactInputValue,
  snapshot,
  typeInto,
  waitForText,
} from "../lib/helpers.mjs";
import { findOne } from "../lib/snapshot.mjs";

/**
 * @param {import("../lib/mcp-client.mjs").PlaywrightMcp} mcp
 * @param {string} APP_URL  Base URL of the running app.
 */
export async function authScenarios(mcp, APP_URL) {
  group("auth");

  await scenario("redirects unauthenticated visitors to /login", async () => {
    await navigate(mcp, APP_URL);
    await waitForText(mcp, "Welcome back");
    const url = await currentUrl(mcp);
    assert(url.endsWith("/login"), `expected to land on /login, got ${url}`);
  });

  await scenario("renders the login form fields", async () => {
    const { nodes } = await snapshot(mcp);
    findOne(nodes, "heading", "Welcome back");
    findOne(nodes, "textbox", "Username");
    findOne(nodes, "textbox", "Password");
    findOne(nodes, "button", "Sign in");
  });

  await scenario("rejects invalid credentials with an inline error", async () => {
    await typeInto(mcp, "Username", "demo");
    await typeInto(mcp, "Password", "wrong");
    await clickByRole(mcp, "button", "Sign in");
    await waitForText(mcp, "Invalid username or password");
    const url = await currentUrl(mcp);
    assert(url.endsWith("/login"), "should still be on the login page");
  });

  await scenario("redirects to the catalogue after a successful sign-in", async () => {
    // Reset the password field via the React-aware setter (direct
    // `.value =` bypasses React's controlled-input tracker).
    await setReactInputValue(mcp, "#password", "demo");
    await clickByRole(mcp, "button", "Sign in");
    await waitForText(mcp, "Catalogue");
    const url = await currentUrl(mcp);
    const path = new URL(url).pathname;
    assertEqual(path, "/", "should land on the catalogue root");
    const userName = await evaluate(
      mcp,
      () => document.querySelector('[data-testid="user-name"]')?.textContent,
    );
    assertEqual(userName, "Demo Shopper");
  });
}
