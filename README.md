# Tally

A cozy number puzzle for all ages, built for the Sky Wolf Studios / Lucid Winds portal. A ring of numbers, a glowing target, four operators — build equations that hit the target and find every distinct way to do it. Endless procedurally-generated levels grouped into playful **worlds**, a daily challenge with streaks, cheerful collectible **Pals** who root you on, and a fully cosmetic economy of skins. Style, never advantage.

## Quick start

```bash
npm install
npm run dev        # play at the printed localhost URL
npm run test:all   # engine tests + full DOM gameplay smoke
npm run build      # production build → dist/ (relative paths, static)
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds `dist/` and publishes it to **GitHub Pages**. Live URL and the full portal handoff (embed contract, earn moments, nav map, localStorage keys, file manifest) are in **`Tally-HANDOFF.md`**.

## Controls

Tap/click numbers and operators to build an equation — it banks automatically the moment it equals the target. Keyboard: `1–5` tiles (clockwise from top), `+ - * /` (or `x`) operators, `Backspace` undo, `Esc` clear, `S` shuffle, `Enter` next.

## For AI-assisted development

`CLAUDE.md` is the operating brief (rules, structure, gotchas); `docs/HANDOFF.md` has the original design/spec/backlog. `Tally-HANDOFF.md` is the portal integration handoff.
