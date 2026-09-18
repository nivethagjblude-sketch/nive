#!/usr/bin/env node
/* scripts/run-local.js - run the full pipeline locally in Node.

Usage:
  node scripts/run-local.js --demo            offline sample run (no network)
  node scripts/run-local.js                   real collection (needs network)

Optional env:
  RUN_TYPE  label recorded in data/status.json (e.g. "schedule", "manual", "demo")

Writes to ./data (latest.json, status.json, history/index.json, history/*.json)
via LocalStore. Those files are committed to the repo; docs/data/ mirrors them
for the GitHub Pages dashboard.
*/

import path from "node:path";
import { fileURLToPath } from "node:url";

import { LocalStore } from "./localStore.js";
import { runPipeline } from "../shared/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const isDemo = args.includes("--demo");
const runType = process.env.RUN_TYPE || (isDemo ? "demo" : "auto");

const store = new LocalStore(path.join(ROOT, "data"));
const result = await runPipeline({ store, demo: isDemo, runType });

const out = {
  ok: true,
  is_demo: isDemo,
  run_type: runType,
  run_date_ist: result.date,
  summary: result.report.summary,
  validation: {
    kept: result.validation.kept,
    dropped: result.validation.reasonCount,
    reasons: result.validation.dropped,
  },
  files: {
    latest: path.join("data", "latest.json"),
    status: path.join("data", "status.json"),
    history_index: path.join("data", "history", "index.json"),
    run_report: path.join("data", "history", `${result.date}.json`),
  },
};
console.log(JSON.stringify(out, null, 2));