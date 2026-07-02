# Tally — Next steps (go-live checklist)

_Last updated 2026-07-02. The game is fully built, tested, and pushed to `main`. Only the Pages toggle is left — a one-time click I can't do from here._

## ✅ Already done (nothing to redo)
- Rebuilt MathVerse → **Tally**: worlds Journey, collectible **Pals**, daily/streaks, skins.
- Abacus brand art built from your thumbnail (`public/thumbnail.png`), glossy navy beads, etc.
- Sky Wolf portal wiring: verbatim embed snippet, `SWS_EXIT` button, relative paths, Wallet + earn-moments.
- Verified: 4/4 engine tests, 19/19 gameplay smoke, clean production build, live-browser screenshots of every screen.
- All committed & pushed to `main` (latest commit around `f0b3134`).
- GitHub Actions deploy workflow is in place (`.github/workflows/deploy.yml`) and **compiles green in CI** — it only fails on the last step because Pages isn't enabled yet.

## 🔧 THE ONE THING TO DO (2 minutes, needs your account)
Enable GitHub Pages — my token isn't allowed to create the Pages site, so this must be you:

1. Go to **https://github.com/Stephenuffugus/Tally/settings/pages**
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Save. (No branch/folder to pick — the workflow handles the rest.)

That's it. Enabling it auto-kicks a deploy. If it doesn't, either push any commit or go to the **Actions** tab → "Deploy Tally to GitHub Pages" → **Run workflow**.

## 🔗 After it's enabled
- **Live URL:** https://stephenuffugus.github.io/Tally/  (embedded: add `?embed=1`)
- Give it ~1–2 min after the green Actions run to appear.
- Then hand your games director **`Tally-HANDOFF.md`** (has the live URL, embed contract, earn-moments list, nav map, localStorage key, file manifest, card copy).

## 💬 When you're back
Just say **"Pages is on"** (or "re-trigger the deploy") and I'll confirm the workflow ran green and the live link works. If anything about the toggle is unclear, tell me what you see on the Pages settings screen and I'll walk you through it.

Rest easy — the build is safe on `main`. 🦊
