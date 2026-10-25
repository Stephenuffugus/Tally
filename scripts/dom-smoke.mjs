// DOM smoke test: bundles the real app, mounts it in jsdom, plays a full puzzle
// through the UI (clicks + keyboard), and checks persistence. `npm run test:dom`.
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evalExpr, OPS, sigOf, genPuzzle, levelOpts, todayKey } from "../src/engine.js";
import * as CFG from "../src/config.js";   // a namespace, so an older copy without TALLY_BUILD still runs (and fails its check)
const { PALS, ECONOMY, TALLY_BUILD, worldOfLevel } = CFG;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const entry = path.join(here, "_entry.jsx");
const outfile = path.join(here, "_bundle.cjs");

writeFileSync(entry, `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../src/App.jsx";
export function mount(el) { const r = createRoot(el); r.render(React.createElement(App)); return r; }
`);

await build({
  entryPoints: [entry], bundle: true, format: "cjs", platform: "node",
  outfile, jsx: "automatic", logLevel: "silent",
  define: { "process.env.NODE_ENV": '"development"' },
});

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch { /* Node >=21 global navigator is fine */ }
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms >= 15000 ? ms / 20 : ms, ...a);   // 18 s think = 900 ms here

let savedMeta = null;
let seed = { seenIntro: true };   // what the "saved game" holds at mount (phase 2 seeds a level)
dom.window.storage = {
  get: async () => ({ value: JSON.stringify(seed) }),
  set: async (_k, v) => { savedMeta = v; return {}; },
  delete: async () => ({}), list: async () => ({ keys: [] }),
};

const require = createRequire(import.meta.url);
const { mount } = require(outfile);
let el = document.getElementById("root");
const rootA = mount(el);

// Player copy law: no "!" and no dashes in ANY text that ever renders (toasts and
// the pal's bubble included), so every text node that appears is recorded.
const BAD = /[!\u2010-\u2015]|[A-Za-z]-[A-Za-z]| - /;
const seenText = new Set();
const noteText = (n) => {
  if (!n) return;
  if (n.nodeType === 3) { if (n.parentNode && n.parentNode.tagName === "STYLE") return; const t = n.data.trim(); if (t) seenText.add(t); return; }
  if (n.nodeType === 1 && n.tagName !== "STYLE" && n.tagName !== "SCRIPT") n.childNodes.forEach(noteText);
};
new dom.window.MutationObserver((muts) => { for (const m of muts) { if (m.type === "characterData") noteText(m.target); else m.addedNodes.forEach(noteText); } })
  .observe(document.body, { childList: true, subtree: true, characterData: true });
const palFrames = [];         // every frame the painted pal shows, in order (the img's data-frame)
let bubbles = 0;              // speech bubbles that appeared
new dom.window.MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("mv-pal-bubble") && !n.hasAttribute("data-measure")) bubbles++; }); })
  .observe(document.body, { childList: true, subtree: true });
new dom.window.MutationObserver((muts) => { for (const m of muts) if (m.target.classList && m.target.classList.contains("mv-pal-img")) palFrames.push(m.target.getAttribute("data-frame")); })
  .observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-frame"] });
const unnamed = new Set();   // icon buttons seen without an accessible name
const namedIcons = new Set();
const noteIcons = () => [...document.querySelectorAll(".mv-icobtn")].forEach((b) => { const n = (b.getAttribute("aria-label") || "").trim(); if (!n) unnamed.add(b.outerHTML.slice(0, 60)); else namedIcons.add(n); });
const star3Label = (p) => p.total - p.required >= 2 ? "Find two bonus ways" : "Find every way";
const star2Label = (hasClean) => hasClean ? "Find a two number solution" : "Find one extra way";
const condTexts = () => [...document.querySelectorAll(".mv-cond")].map((c) => c.textContent.trim());
const paidLine = `Paid at the bank: ${ECONOMY.SOLVE_COINS} a way, ${ECONOMY.BONUS_COINS} a bonus`;

const q = (s) => el.querySelector(s);
const qa = (s) => [...el.querySelectorAll(s)];
const click = (n) => n.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const key = (k) => dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// brute-force distinct solutions with the real engine's eval + sig
function findSolutions(pool, target) {
  const out = new Map(); const idx = [...pool.keys()];
  const perms = (k) => { const r = [], u = Array(idx.length).fill(false), c = [];
    (function rec() { if (c.length === k) { r.push(c.slice()); return; }
      for (let i = 0; i < idx.length; i++) if (!u[i]) { u[i] = true; c.push(idx[i]); rec(); c.pop(); u[i] = false; } })();
    return r; };
  const ocs = (l) => l === 0 ? [[]] : ocs(l - 1).flatMap((r) => OPS.map((o) => [...r, o]));
  for (let k = 2; k <= Math.min(pool.length, 4); k++)
    for (const p of perms(k)) { const nums = p.map((i) => pool[i]);
      for (const oc of ocs(k - 1)) { const tok = [];
        nums.forEach((n, i) => { tok.push(n); if (i < oc.length) tok.push(oc[i]); });
        if (evalExpr(tok) === target) { const s = sigOf(nums, oc); if (!out.has(s)) out.set(s, tok); } } }
  return [...out.values()];
}

const results = [];
const A = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);

// Wait for the async meta load + first React commit to paint the board, rather
// than a fixed sleep (which races the bundle-mount time under CPU contention).
const waitFor = async (sel, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (q(sel)) return true; await sleep(30); }
  return false;
};
await waitFor(".mv-beacon-num");
await sleep(200); // let StrictMode's double-mount effects settle before driving input
A("board renders", !!q(".mv-board"));
A("Part 3: the wordmark stands in the header", !!q(".mv-wordmark") && /ui\/logo\.webp/.test(q(".mv-wordmark").getAttribute("src")));
A("four operators + − × ÷", qa(".mv-op").map((b) => b.textContent).join("") === "+−×÷");
A("no submit button (auto-commit UX)", qa(".mv-submit").length === 0);
A("help button present", !!q('[aria-label="How to play"]'));

const pool = qa(".mv-tile").map((t) => parseInt(t.textContent, 10));
const target = parseInt(q(".mv-beacon-num").textContent, 10);
const sols = findSolutions(pool, target);
A("driver found >=2 solutions", sols.length >= 2, `pool=[${pool}] target=${target}`);

const opNode = (g) => qa(".mv-op").find((b) => b.textContent === (g === "-" ? "−" : g));
const tileNode = (v) => qa(".mv-tile").find((t) => parseInt(t.textContent, 10) === v);
async function play(tokens) {
  for (const x of tokens) { (typeof x === "number") ? click(tileNode(x)) : click(opNode(x)); await sleep(20); }
  await sleep(400); // past the 300ms bank lock
}

const palImg0 = q(".mv-pal-img");
A("the painted pal stands on the board", !!palImg0 && /^\.\/art\/t1\/pals\/pip\/(idle|think)_0\d\.webp$/.test(palImg0.getAttribute("src")), palImg0 && palImg0.getAttribute("src"));
const palBox = q(".mv-pal-box");
// the box's shape must be the frame's own shape: read the width and height from the WebP file itself
const webpSize = (file) => { const b = (fsMod).readFileSync(file); const k = b.toString("ascii", 12, 16);
  if (k === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (k === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; };
const fsMod = await import("node:fs");
const [fw, fh] = webpSize(path.join(root, "public", "art", "t1", "pals", "pip", "idle_01.webp"));
const pw = parseFloat(palBox && palBox.style.getPropertyValue("--pw")), ph = parseFloat(palBox && palBox.style.getPropertyValue("--ph"));
A("the pal's box has the frame's own shape", Math.abs(pw / ph - fw / fh) < 0.002 && ph > 0.85 && ph <= 1, `box ${pw}/${ph} frame ${fw}x${fh}`);
palFrames.length = 0; bubbles = 0;
await play(sols[0]);
await sleep(700);   // the cheer is 100 + 120 + 180 + 140 ms
const c1 = palFrames.indexOf("cheer_01");
A("a bank plays cheer_01..04 then idle", c1 >= 0 && palFrames.slice(c1, c1 + 5).join() === "cheer_01,cheer_02,cheer_03,cheer_04,idle_01", palFrames.join(" "));
A("auto-commit banks a find", qa(".mv-findchip").length === 1);
await play(sols[1]);
A("second find banks", qa(".mv-findchip").length === 2);
A("the bubble speaks once for two banks inside 6 s", bubbles === 1, "bubbles=" + bubbles);
// a modal is up: the think pose must not play (its 18 s clock runs at 900 ms in this test; the bank was the last input)
click(q('[aria-label="Settings"]')); await sleep(30); palFrames.length = 0; await sleep(1500);
A("think never plays under a modal", !palFrames.includes("think_01"), palFrames.join(" "));
click(q(".mv-modal-head .mv-icobtn")); await sleep(1500);
A("think plays once the board is clear again", palFrames.includes("think_01"), palFrames.join(" "));

const meta = savedMeta ? JSON.parse(savedMeta) : {};
A("finds persisted", Object.values(meta.finds || {})[0]?.length === 2);
A("coins persisted & increased", (meta.coins || 0) > 130, "coins=" + meta.coins);
A("companion pal present on board", !!q(".mv-pal"));
A("wallet marked first-solve earn moment", !!(meta.earns && meta.earns.first_solve));

const nextBtn = q(".mv-ctrl.next");
A("Next appears after clearing required", !!nextBtn);
if (nextBtn) { click(nextBtn); await sleep(120); }
A("win summary opens", !!q(".mv-win-title"));
A("Part 3: the win shows Astra's banner, three painted stars and the pal's win loop", !!q(".mv-win-banner") && qa(".mv-starimg").length === 3 && !!q(".mv-winpal img") && /win_0\d\.webp$/.test(q(".mv-winpal img").getAttribute("src")), (q(".mv-winpal img") || {}).getAttribute && q(".mv-winpal img").getAttribute("src"));
A("Part 3: one confetti pass on a campaign clear (motion on)", !!q(".mv-confetti") && /fx\/confetti_0\d\.webp$/.test(q(".mv-confetti").getAttribute("src")), (q(".mv-confetti") || {}).getAttribute && q(".mv-confetti").getAttribute("src"));
A("Part 3: a lit star pops once", qa(".mv-starpop").length >= 1 && /star_pop_0\d/.test(qa(".mv-starpop")[0].getAttribute("src")));
const P1 = genPuzzle(1001, levelOpts(1));
A("star 2 label follows the puzzle (level 1)", condTexts()[1] === star2Label(P1.hasClean), JSON.stringify(condTexts()[1]) + " hasClean=" + P1.hasClean);
A("star 3 label follows the puzzle (level 1)", condTexts()[2] === star3Label(P1), JSON.stringify(condTexts()[2]));
A("results name the bank pay", (q(".mv-win-paid") || {}).textContent === paidLine, (q(".mv-win-paid") || {}).textContent);
key("Enter"); await sleep(150);
A("Enter advances to a fresh puzzle", !q(".mv-win-title") && qa(".mv-findchip").length === 0);
A("the next puzzle sets the pal back to idle", (q(".mv-pal-img") || { getAttribute: () => "" }).getAttribute("data-frame") === "idle_01", palFrames.slice(-4).join(" "));
A("level persisted", JSON.parse(savedMeta).level === 2, "level=" + JSON.parse(savedMeta).level);
// level 2 has one way beyond the two required: its star 3 can only mean finding every way
const P2 = genPuzzle(1002, levelOpts(2));
const pool2 = qa(".mv-tile").map((t) => parseInt(t.textContent, 10));
const sols2 = findSolutions(pool2, parseInt(q(".mv-beacon-num").textContent, 10));
for (let i = 0; i < P2.required && i < sols2.length; i++) await play(sols2[i]);
if (q(".mv-ctrl.next")) { click(q(".mv-ctrl.next")); await sleep(150); }
A("star 3 label follows the puzzle (level 2)", condTexts()[2] === star3Label(P2), JSON.stringify(condTexts()[2]) + " total=" + P2.total + " required=" + P2.required);
key("Enter"); await sleep(150);

// Journey map + Pals shop (new screens)
const navBtn = (label) => qa(".mv-navbtn").find((b) => b.textContent.includes(label));
click(navBtn("Map")); await sleep(120);
A("Journey map renders the painted world panels", qa(".mv-mappanel").length >= 1 && /art\/t1\/map\/meadow\.webp/.test(q(".mv-mappanel").getAttribute("style") || ""));
A("map shows its eight level buttons on her stops", qa(".mv-mappanel")[0] && qa(".mv-mappanel")[0].querySelectorAll(".mv-lvl").length === 8, qa(".mv-lvl").length + " buttons");
{ // every stop button sits where her anchor says (the art.json written by the cut tool from map_anchors.json)
  const a0 = JSON.parse((await import("node:fs")).readFileSync(path.join(root, "src", "art-t1.json"), "utf8")).map.stops.meadow;
  const btns = [...qa(".mv-mappanel")[0].querySelectorAll(".mv-lvl")];
  A("the stops stand on her anchors", btns.length === 8 && btns.every((b, k) => b.style.left === a0[k][0] * 100 + "%" && b.style.top === a0[k][1] * 100 + "%"), btns.slice(0, 2).map((b) => b.style.left + "," + b.style.top).join(" "));
}
click(navBtn("Shop")); await sleep(120);
const ports = qa("img.mv-palport").map((i) => i.getAttribute("src"));
A("shop opens on Pals tab with the ten portraits", ports.join() === PALS.map((p) => "./art/t1/pals/" + p.id + "/portrait.webp").join(), ports.length + " portraits");
const skinsTab = qa(".mv-shoptab").find((b) => b.textContent.includes("Skins"));
click(skinsTab); await sleep(80);
A("shop can switch to Skins tab", qa(".mv-skinswatch").length >= 1);

// Phase 2: a fresh mount on a seeded save whose level HAS a two number solution.
const LC = (() => { for (let L = 2; L <= 48; L++) if (genPuzzle(1000 + L, levelOpts(L)).hasClean) return L; return 0; })();
const PC = genPuzzle(1000 + LC, levelOpts(LC));
rootA.unmount();
el = document.createElement("div"); document.body.appendChild(el);
seed = { seenIntro: true, level: LC, motion: false };   // Animations off: the pal shows idle_01 only
const rootB = mount(el);
palFrames.length = 0;
await waitFor(".mv-beacon-num"); await sleep(200);
const poolB = qa(".mv-tile").map((t) => parseInt(t.textContent, 10));
const targetB = parseInt(q(".mv-beacon-num").textContent, 10);
A("seeded save opens level " + LC, targetB === PC.target, "target=" + targetB + " want " + PC.target);
const solsB = findSolutions(poolB, targetB);
for (let i = 0; i < PC.required && i < solsB.length; i++) await play(solsB[i]);
const nextB = q(".mv-ctrl.next");
if (nextB) { click(nextB); await sleep(150); }
A("Animations off: the pal never leaves idle_01", palFrames.every((f) => f === "idle_01") && (q(".mv-pal-img") || { getAttribute: () => "" }).getAttribute("data-frame") === "idle_01", palFrames.join(" "));
A("star 2 label follows the puzzle (level " + LC + ")", condTexts()[1] === star2Label(PC.hasClean), JSON.stringify(condTexts()[1]) + " hasClean=" + PC.hasClean);
A("star 3 label follows the puzzle (level " + LC + ")", condTexts()[2] === star3Label(PC), JSON.stringify(condTexts()[2]));
key("Enter"); await sleep(150);
noteIcons();
click(q('[aria-label="Settings"]')); await sleep(80); noteIcons();
A("Settings shows the build", (q(".mv-set-build") || {}).textContent === "Build " + TALLY_BUILD, (q(".mv-set-build") || {}).textContent);
click(q(".mv-modal-head .mv-icobtn")); await sleep(60);
click(q('[aria-label="How to play"]')); await sleep(80); noteIcons();
click(q(".mv-modal-head .mv-icobtn")); await sleep(60);
for (const label of ["Daily", "Stats", "Map", "Shop"]) { click(navBtn(label)); await sleep(100); noteText(el); }
click(q(".mv-skincard")); await sleep(80); noteIcons(); noteText(el);   // the first pal's preview
click(q(".mv-preview-x")); await sleep(60);
click(qa(".mv-shoptab").find((b) => b.textContent.includes("Skins"))); await sleep(80);
click(q(".mv-skincard")); await sleep(80); noteIcons(); noteText(el);   // the first skin's preview
click(q(".mv-preview-x")); await sleep(60);
click(qa(".mv-shoptab").find((b) => b.textContent.includes("Boosts"))); await sleep(80); noteText(el);
A("every icon button has a name", unnamed.size === 0 && namedIcons.size >= 6, [...unnamed].join(" | ") + " named=" + namedIcons.size);
// every stamp moves together: package.json 0.N.0, sw.js CACHE tally-vN, register ./sw.js?v=N, TALLY_BUILD t(N-2)
{
  const fs = await import("node:fs");
  const minor = parseInt(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version.split(".")[1], 10);
  const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  A("the stamps move together", sw.includes(`var CACHE = "tally-v${minor}";`) && html.includes(`register('./sw.js?v=${minor}')`) && TALLY_BUILD === "t" + (minor - 2),
    `minor=${minor} build=${TALLY_BUILD}`);
}
const badText = [...seenText].filter((t) => BAD.test(t));
A("no ! or dash in any rendered text", badText.length === 0, badText.slice(0, 5).join(" | "));
const palBad = PALS.flatMap((p) => [...p.cheers, p.win]).filter((s) => BAD.test(s));
A("pal lines carry no ! or dash", palBad.length === 0, palBad.slice(0, 3).join(" | "));
A("rendered text was recorded", seenText.size > 40, "texts=" + seenText.size);

// Part 2: the board stands on its world's plate at the world's levels, and the Endless panel names its real levels
rootB.unmount();
const plates = [];
let rootC = null;
for (const L of [1, 8, 9, 48, 49, 57]) {
  if (rootC) rootC.unmount();
  el = document.createElement("div"); document.body.appendChild(el);
  seed = { seenIntro: true, level: L };
  rootC = mount(el);
  await waitFor(".mv-beacon-num"); await sleep(120);
  const b = q(".mv-board"), want = worldOfLevel(L).world.id;   // the world worked out here from config.js
  plates.push({ L, want, got: b && b.getAttribute("data-world"), url: b && b.style.getPropertyValue("--plate") });
}
A("the board's plate follows the world for levels 1, 8, 9, 48, 49, 57", plates.every((p) => p.got === p.want && p.url.indexOf("art/t1/worlds/" + p.want + ".webp") >= 0), JSON.stringify(plates.map((p) => p.L + ":" + p.got + "/" + p.want)));
click(navBtn("Map")); await sleep(150);
{ const w57 = worldOfLevel(57), panel = qa(".mv-mappanel").find((s) => s.getAttribute("data-world") === "endless" && s.textContent.indexOf("Levels " + w57.from + " to " + w57.to) >= 0);
  A("the Endless panel names its real levels (" + w57.from + " to " + w57.to + ")", !!panel && [...panel.querySelectorAll(".mv-lvl")].map((x) => x.querySelector(".mv-lvlnum") && x.querySelector(".mv-lvlnum").textContent).filter(Boolean).indexOf(String(w57.from)) >= 0, qa(".mv-mappanel").length + " panels"); }
rootC.unmount();

// Part 3: the splash plate leaves after mount; the daily card and the midnight regenerate; no confetti on a daily replay nor under reduced motion
{
  const DAILY_OPTS = { poolSize: 5, lo: 1, hi: 22, tMin: 12, tMax: 99, reqCap: 3 };
  const navBtn3 = (label) => qa(".mv-navbtn").find((b) => b.textContent.includes(label));
  const glyph = (g) => ({ "-": "−", "*": "×", "/": "÷", "x": "×" })[g] || g;
  async function playTokens(sols) {   // plays the puzzle's own solutions until Next appears
    const opNode = (g) => qa(".mv-op").find((b) => b.textContent === glyph(g));
    const tileNode = (v) => qa(".mv-tile").find((t) => parseInt(t.textContent, 10) === v);
    for (const sol of sols.slice(0, 12)) {
      for (const x of sol) { const n = (typeof x === "number") ? tileNode(x) : opNode(x); if (n) click(n); await sleep(20); }
      await sleep(400); if (q(".mv-ctrl.next")) break;
      const cl = qa(".mv-ctrl").find((b) => /Clear/.test(b.textContent)); if (cl && !cl.disabled) { click(cl); await sleep(30); }
    }
    if (q(".mv-ctrl.next")) { click(q(".mv-ctrl.next")); await sleep(150); }
  }
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  // a. the splash plate (index.html) is faded and removed once the game is up
  if (typeof rootC !== "undefined" && rootC) rootC.unmount();
  document.body.insertAdjacentHTML("beforeend", '<div id="mv-splashplate"></div>');
  el = document.createElement("div"); document.body.appendChild(el);
  seed = { seenIntro: true };
  let rootD = mount(el);
  await waitFor(".mv-beacon-num"); await sleep(500);
  A("Part 3: the splash plate is removed after mount", !document.getElementById("mv-splashplate"));
  // b. the daily card, then a new day while the tab is open makes a new daily
  click(navBtn3("Daily")); await sleep(150);
  const card = q(".mv-dailycard");
  A("Part 3: the daily card says the date, the state and the days played", !!card && /Daily for /.test(card.textContent) && /Not played yet/.test(card.textContent) && /days played/.test(card.textContent), card && card.textContent);
  const t1 = parseInt(q(".mv-beacon-num").textContent, 10);
  const RealDate = globalThis.Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + 86400000); } static now() { return RealDate.now() + 86400000; } }
  globalThis.Date = FakeDate; dom.window.Date = FakeDate;
  const tomorrow = new FakeDate(); const key2 = tomorrow.getFullYear() * 10000 + (tomorrow.getMonth() + 1) * 100 + tomorrow.getDate();
  dom.window.dispatchEvent(new dom.window.Event("focus")); await sleep(200);
  const t2 = parseInt(q(".mv-beacon-num").textContent, 10);
  const want2 = genPuzzle(key2, DAILY_OPTS).target;
  A("Part 3: the daily regenerates when the day changes while the tab is open (fake clock, +1 day, focus)", t2 === want2 && (t1 !== t2 || genPuzzle(key2 - 1, DAILY_OPTS).target === want2), `before ${t1} after ${t2} want ${want2}`);
  globalThis.Date = RealDate; dom.window.Date = RealDate;
  rootD.unmount();
  // c. a daily already done today: the win says replay and brings no confetti
  el = document.createElement("div"); document.body.appendChild(el);
  seed = { seenIntro: true, lastDaily: todayIso(), streak: 3 };
  rootD = mount(el);
  await waitFor(".mv-beacon-num"); await sleep(300);
  click(navBtn3("Daily")); await sleep(150);
  A("Part 3: the daily card says done today", /Done today/.test((q(".mv-dailycard") || {}).textContent || ""), (q(".mv-dailycard") || {}).textContent);
  {
    const P = genPuzzle(todayKey(), DAILY_OPTS);   // the puzzle's own solutions drive the board (the local solver stops at four numbers)
    await playTokens(P.solutions.map((x) => x.tokens));
    A("Part 3: a daily replay says so and brings no confetti", !!q(".mv-win-title") && /Replayed/.test((q(".mv-daily-note") || {}).textContent || "") && !q(".mv-confetti"), `win ${!!q(".mv-win-title")} finds ${qa(".mv-findchip").length} sols ${sols.length} note ${(q(".mv-daily-note") || {}).textContent} confetti ${!!q(".mv-confetti")}`);
  }
  rootD.unmount();
  // d. reduced motion: a campaign clear shows the pal's last pose, no star pop, no confetti
  el = document.createElement("div"); document.body.appendChild(el);
  seed = { seenIntro: true, motion: false };
  rootD = mount(el);
  await waitFor(".mv-beacon-num"); await sleep(300);
  {
    const P = genPuzzle(1001, levelOpts(1)); await playTokens(P.solutions.map((x) => x.tokens));
    A("Part 3: under reduced motion the win has no confetti and no star pop, and the pal holds its last win pose", !!q(".mv-win-title") && !q(".mv-confetti") && qa(".mv-starpop").length === 0 && /win_06\.webp$/.test((q(".mv-winpal img") || { getAttribute: () => "" }).getAttribute("src") || ""), (q(".mv-winpal img") || {}).getAttribute && q(".mv-winpal img").getAttribute("src"));
  }
  rootD.unmount();
}

rmSync(entry, { force: true }); rmSync(outfile, { force: true });
console.log("\n" + results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length} checks, ${fails} failures.`);
process.exit(fails ? 1 : 0);
