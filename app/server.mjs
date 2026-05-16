/**
 * @file Zero-dependency static file server for the demo app.
 *
 * Serves `index.html`, `app.js` and `styles.css` from this directory on
 * `http://localhost:5173` (override via the `PORT` env var). The server is
 * intentionally minimal so the demo has no production dependencies beyond
 * `@modelcontextprotocol/sdk` and `@playwright/mcp`; it is NOT meant for
 * use outside this demo.
 *
 * Security note: a `..` traversal check guards against requests that try to
 * escape the document root. Any such request is rejected with `403`.
 *
 * @module app/server
 */

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

/** Directory whose files are served. @type {string} */
const ROOT = fileURLToPath(new URL(".", import.meta.url));

/** TCP port to listen on. @type {number} */
const PORT = Number(process.env.PORT ?? 5173);

/**
 * Map of recognised file extensions to the `Content-Type` header value to
 * return for them. Anything not in this map is served as
 * `application/octet-stream`.
 *
 * @type {Record<string, string>}
 */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let path = decodeURIComponent(url.pathname);
  if (path === "/") path = "/index.html";

  // Resolve against ROOT and ensure the result is still inside ROOT.
  // This prevents path-traversal attacks like `/../../etc/passwd`.
  const filePath = join(ROOT, normalize(path));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

server.listen(PORT, () => {
  console.log(`[app] serving ${ROOT} at http://localhost:${PORT}`);
});
