/* digest.js - builds subject + HTML + plain-text digest from a report. */

export const NO_UPDATE_MESSAGE =
  "No significant new moisturizer updates were verified this week.";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

export function subjectFor(report) {
  let date = "";
  try {
    date = new Date(report.generated_at).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { /* ignore */ }
  return `Weekly Moisturizer Intelligence \u2014 ${date}`;
}

function itemMd(it) {
  const L = [];
  L.push(`- **${it.product_name}** (${it.brand}) [${it.new_or_updated}]`);
  L.push(`  - Type: ${it.product_type}`);
  if (it.skin_type && it.skin_type.length) L.push(`  - Skin types: ${it.skin_type.join(", ")}`);
  if (it.key_ingredients && it.key_ingredients.length) L.push(`  - Key ingredients: ${it.key_ingredients.join(", ")}`);
  if (it.price_inr) L.push(`  - Price: INR ${it.price_inr}`);
  if (it.pack_size) L.push(`  - Pack size: ${it.pack_size}`);
  L.push(`  - India availability: ${it.india_availability}`);
  if (it.launch_or_update_date) L.push(`  - Reported: ${it.launch_or_update_date}`);
  if (it.short_description) L.push(`  - ${it.short_description}`);
  for (const s of it.sources || []) L.push(`  - Source: ${s.name} <${s.url}>`);
  return L.join("\n");
}

export function buildMd(report) {
  const s = report.summary || {};
  const out = [];
  out.push("# Weekly Moisturizer Intelligence");
  if (report.is_demo) out.push("", "> DEMO REPORT - sample data for testing, not real product information.");
  out.push("", `Generated: ${report.generated_at}  (market: ${report.market})`);
  const items = report.items || [];
  if (!items.length) {
    out.push("", NO_UPDATE_MESSAGE);
    return out.join("\n");
  }
  out.push("", "## Weekly Summary", "");
  out.push(`- Products reviewed: ${s.products_reviewed}`);
  out.push(`- New products: ${s.new_products}`);
  out.push(`- Updated products: ${s.updated_products}`);
  out.push(`- Verified sources: ${s.verified_sources}`);
  const newItems = items.filter((i) => i.new_or_updated === "new");
  const updItems = items.filter((i) => i.new_or_updated === "updated");
  if (newItems.length) {
    out.push("", "## New Products", "");
    newItems.forEach((it) => { out.push(itemMd(it), ""); });
  }
  if (updItems.length) {
    out.push("## Important Updates", "");
    updItems.forEach((it) => { out.push(itemMd(it), ""); });
  }
  out.push("## Sources", "");
  const seen = {};
  for (const it of items) for (const s of it.sources || []) {
    if (s.url && !seen[s.url]) {
      seen[s.url] = s;
      out.push(`- ${s.name}: ${s.url}`);
    }
  }
  return out.join("\n");
}

function row(label, value) {
  return `<div class="row"><span class="label">${esc(label)}</span><span class="value">${value}</span></div>`;
}

function itemHtml(it) {
  const rows = [];
  rows.push(row("Brand", esc(it.brand)));
  rows.push(row("Type", esc(it.product_type)));
  if (it.skin_type && it.skin_type.length) rows.push(row("Skin types", esc(it.skin_type.join(", "))));
  if (it.key_ingredients && it.key_ingredients.length) rows.push(row("Key ingredients", esc(it.key_ingredients.join(", "))));
  if (it.price_inr) rows.push(row("Price", esc(String(it.price_inr))));
  if (it.pack_size) rows.push(row("Pack size", esc(it.pack_size)));
  rows.push(row("India availability", esc(it.india_availability)));
  if (it.launch_or_update_date) rows.push(row("Reported", esc(it.launch_or_update_date)));
  if (it.short_description) rows.push(`<p class="desc">${esc(it.short_description)}</p>`);
  const links = (it.sources || [])
    .filter((s) => s.url)
    .map((s) => `<a href="${esc(s.url)}">${esc(s.name || s.url)}</a>`);
  if (links.length) rows.push(row("Source", links.join(" \u00b7 ")));
  const pill = it.new_or_updated === "new"
    ? '<span class="pill new">NEW</span>'
    : '<span class="pill upd">UPDATED</span>';
  return `<div class="item"><h3>${esc(it.product_name)} ${pill}</h3>\n${rows.join("\n")}</div>`;
}

export function buildHtml(report) {
  const s = report.summary || {};
  const items = report.items || [];
  const demo = report.is_demo
    ? '<div class="demo">DEMO REPORT - sample data for testing, not real product information.</div>'
    : "";
  const out = [];
  out.push(demo);
  out.push(`<p class="meta">Generated: ${esc(report.generated_at)} \u00b7 market: ${esc(report.market)}</p>`);
  if (!items.length) {
    out.push(`<p>${NO_UPDATE_MESSAGE}</p>`);
    out.push(`<p class="footer-note">Next check: next Sunday morning IST. This digest only sends verified findings.</p>`);
    return out.join("\n");
  }
  out.push(`<h2>Weekly Summary</h2>
<div class="cards">
<div class="card"><b>${s.products_reviewed}</b>Reviewed</div>
<div class="card"><b>${s.new_products}</b>New</div>
<div class="card"><b>${s.updated_products}</b>Updated</div>
<div class="card"><b>${s.verified_sources}</b>Sources</div>
</div>`);
  const newItems = items.filter((i) => i.new_or_updated === "new");
  const updItems = items.filter((i) => i.new_or_updated === "updated");
  if (newItems.length) out.push("<h2>New Products</h2>", ...newItems.map(itemHtml));
  if (updItems.length) out.push("<h2>Important Updates</h2>", ...updItems.map(itemHtml));
  const seen = {};
  for (const it of items) for (const src of it.sources || []) {
    if (src.url && !seen[src.url]) seen[src.url] = src;
  }
  const links = Object.values(seen)
    .map((s) => `<a href="${esc(s.url)}">${esc(s.name || s.url)}</a>`);
  if (links.length) out.push("<h2>Sources</h2>", `<p class="sources">${links.join(" \u00b7 ")}</p>`);
  return out.join("\n");
}

export function buildDigest(report) {
  return {
    subject: subjectFor(report),
    html: buildHtml(report),
    text: buildMd(report),
  };
}