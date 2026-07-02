# MathVerse

A zen math puzzle game (think Wordscapes, but numbers). A ring of number tiles, a glowing target, four operators. Tap numbers and operators to build an equation; the instant it equals the target it banks automatically. Find every required way to clear the level. Full ecosystem included: coins/gems, 9 cosmetic skins, daily challenge with streaks + freezes, hints, boosts, stats, onboarding, keyboard play, haptics.

Read `docs/HANDOFF.md` before starting real work — it has the full design rationale, research, economy spec, and the prioritized backlog.

## Commands

```bash
npm install        # once
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm test           # engine unit tests (node:test, zero deps)
npm run test:dom   # bundles the real app, mounts in jsdom, plays a full puzzle
npm run test:all   # both
```

All three verification layers were green at handoff: 4/4 engine tests, 13/13 DOM smoke checks, clean `vite build`.

## Structure

| Path | What it is |
|---|---|
| `src/engine.js` | Pure puzzle logic: eval, solver, generator, RNG, difficulty curve. No React, no DOM — keep it that way. |
| `src/config.js` | `SKINS` (theme token sets) + `ECONOMY` (every tunable reward/cost number). |
| `src/storage.js` | Persistence adapter: `window.storage` (Claude artifact) else `localStorage`. One JSON blob, `mathverse:v1`. |
| `src/audio.js` | Web Audio tone synth (`sfx`) + haptics (`buzz`). |
| `src/Game.jsx` | The entire UI: state, handlers, Board/Shop/Stats/overlays + all CSS in one injected `<style>`. **Splitting this is backlog P0-1.** |
| `src/App.jsx`, `src/main.jsx` | Thin shell. |
| `tests/` | Engine invariants. |
| `scripts/dom-smoke.mjs` | Full-loop UI test. Keep it green after every change. |
| `artifact/mathverse.jsx` | Single-file twin that runs as a claude.ai artifact. This repo is now source of truth; the artifact is reference only. |
| `docs/HANDOFF.md` | Vision, research, specs, backlog. |

## Hard product rules (do not violate)

1. **Cosmetic-only monetization.** Skins and boosts never change puzzle difficulty, solutions, or scoring. "Style, never advantage" is shipped copy in the Shop.
2. **No submit button.** Auto-commit on hitting the target is the core UX. Never reintroduce manual equation submission.
3. **The play screen never scrolls.** It's a fixed full-height flex column; the number ring self-sizes (ResizeObserver) to the leftover space. Any new play-screen element must fit inside this budget.
4. **Integer-only math, standard precedence** (× ÷ before + −), each pool number used at most once per equation.
5. **No forced timers** in the core zen modes. Timed play only ever as a separate opt-in mode.
6. **Every color comes from skin tokens** (CSS vars set from `SKINS[i].v`). No hardcoded theme colors in components.
7. **Engine stays pure and tested.** Anything in `src/engine.js` must run in bare Node.

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
