# Tally — Portal Handoff (for the Lucid Winds games director)

A cozy, kid-friendly number puzzle. Combine numbers to hit a target, find every way, journey through worlds, and collect cheerful **Pals** who root you on. Fully static, self-contained, offline-friendly, wired for the Sky Wolf embed contract.

---

## 1. Where it lives

| | |
|---|---|
| **Repo** | https://github.com/Stephenuffugus/Tally |
| **Deploy path** | GitHub Pages, served by **GitHub Actions** from the `main` branch (`.github/workflows/deploy.yml` builds `dist/` and publishes it). Pages **Source** must be set to **GitHub Actions**. |
| **Live URL** | **https://stephenuffugus.github.io/Tally/** |
| **Embed URL** | append `?embed=1` → `https://stephenuffugus.github.io/Tally/?embed=1` |
| **Re-host** | Every asset path is relative (Vite `base: "./"`), so the built `dist/` folder also runs unchanged at `https://lucidwinds.com/satellites/tally/`. |

> **One-time enable:** GitHub Pages must be turned on for the repo (Settings → Pages → Build and deployment → Source = **GitHub Actions**). The build itself is green in CI; once Pages is enabled, every push to `main` auto-deploys.

---

## 2. Portal card copy

**Hook:** *Combine the numbers, hit the target — with a pocketful of pals cheering you on.*

**Description:** Tally is a cozy number puzzle for all ages. Tap numbers and operators to build little equations; the instant one equals the target, it banks itself — no submit button, no timers, no fail states. Each puzzle has several hidden solutions, so the real game is finding *every* way. Journey through playful worlds of endless, procedurally-generated levels, keep a daily streak alive, and spend your coins on a whole cast of collectible **Pals** — a fox, an owl, a dragon, a unicorn and more — who bounce beside the board and cheer every solve. Everything you can buy is cosmetic: style, never advantage.

---

## 3. Embed contract (already wired)

The verbatim Sky Wolf snippet is in `index.html` (sets `window.SWS_EMBED`, `window.SWS_EXIT`, posts `ready`). On top of it:

- **Exit button:** Settings → **"All Sky Wolf games"** calls `window.SWS_EXIT()` (posts `{sws:'close'}` when embedded, else navigates to the portal). It's the only outbound navigation in the game.
- **No `history.back()` / no auto-navigation** anywhere.
- **No service worker** is registered (nothing to skip; safe when embedded).
- **No fullscreen requests** anywhere.
- **postMessage out:** `{sws:'ready'}` on load (from the snippet) and `{sws:'earn', moment, detail}` on each first-time earn moment (see §5).

---

## 4. Nav map — every screen and how it closes

Two layers of UI state: **screens** (persistent bottom nav) and **overlays** (modals on top). Switching any screen calls `go()`, which **always clears the current overlay first** — so no overlay can ever be left painted over a new screen (the black-screen bug can't occur). Overlays are a single `overlay` state value; closing sets it to `null`.

**Screens** (bottom nav — always visible, tap to switch):
| Screen | What it is | Leaves via |
|---|---|---|
| Play | the active puzzle board + companion Pal | bottom nav (clears overlays) |
| Map | Journey: worlds & replayable levels | bottom nav |
| Daily | date-seeded daily challenge board | bottom nav |
| Shop | Pals / Skins / Boosts tabs | bottom nav |
| Stats | progress summary | bottom nav |

**Overlays** (rendered on top of the current screen):
| Overlay | Opened by | Back / ✕ |
|---|---|---|
| How to play | top-bar `?`, or first run | ✕, scrim tap, "Let's play" → `overlay=null` |
| Settings | top-bar gear | ✕, scrim tap → `overlay=null` |
| Win summary | clearing a puzzle | "Next"/"Back to levels" → `overlay=null` + advance |
| Skin preview | tapping a skin card | ✕, scrim tap → `overlay=null` |
| Pal preview | tapping a Pal card | ✕, scrim tap → `overlay=null` |

Every ✕/back is an internal state switch (`setOverlay(null)` / `go(screen)`); none touch browser history.

---

## 5. Earn moments (the sunbeam hooks)

Tally keeps its **own** currencies (coins + gems) internally and **never touches sunbeams**. All earning is funneled through one marked object — **`src/wallet.js`** — which also announces "sunbeam-worthy" moments to the parent frame via `postMessage({sws:'earn', moment, detail})`. Every moment is **first-time-only**, guarded by `meta.earns` (persisted), so replaying a level or re-opening the app cannot farm it.

The portal decides sunbeam values; tune so a solid casual session lands ~20–40 sunbeams. Cadence estimates for a casual ~10-minute session:

| `moment` type | Fires (first time only) | Casual session hits |
|---|---|---|
| `first_solve` | the very first solution ever found | 1 (first session only) |
| `level_clear` | first clear of each level | **3–6** (main driver early on) |
| `three_star` | first 3-star of each puzzle | 1–3 |
| `world_clear` | finishing the last level of a world (every 8) | 0–1 |
| `daily_done` | completing the Daily (once per calendar day) | 1 (if they open the Daily) |
| `streak_milestone` | streak hits 3 / 7 / 14 / 30 / 100 | ~0, occasionally 1 |
| `pal_unlock` | first time each Pal is unlocked | 0–1 |
| `skin_unlock` | first time each Skin is unlocked | 0–1 |

`detail` carries context (e.g. `{level}`, `{stars}`, `{streak}`, `{world}`, `{id}`). A suggested starting mix: `level_clear` ≈ 4–6 sunbeams, `daily_done` ≈ 6–8, `three_star` ≈ 3–4, `world_clear`/`pal_unlock`/`skin_unlock` ≈ 6–10, `streak_milestone` ≈ 10+. The full catalogue is `EARN_MOMENTS` in `src/wallet.js`.

To read the signals from the portal frame:
```js
window.addEventListener('message', (e) => {
  if (e.data?.sws === 'earn') grantSunbeams(e.data.moment, e.data.detail);
});
```

---

## 6. localStorage keys written

Exactly **one** key: **`tally:v1`** — a single JSON blob (coins, gems, streak, level, per-puzzle stars, owned/equipped skin & Pal, freezes, boost expiry, settings, solutions found, and the `earns` first-time-moment map). In the claude.ai artifact runtime it transparently uses `window.storage` instead; in a normal browser it's `localStorage["tally:v1"]`. No cookies, no other keys, no trackers.

---

## 7. File manifest

**Deployable (shipped in `dist/` after `npm run build`):**
- `index.html` — shell + Sky Wolf embed snippet
- `src/*.js`, `src/*.jsx` — bundled into `dist/assets/index-*.js`
  - `engine.js` (pure puzzle logic), `config.js` (skins/pals/worlds/economy), `storage.js`, `wallet.js`, `audio.js`, `Game.jsx` (all UI + CSS), `App.jsx`, `main.jsx`
- `vite.config.js` — `base: "./"` for relative paths

**Dev-only (NOT shipped):**
- `.github/workflows/deploy.yml` — CI build + Pages deploy
- `tests/engine.test.mjs` — engine unit tests
- `scripts/dom-smoke.mjs` — full-loop jsdom gameplay test (19 checks)
- `docs/HANDOFF.md` — original design/spec/backlog
- `CLAUDE.md`, `README.md`, `Tally-HANDOFF.md` — docs
- `artifact/mathverse.jsx` — legacy single-file twin, reference only (pre-rebrand)
- `package.json`, `package-lock.json`, `node_modules/`

**Build:** `npm ci && npm run build` → static `dist/`. Verified: 4/4 engine tests, 19/19 DOM gameplay checks, clean production build.

---

## 8. Thumbnail source

No binary asset is committed, but the portal card art can be rendered from the game's own look: the amber **beacon** (target) over the moonstone number ring on the indigo "Twilight" background, with the fox Pal 🦊 peeking from the corner. A quick capture: open the live URL, or use the beacon + `🦊🦉🐲🦄` Pal faces on a `#0d1326`→`#182246` radial gradient. (Say the word and I'll add a committed `thumbnail.png`/SVG.)

---

## 9. Compliance checklist (Sky Wolf hard rules)

- ✅ Fully static, no backend, no accounts, no payments, no trackers; localStorage save; one folder over HTTPS; all paths relative.
- ✅ Portrait-first, touch-first (48px+ targets), keyboard supported, `prefers-reduced-motion` respected (setting + media query).
- ✅ GitHub Pages deploy from `main` via Actions (URL + path above).
- ✅ Sky Wolf embed snippet included **verbatim**.
- ✅ Every back/✕ is an internal screen switch that clears overlays; no `history.back()`; no navigation when embedded; one "All Sky Wolf games" button → `SWS_EXIT()`; no service worker; no auto-fullscreen.
- ✅ Game score kept internal; all earning routed through one marked Wallet object; earn moments listed and kept first-time-only in the game's own state; sunbeams left entirely to the portal.
