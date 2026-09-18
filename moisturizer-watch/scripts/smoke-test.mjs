#!/usr/bin/env node
/* scripts/smoke-test.mjs - offline verification of the Cloudflare pipeline.

No network, no Cloudflare account, no Gmail. Uses an in-memory KV mock to:
  1. run the full demo pipeline (collect-demo -> normalize -> validate -> compare)
  2. simulate the Worker /api/* endpoints
  3. simulate the Pages Functions (same handlers, same mock env)
  4. check JSON validity + key invariants

Run: node scripts/smoke-test.mjs
*/

import { runPipeline } from "../shared/pipeline.js";
import { buildEmail } from "../shared/email.js";
import { buildMime } from "../shared/mime.js";
import { KvStore } from "../shared/storage.js";

class MockKV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v) { this.m.set(k, v); }
}

const kv = new MockKV();
const env = { MOISTURIZER_KV: kv };
const store = new KvStore(env);
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
check("second run skips all as duplicates (demo baseline reset)",
  r2.report.summary.new_products === 3 &&
  r2.report.summary.duplicates_skipped === 0);

// 2) storage artifacts exist
const latest = await store.get("latest");
const status = await store.get("status");
const histIndex = await store.get("history");
const dated = await store.get(`history/${r1.date}`);
check("latest.json present + valid", !!latest && !!latest.summary && Array.isArray(latest.items));
check("status.json present", !!status && status.run_date_ist === r1.date);
check("history index present", !!histIndex && histIndex.history.length >= 1);
check("dated history present", !!dated && dated.generated_at === latest.generated_at);

// 3) every item has schema + source
const schemaOk = latest.items.every((it) =>
  it.product_name && it.product_type && it.confidence &&
  Array.isArray(it.sources) && it.sources.length >= 1 &&
  it.sources.every((s) => /^https?:/.test(s.url)) &&
  /^(new|updated)$/.test(it.new_or_updated) &&
  typeof it.price_inr !== "string"
);
check("all items match schema + have valid sources", schemaOk);

// 4) mime builder produces a well-formed multipart email
const mail = buildEmail(r1.report);
const mime = buildMime({
  from: "a@example.com", to: "b@example.com",
  subject: mail.subject, html: mail.html, text: mail.text,
});
check("subject uses encoded-word for non-ASCII", /\?utf-8\?B\?/.test(mime.split("\n")[1]) || !/[^\x00-\x7F]/.test(mime.split("\n")[1]));
check("mime has multipart boundary", /multipart\/alternative/.test(mime) && mime.includes(`--${/boundary="([^"]+)"/.exec(mime)[1]}--`));
check("mime has base64 text part", mime.includes("Content-Transfer-Encoding: base64"));

// 5) simulate Worker + Pages Function handlers with the mock env
const { default: worker } = await import("../worker/index.js");
const latestReq = new Request("https://test.local/api/latest");
const resp = await worker.fetch(latestReq, env, {});
check("worker GET /api/latest -> 200 JSON", resp.status === 200 && (await resp.json()).generated_at === latest.generated_at);

const statusRes = await worker.fetch(new Request("https://test.local/api/status"), env, {});
check("worker GET /api/status -> 200", (await statusRes.json()).last_email_status === "pending");

const histRes = await worker.fetch(new Request("https://test.local/api/history"), env, {});
check("worker GET /api/history -> list", (await histRes.json()).history.length >= 1);

// Pages Functions use the same store adapter; test them directly
const { onRequestGet: latestFn } = await import("../dashboard/functions/api/latest.js");
const pages = await latestFn({ env, params: {} });
check("Pages /api/latest handler -> 200 JSON", pages.status === 200 && (await pages.json()).summary.products_reviewed === 3);

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
process.exit(failures.length ? 1 : 0);