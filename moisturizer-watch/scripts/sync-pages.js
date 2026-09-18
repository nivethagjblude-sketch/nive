#!/usr/bin/env node
/* scripts/sync-pages.js - mirror ./data into ./docs/data so the static
GitHub Pages dashboard can read it via relative paths (docs/ is served as
the site root -- locally at /docs/, on GitHub Pages at /nive/data/...).

Run: npm run sync:pages   (also invoked by the GitHub Actions workflow)
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "data");
const DST = path.join(ROOT, "docs", "data");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`No ${SRC} yet. Run 'npm run demo' or 'npm run collect' first.`);
  process.exit(1);
}

fs.rmSync(DST, { recursive: true, force: true });
copyDir(SRC, DST);
console.log(`Synced ${SRC} -> ${DST}`);
console.log(fs.readdirSync(DST, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => `  ${e.name}`)
  .join("\n"));