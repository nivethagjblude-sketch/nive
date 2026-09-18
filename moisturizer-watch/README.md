# Weekly Moisturizer Intelligence (India) — Cloudflare-native

A lightweight, dependency-free, **fully Cloudflare-hosted** system that checks every
**Sunday morning (IST)** for the latest face-moisturizer launches, reformulations, and
availability news for India, stores JSON reports, emails a short digest to
`nivethagjblude@gmail.com`, and shows the latest data on a Cloudflare Pages dashboard.

**No GitHub Actions, no GitHub required for any runtime or deployment.**
GitHub is used only as a source-code backup.

- **Cloudflare Pages** – static dashboard + Pages Functions API
- **Cloudflare Worker** – the weekly automation job + manual trigger
- **Cloudflare Cron Triggers** – Sunday 06:30 AM IST
- **Workers KV** – storage for latest/history/status JSON
- **Gmail SMTP** – weekly email (no paid email API)
- **OpenCode / wrangler** – local development and deployment

---

## Architecture

```
Sunday 06:30 IST (01:00 UTC)
        │   Cloudflare CRON TRIGGER  "0 1 * * 0"
        ▼
   Worker "moisturizer-watch" (scheduled handler)
       collect     Google News RSS (keyless) + moisturizer/India filters
       normalize   news → product schema
       validate    rules + de-duplication
       compare     new / updated / duplicate vs previous run
       digest      subject + HTML + plain-text email
       email       Gmail SMTP over Worker sockets (App Password secret)
       storage     write latest.json + history/<date>.json to KV
        │
        ▼  Workers KV "MOISTURIZER_KV"
            latest │ status │ history │ history/<YYYY-MM-DD>
        │
        ▼
   Cloudflare Pages  (same project)
       dashboard/            static HTML/CSS/JS
       dashboard/functions   /api/latest /api/history /api/status /api/history/:date
                             (read the same KV -> zero CORS, zero extra infra)
```

**Why Workers KV?** The weekly output is a handful of small JSON documents written once a
week and read by the dashboard. KV fits perfectly and uses the free tier. D1 (SQL) is
overkill; R2 (object storage) is billed and heavier.

**Storage keys**

| KV key | Content |
|--------|---------|
| `latest` | newest report `{generated_at, market, category, is_demo, summary, items}` |
| `status` | automation status (`last_email_status`, `verified_sources`, …) |
| `history` | index `{history: [{date, file, summary, is_demo}]}` |
| `history/YYYY-MM-DD` | each dated report |

---

## Project layout

```text
moisturizer-watch/
├── package.json              # no runtime deps; wrangler as devDependency
├── wrangler.toml             # Worker + Pages + KV binding + cron trigger
├── .gitignore
├── shared/                   # the pipeline (Node + Worker-compatible, stdlib only)
│   ├── config.js             # market, queries, KV keys
│   ├── classification.js     # moisturizer/India/price/pack rules
│   ├── collect.js            # Google News RSS fetch + filters (+ demo items)
│   ├── normalize.js          # raw entries → schema items
│   ├── validate.js           # schema + content rules + de-dup
│   ├── compare.js            # new/updated/duplicate classification
│   ├── digest.js             # digest (subject, HTML, text)
│   ├── pipeline.js           # one call orchestrates all of the above
│   ├── storage.js            # KV adapter + JSON responses
│   ├── mime.js               # pure MIME builder (Node-testable)
│   ├── smtp.js               # SMTP over cloudflare:sockets (Worker runtime only)
│   └── email.js              # build email + send via Gmail
├── worker/
│   ├── index.js              # scheduled + fetch handlers (/run, /api/*)
│   └── status.js             # email-outcome updater for status key
├── dashboard/
│   ├── index.html  styles.css  app.js
│   └── functions/api/        # Pages Functions (same-origin, KV-backed)
│       ├── latest.js  status.js
│       └── history/ index.js [date].js
├── scripts/
│   ├── run-local.js          # local mirror of the pipeline (writes ./data)
│   ├── localStore.js         # KV adapter backed by local files
│   └── smoke-test.mjs        # offline test (16 checks) — `npm test`
└── demo/                     # demo seed JSON for an immediate first dashboard
```

Data-honesty rules are unchanged: no invented products, every item has ≥1 source URL,
missing values are `unknown`, confidence defaults to `low` for RSS-derived entries, and
categories are restricted to moisturizers.

---

## One-time setup (free Cloudflare account)

```bash
cd moisturizer-watch
npm install
npx wrangler login                      # browser login to Cloudflare
```

1. **Create the KV namespace** (store the returned id):
   ```bash
   npx wrangler kv namespace create MOISTURIZER_KV
   ```
   Paste the `id` (and set `preview_id` to the same value) into `wrangler.toml`.

2. **Add the Gmail secrets** (never committed, never printed):
   ```bash
   npx wrangler secret put GMAIL_SENDER        # nivethagjblude@gmail.com
   npx wrangler secret put GMAIL_RECIPIENT     # nivethagjblude@gmail.com
   npx wrangler secret put GMAIL_APP_PASSWORD  # 16-char App Password (see Gmail section)
   ```

3. **Deploy the Worker** (installs the cron trigger too):
   ```bash
   npm run deploy:worker
   ```

4. **Deploy the Pages site**:
   ```bash
   npm run deploy:pages
   ```
   The dashboard will be at `https://<worker-name>.pages.dev/dashboard/`.

5. **Seed demo data so the dashboard isn't empty** before the first Sunday:
   ```bash
   npx wrangler kv key put --binding=MOISTURIZER_KV "latest" --path=demo/latest.json
   npx wrangler kv key put --binding=MOISTURIZER_KV "status" --path=demo/status.json
   npx wrangler kv key put --binding=MOISTURIZER_KV "history" --path=demo/history.json
   npx wrangler kv key put --binding=MOISTURIZER_KV "history/2026-09-18" --path=demo/history/2026-09-18.json
   ```
   (Demo records are tagged `is_demo: true` and the dashboard shows a DEMO banner. The first
   Sunday run overwrites them.)

---

## Gmail setup (one time)

1. Google Account → **Security → 2-Step Verification** → on.
2. **Security → 2-Step Verification → App passwords** → app **Mail**, device **Other** →
   copy the 16-character App Password (shown once).
3. Store it only as the Cloudflare Worker secret `GMAIL_APP_PASSWORD` (step 2 above).

The Worker reads these secrets at runtime only. `SMTP smtp.gmail.com:465` (implicit TLS) is
used; the password is never logged and mail failures still record status so the report is saved.

---

## Weekly automation

- **Cloudflare Cron Trigger** runs `0 1 * * 0` = **Sunday 01:00 UTC = 06:30 AM IST**.
  Cron syntax on Cloudflare is always UTC; the IST conversion is documented here.
  Runs may be a few minutes late if the account is on a plan with queueing.
- **Manual trigger** (also good as a first live test):
  ```bash
  curl -X POST "https://<worker>.workers.dev/run"
  ```
  Runs the full pipeline now and sends the email (fails loudly on missing secrets).
- **API (same data the dashboard reads)**: `/api/latest`, `/api/status`, `/api/history`,
  `/api/history/YYYY-MM-DD` on the Worker directly, or on the Pages site via Functions.

---

## Local development (no Cloudflare account needed)

```bash
npm run demo          # offline demo run -> writes ./data (git-ignored)
npm run demo:email    # demo run + data/email_dryrun.html/.txt
npm test              # 16 offline checks (in-memory KV, worker endpoints, MIME)
```

`npm run dev:pages` starts a local Pages preview at `http://localhost:8788`.
Note: the local Pages preview keeps KV in a local simulacrum (no real namespace needed),
so the `/api/*` functions work before you deploy.

---

## Cloudflare details — exact components

| Component | What it is | Where configured |
|-----------|-----------|------------------|
| Workers KV namespace `MOISTURIZER_KV` | JSON storage | `wrangler.toml` → `kv_namespaces` |
| Worker `moisturizer-watch` | scheduled automation + `/run` + `/api/*` | `worker/index.js` + `main` |
| Cron Trigger `0 1 * * 0` | weekly kick | `wrangler.toml` → `[triggers] crons` |
| Worker secrets | Gmail creds at runtime | `npx wrangler secret put …` |
| Pages project `moisturizer-watch` | static dashboard | `wrangler.toml` → `pages_build_output_dir` |
| Pages Functions `functions/api/*` | same-origin KV reads | `dashboard/functions/` |
| Gmail SMTP 465 | email delivery | `shared/smtp.js` (cloudflare:sockets) |

---

## Push the code to your GitHub repo (backup only)

The runtime uses **no GitHub**. To store the source (commands shown as run on a machine
with git; this folder was exported with everything needed):

```bash
git init                      # if starting a fresh repo
git remote add origin https://github.com/nivethagjblude-sketch/nive.git
git add .
git commit -m "Add Cloudflare-native weekly moisturizer watch"
git push -u origin main
```

Caution — same-contract rules as the GitHub variant:
- Never commit `node_modules/`, `data/`, `.wrangler/`, `.env*`, or the App Password.
- The `wrangler.toml` ships with a placeholder KV id; put the real id **only** after deciding
  whether you want it in the repo (safer to edit after clone).

---

## GitHub Pages mirror (optional, no GitHub Actions)

The live dashboard is **Cloudflare Pages** (`npm run deploy:pages`). If you also want a
GitHub Pages copy at `https://nivethagjblude-sketch.github.io/nive/`:

1. A static mirror of the dashboard lives at repo root **`docs/`** (GitHub's built-in
   Pages source folder — no GitHub Actions needed).
2. Repo → **Settings → Pages** → **Build and deployment** → Source **"Deploy from a
   branch"** → branch `main`, folder `/docs` → **Save**.
3. GitHub Pages cannot run Cloudflare Pages Functions, so the mirror must read data from
   your Worker's `/api` (CORS is already enabled on the Worker). Either:
   - edit `docs/index.html` and set
     `window.MOISTURIZER_WORKER = "https://moisturizer-watch.<account>.workers.dev";`, or
   - append `?worker=https://moisturizer-watch.<account>.workers.dev` to the URL.
4. Re-copy `dashboard/*.{html,css,js}` into `docs/` whenever you change the dashboard.

---

## Making changes (OpenCode workflow)

1. Edit `shared/*` → `npm run demo:email` to see the digest locally.
2. Add/adjust `SEARCH_QUERIES` in `shared/config.js`.
3. Re-run `npm test`, then `npm run deploy:worker && npm run deploy:pages`.