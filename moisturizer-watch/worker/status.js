/* worker/status.js - small helper to record email outcome in status.json. */

import { KV_STATUS } from "../shared/config.js";

export async function updatedStatusAfterEmail(store, email) {
  const status = (await store.get(KV_STATUS, null)) || {};
  status.last_email_status = email.last_email_status;
  status.last_email_at = email.last_email_at;
  status.generated_at = new Date().toISOString();
  await store.put(KV_STATUS, status);
  return status;
}