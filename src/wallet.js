/* ============================================================================
   Tally — WALLET
   ----------------------------------------------------------------------------
   This is the ONE marked place where the player earns anything. Tally keeps its
   own internal currencies (coins + gems) in React `meta`; this module is the
   single choke point that mutates them, and the single place that announces
   "sunbeam-worthy moments" to the outside world.

   Tally does NOT know about sunbeams and never awards them. When wired into the
   Lucid Winds portal, the portal listens for the postMessage events emitted by
   `noteMoment()` below and grants sunbeams on its own side, tuned to land a
   casual session at ~20-40 sunbeams. See EARN_MOMENTS for the full list and the
   handoff doc for cadence.

   Every earn moment is FIRST-TIME-ONLY: each unique `key` fires at most once,
   guarded by `meta.earns` so replaying a level or re-opening the app can't farm
   sunbeams. The game's own coins/gems are unaffected by that guard — you always
   earn coins for a solve; only the sunbeam signal is deduped.
   ========================================================================== */

// The catalogue of sunbeam-worthy moments Tally emits. `key(...)` builds the
// first-time-only key; the portal maps each `type` to a sunbeam value.
export const EARN_MOMENTS = {
  level_clear: { label: "Clear a level (first time)", key: (lvl) => `level_clear:${lvl}` },
  three_star: { label: "3-star a puzzle (first time)", key: (pid) => `three_star:${pid}` },
  world_clear: { label: "Finish a world (first time)", key: (wid) => `world_clear:${wid}` },
  daily_done: { label: "Complete the Daily Challenge (once per day)", key: (day) => `daily_done:${day}` },
  streak_milestone: { label: "Reach a streak milestone (3/7/14/30/100)", key: (n) => `streak:${n}` },
  pal_unlock: { label: "Unlock a new Pal (first time each)", key: (id) => `pal_unlock:${id}` },
  skin_unlock: { label: "Unlock a new Skin (first time each)", key: (id) => `skin_unlock:${id}` },
  first_solve: { label: "Find your very first solution (once ever)", key: () => "first_solve" },
};

export const STREAK_MILESTONES = [3, 7, 14, 30, 100];

// Tell the parent frame a sunbeam-worthy moment happened. No-op when not embedded.
function announce(type, detail) {
  try {
    if (window.SWS_EMBED && parent !== window) {
      parent.postMessage({ sws: "earn", moment: type, detail }, "*");
    }
  } catch (e) { /* sandboxed / cross-origin — safe to ignore */ }
}

// Build a wallet bound to the component's setMeta. All coin/gem changes and all
// sunbeam moments go through this object.
export function createWallet(setMeta) {
  return {
    // ---- internal currency (always applies) ----
    addCoins(amount, boostActive) {
      const amt = boostActive ? amount * 2 : amount;
      setMeta((m) => ({ ...m, coins: m.coins + amt }));
      return amt;
    },
    addGems(amount) {
      setMeta((m) => ({ ...m, gems: m.gems + amount }));
      return amount;
    },
    spendCoins(amount) { setMeta((m) => ({ ...m, coins: m.coins - amount })); },
    spendGems(amount) { setMeta((m) => ({ ...m, gems: m.gems - amount })); },

    // ---- sunbeam moments (first-time-only) ----
    // `currentEarns` is meta.earns at call time; returns true if this was new.
    noteMoment(type, key, currentEarns, detail = {}) {
      if (!EARN_MOMENTS[type]) return false;
      if (currentEarns && currentEarns[key]) return false; // already fired once
      setMeta((m) => ({ ...m, earns: { ...m.earns, [key]: 1 } }));
      announce(type, { key, ...detail });
      return true;
    },
  };
}
