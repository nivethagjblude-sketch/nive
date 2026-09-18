/* normalize.js - raw news entries -> product schema items. */
import {
  classifySourceType, detectIngredients, detectProductType, detectSkinTypes,
  extractPackSize, extractPrice, hintsIndia,
} from "./classification.js";
import { cleanText, stripUtm, normalizeUrl } from "./utils.js";

function parseRssPublished(value) {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  return String(value);
}

function guessBrand(entry) {
  const title = cleanText(entry.title);
  const low = title.toLowerCase();
  for (const prefix of ["introducing ", "introduces ", "launches ", "launch of ", "new from "]) {
    if (low.startsWith(prefix)) {
      const rest = title.slice(prefix.length).replace(/[\u2014–]-?\s*(now\s*.+)?$/i, "").trim();
      const parts = rest.split(/[^A-Za-z0-9 &]+/).filter(Boolean);
      if (parts.length) return parts[0].split(/\s+/)[0];
    }
  }
  return "unknown";
}

export function normalizeItem(entry, isDemo) {
  const title = cleanText(entry.title);
  const url = stripUtm(entry.url).trim();
  if (!title || !url) return null;
  const text = cleanText(`${title} ${entry.description}`);
  const published = parseRssPublished(entry.published);
  const sourceType = classifySourceType(entry.sourceUrl || url, entry.sourceName);
  const ingredients = detectIngredients(text);
  const indiaAvailability = !hintsIndia(text)
    ? "unknown"
    : sourceType === "retailer" ? "available" : "reported";

  const item = {
    product_name: title,
    brand: guessBrand(entry),
    product_type: detectProductType(text),
    skin_type: detectSkinTypes(text),
    key_ingredients: ingredients,
    launch_or_update_date: published,
    india_availability: indiaAvailability,
    price_inr: extractPrice(text),
    pack_size: extractPackSize(text),
    short_description: cleanText(entry.description),
    notable_features: [...ingredients],
    new_or_updated: "new",
    sources: [
      {
        name: cleanText(entry.sourceName) || "Unknown source",
        url,
        published_or_checked_date: published || new Date().toISOString(),
        source_type: sourceType,
      },
    ],
    confidence: "low",
  };
  if (isDemo) item.is_demo = true;
  return item;
}

export function dedupeItems(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const it of items) {
    if (!it) continue;
    const src = (it.sources && it.sources[0] && it.sources[0].url) || "";
    const uk = normalizeUrl(src);
    const tk = String(it.product_name || "").trim().toLowerCase();
    if (uk && seenUrl.has(uk)) continue;
    if (tk && seenTitle.has(tk)) continue;
    if (uk) seenUrl.add(uk);
    if (tk) seenTitle.add(tk);
    out.push(it);
  }
  return out;
}

export function normalize(raw) {
  const isDemo = Boolean(raw.is_demo);
  const items = (raw.items || [])
    .map((e) => normalizeItem(e, isDemo))
    .filter(Boolean);
  const normalized = dedupeItems(items);
  return { is_demo: isDemo, items: normalized };
}