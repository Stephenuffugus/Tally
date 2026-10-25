// The pal animator on a fake clock: Astra's cadence, the priorities, the think pose, pause on hide.
// Expected timings are computed here from the numbers in her brief, never read back from the module.
import test from "node:test";
import assert from "node:assert/strict";
import { createPalAnimator, palMaySpeak } from "../src/palAnim.js";

const IDLE = [1800, 180, 100, 1800], CHEER = [100, 120, 180, 140], WIN = [90, 100, 140, 150, 120, 180], THINK = [800, 1100];

function clock() {
  let now = 0, id = 0; const timers = new Map();
  return {
    set: (fn, ms) => { id += 1; timers.set(id, { at: now + ms, fn }); return id; },
    clear: (t) => { timers.delete(t); },
    // advance time, firing timers in order (a fired timer may set new ones)
    tick(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [k, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [k, t];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
    get now() { return now; },
  };
}
function rig(opts = {}) {
  const c = clock(); const log = [];
  const a = createPalAnimator({ onFrame: (f) => log.push([c.now, f]), setTimer: c.set, clearTimer: c.clear, ...opts });
  return { c, a, log };
}

test("idle loops on 1800, 180, 100, 1800", () => {
  const { c, log } = rig();
  c.tick(IDLE.reduce((s, x) => s + x, 0) + 1);
  assert.deepEqual(log.map((x) => x[1]), ["idle_01", "idle_02", "idle_03", "idle_04", "idle_01"]);
  let t = 0; const at = [0]; for (const d of IDLE) { t += d; at.push(t); }
  assert.deepEqual(log.map((x) => x[0]), at);
});

test("a bank plays the cheer frames in order on her cadence, then idle", () => {
  const { c, a, log } = rig();
  c.tick(500); log.length = 0;
  a.event("solve");
  c.tick(CHEER.reduce((s, x) => s + x, 0));
  assert.deepEqual(log.map((x) => x[1]), ["cheer_01", "cheer_02", "cheer_03", "cheer_04", "idle_01"]);
  let t = 500; const at = [500]; for (const d of CHEER) { t += d; at.push(t); }
  assert.deepEqual(log.map((x) => x[0]), at);
});

test("one cheer queued at most", () => {
  const { c, a, log } = rig();
  a.event("solve"); a.event("solve"); a.event("solve"); a.event("solve");
  c.tick(5000);
  assert.equal(log.filter((x) => x[1] === "cheer_01").length, 2);
});

test("the results play the win frames and hold the sixth", () => {
  const { c, a, log } = rig();
  a.event("solve"); c.tick(150);
  a.event("win");                         // win outranks the cheer in flight
  c.tick(60000);
  const names = log.map((x) => x[1]);
  const w = names.indexOf("win_01");
  assert.deepEqual(names.slice(w), ["win_01", "win_02", "win_03", "win_04", "win_05", "win_06"]);
  assert.equal(a.state, "win");
  a.event("solve"); c.tick(1000);
  assert.equal(names.length, log.length, "a cheer never interrupts the held win");
  a.reset();
  assert.equal(log[log.length - 1][1], "idle_01");
});

test("think plays once after 18 s without input, never while quiet, again only after input", () => {
  const { c, a, log } = rig();
  c.tick(17999);
  assert.ok(!log.some((x) => x[1].startsWith("think")));
  c.tick(1);
  assert.equal(log[log.length - 1][1], "think_01");
  c.tick(THINK[0]);
  assert.equal(log[log.length - 1][1], "think_02");
  c.tick(THINK[1]);
  assert.equal(log[log.length - 1][1], "idle_01");
  c.tick(60000);
  assert.equal(log.filter((x) => x[1] === "think_01").length, 1, "once, until the player does something");
  a.input(); c.tick(18000);
  assert.equal(log.filter((x) => x[1] === "think_01").length, 2);
  const q = rig(); q.a.setQuiet(true); q.c.tick(40000);
  assert.ok(!q.log.some((x) => x[1].startsWith("think")), "never over a modal");
});

test("hidden pauses every timer and showing resumes", () => {
  const { c, a, log } = rig();
  a.event("solve"); c.tick(50);
  a.setHidden(true); const n = log.length; c.tick(60000);
  assert.equal(log.length, n);
  a.setHidden(false); c.tick(CHEER.reduce((s, x) => s + x, 0));
  assert.ok(log.slice(n).some((x) => x[1] === "cheer_04"));
});

test("reduced motion shows idle_01 only", () => {
  const { c, a, log } = rig({ still: true });
  a.event("solve"); a.event("win"); c.tick(60000);
  assert.deepEqual(log.map((x) => x[1]), ["idle_01"]);
});

test("the bubble speaks at most once per 6 s, a win always", () => {
  assert.equal(palMaySpeak("solve", null, 0), true);
  assert.equal(palMaySpeak("solve", 1000, 6999), false);
  assert.equal(palMaySpeak("solve", 1000, 7000), true);
  assert.equal(palMaySpeak("win", 1000, 1001), true);
});
