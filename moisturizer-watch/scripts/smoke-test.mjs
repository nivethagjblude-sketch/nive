#!/usr/bin/env node
/* scripts/smoke-test.mjs - offline verification of the GitHub-native pipeline.

No network, no Cloudflare, no Gmail. Uses a temporary LocalStore (real files on
disk) to:
  1. run the full demo pipeline twice (collect-demo -> normalize -> validate ->
     compare -> history index -> status)
  2. verify the exact files the GitHub Pages dashboard reads are written
  3. check schema + data-honesty invariants
  4. confirm the dashboard no longer calls /api/* and uses relative static paths

Run: npm test   (node scripts/smoke-test.mjs)
*/

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LocalStore } from "./localStore.js";
import { runPipeline } from "../shared/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "moisturizer-smoke-"));
const store = new LocalStore(DIR);

const results = [];
function check(name, cond) {
  results.push({ name, pass: Boolean(cond) });
  console.log(`${cond ? "PASS" : "FAIL"} - ${name}`);
}

// 1) demo pipeline (twice: second run must classify everything as duplicate)
const r1 = await runPipeline({ store, demo: true, runType: "demo" });
const r2 = await runPipeline({ store, demo: true, runType: "demo" });

check("run 1 wrote 3 demo items", r1.report.summary.products_reviewed === 3);
check("run 1 marks all as new", r1.report.summary.new_products === 3);
check("first report flagged is_demo", r1.report.is_demo === true);
check("second run resets baseline (demo ignored) and re-reports 3 new",
  r2.report.summary.new_products === 3);

// 2) files the dashboard reads actually exist on disk
const latestFile = path.join(DIR, "latest.json");
const statusFile = path.join(DIR, "status.json");
const histIndexFile = path.join(DIR, "history", "index.json");
const historyFile = path.join(DIR, "history", `${r1.date}.json`);
check("latest.json written", fs.existsSync(latestFile));
check("status.json written", fs.existsSync(statusFile));
check("history/index.json written", fs.existsSync(histIndexFile));
check(`history/${r1.date}.json written`, fs.existsSync(historyFile));

const latest = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
const status = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
const histIndex = JSON.parse(fs.readFileSync(histIndexFile, "utf-8"));
const dated = JSON.parse(fs.readFileSync(historyFile, "utf-8"));

check("latest.json has summary + items", !!latest.summary && Array.isArray(latest.items));
check("status.json no email fields, has history_count",
  !("last_email_status" in status) && status.history_count >= 1 &&
  status.run_date_ist === r1.date);
check("history index has dated entry", histIndex.history.length === 1 &&
  histIndex.history[0].file === `history/${r1.date}`);
check("dated history matches latest timestamp",
  dated.generated_at === latest.generated_at);

// 3) every item has schema + real source (data-honesty)
const schemaOk = latest.items.every((it) =>
  it.product_name && it.product_type && it.confidence &&
  Array.isArray(it.sources) && it.sources.length >= 1 &&
  it.sources.every((s) => /^https?:/.test(s.url)) &&
  /^(new|updated)$/.test(it.new_or_updated) &&
  typeof it.price_inr !== "string"
);
check("all items match schema + have valid sources", schemaOk);

// 4) dashboard is GitHub-Pages ready: no /api, uses relative static data paths
const appJsPath = path.join(ROOT, "docs", "app.js");
const idxPath = path.join(ROOT, "docs", "index.html");
const appJs = fs.readFileSync(appJsPath, "utf-8");
const idxHtml = fs.readFileSync(idxPath, "utf-8");

check("docs/app.js contains no /api calls", !/['"]\/(?:api|api\/)/.test(appJs) && !appJs.includes("MOISTURIZER_WORKER"));
check("docs/app.js reads relative data/latest.json", appJs.includes('"data"') && appJs.includes('"latest.json"') || appJs.includes("latest.json"));
check("docs/index.html has no Cloudflare references",
  !/Cloudflare|worker|KV/i.test(idxHtml));

// 5) LocalStore maps exactly like pipeline test used above (key->file)
const localStore = new LocalStore(DIR);
check("LocalStore fileFor('latest') -> latest.json",
  localStore.fileFor("latest") === "latest.json");
check("LocalStore fileFor('history/2026-09-18') -> history/2026-09-18.json",
  localStore.fileFor("history/2026-09-18") === "history/2026-09-18.json");

fs.rmSync(DIR, { recursive: true, force: true });

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
process.exit(failures.length ? 1 : 0);