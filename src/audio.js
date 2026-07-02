/* --------------------------------- audio ---------------------------------- */
let AC = null;
function tone(freq, dur, type = "sine", vol = 0.06, slideTo = null) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* no audio */ }
}
const sfx = {
  place: (on) => on && tone(520, 0.08, "sine", 0.05, 640),
  op: (on) => on && tone(360, 0.06, "triangle", 0.045),
  good: (on) => on && [660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.14, "sine", 0.06), i * 80)),
  win: (on) => on && [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, "sine", 0.07), i * 100)),
  err: (on) => on && tone(200, 0.16, "sawtooth", 0.04, 150),
  buy: (on) => on && [700, 1000].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle", 0.06), i * 70)),
};
// gentle haptics on supporting devices; respects the in-game toggle, no-ops elsewhere
function buzz(pattern, on = true) {
  try { if (on && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* none */ }
}

export { tone, sfx, buzz };
