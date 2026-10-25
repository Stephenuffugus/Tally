/* ------------------------------ PAL ANIMATOR -------------------------------
   The equipped pal's painted frames on Astra's slow cadence. Pure (no React, no
   DOM): the timers are injected, so tests drive it with a fake clock.
   Priority: win over cheer over think over idle. One cheer queued at most. Win
   holds its last pose until reset(). Think plays once after THINK_AFTER ms with
   no input, never while quiet (a modal is up). Hidden pauses every timer.
   Cosmetic only: nothing here touches the puzzle, the score or the wallet. */
export const PAL_CADENCE = {
  idle: [1800, 180, 100, 1800],          // looped
  cheer: [100, 120, 180, 140],           // then idle (or the one queued cheer)
  win: [90, 100, 140, 150, 120, 180],    // holds the last pose
  think: [800, 1100],                    // once, then idle
};
export const PAL_THINK_AFTER = 18000;
export const PAL_SAY_GAP = 6000;         // the bubble speaks at most once per 6 s (a win always speaks)

export const palFrameName = (state, i) => state + "_" + String(i + 1).padStart(2, "0");

// May the bubble speak now? kind "win" always may.
export function palMaySpeak(kind, lastAt, now) {
  return kind === "win" || lastAt == null || now - lastAt >= PAL_SAY_GAP;
}

// onFrame(name) is called with every frame to show ("idle_01" ...).
export function createPalAnimator({ onFrame, setTimer = setTimeout, clearTimer = clearTimeout, still = false }) {
  let state = "idle", frame = 0, timer = null, thinkTimer = null;
  let queued = false, quiet = false, hidden = false, thoughtSinceInput = false, stopped = false;

  const show = () => onFrame(palFrameName(state, frame));
  const clear = () => { if (timer) { clearTimer(timer); timer = null; } };
  const clearThink = () => { if (thinkTimer) { clearTimer(thinkTimer); thinkTimer = null; } };

  function schedule() {
    clear();
    if (stopped || hidden || still) return;
    if (state === "win" && frame === PAL_CADENCE.win.length - 1) return;   // hold the last win pose
    timer = setTimer(step, PAL_CADENCE[state][frame]);
  }
  function step() {
    timer = null;
    const len = PAL_CADENCE[state].length;
    if (frame < len - 1) { frame += 1; show(); schedule(); return; }
    if (state === "idle") { frame = 0; show(); schedule(); return; }
    if (state === "cheer" && queued) { queued = false; frame = 0; show(); schedule(); return; }
    enter("idle");
  }
  function enter(s) {
    state = s; frame = 0; show(); schedule();
    if (s === "idle") armThink();
  }
  function armThink() {
    clearThink();
    if (stopped || still || hidden || quiet || thoughtSinceInput) return;
    thinkTimer = setTimer(() => {
      thinkTimer = null;
      if (state === "idle" && !quiet && !hidden) { thoughtSinceInput = true; enter("think"); }
    }, PAL_THINK_AFTER);
  }

  show();
  schedule();
  armThink();

  return {
    // "solve" (a bank) or "win" (the results)
    event(kind) {
      if (stopped || still) return;
      if (kind === "win") { queued = false; clearThink(); enter("win"); return; }
      if (state === "win") return;                       // win outranks a cheer
      if (state === "cheer") { queued = true; return; }  // one cheer queued at most
      clearThink(); enter("cheer");
    },
    // any player input: the think clock starts again
    input() { thoughtSinceInput = false; if (state === "idle") armThink(); },
    setQuiet(q) { quiet = !!q; if (quiet) clearThink(); else if (state === "idle") armThink(); },
    setHidden(h) {
      hidden = !!h;
      if (hidden) { clear(); clearThink(); }
      else { schedule(); if (state === "idle") armThink(); }
    },
    // a new puzzle: back to idle from anything (the held win pose included)
    reset() { queued = false; thoughtSinceInput = false; clearThink(); enter("idle"); },
    stop() { stopped = true; clear(); clearThink(); },
    get state() { return state; },
  };
}
