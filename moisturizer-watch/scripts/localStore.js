/* scripts/localStore.js - mirrored KV store backed by local files (Node only). */

import fs from "node:fs/promises";
import path from "node:path";

const FILE_MAP = {
  latest: "latest.json",
  status: "status.json",
  history: "history/index.json",
};

export class LocalStore {
  constructor(dir) {
    this.dir = dir;
  }

  fileFor(key) {
    if (key in FILE_MAP) return FILE_MAP[key];
    const safe = key.replace(/[^a-zA-Z0-9/-]/g, "_");
    return `${safe}.json`;
  }

  async get(key, fallback = null) {
    const p = path.join(this.dir, this.fileFor(key));
    try {
      return JSON.parse(await fs.readFile(p, "utf-8"));
    } catch {
      return fallback;
    }
  }

  async put(key, obj) {
    const p = path.join(this.dir, this.fileFor(key));
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf-8");
    return p;
  }
}