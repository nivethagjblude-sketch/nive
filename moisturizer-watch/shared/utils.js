/* Shared text/URL/date helpers (Node + Workers compatible, no deps). */

export const IST_OFFSET_MIN = 5 * 60 + 30;

export function utcNow() {
  return new Date();
}

export function isoDate(d = new Date()) {
  return d.toISOString();
}

export function nowIST(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000);
}

export function istDateString(d = new Date()) {
  return nowIST(d).toISOString().slice(0, 10);
}

export function cleanText(s) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}

export function stripUtm(url) {
  return String(url || "").replace(/[?&]utm_[^=]+=[^&]*/g, "").replace(/[?&]$/, "");
}

export function normalizeUrl(url) {
  let u = stripUtm(url).trim();
  u = u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  u = u.split(/[?#]/)[0];
  return u.toLowerCase().replace(/\/+$/, "");
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return String(url || "").toLowerCase();
  }
}

const ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};
export function decodeEntities(s) {
  return String(s || "").replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+);/g, (m) => {
    if (m.startsWith("&#")) {
      return String.fromCharCode(parseInt(m.slice(2, -1), 10));
    }
    return ENTITIES[m] || m;
  });
}

export function hashText(s) {
  let h = 5381;
  const t = String(s);
  for (let i = 0; i < t.length; i++) {
    h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}