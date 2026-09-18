#!/usr/bin/env node
/* scripts/dev-server.js - minimal static file server (stdlib only) for local
preview of the GitHub Pages dashboard.

Serves the project root (the folder containing docs/). The dashboard is then at:
  http://localhost:8080/docs/

Relative data paths behave identically here (/docs/data/...) and on GitHub
Pages (/nive/data/...).

Run: npm run serve   [PORT=8080]
*/

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.normalize(path.join(ROOT, urlPath));
  if (file === ROOT || !file.startsWith(ROOT)) {
    return send(res, 404, "text/plain", "Not found");
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file)) return send(res, 404, "text/plain", "Not found");
  const ext = path.extname(file);
  send(res, 200, MIME[ext] || "application/octet-stream", fs.readFileSync(file));
});

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}/docs/`);
});