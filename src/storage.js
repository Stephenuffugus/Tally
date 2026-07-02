// Tally persistence — one JSON blob under a single key.
// Backend adapter: prefers window.storage (Claude.ai artifact runtime),
// falls back to localStorage (normal browsers). Both async-shaped.
import { ECONOMY } from "./config.js";

export const STORE_KEY = "tally:v1";

export const DEFAULT_META = {
  coins: ECONOMY.START_COINS,
  gems: ECONOMY.START_GEMS,
  streak: 0,
  best: 0,
  lastDaily: null,        // ISO day string of last completed daily
  level: 1,               // highest campaign level unlocked
  stars: {},              // puzzleId -> best star count
  owned: ["twilight", "sunrise"],   // owned skin ids
  skin: "twilight",       // equipped skin id
  ownedPals: ["pip", "hoot"],       // owned Pal (companion) ids
  pal: "pip",             // equipped Pal id
  freezes: 1,             // streak freezes held
  boostUntil: 0,          // epoch ms; double-coins active while now < boostUntil
  sound: true,
  motion: true,
  haptics: true,
  solved: 0,
  bonus: 0,
  seenIntro: false,
  finds: {},              // puzzleId -> [solution signatures] (pruned to active puzzles)
  earns: {},              // first-time-only sunbeam moment keys (see src/wallet.js)
};

async function backendGet() {
  if (typeof window === "undefined") return null;
  if (window.storage) {
    const r = await window.storage.get(STORE_KEY);
    return r?.value ?? null;
  }
  try { return window.localStorage.getItem(STORE_KEY); } catch { return null; }
}

async function backendSet(value) {
  if (typeof window === "undefined") return;
  if (window.storage) { await window.storage.set(STORE_KEY, value); return; }
  try { window.localStorage.setItem(STORE_KEY, value); } catch { /* quota/private mode */ }
}

export async function loadMeta() {
  try {
    const raw = await backendGet();
    if (raw) return { ...DEFAULT_META, ...JSON.parse(raw) }; // spread = forward-compatible migration
  } catch { /* first run or corrupt blob */ }
  return { ...DEFAULT_META };
}

export async function saveMeta(meta) {
  try { await backendSet(JSON.stringify(meta)); } catch { /* non-fatal */ }
}
