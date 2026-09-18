# Weekly Moisturizer Intelligence (India) — GitHub-native

A lightweight, dependency-free system that checks every **Sunday morning (IST)** for
the latest face-moisturizer launches, reformulations, and availability news for India,
stores JSON reports in the repository, and publishes them on a **GitHub Pages** dashboard.

- **GitHub Actions** – the weekly research pipeline (`schedule: "0 1 * * 0"` = Sunday 01:00
  UTC = **06:30 AM IST**) + manual `workflow_dispatch` trigger
- **GitHub Pages** – static dashboard served from `moisturizer-watch/docs/`
- **Static JSON in the repo** – `moisturizer-watch/data/latest.json`, `data/status.json`,
  `data/history/` (no Cloudflare Workers, no KV, no Pages Functions, no APIs, no email)

---

## Architecture

```
Sunday 06:30 IST (GitHub Actions cron "0 1 * * 0")
        │
        ▼  checkout → npm ci → node scripts/run-local.js
   pipeline (shared/*, Node 20, stdlib only)
       collect     Google News RSS (keyless) + moisturizer/India filters
       normalize   news → product schema
       validate    rules + de-duplication + data-honesty checks
       compare     new / updated / duplicate vs previous run
       digest      plain-text + HTML report digest
       storage     write data/latest.json + data/history/<date>.json
        │
        ▼
   moisturizer-watch/data/            committed back to the repo
      latest.json  status.json  history/index.json  history/<YYYY-MM-DD>.json
        │  npm run sync:pages (mirror data → docs/data)
        ▼
   moisturizer-watch/docs/data/       served as static JSON by GitHub Pages
        │
        ▼  actions/upload-pages-artifact + actions/deploy-pages
   https://nivethagjblude-sketch.github.io/nive/   (dashboard, relative paths)
```

**Why static JSON + git?** The weekly output is a handful of small JSON documents.
Committing them gives free versioning/history, makes GitHub Actions the only moving
part, and lets GitHub Pages (which cannot run server functions) serve the dashboard
directly.

**Relative data paths.** The dashboard (in `moisturizer-watch/docs/`) loads
`data/latest.json`, `data/status.json` and `data/history/...` with *relative* paths, so
the same page works locally at `http://localhost:8080/docs/` and on GitHub Pages at
`https://nivethagjblude-sketch.github.io/nive/`.

---

## Project layout

```text
nive/                              (this repo)
├── .github/workflows/
│   └── moisturizer-weekly.yml     weekly pipeline + Pages deploy
└── moisturizer-watch/
    ├── package.json               no runtime deps (stdlib only)
    ├── docs/                      GitHub Pages dashboard (index, styles, app.js)
    │   └── data/                  mirrored JSON served to the dashboard
    ├── data/                      canonical pipeline output (committed)
    │   ├── latest.json            newest report
    │   ├── status.json            automation status
    │   └── history/
    │       ├── index.json         history index
    │       └── YYYY-MM-DD.json    each dated report
    ├── shared/                    the pipeline (Node, stdlib only)
    │   ├── config.js              market, queries, store keys
    │   ├── classification.js      moisturizer/India/price/pack rules
    │   ├── collect.js             Google News RSS fetch + filters (+ demo items)
    │   ├── normalize.js           raw entries → schema items
    │   ├── validate.js            schema + content rules + de-dup
    │   ├── compare.js             new/updated/duplicate classification
    │   ├── digest.js              report digest (plain text + HTML)
    │   └── pipeline.js            one call orchestrates all of the above
    └── scripts/
        ├── run-local.js           full pipeline → writes ./data
        ├── localStore.js          store interface backed by local files
        ├── sync-pages.js          mirror ./data → ./docs/data
        ├── dev-server.js          local preview server (`npm run serve`)
        └── smoke-test.mjs         offline test (~16 checks) — `npm test`
```

Data-honesty rules are unchanged: no invented products, every item has ≥1 source URL,
missing values are `unknown`, confidence defaults to `low` for RSS-derived entries, and
categories are restricted to moisturizers.

---

## GitHub Pages setup (one time)

The dashboard is served from the workflow via `actions/deploy-pages`, so Pages must
be set to deploy **from GitHub Actions**:

1. Repo → **Settings → Pages** → **Build and deployment** → Source **"GitHub Actions"**.
2. That's it — the workflow publishes `moisturizer-watch/docs/` on every run/push.
3. Dashboard URL: `https://nivethagjblude-sketch.github.io/nive/`.

---

## Weekly automation

- **Schedule** (`".github/workflows/moisturizer-weekly.yml"`): `cron: "0 1 * * 0"`
  = **Sunday 06:30 AM IST**. Runs the full pipeline, commits the regenerated
  `data/` + `docs/data/`, and deploys the Pages site — all automatically.
- **Manual trigger**: **Actions → Moisturizer Weekly → Run workflow** (tick *demo* for
  an offline sample run).
- Any push touching `moisturizer-watch/docs/**`, `shared/**` or the workflow also
  re-deploys Pages.

---

## Local development (no GitHub needed)

```bash
cd moisturizer-watch
npm install

npm run collect      # live collection (needs network) -> writes ./data
npm run demo         # offline demo collection (same pipeline)

npm run sync:pages   # mirror ./data -> ./docs/data for the dashboard
npm run serve        # preview at http://localhost:8080/docs/

npm test             # offline checks (pipeline, files, schema, dashboard paths)
```

Preview flow: `npm run demo && npm run sync:pages && npm run serve`, then open
`http://localhost:8080/docs/`. Relative data paths behave exactly like the deployed
site.

---

## README history — notable changes

- **2026-09-18 (v2)**: moved to a GitHub-native architecture — GitHub Actions for the
  weekly pipeline, GitHub Pages for the dashboard, static committed JSON instead of
  Cloudflare Workers/KV/Pages Functions. Removed Gmail/email and all Cloudflare
  deployment assets. Dashboard still reads `data/latest.json` / `data/history/` via
  relative paths; all existing research, validation, dedup and history logic reused
  unchanged.