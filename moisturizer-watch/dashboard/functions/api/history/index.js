/* Pages Function: GET /api/history -> history index from KV */
import { KvStore, jsonResponse } from "../../../../shared/storage.js";
import { KV_HISTORY } from "../../../../shared/config.js";

export async function onRequestGet(context) {
  const store = new KvStore(context.env);
  const index = await store.get(KV_HISTORY, null);
  return jsonResponse(index || { history: [] });
}