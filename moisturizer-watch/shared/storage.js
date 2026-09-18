/* storage.js - KV-backed store wrapper used by the Worker and Pages Functions. */

export class KvStore {
  constructor(env, kvBinding = "MOISTURIZER_KV") {
    this.kv = env && env[kvBinding];
    if (!this.kv) {
      throw new Error(
        `Missing KV binding "${kvBinding}". Bind the namespace in wrangler.toml ` +
        "and, for Pages, in the Pages project's Functions settings."
      );
    }
  }

  async get(key, fallback = null) {
    const v = await this.kv.get(key);
    if (v == null) return fallback;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  async put(key, obj) {
    await this.kv.put(key, JSON.stringify(obj));
  }
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export function notFound(msg = "Not found") {
  return jsonResponse({ ok: false, error: msg }, 404);
}