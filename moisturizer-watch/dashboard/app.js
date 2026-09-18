/* Weekly Moisturizer Intelligence - dependency-free dashboard. */
(function () {
  "use strict";

  var current = null; // currently rendered report object

  function showBanner(msg, kind) {
    var el = document.getElementById("banner");
    el.className = "banner " + kind;
    el.textContent = msg;
  }

  function hideBanner() {
    document.getElementById("banner").className = "banner hidden";
  }

  function get(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + path);
      return r.json();
    });
  }

  function fmtDate(v) {
    if (!v) return "unknown";
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  }

  function sourceLinks(item) {
    var srcs = item.sources || [];
    if (!srcs.length) return "<span>no source</span>";
    return '<div class="src-list">' +
      srcs.map(function (s) {
        return '<div class="sources">' +
          (s.name ? "<strong>" + esc(s.name) + "</strong> &mdash; " : "") +
          '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">source</a></div>';
      }).join("") + "</div>";
  }

  function itemHtml(item) {
    var typeLabel = (item.product_type || "face_moisturizer").replace(/_/g, " ");
    var pills = "";
    if (item.new_or_updated === "new") pills += '<span class="pill new">NEW</span>';
    else pills += '<span class="pill upd">UPDATED</span>';
    if (item.is_demo) pills += '<span class="pill demo">DEMO</span>';

    var meta = "";
    meta += '<span>Type: ' + esc(typeLabel) + "</span>";
    if (item.price_inr) meta += "<span>INR " + esc(String(item.price_inr)) + "</span>";
    if (item.pack_size) meta += "<span>" + esc(item.pack_size) + "</span>";
    meta += "<span>India: " + esc(item.india_availability || "unknown") + "</span>";
    if (item.launch_or_update_date) meta += "<span>Reported: " + esc(fmtDate(item.launch_or_update_date)) + "</span>";
    meta += '<span>Confidence: ' + esc(item.confidence || "low") + "</span>";

    var tags = (item.skin_type || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; })
      .concat((item.key_ingredients || []).map(function (t) { return '<span class="tag">' + esc(t + "") + "</span>"; })).join("");

    return '<article class="product"><h3>' + esc(item.product_name) + pills + "</h3>" +
      '<div class="brand-row">' + esc(item.brand || "unknown") + "</div>" +
      '<div class="meta">' + meta + "</div>" +
      (tags ? '<div class="tags">' + tags + "</div>" : "") +
      (item.short_description ? '<p class="desc">' + esc(item.short_description) + "</p>" : "") +
      sourceLinks(item) + "</article>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderSummary(report) {
    var s = report.summary || {};
    setText("s-latest", report.generated_at ? fmtDate(report.generated_at) : "-");
    setText("s-reviewed", s.products_reviewed != null ? s.products_reviewed : 0);
    setText("s-new", s.new_products != null ? s.new_products : 0);
    setText("s-updated", s.updated_products != null ? s.updated_products : 0);
    setText("s-sources", s.verified_sources != null ? s.verified_sources : 0);
  }

  function renderStatus(status) {
    var grid = document.getElementById("status-grid");
    var rows = [
      ["Last successful run", status.last_successful_run, "ok"],
      ["Last data update", status.last_data_update, "ok"],
      ["Last email", status.last_email_status, /sent/i.test(status.last_email_status || "") ? "ok" : "bad"],
      ["Verified sources", status.verified_sources != null ? status.verified_sources : "-", "ok"],
      ["Run date (IST)", status.run_date_ist, "ok"],
      ["Run type", status.run_type, "ok"]
    ];
    grid.innerHTML = rows.map(function (r) {
      return '<div class="status-item ' + r[2] + '"><span>' + esc(r[0]) + "</span>" +
        "<b>" + esc(r[1] || "-") + "</b></div>";
    }).join("");
  }

  function setText(id, v) {
    document.getElementById(id).textContent = v == null ? "-" : v;
  }

  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    values.sort();
    sel.length = 1;
    values.forEach(function (v) {
      if (v === "") return;
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  function updateFilters(items) {
    var brands = {}, skins = {}, types = {}, dates = {};
    items.forEach(function (it) {
      if (it.brand) brands[it.brand] = 1;
      (it.skin_type || []).forEach(function (x) { skins[x] = 1; });
      if (it.product_type) types[it.product_type] = 1;
      if (it.launch_or_update_date) {
        var d = String(it.launch_or_update_date).slice(0, 10);
        if (d) dates[d] = 1;
      }
    });
    fillSelect("f-brand", Object.keys(brands));
    fillSelect("f-skin", Object.keys(skins));
    fillSelect("f-type", Object.keys(types));
    fillSelect("f-date", Object.keys(dates));
  }

  function currentFilters() {
    function v(id) { return document.getElementById(id).value; }
    return { brand: v("f-brand"), skin: v("f-skin"), type: v("f-type"), status: v("f-status"), date: v("f-date") };
  }

  function renderProducts(items) {
    var f = currentFilters();
    var list = [];
    items.forEach(function (it) {
      if (f.brand && it.brand !== f.brand) return;
      if (f.status && it.new_or_updated !== f.status) return;
      if (f.type && it.product_type !== f.type) return;
      if (f.skin && (it.skin_type || []).indexOf(f.skin) === -1) return;
      if (f.date && String(it.launch_or_update_date || "").slice(0, 10) !== f.date) return;
      list.push(it);
    });
    document.getElementById("product-list").innerHTML = list.map(itemHtml).join("");
    document.getElementById("empty").classList.toggle("hidden", list.length > 0);
  }

  function loadReport(report) {
    current = report;
    if (report.is_demo) {
      showBanner("DEMO DATA - this report contains sample products for testing, not real information.", "demo");
    } else {
      hideBanner();
    }
    renderSummary(report);
    var items = report.items || [];
    updateFilters(items);
    renderProducts(items);
  }

  function loadHistorySelect(index) {
    var sel = document.getElementById("f-report");
    sel.length = 0;
    var latest = document.createElement("option");
    latest.value = "";
    latest.textContent = "Latest report";
    sel.appendChild(latest);
    (index && index.history || []).forEach(function (h) {
      var o = document.createElement("option");
      o.value = h.file;
      o.textContent = h.date + (h.is_demo ? " (demo)" : " report");
      sel.appendChild(o);
    });
  }

  function wireEvents(index) {
    ["f-brand", "f-skin", "f-type", "f-status", "f-date"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        if (current) renderProducts(current.items || []);
      });
    });
    document.getElementById("f-reset").addEventListener("click", function () {
      ["f-brand", "f-skin", "f-type", "f-status", "f-date"].forEach(function (id) {
        document.getElementById(id).value = "";
      });
      if (current) renderProducts(current.items || []);
    });
    document.getElementById("f-report").addEventListener("change", function () {
      var v = this.value;
      if (!v) { get("/api/latest").then(loadReport).catch(fail); return; }
      get("/api/" + v).then(loadReport).catch(function (e) {
        showBanner("Could not load report " + v + " (" + e.message + ").", "error");
      });
    });
  }

  function fail(e) {
    showBanner("Could not load dashboard data: " + e.message +
      ". The dashboard reads /api/* from Pages Functions (backed by Workers KV). " +
      "For local preview run: `npm run dev:pages` (wrangler pages dev).", "error");
  }

  get("/api/latest")
    .then(function (latest) {
      return get("/api/history").catch(function () {
        return { history: [] };
      }).then(function (index) {
        return { latest: latest, index: index };
      });
    })
    .then(function (bundle) {
      loadReport(bundle.latest);
      loadHistorySelect(bundle.index);
      wireEvents(bundle.index);
      if (bundle.latest && bundle.latest.is_demo) {
        showBanner("DEMO DATA - this report contains sample products for testing, not real information.", "demo");
      } else {
        hideBanner();
      }
      return get("/api/status").catch(function () { return null; });
    })
    .then(function (status) {
      if (status) renderStatus(status);
      else {
        var g = document.getElementById("status-grid");
        g.innerHTML = '<div class="status-item"><span>Status</span><b>unknown (no data yet)</b></div>';
      }
    })
    .catch(fail);
})();