export const MARKET = "India";
export const CATEGORY = "Face Moisturizer";
export const RECIPIENT = "nivethagjblude@gmail.com";
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

// Key names used in Workers KV (and mirrored as files locally).
export const KV_LATEST = "latest";
export const KV_STATUS = "status";
export const KV_HISTORY = "history";              // history/index.json file
export function kvHistoryDate(date) { return `history/${date}`; }

export const DEMO_NOTE =
  "DEMO DATA ONLY. Fabricated examples used to test the pipeline offline. Do not treat as real product information.";