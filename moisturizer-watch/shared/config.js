export const MARKET = "India";
export const CATEGORY = "Face Moisturizer";
export const MAX_ITEMS_PER_QUERY = 6;

export const SEARCH_QUERIES = [
  "new facial moisturizer launch India",
  "face moisturizer launched India",
  "gel moisturizer new India",
  "cream moisturizer launch India",
  "ceramide moisturizer launch India",
  "hyaluronic acid moisturizer new India",
  "niacinamide moisturizer India new",
  "fragrance free moisturizer India",
  "moisturizer reformulation",
  "moisturizer new variant India",
  "barrier cream moisturizer India",
  "sensitive skin moisturizer India",
];

// Store keys. The file-backed store (scripts/localStore.js) maps:
//   latest               -> data/latest.json
//   status               -> data/status.json
//   history              -> data/history/index.json
//   history/<YYYY-MM-DD> -> data/history/<YYYY-MM-DD>.json
export const KEY_LATEST = "latest";
export const KEY_STATUS = "status";
export const KEY_HISTORY = "history"; // history/index.json file
export function historyDateKey(date) { return `history/${date}`; }

export const DEMO_NOTE =
  "DEMO DATA ONLY. Fabricated examples used to test the pipeline offline. Do not treat as real product information.";