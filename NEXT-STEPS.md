# Tally — Status: 🟢 LIVE

_Updated 2026-07-02. GitHub Pages is enabled and the production build is deployed and verified._

## ✅ Live
- **Play it:** https://stephenuffugus.github.io/Tally/  (embedded: add `?embed=1`)
- Verified in a real browser: board + beacon render, all assets (JS, `thumbnail.png`) return 200, **zero console errors**.
- Every push to `main` rebuilds and redeploys via GitHub Actions (`.github/workflows/deploy.yml`).

## 📦 Hand to the games director
Give them **`Tally-HANDOFF.md`** — it has the live URL, embed contract, earn-moments list, nav map, the single localStorage key (`tally:v1`), file manifest, and portal card copy.

## 🛠️ One optional tidy (only if a future deploy ever looks stale)
Pages Source is currently set to **"Deploy from a branch"** but the Actions workflow is what's actually serving the built site. If you ever push a change and the live site looks broken/old, switch the source to the cleaner mode:
- **https://github.com/Stephenuffugus/Tally/settings/pages** → **Source → GitHub Actions** → Save, then re-run the "Deploy Tally to GitHub Pages" workflow.

Not needed right now — the site is live and correct. 🦊
