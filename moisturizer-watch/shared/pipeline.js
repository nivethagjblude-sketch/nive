/* pipeline.js - orchestrates all stages for one weekly run.

Works in Node (local dev and GitHub Actions). `store` is any object exposing
get(key) / put(key, obj) with a Workers-KV-like interface (see
scripts/localStore.js which writes plain JSON files under ./data).
*/

import { collect, collectDemo } from "./collect.js";
import { normalize } from "./normalize.js";
import { validate } from "./validate.js";
import { buildReport } from "./compare.js";
import { buildDigest } from "./digest.js";
import {
  CATEGORY, DEMO_NOTE, KEY_HISTORY, KEY_LATEST, KEY_STATUS, MARKET, historyDateKey,
} from "./config.js";
import { isoDate, istDateString } from "./utils.js";

export async function updateHistoryIndex(store, date, report, now = new Date()) {
  const index = (await store.get(KEY_HISTORY, null)) || { history: [] };
  const entries = (index.history || []).filter((e) => e.date !== date);
  entries.unshift({
    date,
    file: `history/${date}`,
    summary: report.summary,
    is_demo: Boolean(report.is_demo),
  });
  const idx = {
    generated_at: isoDate(now),
    history: entries,
  };
  await store.put(KEY_HISTORY, idx);
  return idx;
}

export async function buildStatus(store, report, date, opts, now = new Date()) {
  const index = (await store.get(KEY_HISTORY, null)) || { history: [] };
  const status = {
    generated_at: isoDate(now),
    run_date_ist: date,
    run_type: opts.runType || "auto",
    is_demo: Boolean(report.is_demo),
    pipeline: "ok",
    last_data_update: report.generated_at,
    last_successful_run: report.generated_at,
    history_count: (index.history || []).length,
    verified_sources: report.summary.verified_sources,
    products_reviewed: report.summary.products_reviewed,
    new_products: report.summary.new_products,
    updated_products: report.summary.updated_products,
    history_file: `history/${date}`,
  };
  await store.put(KEY_STATUS, status);
  return status;
}

export async function runPipeline({ store, demo = false, runType = "auto", now = new Date() }) {
  const raw = demo ? await collectDemo() : await collect();
  raw.is_demo = demo;
  raw.note = demo ? DEMO_NOTE : undefined;

  const normalized = normalize(raw);
  const valid = validate(normalized);

  const prev = await store.get(KEY_LATEST, null);
  const prevItems =
    prev && Array.isArray(prev.items) && !prev.is_demo ? prev.items : [];

  const report = buildReport(valid.items, prevItems, {
    generated_at: isoDate(now),
    market: MARKET,
    category: CATEGORY,
    is_demo: demo,
  });
  const date = istDateString(now);

  await store.put(KEY_LATEST, report);
  await store.put(historyDateKey(date), report);
  await updateHistoryIndex(store, date, report, now);
  const digest = buildDigest(report);
  const status = await buildStatus(store, report, date, { runType }, now);

  return { report, digest, status, date, validation: valid.validation, raw };
}