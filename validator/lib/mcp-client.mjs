/**
 * @file Thin wrapper around the official Model Context Protocol SDK.
 *
 * Spawns the `@playwright/mcp` server as a child process over stdio and exposes
 * a single {@link PlaywrightMcp#call} helper that performs `tools/call`
 * requests and returns the concatenated text payload. The wrapper exists so
 * callers don't have to deal with the lower-level
 * `Client.callTool({ name, arguments })` shape every time.
 *
 * @module validator/mcp-client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Options accepted by {@link connectPlaywrightMcp}.
 *
 * @typedef {object} ConnectOptions
 * @property {boolean} [headless=true]   Run Chromium without a visible window.
 *                                       Pass `false` to watch the browser drive
 *                                       itself; useful during local debugging.
 * @property {string[]} [extraArgs=[]]   Additional CLI flags forwarded to
 *                                       `@playwright/mcp` (e.g. `--isolated`,
 *                                       `--device "iPhone 15"`).
 */

/**
 * Tool descriptor as returned by `tools/list`. Only the fields the demo
 * inspects are typed here; the SDK exposes a richer shape.
 *
 * @typedef {object} ToolDescriptor
 * @property {string} name              Tool name (e.g. `"browser_click"`).
 * @property {string} [description]     Human-readable summary from the server.
 * @property {object} [inputSchema]     JSON Schema describing tool arguments.
 */

/**
 * Result of a successful tool invocation: the concatenated text from the
 * server's `content` array, plus the raw response if a caller needs to inspect
 * non-text parts (images, embedded resources, etc.).
 *
 * @typedef {object} ToolResult
 * @property {string} text   All `content[].text` entries joined with newlines.
 * @property {object} raw    The raw response object from the SDK.
 */

/**
 * Spawn the `@playwright/mcp` server and return a ready-to-use client.
 *
 * The transport is stdio-based: the SDK pipes JSON-RPC frames over the child
 * process's stdin/stdout. Callers MUST invoke {@link PlaywrightMcp#close} when
 * done, otherwise the child process leaks.
 *
 * @param {ConnectOptions} [options]
 * @returns {Promise<PlaywrightMcp>}  Connected client wrapper.
 *
 * @example
 *   const mcp = await connectPlaywrightMcp({ headless: false });
 *   try {
 *     await mcp.call("browser_navigate", { url: "https://example.com" });
 *   } finally {
 *     await mcp.close();
 *   }
 */
export async function connectPlaywrightMcp({ headless = true, extraArgs = [] } = {}) {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@playwright/mcp@latest", ...(headless ? ["--headless"] : []), ...extraArgs],
  });

  const client = new Client({ name: "frontend-validator", version: "1.0.0" }, { capabilities: {} });

  await client.connect(transport);
  return new PlaywrightMcp(client);
}

/**
 * Convenience wrapper around the SDK {@link Client} that hides the
 * `callTool({ name, arguments })` boilerplate and surfaces tool errors as
 * thrown `Error`s rather than `isError: true` flags on the result.
 */
export class PlaywrightMcp {
  /**
   * @param {Client} client  Already-connected SDK client.
   */
  constructor(client) {
    /** @private @type {Client} */
    this.client = client;
  }

  /**
   * List every tool the connected MCP server exposes.
   *
   * @returns {Promise<ToolDescriptor[]>}  Tool descriptors from `tools/list`.
   */
  async listTools() {
    const { tools } = await this.client.listTools();
    return tools;
  }

  /**
   * Call a tool by name and return its concatenated text content.
   *
   * The MCP `tools/call` response can contain multiple content blocks of
   * different types (text, image, resource). This helper only joins the
   * `type: "text"` blocks — the raw response is also returned for callers that
   * need more.
   *
   * @template {Record<string, unknown>} A
   * @param {string} name   Tool name, e.g. `"browser_click"`.
   * @param {A} [args]      Tool arguments matching its `inputSchema`.
   * @returns {Promise<ToolResult>}  Concatenated text and raw response.
   * @throws {Error}        When the server reports `isError: true`. The
   *                        error message includes the tool name and the
   *                        server-supplied diagnostic text.
   */
  async call(name, args = {}) {
    const result = await this.client.callTool({ name, arguments: args });
    const text = (result.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    if (result.isError) {
      throw new Error(`tool ${name} failed:\n${text}`);
    }
    return { text, raw: result };
  }

  /**
   * Tear down the stdio transport and kill the child MCP server process.
   * Idempotent — safe to call more than once.
   *
   * @returns {Promise<void>}
   */
  async close() {
    await this.client.close();
  }
}
