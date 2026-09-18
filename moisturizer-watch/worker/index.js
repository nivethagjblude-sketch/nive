/* worker/index.js - the scheduled automation Worker.

Handles:
  - scheduled          weekly cron (Sunday 01:00 UTC = 06:30 IST)
  - POST /run          manual pipeline run (and email)
  - GET /api/latest    latest report from KV
  - GET /api/history   history index from KV
  - GET /api/status    automation status from KV
  - GET /api/history/:date  a specific dated report
  - GET /              info
*/

import { KvStore, jsonResponse, notFound } from "../shared/storage.js";
import { runPipeline } from "../shared/pipeline.js";
import { buildEmail, sendGmail } from "../shared/email.js";
import { KV_HISTORY, KV_LATEST, KV_STATUS } from "../shared/config.js";
import { RECIPIENT } from "../shared/config.js";
import { updatedStatusAfterEmail } from "./status.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function doRun(env, ctx, runType) {
  const store = new KvStore(env);
  const { report, digest, status, date } = await runPipeline({
    store,
    demo: false,
    runType,
  });

  let email = {
    last_email_status: "skipped (no email env)",
    last_email_at: new Date().toISOString(),
  };

  const sender = env.GMAIL_SENDER;
  const recipient = env.GMAIL_RECIPIENT || RECIPIENT;
  const appPassword = env.GMAIL_APP_PASSWORD;

  if (sender && recipient && appPassword) {
    const mail = buildEmail(report);
    try {
      await sendGmail({ sender, recipient, appPassword, ...mail });
      email = {
        last_email_status: "sent",
        last_email_at: new Date().toISOString(),
      };
    } catch (err) {
      email = {
        last_email_status: `failed: ${String(err && err.message || err).slice(0, 120)}`,
        last_email_at: new Date().toISOString(),
      };
    }
  } else if (runType === "manual" && !(sender && recipient && appPassword)) {
    email = {
      last_email_status: "failed: missing GMAIL_* secrets",
      last_email_at: new Date().toISOString(),
    };
  }

  const finalStatus = await updatedStatusAfterEmail(store, email);
  const log = {
    ok: "pipeline_ok",
    run_type: runType,
    run_date: date,
    date_is_ist: true,
    email: email.last_email_status,
    summary: report.summary,
  };
  return { report, digest, status: finalStatus, log };
}

async function handleApi(env, url, path) {
  const store = new KvStore(env);
  const res = await store.get(KV_LATEST, null);
  const st = await store.get(KV_STATUS, null);
  const hist = await store.get(KV_HISTORY, null);

  switch (path) {
    case "/api/latest":
      return res ? jsonResponse(res) : notFound("latest report not available yet (run the pipeline once, e.g. POST /run)");
    case "/api/status":
      return st ? jsonResponse(st) : jsonResponse({
        ok: true, message: "no run yet (POST /run to generate the first report)",
      });
    case "/api/history":
      return hist ? jsonResponse(hist) : jsonResponse({ history: [] });
    default: {
      const m = /^\/api\/history\/(\d{4}-\d{2}-\d{2})$/.exec(path);
      if (m && DATE_RE.test(m[1])) {
        const d = await store.get(`history/${m[1]}`, null);
        return d ? jsonResponse(d) : notFound("no report for that date");
      }
      return notFound("unknown endpoint");
    }
  }
}

export default {
  async scheduled(event, env, ctx) {
    const result = await doRun(env, ctx, event.cron ? "auto (cron)" : "auto");
    ctx.waitUntil(Promise.resolve());
    // note: scheduled handler has no response; side effects via ctx.waitUntil
    return result;
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    const cors = (res) => {
      const r = new Response(res.body, res);
      r.headers.set("access-control-allow-origin", "*");
      return r;
    };

    if (request.method === "POST" && pathname === "/run") {
      const trigger = searchParams.get("withEmail") === "0" ? false : true;
      try {
        const result = await doRun(env, ctx, "manual");
        const payload = { ok: true, ...result.log };
        if (!trigger) {
          // If secrets missing we already recorded failure above; here allow email skip.
        }
        return jsonResponse(payload);
      } catch (err) {
        return jsonResponse({ ok: false, error: String(err && err.message || err) }, 500);
      }
    }

    if (request.method === "GET") {
      if (pathname === "/") {
        return jsonResponse({
          ok: true,
          service: "moisturizer-watch",
          endpoints: ["/api/latest", "/api/history", "/api/status", "/api/history/:date", "POST /run"],
          schedule_utc: "0 1 * * 0",
          schedule_ist: "Sunday 06:30 AM",
        });
      }
      if (pathname.startsWith("/api/")) {
        return cors(await handleApi(env, url, pathname));
      }
    }

    return notFound("use /api/* or POST /run");
  },
};