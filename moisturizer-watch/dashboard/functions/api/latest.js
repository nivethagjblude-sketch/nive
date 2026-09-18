/* Pages Function: GET /api/latest -> latest report from KV */
import { KvStore, jsonResponse, notFound } from "../../../shared/storage.js";
import { KV_LATEST } from "../../../shared/config.js";

export async function onRequestGet(context) {
  const store = new KvStore(context.env);
  const report = await store.get(KV_LATEST, null);
  if (!report) {
    return notFound("No report yet. Schedules run Sunday 06:30 IST; or trigger the Worker: POST /run");
  }
  return jsonResponse(report);
}