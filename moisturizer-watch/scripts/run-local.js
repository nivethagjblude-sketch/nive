#!/usr/bin/env node
/* scripts/run-local.js - run the full pipeline locally in Node.

Usage:
  node scripts/run-local.js --demo            offline sample run (no network)
  node scripts/run-local.js --dry-email       also write data/email_dryrun.html/.txt
  node scripts/run-local.js                   real collection (needs network)

Writes to ./data (latest.json, history/*, status.json) via LocalStore.
Emails are NEVER sent from this script.
*/

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LocalStore } from "./localStore.js";
import { runPipeline } from "../shared/pipeline.js";
import { buildEmail } from "../shared/email.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const isDemo = args.includes("--demo");
const dryEmail = args.includes("--dry-email");

const store = new LocalStore(path.join(ROOT, "data"));
const result = await runPipeline({
  store,
  demo: isDemo,
  runType: isDemo ? "demo" : "auto",
});

const out = {
  ok: true,
  is_demo: isDemo,
  run_date_ist: result.date,
  summary: result.report.summary,
  validation: {
    kept: result.validation.kept,
    dropped: result.validation.reasonCount,
    reasons: result.validation.dropped,
  },
  history_file: `history/${result.date}`,
};
console.log(JSON.stringify(out, null, 2));

if (dryEmail) {
  const mail = buildEmail(result.report);
  const htmlPath = path.join(ROOT, "data", "email_dryrun.html");
  const txtPath = path.join(ROOT, "data", "email_dryrun.txt");
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await fs.writeFile(htmlPath, mail.html, "utf-8");
  await fs.writeFile(txtPath, mail.text, "utf-8");
  console.log(`email dry-run subject: ${mail.subject}`);
  console.log(`  html: ${htmlPath}`);
  console.log(`  text: ${txtPath}`);
}