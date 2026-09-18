/* compare.js - new/updated/duplicate classification + report assembly. */
import { normalizeUrl } from "./utils.js";

function keys(item) {
  const src = (item.sources && item.sources[0]) || {};
  const urlKey = normalizeUrl(src.url || "");
  const titleKey = String(item.product_name || "").trim().toLowerCase();
  const textKey = clean(`${item.product_name} ${item.short_description} ${item.launch_or_update_date}`)
    .toLowerCase();
  return { urlKey, titleKey, textKey };
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

export function classify(items, prevItems) {
  const byUrl = new Map();
  const byTitle = new Map();
  for (const it of prevItems || []) {
    const { urlKey, titleKey } = keys(it);
    if (urlKey && !byUrl.has(urlKey)) byUrl.set(urlKey, it);
    if (titleKey && !byTitle.has(titleKey)) byTitle.set(titleKey, it);
  }

  const newList = [];
  const updatedList = [];
  const duplicates = [];
  const seenUrl = new Set();
  const seenTitle = new Set();

  for (const it of items) {
    const { urlKey, titleKey, textKey } = keys(it);
    const isDupUrl = urlKey && seenUrl.has(urlKey);
    const isDupTitle = titleKey && seenTitle.has(titleKey) && !isDupUrl;
    if (isDupUrl || isDupTitle) {
      duplicates.push(it);
      continue;
    }
    if (urlKey) seenUrl.add(urlKey);
    if (titleKey) seenTitle.add(titleKey);

    const existing = (urlKey && byUrl.get(urlKey)) || (titleKey && byTitle.get(titleKey));
    if (!existing) {
      it.new_or_updated = "new";
      newList.push(it);
      continue;
    }
    const prevText = keys(existing).textKey;
    if (prevText === textKey) {
      duplicates.push(it);
      continue;
    }
    it.new_or_updated = "updated";
    updatedList.push(it);
  }
  return { newList, updatedList, duplicates };
}

export function uniqueSourceCount(items) {
  const set = new Set();
  for (const it of items) {
    for (const s of it.sources || []) {
      const u = normalizeUrl(s.url);
      if (u) set.add(u);
    }
  }
  return set.size;
}

export function buildReport(validatedItems, prevItems, meta) {
  const { newList, updatedList, duplicates } = classify(validatedItems, prevItems);
  const kept = [...newList, ...updatedList];
  return {
    generated_at: meta.generated_at,
    market: meta.market,
    category: meta.category,
    is_demo: Boolean(meta.is_demo),
    summary: {
      products_reviewed: validatedItems.length,
      new_products: newList.length,
      updated_products: updatedList.length,
      duplicates_skipped: duplicates.length,
      verified_sources: uniqueSourceCount(kept),
    },
    items: kept,
  };
}