/* collect.js - Google News RSS search (keyless) for moisturizer news, India. */
import { SEARCH_QUERIES, MAX_ITEMS_PER_QUERY } from "./config.js";
import {
  hasMoisturizerTerm, isNonMoisturizer, hintsIndia, hintsLaunch,
} from "./classification.js";
import { decodeEntities, cleanText, stripUtm } from "./utils.js";

const RSS_URL = "https://news.google.com/rss/search";
const USER_AGENT = "Mozilla/5.0 (moisturizer-watch/1.0)";

export const DEMO_ITEMS = [
  {
    title: "Apollo Naturals Launches New Ceramide Repair Moisturizer in India",
    url: "https://example.in/demo/apollo-ceramide-moisturizer",
    sourceName: "Demo Beauty News",
    published: "Thu, 17 Sep 2026 06:00:00 GMT",
    description:
      "Launch of a ceramide barrier moisturizer for dry and sensitive skin now available in India. 50 ml, INR 649.",
  },
  {
    title: "HydraGlow Introduces Gel Moisturizer Variant for Oily Skin in Mumbai",
    url: "https://example.in/demo/hydraglow-gel",
    sourceName: "Demo Beauty News",
    published: "Wed, 16 Sep 2026 08:30:00 GMT",
    description:
      "New lightweight gel moisturizer with niacinamide for oily skin arriving on Nykaa, Flipkart and Amazon India.",
  },
  {
    title: "Revamped Formula: SoftSkin Reformulates Daily Hydrating Cream, New India Price",
    url: "https://example.in/demo/softskin-reformulation",
    sourceName: "Demo Skincare Weekly",
    published: "Tue, 15 Sep 2026 10:00:00 GMT",
    description:
      "Updated daily hydrating cream now with hyaluronic acid and squalane. INR 899 for 100 ml in India.",
  },
];

function buildUrl(query) {
  const params = new URLSearchParams({ q: query, hl: "en-IN", gl: "IN", ceid: "IN:en" });
  return `${RSS_URL}?${params}`;
}

// Minimal RSS item parser (Workers have no DOMParser). Good enough for RSS 2.0.
function parseItems(xml) {
  const items = [];
  const reItem = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = reItem.exec(xml)) !== null) {
    const body = m[1];
    const grab = (tag) => {
      const r = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(body);
      return r ? decodeEntities(r[1]) : "";
    };
    const title = cleanText(grab("title"));
    const link = cleanText(grab("link"));
    const published = cleanText(grab("pubDate"));
    const description = cleanText(grab("description").replace(/<[^>]+>/g, " "));
    const sourceName = cleanText(grab("source"));
    if (!title || !link) continue;
    items.push({ title, url: stripUtm(link), sourceName, published, description });
  }
  return items;
}

function keep(entry) {
  const text = `${entry.title} ${entry.description}`;
  if (!hasMoisturizerTerm(text)) return false;
  if (isNonMoisturizer(text)) return false;
  if (hintsIndia(text)) return true;
  return hintsLaunch(text);
}

export async function collect({ queries = SEARCH_QUERIES, maxPerQuery = MAX_ITEMS_PER_QUERY, fetchImpl = fetch } = {}) {
  const out = [];
  const seen = new Set();
  const failed = [];

  for (const q of queries) {
    try {
      const res = await fetchImpl(buildUrl(q), {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const all = parseItems(xml);
      const picks = all.filter(keep).slice(0, maxPerQuery);
      for (const e of picks) {
        const key = normalizeUrlKey(e.url);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(e);
        }
      }
    } catch (err) {
      failed.push({ query: q, error: String(err.message || err).slice(0, 200) });
    }
  }
  return { items: out, failed };
}

import { normalizeUrl } from "./utils.js";
const normalizeUrlKey = (u) => normalizeUrl(u);

export async function collectDemo() {
  return { items: DEMO_ITEMS.map((e) => ({ ...e })), failed: [] };
}