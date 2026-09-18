/* Pages Function: GET /api/status -> automation status from KV */
import { KvStore, jsonResponse } from "../../../shared/storage.js";
import { KV_STATUS } from "../../../shared/config.js";

export async function onRequestGet(context) {
  const store = new KvStore(context.env);
  const status = await store.get(KV_STATUS, null);
  return jsonResponse(status || {
    ok: true,
    message: "No run yet. The weekly schedule runs Sunday 06:30 IST.",
    last_email_status: "pending",
  });
}