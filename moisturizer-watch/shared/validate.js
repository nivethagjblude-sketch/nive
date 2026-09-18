/* validate.js - schema + content rules, de-dup of validated items. */
import {
  ALLOWED_AVAILABILITY, ALLOWED_CONFIDENCE, ALLOWED_SOURCE_TYPES,
  ALLOWED_STATUS, hasMoisturizerTerm, isNonMoisturizer,
} from "./classification.js";
import { normalizeUrl } from "./utils.js";

const REQUIRED_FIELDS = [
  "product_name", "brand", "product_type", "skin_type", "key_ingredients",
  "launch_or_update_date", "india_availability", "price_inr", "pack_size",
  "short_description", "notable_features", "new_or_updated", "sources",
  "confidence",
];

function hasValidSource(item) {
  const sources = item && Array.isArray(item.sources) ? item.sources : [];
  if (!sources.length) return { ok: false, reason: "no sources" };
  const anyValid = sources.some(
    (s) => s && (String(s.url).startsWith("http://") || String(s.url).startsWith("https://"))
  );
  return anyValid ? { ok: true, reason: "" } : { ok: false, reason: "no valid http(s) source URL" };
}

export function validateItem(item) {
  if (!item || typeof item !== "object") {
    return { ok: false, reason: "not an object", item };
  }
  const title = String(item.product_name || "");
  const text = `${title} ${item.short_description || ""}`;
  if (!title.trim()) return { ok: false, reason: "empty product name", item };
  if (!hasMoisturizerTerm(text)) {
    return { ok: false, reason: "no moisturizer term in title/description", item };
  }
  if (isNonMoisturizer(text)) {
    return { ok: false, reason: "indicates non-moisturizer category", item };
  }
  const src = hasValidSource(item);
  if (!src.ok) return { ok: false, reason: src.reason, item };

  const it = { ...item };
  for (const f of REQUIRED_FIELDS) {
    if (it[f] === undefined) {
      it[f] = ["skin_type", "key_ingredients", "notable_features", "sources"].includes(f) ? [] : "";
    }
  }
  if (!ALLOWED_AVAILABILITY.has(it.india_availability)) it.india_availability = "unknown";
  if (!ALLOWED_STATUS.has(it.new_or_updated)) it.new_or_updated = "new";
  if (!ALLOWED_CONFIDENCE.has(it.confidence)) it.confidence = "low";
  if (it.price_inr != null && typeof it.price_inr !== "number") it.price_inr = null;

  it.sources = (Array.isArray(it.sources) ? it.sources : [])
    .filter((s) => s && typeof s === "object" && /^https?:\/\//.test(String(s.url)))
    .map((s) => ({
      name: String(s.name || "").trim(),
      url: String(s.url || "").trim(),
      published_or_checked_date: String(s.published_or_checked_date || "").trim(),
      source_type: ALLOWED_SOURCE_TYPES.has(s.source_type) ? s.source_type : "secondary",
    }));

  return { ok: true, reason: "", item: it };
}

export function validate(normalized, dedupe = true) {
  const kept = [];
  const dropped = [];
  for (const it of normalized.items || []) {
    const r = validateItem(it);
    if (r.ok) kept.push(r.item);
    else dropped.push({ reason: r.reason, title: String(it.product_name || "").slice(0, 120) });
  }

  if (dedupe) {
    const seen = new Set();
    const out = [];
    for (const it of kept) {
      const src = (it.sources && it.sources[0] && it.sources[0].url) || "";
      const uk = normalizeUrl(src);
      const tk = String(it.product_name || "").trim().toLowerCase();
      if (uk && seen.has(uk)) continue;
      if (tk && seen.has(tk)) continue;
      if (uk) seen.add(uk);
      if (tk) seen.add(tk);
      out.push(it);
    }
    kept.length = 0;
    kept.push(...out);
  }

  return {
    is_demo: Boolean(normalized.is_demo),
    items: kept,
    validation: { kept: kept.length, dropped, reasonCount: dropped.length },
  };
}