# MathVerse — Project Handoff

This document is the complete context for continuing development. It covers where the idea came from, what's built and why, every spec you need to extend it safely, and a prioritized backlog. `CLAUDE.md` at the repo root is the short operating brief; this is the deep version.

## 1. Vision

MathVerse is "Wordscapes for numbers": a calm, beautiful, endlessly generated math puzzle. A ring of number tiles at the bottom, a glowing target at the top, four operators in between. The player combines pool numbers with + − × ÷ to hit the target, and each puzzle asks for *multiple distinct ways* to reach it — the Wordscapes "find all the words" loop, translated to arithmetic.

Product pillars, in priority order:

1. **Zen first.** No forced timers, no fail states, generous rewards. The game should lower the player's heart rate.
2. **Rapid, frictionless play.** The core loop is tap-tap-tap; anything that adds a step (submit buttons, confirmation dialogs, scrolling) is the enemy.
3. **Style, never advantage.** Monetization is 100% cosmetic + convenience. Skins re-theme the whole board; nothing purchasable changes difficulty or scoring. This exact phrase ships in the Shop copy.
4. **Infinite content for free.** Procedural generation means the level supply costs nothing; monetization rides on attachment, not gating.

## 2. Market research that shaped this (mid-2026)

- **NYT "Digits" is the proof of demand.** NYT ran a beta with almost exactly this mechanic (combine six numbers to hit a target) and discontinued it in August 2023 despite an audibly upset fanbase. That audience never got a spiritual successor at quality. Digits fans specifically praised/requested: efficiency scoring (fewer numbers = better), shareable emoji results, and difficulty tiers — all reflected in our star system, share text, and level curve.
- **Wordscapes/Zenwords** proves the loop: circle-of-pieces input, find-several-solutions-per-board, bonus finds convert to soft currency, hints cost currency, free shuffle, daily puzzle, and heavy cosmetic theming. We mirror that structure deliberately.
- **Nerdle/Mathler** validate daily math puzzles with streak mechanics as a retention spine.
- **Monetization patterns (2025–26):** cosmetic-only economies retain best long-term (no pay-to-win backlash); streak+reward systems measurably boost D7/D30 retention; season/battle passes are the dominant recurring-revenue structure in casual; rewarded value exchanges (e.g., double coins) outperform interstitials for sentiment. Hence: skins as the core product, Zen Pass as the planned recurring layer, boosts as convenience-only.

## 3. What's built (feature inventory)

**Core game:** tap-to-build equations with number/operator alternation enforced; standard precedence; integer-only; auto-commit the instant a complete expression equals the target (300ms green "bank" flash, input locked during it); live running total that turns red on complete-but-wrong, green on bank; undo / clear; free shuffle (ring center) that safely remaps in-progress builder indices; hint (25 coins) reveals the simplest unfound solution; progress dots + bonus counter; found-solutions strip (horizontal scroll); clearing the required count reveals a pulsing **Next** and keeps the puzzle open for bonus finds; finding *every* solution auto-opens the summary; 3-star scoring; win overlay with per-star conditions, coin tally, share (clipboard).

**Modes:** endless campaign (level-seeded generation, rising difficulty) and Daily Challenge (date-seeded, +1 gem, streak logic with freezes, "new daily" badge on the nav).

**Ecosystem:** coins + gems dual currency; 9 skins (2 free, 5 coin-priced 250–900, 2 gem-priced 15/25) that re-theme every surface via CSS tokens; skin preview modal; Streak Freeze (3 gems); Double Coins 24h boost (5 gems, honored by `addCoins`); Zen Pass placeholder card; Stats screen; Settings (sound, animations, reset with confirm).

**Comfort & platform:** one-screen no-scroll play layout with a ResizeObserver-sized number ring; onboarding (first-run 3-step "How to play", reopenable via the top-bar `?`); full keyboard play (1–5 tiles, `+ - * /` or `x`, Backspace undo, Esc clear, S shuffle, Enter next/advance); haptics on bank/clear/win (`navigator.vibrate`); Web Audio sfx (lazy AudioContext); `touch-action: manipulation` (no double-tap zoom delay); `overscroll-behavior: none`; `100dvh` with `vh` fallback; reduced-motion support (setting + media query); visible focus rings; toast is `role="status"`.

**Persistence:** single JSON blob (`mathverse:v1`) via an adapter — `window.storage` in the claude.ai artifact runtime, `localStorage` in browsers. Solutions found for the two active puzzles persist, so reloads resume mid-puzzle. Forward-compatible loading (defaults spread under saved data).

## 4. Architecture

```
index.html → src/main.jsx (StrictMode) → src/App.jsx → src/Game.jsx
                                              │
        ┌──────────────┬──────────────┬───────┴──────┐
   src/engine.js   src/config.js   src/storage.js  src/audio.js
   (pure logic)    (SKINS+ECONOMY) (meta blob I/O)  (sfx+buzz)
```

`Game.jsx` currently contains all UI: component state, handlers, `Board`, `Shop`, `Stats`, `WinOverlay`, `SettingsOverlay`, `HowToOverlay`, `SkinPreview`, `NavBtn`, and a `StyleTag` holding every CSS rule. Splitting it is deliberately the first backlog task — do it mechanically with the DOM smoke as the safety net.

## 5. Engine spec (`src/engine.js`)

- **Token model:** an expression is `[num, op, num, op, num, ...]` — odd length, ends in a number. Ops are the glyphs `+ - × ÷`.
- **`evalExpr(tokens)`:** two-pass precedence evaluation (× ÷ collapse left-to-right first, then + −). Returns `NaN` for invalid shapes.
- **`sigOf(nums, ops)`:** canonical signature = sorted numbers joined + `|` + sorted ops joined. Solutions with the same multiset of numbers and ops count as one "way" (so `8+12` ≡ `12+8`, and `12÷2×3` ≡ `12×3÷2`). This is a deliberate design simplification — see §11.
- **`solveAll(pool)`:** enumerates all permutations of 2..min(5,|pool|) pool numbers × all operator combos, keeps finite non-negative integer results ≤ 300, returns `Map(value → Map(sig → {sig, tokens, count}))`.
- **`genPuzzle(seed, opts)`:** seeded (`mulberry32`) generation. Picks a distinct-number pool, solves it, and selects a target with a healthy solution count (prefers 3–6 distinct solutions, falls back to 2–8), up to 80 attempts, then a hardcoded safe fallback. Returns `{id, pool (shuffled), target, solutions, total, required, hasClean}` where `hasClean` = a 2-number solution exists. **Pool values are always distinct** — several systems (shuffle remap, keyboard selection) rely on this.
- **Difficulty curve (`levelOpts`):**

| Levels | Pool | Number range | Target range | Required |
|---|---|---|---|---|
| 1–2 | 4 | 1–12 | 8–40 | 2 |
| 3–6 | 5 | 1–15 | 10–60 | 3 |
| 7–14 | 5 | 1–20 | 12–80 | 3 |
| 15+ | 5 | 1–25 | 14–99 | 3 |

- **Seeds:** campaign = `1000 + level`; daily = `YYYYMMDD` int. Deterministic per seed (unit-tested), so the same level replays identically and every player worldwide gets the same daily.

## 6. Game rules

- Each pool number may be used at most once per equation; the builder enforces number/op alternation with gentle toasts on misuse.
- **Auto-commit:** when a placed number completes an expression equal to the target, it banks automatically. Duplicate signatures toast "Already found that one" and clear.
- **Clearing:** `required` distinct solutions clears the puzzle → Next appears (Hint hides), puzzle stays open for bonus finds. Banking the final undiscovered solution auto-opens the summary.
- **Stars:** ★1 reach the target (always true on finish). ★2 find a two-number solution — or, if the puzzle has none (`hasClean` false), find `required + 1` solutions. ★3 two or more bonus finds, or all solutions found. Best stars per puzzle id persist.
- **Daily streak:** completing today's daily → gap 1 day = streak+1; gap >1 with a freeze = consume one, streak+1; otherwise streak resets to 1. Same-day replays never double-credit (guarded inside the state updater). +1 gem per first completion of a day.

## 7. Economy (all values live in `src/config.js → ECONOMY`)

| Item | Value |
|---|---|
| Starting balance | 130 coins, 6 gems |
| Required solution | +14 coins |
| Bonus solution | +9 coins |
| Star bonus at finish | +12 coins per star |
| Daily completion | +1 gem |
| Hint | −25 coins |
| Streak Freeze | 3 gems |
| Double Coins (24h) | 5 gems (multiplies `addCoins` at award time) |
| Skins | free ×2 · 250 / 350 / 400 / 500 / 900 coins · 15 / 25 gems |

Intended balance feel: a 3-star clear with one bonus ≈ 14×2–3 + 9 + 36 ≈ 70–80 coins, so the first paid skin (250) lands after ~3–4 good levels — an early, satisfying purchase that teaches the shop. Gems are scarce (dailies only) so gem skins read as prestige. Tune freely; keep everything in `ECONOMY`.

## 8. UX decisions and their reasons

- **Auto-commit over a submit button:** the single biggest friction cut for rapid play; also reclaims a whole control row on small screens. The 300ms `banking` lock prevents double-input during the flash.
- **Cleared → Next (not auto-advance):** auto-advancing at `required` made bonus finds and ★3 nearly unreachable. Keeping the puzzle open converts "done" into "how many more can I find?" — the retention heart of the Wordscapes loop.
- **Self-sizing ring:** the ring measures its flex region (ResizeObserver) and sets a `--cd` diameter (clamped 140–360px); tiles are 30% of `--cd`, fonts 12.3%, center 22% (min 40px), orbit radius 37%. Guarantees the one-screen rule on any viewport.
- **Complete-but-wrong turns the total red** rather than toasting/shaking: mid-thought expressions often pass through wrong totals; color is honest feedback without punishment.
- **Keyboard digits pick positions, not values:** pool values can be two digits, so typed values are ambiguous; positions 1–5 (clockwise from top) are instant.
- **Haptics:** 15ms tick per bank, pattern on clear/win. Subtle by design; a settings toggle is backlog P1-7.

## 9. Design system

The board is the product, so *everything* re-themes. A skin is `{ id, name, vibe, price, currency, v }` where `v` is this token set:

| Token | Role |
|---|---|
| `bg`, `bg2` | page gradient ends |
| `surf`, `surf2` | card / control surfaces |
| `target`, `tg` (rgb triplet), `ttext` | beacon fill, its glow color, text on it |
| `tile`, `tile2`, `ttx` | number-tile gradient + numeral color |
| `edge` | tile rim |
| `acc`, `acc2` | primary/secondary accents (operators, nav active, buttons) |
| `line`, `fill` | hairlines and inset fills |
| `text`, `muted` | type colors |
| `good`, `warn` | success / error semantics |
| `act`, `part` | active states, celebration particles |

Adding a skin = one object in `SKINS`. The default look ("Twilight") is a deliberate identity: layered indigo night, warm amber beacon (the one bold element), moonstone tiles — chosen over generic AI-default palettes. Sumi Ink is the light-mode proof that the token system handles inversion.

## 10. Persistence schema (`mathverse:v1`)

`coins, gems` (int) · `streak, best` (int) · `lastDaily` (ISO `Y-M-D` or null) · `level` (int) · `stars` (`{puzzleId: 0..3}`) · `owned` (skin ids) · `skin` (id) · `freezes` (int) · `boostUntil` (epoch ms) · `sound, motion, seenIntro` (bool) · `solved, bonus` (int) · `finds` (`{puzzleId: [sig]}`, pruned each save to the active campaign + today's daily). Loading spreads saved data over `DEFAULT_META`, so adding fields is a non-breaking migration; renames need explicit handling.

## 11. Known issues & accepted simplifications

1. Daily doesn't regenerate if the date rolls over mid-session (P0-3: re-check on `visibilitychange`).
2. Hint "reveals" (italic styling) aren't persisted — after reload a hinted chip looks like a normal find. Cosmetic only.
3. `sigOf` treats any reordering with the same number/op multisets as one solution. Rarely, genuinely different expressions collapse (e.g. `10−2+5` ≡ `10+5−2` — intended; edge cases with mixed ÷ are theoretically possible). Accepted for sanity of "distinct ways".
4. Negative *intermediate* values are allowed if the final result is a non-negative integer; only the final value is validated.
5. `user-scalable=no` in `index.html` is a deliberate game-feel/accessibility tradeoff — revisit if a11y review objects.
6. No error boundary around `Game` yet; a corrupt storage blob falls back to defaults, but a render crash would white-screen.

## 12. Backlog (prioritized)

**P0 — structure & shipping**
1. **Split `Game.jsx`** into `components/{Board,Shop,Stats,WinOverlay,SettingsOverlay,HowToOverlay,SkinPreview,NavBtn}.jsx` + `styles.js`, zero behavior change. Acceptance: `npm run test:all` green, no visual diff.
2. **Level journey screen** — replayable level list with star badges (data already in `meta.stars`); tapping a level regenerates it from its seed. Acceptance: replay any beaten level; best stars retained.
3. **Daily rollover** — on `visibilitychange`/focus, if `todayKey()` changed, regenerate the daily and refresh the nav badge.
4. **Deploy** — static host (Vercel/Netlify/Pages) + PWA manifest, icons, and a minimal service worker for offline play.

**P1 — retention & feel**
5. **Zen Pass Season 1** (the placeholder card exists): 30 tiers; XP = 10/required solve, 5/bonus, 25/daily; free lane pays coins/gems, premium lane (gem-priced) pays exclusive skins. Data: `meta.pass = {season, xp, claimed[], premium}`. Keep cosmetic-only.
6. **More skins**, incl. one animated (`fx` field, e.g. aurora shimmer) and one seasonal.
7. **Settings additions:** haptics toggle, master volume.
8. **Achievements** (10 to start: first ★3, 7-day streak, 50 bonus finds, own 3 skins, level 25, solve using ÷ four times in one puzzle, etc.) with coin payouts.

**P2 — modes & insight**
9. **Zen Blitz** (opt-in only): 90-second target chains, separate leaderboard-ready scoring. Must not touch core-mode code paths.
10. **Analytics** behind a no-op `track(event, props)`: `session_start, puzzle_start{mode,level}, solution_found{isBonus,nth,ms}, puzzle_complete{stars,found,total}, hint_used, shuffle_used, skin_{preview,purchase,equip}, boost_purchase, daily_complete{streak}, share_result, howto_{open,complete}`.
11. **Stats v2:** solutions/day chart, daily-completion calendar heatmap.

**P3 — platform**
12. **Accounts + cloud sync:** thin API (`POST /auth/anonymous`, `GET/PUT /sync` with last-write-wins on `meta`, `POST /purchase/validate`), server-authoritative gem grants; Stripe for gem packs; daily leaderboard (fewest total numbers used). Keep the client fully functional offline-first.

## 13. Testing

- `npm test` — engine invariants (precedence, dedupe, 320-puzzle validity sweep across the curve, deterministic seeds).
- `npm run test:dom` — bundles the real app with esbuild, mounts it in jsdom (with a `window.storage` mock and ResizeObserver polyfill), then *plays it*: solves two real solutions by clicking, asserts auto-commit banking, persistence of finds/coins/level, the Next flow, the win summary, and keyboard Enter-advance.
- Pattern to reuse: compute solutions with the engine itself, drive the DOM with dispatched events, `await sleep(400)` past the 300ms bank lock. Extend this file whenever gameplay behavior changes.

## 14. Kickoff prompt for Claude Code

> Read CLAUDE.md and docs/HANDOFF.md. Run `npm install && npm run test:all` and confirm everything is green. Then work through the P0 backlog in order, starting with splitting src/Game.jsx into components with zero behavior change — keep `npm run test:all` green after every step, and extend scripts/dom-smoke.mjs to cover any new behavior you add.
