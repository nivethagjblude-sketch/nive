/* Pages Function: GET /api/history/:date -> a specific dated report from KV */
import { KvStore, jsonResponse, notFound } from "../../../../shared/storage.js";

export async function onRequestGet(context) {
  const date = context.params && context.params.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return notFound("Expected /api/history/YYYY-MM-DD");
  }
  const store = new KvStore(context.env);
  const report = await store.get(`history/${date}`, null);
  return report ? jsonResponse(report) : notFound("No report for that date");
}