// DOM smoke test: bundles the real app, mounts it in jsdom, plays a full puzzle
// through the UI (clicks + keyboard), and checks persistence. `npm run test:dom`.
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evalExpr, OPS, sigOf } from "../src/engine.js";

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

let savedMeta = null;
dom.window.storage = {
  get: async () => ({ value: JSON.stringify({ seenIntro: true }) }),
  set: async (_k, v) => { savedMeta = v; return {}; },
  delete: async () => ({}), list: async () => ({ keys: [] }),
};

const require = createRequire(import.meta.url);
const { mount } = require(outfile);
const el = document.getElementById("root");
mount(el);

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

await sleep(250);
A("board renders", !!q(".mv-board"));
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

await play(sols[0]);
A("auto-commit banks a find", qa(".mv-findchip").length === 1);
await play(sols[1]);
A("second find banks", qa(".mv-findchip").length === 2);

const meta = savedMeta ? JSON.parse(savedMeta) : {};
A("finds persisted", Object.values(meta.finds || {})[0]?.length === 2);
A("coins persisted & increased", (meta.coins || 0) > 130, "coins=" + meta.coins);
A("companion pal present on board", !!q(".mv-pal"));
A("wallet marked first-solve earn moment", !!(meta.earns && meta.earns.first_solve));

const nextBtn = q(".mv-ctrl.next");
A("Next appears after clearing required", !!nextBtn);
if (nextBtn) { click(nextBtn); await sleep(120); }
A("win summary opens", !!q(".mv-win-title"));
key("Enter"); await sleep(150);
A("Enter advances to a fresh puzzle", !q(".mv-win-title") && qa(".mv-findchip").length === 0);
A("level persisted", JSON.parse(savedMeta).level === 2, "level=" + JSON.parse(savedMeta).level);

// Journey map + Pals shop (new screens)
const navBtn = (label) => qa(".mv-navbtn").find((b) => b.textContent.includes(label));
click(navBtn("Map")); await sleep(120);
A("Journey map renders worlds", qa(".mv-worldcard").length >= 1);
A("map shows level nodes", qa(".mv-lvlnode").length >= 8);
click(navBtn("Shop")); await sleep(120);
A("shop opens on Pals tab", qa(".mv-palface").length >= 1);
const skinsTab = qa(".mv-shoptab").find((b) => b.textContent.includes("Skins"));
click(skinsTab); await sleep(80);
A("shop can switch to Skins tab", qa(".mv-skinswatch").length >= 1);

rmSync(entry, { force: true }); rmSync(outfile, { force: true });
console.log("\n" + results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length} checks, ${fails} failures.`);
process.exit(fails ? 1 : 0);
