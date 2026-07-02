# Tally

A cozy number puzzle for all ages (think Wordscapes, but numbers). A ring of number tiles, a glowing target, four operators. Tap numbers and operators to build an equation; the instant it equals the target it banks automatically. Find every required way to clear the level. Full ecosystem: coins/gems, cosmetic **skins**, collectible companion **Pals** who cheer you on, a **Journey** of themed worlds, daily challenge with streaks + freezes, hints, boosts, stats, onboarding, keyboard play, haptics. Built for the Sky Wolf / Lucid Winds portal.

Read `Tally-HANDOFF.md` for the portal integration (embed contract, earn moments, nav map, localStorage keys, deploy). `docs/HANDOFF.md` is the original design rationale/spec/backlog.

## Commands

```bash
npm install        # once
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm test           # engine unit tests (node:test, zero deps)
npm run test:dom   # bundles the real app, mounts in jsdom, plays a full puzzle
npm run test:all   # both
```

All verification layers were green at handoff: 4/4 engine tests, 19/19 DOM smoke checks, clean `vite build` (relative paths via `base: "./"`).

## Structure

| Path | What it is |
|---|---|
| `src/engine.js` | Pure puzzle logic: eval, solver, generator, RNG, difficulty curve. No React, no DOM — keep it that way. |
| `src/config.js` | `SKINS`, `PALS` (companions), `WORLDS` (`worldOfLevel`), and `ECONOMY` (every tunable reward/cost). |
| `src/wallet.js` | **The one marked earning choke point.** All coin/gem changes + first-time-only sunbeam earn-moment signals (`postMessage` to the portal). `EARN_MOMENTS` catalogue lives here. |
| `src/storage.js` | Persistence adapter: `window.storage` (Claude artifact) else `localStorage`. One JSON blob, **`tally:v1`**. |
| `src/audio.js` | Web Audio tone synth (`sfx`) + haptics (`buzz`). |
| `src/Game.jsx` | The entire UI: state, handlers, Board/Journey/Shop/Stats/overlays + all CSS in one injected `<style>`. Screen switches go through `go()` which clears overlays. |
| `src/App.jsx`, `src/main.jsx` | Thin shell. |
| `index.html` | Shell + verbatim Sky Wolf embed snippet (`SWS_EMBED`/`SWS_EXIT`). |
| `.github/workflows/deploy.yml` | Builds `dist/` on push to `main` and deploys to GitHub Pages. |
| `tests/`, `scripts/dom-smoke.mjs` | Engine invariants + full-loop UI test. Keep green after every change. |
| `artifact/mathverse.jsx` | Legacy single-file twin (pre-rebrand), reference only. |
| `docs/HANDOFF.md`, `Tally-HANDOFF.md` | Original design/backlog + portal integration handoff. |

## Hard product rules (do not violate)

1. **Cosmetic-only monetization.** Skins and boosts never change puzzle difficulty, solutions, or scoring. "Style, never advantage" is shipped copy in the Shop.
2. **No submit button.** Auto-commit on hitting the target is the core UX. Never reintroduce manual equation submission.
3. **The play screen never scrolls.** It's a fixed full-height flex column; the number ring self-sizes (ResizeObserver) to the leftover space. Any new play-screen element must fit inside this budget.
4. **Integer-only math, standard precedence** (× ÷ before + −), each pool number used at most once per equation.
5. **No forced timers** in the core zen modes. Timed play only ever as a separate opt-in mode.
6. **Every color comes from skin tokens** (CSS vars set from `SKINS[i].v`). No hardcoded theme colors in components.
7. **Engine stays pure and tested.** Anything in `src/engine.js` must run in bare Node.
8. **Pals are cosmetic too.** Companions only cheer — never touch difficulty, solutions, or scoring.
9. **Portal safety.** Keep asset paths relative (`base: "./"`). Route all earning through `src/wallet.js`. Never `history.back()`; never auto-fullscreen; screen switches must clear overlays (use `go()`); keep the verbatim embed snippet in `index.html`; the game never awards sunbeams itself.

## Engine invariants (asserted in tests)

- Every generated puzzle has ≥ `required` distinct solutions and an integer target in [0, 300].
- Solutions dedupe by canonical signature (sorted numbers | sorted ops) so `8+12` and `12+8` count once.
- Generation is deterministic per seed (`mulberry32`); campaign seed = `1000 + level`, daily seed = `YYYYMMDD`.

## Gotchas

- Shuffle remaps builder tile indices by value (pool values are distinct) — don't "simplify" this away or used-tile tracking corrupts.
- `finds` (solutions found) are persisted but pruned to the two active puzzle ids each save.
- The daily puzzle doesn't regenerate if the date rolls over mid-session (backlog P0-3).
- React StrictMode double-invokes effects in dev; the load effect has a cancellation guard.
- `sfx`/AudioContext is lazily created inside try/catch (iOS needs a user gesture first).
- Keyboard digits 1–5 select tiles **by position** (clockwise from top), not by value.

## Working agreement

Run `npm run test:all` before and after every task. When you change gameplay behavior, extend `scripts/dom-smoke.mjs` to cover it. Start with the P0 backlog in `docs/HANDOFF.md §12` — first task is splitting `src/Game.jsx` into components with zero behavior change.
