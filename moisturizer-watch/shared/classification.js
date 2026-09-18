/* Text classification rules (moisturizer-only scope, India-focused). */

const CREAM_MOISTURIZER_RE =
  /(moistur\w+|(?:daily|hydrating|face|barrier|gel|lightweight|repair|repairing|nourishing|intensive)[-\s]?cream)/i;
const EXCLUDE_CREAM_RE =
  /(eye cream|hand cream|body cream|bb cream|cold cream|foot cream|under-eye|night cream)/i;

const NON_MOISTURIZER_RE =
  /(sunscreen|sunscream|\bspf\b|serum|cleanser|face wash|toner|\btonic\b|exfoliat|\bmask\b|sheet mask|makeup|foundation|primer|lip balm|body lotion|body moistur|hair|shampoo|conditioner|perfume|deodorant|\bsoap\b|body wash|shower gel|face oil|night cream)/i;

const INDIA_RE =
  /\b(india|inr|rupee|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|nykaa|flipkart|amazon\.in|myntra|purplle|jio mart|tatacliq)\b|\bmrp\b|\u20b9/i;

const LAUNCH_RE =
  /\b(launch|launched|launches|newest|new|introduces|introducing|just dropped|reformulat|relaunch|restock|variant|expansion|now available|arrives|hit stores)\b/i;

const PRICE_RE = /(?:\u20b9|\bINR\b|\bRs\.?)\s?([0-9][0-9,]*(?:\.\d{1,2})?)/i;
const PACK_RE = /(\d+(?:\.\d+)?)\s?(ml|g|gm|gr)\b/i;

export function hasMoisturizerTerm(text) {
  const t = String(text || "").toLowerCase();
  if (EXCLUDE_CREAM_RE.test(t)) return false;
  return CREAM_MOISTURIZER_RE.test(t);
}

export function isNonMoisturizer(text) {
  return NON_MOISTURIZER_RE.test(String(text || ""));
}

export function hintsIndia(text) {
  return INDIA_RE.test(String(text || ""));
}

export function hintsLaunch(text) {
  return LAUNCH_RE.test(String(text || ""));
}

export function detectProductType(text) {
  const t = String(text || "").toLowerCase();
  const map = [
    ["fragrance free", "fragrance_free_moisturizer"],
    ["fragrance-free", "fragrance_free_moisturizer"],
    ["oil control", "oil_control_moisturizer"],
    ["oil-control", "oil_control_moisturizer"],
    ["sensitive", "sensitive_skin_moisturizer"],
    ["ceramide", "ceramide_moisturizer"],
    ["hyaluronic", "hyaluronic_acid_moisturizer"],
    ["niacinamide", "niacinamide_moisturizer"],
    ["barrier", "barrier_moisturizer"],
    ["gel", "gel_moisturizer"],
    ["cream", "cream_moisturizer"],
    ["lightweight", "lightweight_moisturizer"],
    ["light weight", "lightweight_moisturizer"],
  ];
  for (const [needle, kind] of map) if (t.includes(needle)) return kind;
  return "face_moisturizer";
}

const INGREDIENT_MAP = [
  ["hyaluronic acid", "hyaluronic_acid"],
  ["glutamic", "hyaluronic_acid"],
  ["ceramide", "ceramides"],
  ["niacinamide", "niacinamide"],
  ["glycerin", "glycerin"],
  ["squalane", "squalane"],
  ["panthenol", "panthenol"],
  ["shea", "shea_butter"],
  ["oat", "oat"],
  ["peptide", "peptides"],
  ["centella", "cica"],
  ["cica", "cica"],
  ["vitamin e", "vitamin_e"],
  ["green tea", "green_tea"],
];

export function detectIngredients(text) {
  const t = String(text || "").toLowerCase();
  const found = [];
  for (const [needle, name] of INGREDIENT_MAP) {
    if (t.includes(needle) && !found.includes(name)) found.push(name);
  }
  return found;
}

const SKIN_TYPES = ["oily", "dry", "sensitive", "combination", "normal", "all"];
export function detectSkinTypes(text) {
  const t = String(text || "").toLowerCase();
  return SKIN_TYPES.filter((s) => t.includes(s));
}

export function extractPrice(text) {
  const m = PRICE_RE.exec(String(text || ""));
  if (!m) return null;
  const val = Math.round(parseFloat(m[1].replace(/,/g, "")));
  if (!Number.isFinite(val) || val < 50 || val > 50000) return null;
  return val;
}

export function extractPackSize(text) {
  const m = PACK_RE.exec(String(text || ""));
  return m ? `${m[1]} ${m[2]}` : "";
}

const RETAILER_DOMAINS = [
  "amazon.in", "flipkart.com", "myntra.com", "purplle.com",
  "tatacliq.com", "jiomart.com", "snapdeal.com", "1mg.com", "netmeds.com",
  "nykaa.com",
];

export function classifySourceType(url, sourceName = "") {
  const u = String(url || "").toLowerCase();
  if (RETAILER_DOMAINS.some((d) => u.includes(d))) return "retailer";
  if (u.includes("news.google.com")) return "news_rss";
  if (/\.in\b/.test(u) || /(news|magazine|beauty|skincare)/.test(u)) return "publication";
  return String(sourceName || "").trim() ? "secondary" : "secondary";
}

export const ALLOWED_STATUS = new Set(["new", "updated"]);
export const ALLOWED_CONFIDENCE = new Set(["low", "medium", "high"]);
export const ALLOWED_AVAILABILITY = new Set([
  "available", "limited", "pre-order", "reported", "unknown",
]);
export const ALLOWED_SOURCE_TYPES = new Set([
  "official", "retailer", "publication", "secondary", "news_rss",
]);