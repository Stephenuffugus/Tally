// MathVerse engine — pure puzzle logic. No React, no DOM. Keep it that way.
const OPS = ["+", "-", "×", "÷"];

function evalExpr(tokens) {
  // tokens: [num, op, num, op, ...]; op glyphs + - × ÷ with standard precedence
  if (tokens.length === 0 || tokens.length % 2 === 0) return NaN;
  const nums = [], ops = [];
  for (let i = 0; i < tokens.length; i++) (i % 2 === 0 ? nums : ops).push(tokens[i]);
  const vals = [nums[0]], add = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i], n = nums[i + 1];
    if (op === "×") vals[vals.length - 1] *= n;
    else if (op === "÷") vals[vals.length - 1] /= n;
    else { add.push(op); vals.push(n); }
  }
  let r = vals[0];
  for (let i = 0; i < add.length; i++) r = add[i] === "+" ? r + vals[i + 1] : r - vals[i + 1];
  return r;
}

// canonical signature so 18+2 and 2+18 count as one solution
function sigOf(nums, ops) {
  return [...nums].sort((a, b) => a - b).join(",") + "|" + [...ops].sort().join("");
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// enumerate every valid expression from a pool -> Map(value -> Map(sig -> solution))
function solveAll(pool) {
  const map = new Map();
  const idxs = [...pool.keys()];
  const opCombos = (len) => {
    if (len === 0) return [[]];
    const rest = opCombos(len - 1), out = [];
    for (const r of rest) for (const o of OPS) out.push([...r, o]);
    return out;
  };
  const perms = (k) => {
    const out = [], used = new Array(idxs.length).fill(false), cur = [];
    const rec = () => {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = 0; i < idxs.length; i++) if (!used[i]) { used[i] = true; cur.push(idxs[i]); rec(); cur.pop(); used[i] = false; }
    };
    rec(); return out;
  };
  const maxK = Math.min(pool.length, 5);
  for (let k = 2; k <= maxK; k++) {
    const ps = perms(k), ocs = opCombos(k - 1);
    for (const p of ps) {
      const numbers = p.map((i) => pool[i]);
      for (const oc of ocs) {
        const tokens = [];
        for (let i = 0; i < numbers.length; i++) { tokens.push(numbers[i]); if (i < oc.length) tokens.push(oc[i]); }
        const val = evalExpr(tokens);
        if (!Number.isFinite(val) || Math.abs(val - Math.round(val)) > 1e-9) continue;
        const v = Math.round(val);
        if (v < 0 || v > 300) continue;
        const sig = sigOf(numbers, oc);
        if (!map.has(v)) map.set(v, new Map());
        const m = map.get(v);
        if (!m.has(sig)) m.set(sig, { sig, tokens: tokens.slice(), count: k });
      }
    }
  }
  return map;
}

function pickDistinct(rng, n, lo, hi) {
  const s = new Set();
  let guard = 0;
  while (s.size < n && guard++ < 400) s.add(lo + Math.floor(rng() * (hi - lo + 1)));
  return [...s];
}

// Generate a puzzle with a target that has 2-6 clean solutions.
function genPuzzle(seed, opts) {
  const { poolSize, lo, hi, tMin, tMax, reqCap } = opts;
  const rng = mulberry32(seed >>> 0);
  for (let attempt = 0; attempt < 80; attempt++) {
    const pool = pickDistinct(rng, poolSize, lo, hi);
    if (pool.length < poolSize) continue;
    const all = solveAll(pool);
    const entries = [];
    for (const [v, m] of all) if (v >= tMin && v <= tMax) entries.push([v, m]);
    let cands = entries.filter(([, m]) => m.size >= 3 && m.size <= 6);
    if (cands.length === 0) cands = entries.filter(([, m]) => m.size >= 2 && m.size <= 8);
    if (cands.length === 0) continue;
    const [target, m] = cands[Math.floor(rng() * cands.length)];
    const sols = [...m.values()];
    const total = sols.length;
    const required = Math.min(reqCap, total);
    return {
      id: "p" + seed,
      pool: shuffleArr(pool, rng),
      target,
      solutions: sols,
      total,
      required,
      hasClean: sols.some((s) => s.count === 2),
    };
  }
  // safe fallback
  const pool = [2, 4, 6, 8, 10];
  const m = solveAll(pool).get(20);
  const sols = [...m.values()];
  return { id: "pfb" + seed, pool, target: 20, solutions: sols, total: sols.length, required: Math.min(3, sols.length), hasClean: sols.some((s) => s.count === 2) };
}

function shuffleArr(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function levelOpts(level) {
  if (level <= 2) return { poolSize: 4, lo: 1, hi: 12, tMin: 8, tMax: 40, reqCap: 2 };
  if (level <= 6) return { poolSize: 5, lo: 1, hi: 15, tMin: 10, tMax: 60, reqCap: 3 };
  if (level <= 14) return { poolSize: 5, lo: 1, hi: 20, tMin: 12, tMax: 80, reqCap: 3 };
  return { poolSize: 5, lo: 1, hi: 25, tMin: 14, tMax: 99, reqCap: 3 };
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function isoDay() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function daysBetween(aIso, bIso) {
  if (!aIso || !bIso) return Infinity;
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad), b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

export { OPS, evalExpr, sigOf, mulberry32, solveAll, pickDistinct, genPuzzle, shuffleArr, levelOpts, todayKey, isoDay, daysBetween };
