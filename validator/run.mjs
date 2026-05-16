/**
 * @file Orchestrator — connects to Playwright MCP, runs each scenario group
 * in order, prints a summary, and tears everything down.
 *
 * Scenario *logic* lives in {@link validator/scenarios}; helpers in
 * {@link validator/lib}. This file is intentionally short so a reader can
 * see the full top-level flow at a glance.
 *
 * CLI flags:
 *   --start-app   Spawn the Vite dev server before running and kill it
 *                 afterwards. Without this flag the app must already be
 *                 reachable at {@link APP_URL}.
 *   --headed      Launch Chromium with a visible window.
 *
 * Environment variables:
 *   APP_URL       Override the default `http://127.0.0.1:5173/`.
 *
 * @module validator/run
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { report } from "./lib/harness.mjs";
import { connectPlaywrightMcp } from "./lib/mcp-client.mjs";
import {
  authScenarios,
  cartScenarios,
  catalogScenarios,
  checkoutScenarios,
  themeScenarios,
  visualScenarios,
} from "./scenarios/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:5173/";
const SHOTS = join(ROOT, "screenshots");

/**
 * Poll a URL until it responds with a 2xx status or the deadline elapses.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`app did not become ready at ${url} within ${timeoutMs}ms`);
}

/**
 * Spawn the Vite dev server as a child process. The caller is responsible
 * for killing it via the returned `ChildProcess` reference.
 *
 * @returns {Promise<import("node:child_process").ChildProcess>}
 */
async function startApp() {
  console.log("Starting Vite dev server...");
  const child = spawn("pnpm", ["app"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, BROWSER: "none" },
  });
  await waitForUrl(APP_URL, 30_000);
  console.log("App ready.");
  return child;
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  /** @type {import("node:child_process").ChildProcess | undefined} */
  let appProc;
  if (process.argv.includes("--start-app")) {
    appProc = await startApp();
  }

  console.log("Connecting to Playwright MCP server...");
  const mcp = await connectPlaywrightMcp({
    headless: !process.argv.includes("--headed"),
  });

  try {
    const tools = await mcp.listTools();
    console.log(`Connected. ${tools.length} tools available.`);

    // ─── Run scenario groups in functional order ──────────────────────
    // Each group leaves the page in a known state for the next one, so
    // they're sequenced like a user story rather than independently.
    await authScenarios(mcp, APP_URL);
    await catalogScenarios(mcp);
    await cartScenarios(mcp, APP_URL);
    await checkoutScenarios(mcp);
    await themeScenarios(mcp);
    await visualScenarios(mcp, APP_URL, SHOTS);

    report();
  } finally {
    await mcp.close().catch(() => {});
    if (appProc) {
      appProc.kill();
      // Give the dev server a moment to release the port.
      await sleep(200);
    }
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
