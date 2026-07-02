import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Coins, Gem, Flame, Settings, X, Star, Lock, Check, Undo2, Trash2, Shuffle,
  Lightbulb, Home, Calendar, Store, BarChart3, ChevronRight, Volume2,
  VolumeX, Sparkles, Trophy, Share2, Palette, Zap, HelpCircle, Vibrate,
  Map as MapIcon, Users, Heart, LogOut,
} from "lucide-react";

/* ============================================================================
   Tally — a cozy number puzzle for all ages. Reach the target by arranging the
   numbers, then find every way. Core loop + worlds journey + skins & pals shop
   + streaks + daily challenge + persistence, wired for the Sky Wolf portal.
   ========================================================================== */

import { OPS, evalExpr, sigOf, genPuzzle, shuffleArr, levelOpts, todayKey, isoDay, daysBetween } from "./engine.js";
import { SKINS, skinById, PALS, palById, WORLDS, WORLD_SIZE, worldOfLevel, ECONOMY } from "./config.js";
import { DEFAULT_META, loadMeta, saveMeta } from "./storage.js";
import { createWallet, STREAK_MILESTONES } from "./wallet.js";
import { sfx, buzz } from "./audio.js";

const pidOf = (level) => "p" + (1000 + level);

/* ================================ COMPONENT =============================== */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [meta, setMetaState] = useState(DEFAULT_META);
  const [screen, setScreen] = useState("play"); // play | map | daily | shop | stats
  const [overlay, setOverlay] = useState(null);  // null | win | settings | howto | skin:<id> | pal:<id>
  const [toast, setToast] = useState(null);
  const [particles, setParticles] = useState([]);
  const [winData, setWinData] = useState(null);
  const [shakeTarget, setShakeTarget] = useState(false);
  const [banking, setBanking] = useState(false); // brief lock while a solved equation banks

  const [campaign, setCampaign] = useState(null);
  const [campaignLevel, setCampaignLevel] = useState(1); // the level currently loaded on the board (may be a replay)
  const [daily, setDaily] = useState(null);
  const [builder, setBuilder] = useState([]); // tokens: {t:'num',v,i}|{t:'op',v}
  const [finds, setFinds] = useState({});     // pid -> [sig]
  const [reveals, setReveals] = useState({}); // pid -> [sig]  (hint reveals)
  const [palSay, setPalSay] = useState(null); // {text, id} — companion speech bubble
  const toastTimer = useRef(null);
  const palTimer = useRef(null);
  const comboRef = useRef({ n: 0, t: 0 });   // rapid-solve chain

  // load
  useEffect(() => {
    let go = true;
    loadMeta().then((m) => {
      if (!go) return;
      setMetaState(m);
      setFinds(m.finds || {});
      setCampaignLevel(m.level);
      setCampaign(genPuzzle(1000 + m.level, levelOpts(m.level)));
      setDaily(genPuzzle(todayKey(), { poolSize: 5, lo: 1, hi: 22, tMin: 12, tMax: 99, reqCap: 3 }));
      setLoaded(true);
      if (!m.seenIntro) setOverlay("howto");
    });
    return () => { go = false; };
  }, []);

  const setMeta = useCallback((updater) => {
    setMetaState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveMeta(next);
      return next;
    });
  }, []);

  // The Wallet is the single choke point for all earning + sunbeam moments.
  const wallet = useMemo(() => createWallet(setMeta), [setMeta]);
  const markEarn = useCallback((type, key, detail) =>
    wallet.noteMoment(type, key, meta.earns, detail), [wallet, meta.earns]);

  // Equipped companion "cheers" the player on. Cosmetic only.
  const pal = palById(meta.pal);
  const palCheer = useCallback((kind) => {
    const p = palById(meta.pal);
    if (!p) return;
    const text = kind === "win" ? p.win : p.cheers[Math.floor(Math.random() * p.cheers.length)];
    setPalSay({ text, id: Math.random() });
    if (palTimer.current) clearTimeout(palTimer.current);
    palTimer.current = setTimeout(() => setPalSay(null), kind === "win" ? 2600 : 1500);
  }, [meta.pal]);

  // Switch top-level screens. ALWAYS clears any overlay first so a screen change
  // can never leave a translucent overlay painted on top (Sky Wolf nav rule).
  const go = useCallback((s) => { setOverlay(null); setScreen(s); }, []);

  // persist solutions found for the active puzzles, so progress survives reloads
  useEffect(() => {
    if (!loaded) return;
    const keep = {};
    if (campaign && finds[campaign.id]) keep[campaign.id] = finds[campaign.id];
    if (daily && finds[daily.id]) keep[daily.id] = finds[daily.id];
    setMeta((m) => ({ ...m, finds: keep }));
  }, [finds, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const boostActive = meta.boostUntil > Date.now();
  // All coin earning routes through the Wallet (which applies the 2× boost).
  const addCoins = useCallback((n) => wallet.addCoins(n, boostActive), [wallet, boostActive]);

  const showToast = useCallback((msg, kind = "info") => {
    setToast({ msg, kind, id: Math.random() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const activePuzzle = screen === "daily" ? daily : campaign;
  const pid = activePuzzle?.id;

  // reset builder when active puzzle changes
  useEffect(() => { setBuilder([]); comboRef.current = { n: 0, t: 0 }; }, [pid]);

  const theme = skinById(meta.skin).v;
  const rootStyle = useMemo(() => {
    const s = {};
    Object.entries(theme).forEach(([k, val]) => { s["--" + k] = val; });
    return s;
  }, [theme]);
  useEffect(() => { try { document.body.style.background = theme.bg; } catch (e) { /* sandboxed */ } }, [theme]);

  const foundSigs = pid ? (finds[pid] || []) : [];
  const revealSigs = pid ? (reveals[pid] || []) : [];
  const usedIdx = useMemo(() => new Set(builder.filter((t) => t.t === "num").map((t) => t.i)), [builder]);
  const plainTokens = useMemo(() => builder.map((t) => t.v), [builder]);
  const liveVal = useMemo(() => {
    const last = builder[builder.length - 1];
    if (!builder.length || (last && last.t === "op")) {
      // evaluate the completed prefix (drop trailing op)
      const pre = last && last.t === "op" ? builder.slice(0, -1).map((t) => t.v) : plainTokens;
      const v = evalExpr(pre); return Number.isFinite(v) ? v : null;
    }
    const v = evalExpr(plainTokens); return Number.isFinite(v) ? v : null;
  }, [builder, plainTokens]);
  const complete = builder.length >= 3 && builder[builder.length - 1]?.t === "num";
  const completeWrong = complete && liveVal !== activePuzzle?.target;
  const cleared = !!activePuzzle && foundSigs.length >= activePuzzle.required;

  const sound = meta.sound;
  const motion = meta.motion;
  const hapt = meta.haptics;

  // keyboard play (desktop): 1-5 pick tiles clockwise from top, + - * / (or x) operators,
  // Backspace undo, Esc clear, S shuffle, Enter advances when cleared / on the win screen
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (overlay === "win") { if (e.key === "Enter") nextLevel(); return; }
      if (overlay || (screen !== "play" && screen !== "daily")) return;
      const k = e.key;
      if (k === "+") tapOp("+");
      else if (k === "-") tapOp("-");
      else if (k === "*" || k === "x" || k === "X") tapOp("×");
      else if (k === "/") { e.preventDefault(); tapOp("÷"); }
      else if (k === "Backspace") { e.preventDefault(); undo(); }
      else if (k === "Escape") clearB();
      else if (k === "s" || k === "S") shuffleCircle();
      else if (k === "Enter" && cleared) openSummary();
      else if (/^[1-9]$/.test(k)) {
        const pos = Number(k) - 1;
        if (activePuzzle && pos < activePuzzle.pool.length) tapNumber(activePuzzle.pool[pos], pos);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ------------------------------ actions ------------------------------- */
  function tapNumber(v, i) {
    if (banking || usedIdx.has(i)) return;
    const last = builder[builder.length - 1];
    if (!(builder.length === 0 || (last && last.t === "op"))) {
      showToast("Add an operator first", "warn");
      return;
    }
    const next = [...builder, { t: "num", v, i }];
    setBuilder(next);
    sfx.place(sound);
    const val = evalExpr(next.map((t) => t.v));
    if (Number.isFinite(val) && val === activePuzzle.target) autoCommit(next);
  }
  function tapOp(op) {
    if (banking) return;
    const last = builder[builder.length - 1];
    if (last && last.t === "num") { setBuilder((b) => [...b, { t: "op", v: op }]); sfx.op(sound); }
    else showToast("Place a number first", "warn");
  }
  function undo() { if (!banking) setBuilder((b) => b.slice(0, -1)); }
  function clearB() { if (!banking) setBuilder([]); }

  // A complete expression reached the target — bank it automatically (no submit button).
  function autoCommit(nextBuilder) {
    const nums = nextBuilder.filter((t) => t.t === "num").map((t) => t.v);
    const ops = nextBuilder.filter((t) => t.t === "op").map((t) => t.v);
    const sig = sigOf(nums, ops);
    setBanking(true);
    if (foundSigs.includes(sig)) {
      showToast("Already found that one", "info");
      sfx.op(sound);
      setTimeout(() => { setBuilder([]); setBanking(false); }, 260);
      return;
    }
    const wasComplete = foundSigs.length >= activePuzzle.required;
    const isBonus = wasComplete;
    const gained = isBonus ? addCoins(ECONOMY.BONUS_COINS) : addCoins(ECONOMY.SOLVE_COINS);
    if (isBonus) setMeta((m) => ({ ...m, bonus: m.bonus + 1 }));
    const nextFound = [...foundSigs, sig];
    const justCleared = !wasComplete && nextFound.length >= activePuzzle.required;
    setFinds((f) => ({ ...f, [pid]: nextFound }));
    markEarn("first_solve", "first_solve");            // first solution ever (sunbeam moment)
    palCheer("solve");
    if (justCleared) {
      sfx.good(sound);
      buzz([20, 60, 30], hapt);
      if (screen === "play") markEarn("level_clear", "level_clear:" + campaignLevel, { level: campaignLevel });
      showToast("All required found — keep going or tap Next!", "good");
    } else {
      sfx.good(sound);
      buzz(15, hapt);
      showToast(`${isBonus ? "Bonus find" : "Solved"}  +${gained} 🪙`, "good");
    }
    setTimeout(() => {
      setBuilder([]); setBanking(false);
      if (nextFound.length >= activePuzzle.total) finishPuzzle(nextFound); // found every solution — wrap up
    }, 300);
  }

  // Player taps Next once required (or more) solutions are found → tally + summary.
  function openSummary() {
    if (!activePuzzle || foundSigs.length < activePuzzle.required) return;
    finishPuzzle(foundSigs);
  }
  function shuffleCircle() {
    if (!activePuzzle || banking) return;
    const newPool = shuffleArr(activePuzzle.pool);
    // keep the builder valid: pool values are distinct, so remap indices by value
    setBuilder((b) => b.map((t) => (t.t === "num" ? { ...t, i: newPool.indexOf(t.v) } : t)));
    const p = { ...activePuzzle, pool: newPool };
    screen === "daily" ? setDaily(p) : setCampaign(p);
  }

  function finishPuzzle(nextFound) {
    const p = activePuzzle;
    const bonusCount = Math.max(0, nextFound.length - p.required);
    const hasTwoNumFind = nextFound.some((sig) => {
      const sol = p.solutions.find((s) => s.sig === sig);
      return sol && sol.count === 2;
    });
    const star1 = true;
    const star2 = p.hasClean ? hasTwoNumFind : nextFound.length >= p.required + 1;
    const star3 = bonusCount >= 2 || nextFound.length === p.total;
    const stars = (star1 ? 1 : 0) + (star2 ? 1 : 0) + (star3 ? 1 : 0);

    // rewards
    const starBonus = stars * ECONOMY.STAR_COINS;
    let extra = starBonus;
    let dailyMsg = null;
    if (screen === "daily") {
      const today = isoDay();
      const alreadyToday = meta.lastDaily === today;
      const gap = daysBetween(meta.lastDaily, today);
      // compute the streak we're about to land on (for sunbeam milestone check)
      const newStreak = alreadyToday ? meta.streak : (gap === 1 || (gap > 1 && meta.freezes > 0)) ? meta.streak + 1 : 1;
      setMeta((m) => {
        if (m.lastDaily === today) return m; // already counted today — no double credit
        const g = daysBetween(m.lastDaily, today);
        let streak, freezes = m.freezes;
        if (g === 1) streak = m.streak + 1;              // consecutive day
        else if (g > 1 && freezes > 0) { freezes -= 1; streak = m.streak + 1; }
        else streak = 1;                                  // first daily, or a missed gap with no freeze
        const best = Math.max(m.best, streak);
        return { ...m, streak, best, freezes, lastDaily: today, gems: m.gems + ECONOMY.DAILY_GEMS };
      });
      if (!alreadyToday) {
        markEarn("daily_done", "daily_done:" + today, { streak: newStreak });          // once per day
        if (STREAK_MILESTONES.includes(newStreak)) markEarn("streak_milestone", "streak:" + newStreak, { streak: newStreak });
      }
      dailyMsg = alreadyToday
        ? "Replayed today's daily"
        : (gap > 1 && meta.freezes > 0)
          ? "Streak Freeze saved your streak! +1 💎"
          : "Daily done — streak kept! +1 💎";
    }
    const coinGain = addCoins(extra);

    setMeta((m) => {
      const key = p.id;
      const prevStars = m.stars[key] || 0;
      return {
        ...m,
        stars: { ...m.stars, [key]: Math.max(prevStars, stars) },
        solved: m.solved + 1,
      };
    });

    // sunbeam moments: 3-star, and finishing the last level of a world
    if (stars === 3) markEarn("three_star", "three_star:" + p.id, { stars });
    if (screen === "play" && campaignLevel % WORLD_SIZE === 0) {
      const w = worldOfLevel(campaignLevel);
      markEarn("world_clear", "world_clear:" + w.world.id, { world: w.world.id });
    }

    sfx.win(sound);
    buzz([25, 70, 25, 70, 50], hapt);
    burst();
    palCheer("win");
    setWinData({ stars, star1, star2, star3, bonusCount, total: p.total, found: nextFound.length, required: p.required, coinGain, target: p.target, mode: screen, dailyMsg });
    setOverlay("win");
  }

  function burst() {
    if (!motion) return;
    const arr = Array.from({ length: 16 }, (_, i) => ({
      id: Math.random(), left: 15 + Math.random() * 70, delay: Math.random() * 0.3,
      dur: 1.1 + Math.random() * 0.9, size: 5 + Math.random() * 8, drift: (Math.random() - 0.5) * 60,
    }));
    setParticles(arr);
    setTimeout(() => setParticles([]), 2400);
  }

  function nextLevel() {
    setOverlay(null); setWinData(null);
    if (screen === "daily") { setScreen("play"); return; }
    const nl = campaignLevel + 1;
    setCampaignLevel(nl);
    setMeta((m) => ({ ...m, level: Math.max(m.level, nl) })); // unlock the frontier as it advances
    setCampaign(genPuzzle(1000 + nl, levelOpts(nl)));
  }

  // Load any unlocked level from the Journey map (replay or jump ahead to frontier).
  function playLevel(lvl) {
    if (lvl > meta.level) return;
    setCampaignLevel(lvl);
    setCampaign(genPuzzle(1000 + lvl, levelOpts(lvl)));
    go("play");
  }

  function useHint() {
    if (!activePuzzle) return;
    const remaining = activePuzzle.required - foundSigs.length;
    if (remaining <= 0) { showToast("Required already solved", "info"); return; }
    const cost = ECONOMY.HINT_COST;
    if (meta.coins < cost) { showToast("Not enough coins for a hint", "warn"); setScreen("shop"); return; }
    // reveal one unfound required solution (auto-solves a slot, no reward)
    const unfound = activePuzzle.solutions.filter((s) => !foundSigs.includes(s.sig));
    if (!unfound.length) return;
    const pick = unfound.sort((a, b) => a.count - b.count)[0];
    setMeta((m) => ({ ...m, coins: m.coins - cost }));
    const nf = [...foundSigs, pick.sig];
    setFinds((f) => ({ ...f, [pid]: nf }));
    setReveals((r) => ({ ...r, [pid]: [...(r[pid] || []), pick.sig] }));
    showToast(`Hint revealed one solution (−${cost} 🪙)`, "info");
    if (nf.length >= activePuzzle.required) setTimeout(() => showToast("All required found — tap Next!", "good"), 1000);
  }

  function buySkin(skin) {
    if (meta.owned.includes(skin.id)) { setMeta((m) => ({ ...m, skin: skin.id })); showToast(`${skin.name} equipped`, "good"); return; }
    const bal = skin.currency === "gems" ? meta.gems : meta.coins;
    if (bal < skin.price) { showToast(`Need more ${skin.currency}`, "warn"); return; }
    setMeta((m) => ({
      ...m,
      coins: skin.currency === "coins" ? m.coins - skin.price : m.coins,
      gems: skin.currency === "gems" ? m.gems - skin.price : m.gems,
      owned: [...m.owned, skin.id], skin: skin.id,
    }));
    sfx.buy(sound); showToast(`${skin.name} unlocked & equipped!`, "good");
    markEarn("skin_unlock", "skin_unlock:" + skin.id, { id: skin.id });
  }
  function buyPal(p) {
    if (meta.ownedPals.includes(p.id)) { setMeta((m) => ({ ...m, pal: p.id })); showToast(`${p.name} is cheering you on!`, "good"); palCheer("solve"); return; }
    const bal = p.currency === "gems" ? meta.gems : meta.coins;
    if (bal < p.price) { showToast(`Need more ${p.currency}`, "warn"); return; }
    setMeta((m) => ({
      ...m,
      coins: p.currency === "coins" ? m.coins - p.price : m.coins,
      gems: p.currency === "gems" ? m.gems - p.price : m.gems,
      ownedPals: [...m.ownedPals, p.id], pal: p.id,
    }));
    sfx.buy(sound); showToast(`${p.name} joined your team!`, "good");
    markEarn("pal_unlock", "pal_unlock:" + p.id, { id: p.id });
    palCheer("solve");
  }
  function equipPal(id) { setMeta((m) => ({ ...m, pal: id })); showToast(`${palById(id).name} equipped`, "good"); }
  function buyFreeze() {
    const cost = ECONOMY.FREEZE_COST_GEMS;
    if (meta.gems < cost) { showToast(`Need ${cost} 💎`, "warn"); return; }
    setMeta((m) => ({ ...m, gems: m.gems - cost, freezes: m.freezes + 1 }));
    sfx.buy(sound); showToast("Streak Freeze added", "good");
  }
  function buyBoost() {
    const cost = ECONOMY.BOOST_COST_GEMS;
    if (meta.gems < cost) { showToast(`Need ${cost} 💎`, "warn"); return; }
    setMeta((m) => ({ ...m, gems: m.gems - cost, boostUntil: Date.now() + ECONOMY.BOOST_HOURS * 3600 * 1000 }));
    sfx.buy(sound); showToast("Double Coins active for 24h!", "good");
  }

  function shareResult() {
    if (!winData) return;
    const starStr = "★".repeat(winData.stars) + "☆".repeat(3 - winData.stars);
    const label = winData.mode === "daily" ? `Daily #${todayKey()}` : `Level ${meta.level}`;
    const txt = `Tally — ${label}\n🎯 ${winData.target}   ${starStr}\n🧩 ${winData.found}/${winData.total} solutions found\nStreak 🔥 ${meta.streak}`;
    try { navigator.clipboard?.writeText(txt); showToast("Result copied!", "good"); }
    catch (e) { showToast("Copy not available here", "warn"); }
  }

  /* ------------------------------ rendering ----------------------------- */
  if (!loaded || !activePuzzle) {
    return (
      <div className="mv-root mv-splash" style={rootStyle}>
        <StyleTag />
        <div className="mv-splash-logo"><span>Ta</span><b>lly</b></div>
        <div className="mv-splash-sub">arranging the numbers…</div>
      </div>
    );
  }

  return (
    <div className={"mv-root" + (motion ? "" : " mv-nomotion")} style={rootStyle}>
      <StyleTag />

      {/* top bar */}
      <header className="mv-top">
        <div className="mv-brand"><span>Ta</span><b>lly</b></div>
        <div className="mv-wallet">
          {boostActive && <span className="mv-chip mv-boost" title="Double coins active"><Zap size={13} /> 2×</span>}
          <span className="mv-chip"><Flame size={14} className="mv-flame" /> {meta.streak}</span>
          <span className="mv-chip"><Coins size={14} /> {meta.coins}</span>
          <span className="mv-chip"><Gem size={14} /> {meta.gems}</span>
          <button className="mv-icobtn" onClick={() => setOverlay("howto")} aria-label="How to play"><HelpCircle size={17} /></button>
          <button className="mv-icobtn" onClick={() => setOverlay("settings")} aria-label="Settings"><Settings size={17} /></button>
        </div>
      </header>

      {/* main */}
      <main className="mv-main">
        {(screen === "play" || screen === "daily") && (
          <Board
            puzzle={activePuzzle}
            screen={screen}
            level={campaignLevel}
            pal={pal}
            palSay={palSay}
            builder={builder}
            liveVal={liveVal}
            foundSigs={foundSigs}
            revealSigs={revealSigs}
            usedIdx={usedIdx}
            shakeTarget={shakeTarget}
            completeWrong={completeWrong}
            banking={banking}
            cleared={cleared}
            onNum={tapNumber}
            onOp={tapOp}
            onUndo={undo}
            onClear={clearB}
            onShuffle={shuffleCircle}
            onHint={useHint}
            onNext={openSummary}
            onOpenMap={() => go("map")}
          />
        )}
        {screen === "map" && (
          <Journey meta={meta} campaignLevel={campaignLevel} onPlay={playLevel} />
        )}
        {screen === "shop" && (
          <Shop meta={meta} boostActive={boostActive}
            onBuySkin={buySkin} onEquipSkin={(id) => setMeta((m) => ({ ...m, skin: id }))} onPreviewSkin={(id) => setOverlay("skin:" + id)}
            onBuyPal={buyPal} onEquipPal={equipPal} onPreviewPal={(id) => setOverlay("pal:" + id)}
            onFreeze={buyFreeze} onBoost={buyBoost} />
        )}
        {screen === "stats" && <Stats meta={meta} />}
      </main>

      {/* particles */}
      {particles.map((p) => (
        <span key={p.id} className="mv-mote" style={{
          left: p.left + "%", width: p.size, height: p.size,
          animationDelay: p.delay + "s", animationDuration: p.dur + "s",
          "--drift": p.drift + "px",
        }} />
      ))}

      {/* toast */}
      {toast && <div className={"mv-toast mv-toast-" + toast.kind} key={toast.id} role="status" aria-live="polite">{toast.msg}</div>}

      {/* bottom nav */}
      <nav className="mv-nav">
        <NavBtn active={screen === "play"} onClick={() => go("play")} icon={<Home size={20} />} label="Play" />
        <NavBtn active={screen === "map"} onClick={() => go("map")} icon={<MapIcon size={20} />} label="Map" />
        <NavBtn active={screen === "daily"} onClick={() => go("daily")} icon={<Calendar size={20} />} label="Daily"
          badge={meta.lastDaily !== isoDay()} />
        <NavBtn active={screen === "shop"} onClick={() => go("shop")} icon={<Store size={20} />} label="Shop" />
        <NavBtn active={screen === "stats"} onClick={() => go("stats")} icon={<BarChart3 size={20} />} label="Stats" />
      </nav>

      {/* overlays */}
      {overlay === "win" && winData && (
        <WinOverlay data={winData} onNext={nextLevel} onShare={shareResult} onClose={() => setOverlay(null)} mode={screen} />
      )}
      {overlay === "settings" && (
        <SettingsOverlay meta={meta} onClose={() => setOverlay(null)}
          onToggleSound={() => setMeta((m) => ({ ...m, sound: !m.sound }))}
          onToggleMotion={() => setMeta((m) => ({ ...m, motion: !m.motion }))}
          onToggleHaptics={() => setMeta((m) => ({ ...m, haptics: !m.haptics }))}
          onExit={() => { try { window.SWS_EXIT && window.SWS_EXIT(); } catch (e) { /* standalone */ } }}
          onReset={() => { setMeta({ ...DEFAULT_META }); setFinds({}); setReveals({}); setCampaignLevel(1); setCampaign(genPuzzle(1001, levelOpts(1))); setOverlay(null); go("play"); showToast("Progress reset", "info"); }} />
      )}
      {overlay === "howto" && (
        <HowToOverlay onClose={() => { setOverlay(null); if (!meta.seenIntro) setMeta((m) => ({ ...m, seenIntro: true })); }} />
      )}
      {typeof overlay === "string" && overlay.startsWith("skin:") && (
        <SkinPreview skin={skinById(overlay.slice(5))} owned={meta.owned.includes(overlay.slice(5))}
          meta={meta} onBuy={(s) => { buySkin(s); setOverlay(null); }} onClose={() => setOverlay(null)} />
      )}
      {typeof overlay === "string" && overlay.startsWith("pal:") && (
        <PalPreview pal={palById(overlay.slice(4))} owned={meta.ownedPals.includes(overlay.slice(4))}
          meta={meta} onBuy={(p) => { buyPal(p); setOverlay(null); }} onClose={() => setOverlay(null)} />
      )}
    </div>
  );
}

/* ------------------------------- BOARD ------------------------------------ */
function Board(props) {
  const { puzzle, screen, level, pal, palSay, builder, liveVal, foundSigs, revealSigs, usedIdx,
    shakeTarget, completeWrong, banking, cleared, onNum, onOp, onUndo, onClear, onShuffle, onHint, onNext, onOpenMap } = props;

  // Size the number ring to exactly the space left over, so the whole board
  // always fits on one screen with no scrolling and tiles never overlap.
  const regionRef = useRef(null);
  const [cd, setCd] = useState(230);
  useEffect(() => {
    const el = regionRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const d = Math.max(140, Math.min(Math.floor(Math.min(r.width, r.height) * 0.94), 360));
      setCd(d);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = puzzle.pool.length;
  const positions = puzzle.pool.map((_, i) => {
    const ang = (-90 + (i * 360) / n) * Math.PI / 180;
    return { x: 50 + 37 * Math.cos(ang), y: 50 + 37 * Math.sin(ang) };
  });

  const bonusCount = Math.max(0, foundSigs.length - puzzle.required);
  const foundSolutions = foundSigs.map((sig) => puzzle.solutions.find((s) => s.sig === sig)).filter(Boolean);
  const showEq = builder.length > 0;

  return (
    <div className="mv-board">
      {/* mode + progress */}
      <div className="mv-mode-row">
        {screen === "daily" ? (
          <span className="mv-eyebrow">Daily Challenge</span>
        ) : (
          <button className="mv-eyebrow mv-eyebrow-btn" onClick={onOpenMap} aria-label="Open the world map">
            <MapIcon size={12} /> Level {level}
          </button>
        )}
        <span className="mv-progress">
          {Array.from({ length: puzzle.required }).map((_, i) => (
            <span key={i} className={"mv-pdot" + (i < Math.min(foundSigs.length, puzzle.required) ? " on" : "")} />
          ))}
          {bonusCount > 0 && <span className="mv-pbonus"><Sparkles size={11} /> {bonusCount}</span>}
        </span>
      </div>

      {/* target beacon */}
      <div className="mv-target-wrap">
        <div className={"mv-beacon" + (shakeTarget ? " mv-shake" : "")}>
          <span className="mv-beacon-label">make</span>
          <span className="mv-beacon-num">{puzzle.target}</span>
        </div>
      </div>

      {/* found solutions — single compact scroll row */}
      <div className="mv-finds" role="list">
        {foundSolutions.length === 0 && <span className="mv-finds-empty">find {puzzle.required} ways to reach {puzzle.target}</span>}
        {foundSolutions.map((sol, i) => (
          <span key={i} className={"mv-findchip" + (revealSigs.includes(sol.sig) ? " revealed" : "")} role="listitem">
            <Check size={12} /> {exprText(sol.tokens)}
          </span>
        ))}
      </div>

      {/* equation builder + live total */}
      <div className={"mv-builder" + (completeWrong ? " wrong" : "") + (banking ? " bank" : "")}>
        <div className="mv-builder-eq-area">
          {!showEq ? (
            <span className="mv-builder-hint">tap a number to start</span>
          ) : (
            builder.map((t, i) => (
              <span key={i} className={t.t === "num" ? "mv-tok-num" : "mv-tok-op"}>{t.v === "-" ? "−" : t.v}</span>
            ))
          )}
        </div>
        <div className="mv-builder-total">
          <span className="mv-eq-sign">=</span>
          <b>{showEq ? (liveVal ?? "?") : "—"}</b>
        </div>
      </div>

      {/* operators */}
      <div className="mv-ops">
        {OPS.map((op) => (
          <button key={op} className="mv-op" onClick={() => onOp(op)} aria-label={"operator " + op}>{op === "-" ? "−" : op}</button>
        ))}
      </div>

      {/* number ring — fills remaining space */}
      <div className="mv-circle-region" ref={regionRef}>
        <div className="mv-circle" style={{ width: cd, height: cd, "--cd": cd + "px" }}>
          {puzzle.pool.map((v, i) => (
            <button key={i} className={"mv-tile" + (usedIdx.has(i) ? " used" : "")}
              style={{ left: positions[i].x + "%", top: positions[i].y + "%" }}
              onClick={() => onNum(v, i)} aria-label={"number " + v}>
              <span>{v}</span>
            </button>
          ))}
          <button className="mv-center" onClick={onShuffle} aria-label="Shuffle numbers"><Shuffle size={18} /></button>
        </div>
      </div>

      {/* controls */}
      <div className="mv-controls">
        <button className="mv-ctrl" onClick={onUndo} disabled={!builder.length} aria-label="Undo last"><Undo2 size={16} /> Undo</button>
        <button className="mv-ctrl" onClick={onClear} disabled={!builder.length} aria-label="Clear all"><Trash2 size={16} /> Clear</button>
        {cleared ? (
          <button className="mv-ctrl next" onClick={onNext} aria-label="Finish and see results">Next <ChevronRight size={16} /></button>
        ) : (
          <button className="mv-ctrl hint" onClick={onHint} aria-label="Buy a hint for 25 coins"><Lightbulb size={16} /> Hint <em>{ECONOMY.HINT_COST}</em></button>
        )}
      </div>

      {/* companion Pal — cheers the player on. Cosmetic only, absolutely placed. */}
      {pal && (
        <div className="mv-pal" style={{ "--pc": pal.color }}>
          {palSay && <div className="mv-pal-bubble" key={"say-" + palSay.id}>{palSay.text}</div>}
          <div className={"mv-pal-face" + (palSay ? " cheer" : "")} key={"face-" + ((palSay && palSay.id) || "idle")} aria-hidden="true">{pal.face}</div>
        </div>
      )}
    </div>
  );
}

function exprText(tokens) {
  return tokens.map((t) => (t === "-" ? "−" : t)).join(" ");
}

/* -------------------------------- SHOP ------------------------------------ */
function Shop({ meta, boostActive, onBuySkin, onEquipSkin, onPreviewSkin, onBuyPal, onEquipPal, onPreviewPal, onFreeze, onBoost }) {
  const [tab, setTab] = useState("pals");
  return (
    <div className="mv-page">
      <div className="mv-shoptabs" role="tablist">
        <button role="tab" className={"mv-shoptab" + (tab === "pals" ? " on" : "")} onClick={() => setTab("pals")}><Users size={15} /> Pals</button>
        <button role="tab" className={"mv-shoptab" + (tab === "skins" ? " on" : "")} onClick={() => setTab("skins")}><Palette size={15} /> Skins</button>
        <button role="tab" className={"mv-shoptab" + (tab === "boosts" ? " on" : "")} onClick={() => setTab("boosts")}><Zap size={15} /> Boosts</button>
      </div>

      {tab === "pals" && (<>
        <h2 className="mv-page-title">Pals</h2>
        <p className="mv-page-sub">Cheerful friends who root you on. Collect them all — cosmetic only, style never advantage.</p>
        <div className="mv-skingrid">
          {PALS.map((p) => {
            const owned = meta.ownedPals.includes(p.id);
            const equipped = meta.pal === p.id;
            return (
              <div key={p.id} className="mv-skincard" onClick={() => onPreviewPal(p.id)}>
                <div className="mv-palswatch" style={{ background: `radial-gradient(circle at 50% 38%, ${p.color}44, transparent 70%)` }}>
                  <span className="mv-palface">{p.face}</span>
                  {equipped && <span className="mv-equipped"><Check size={12} /></span>}
                </div>
                <div className="mv-skinmeta">
                  <div className="mv-skinname">{p.name}</div>
                  <div className="mv-skinvibe">{p.vibe}</div>
                </div>
                <button className={"mv-skinbtn" + (equipped ? " equipped" : owned ? " owned" : "")}
                  onClick={(e) => { e.stopPropagation(); owned ? onEquipPal(p.id) : onBuyPal(p); }}>
                  {equipped ? "Cheering!" : owned ? "Equip" : (
                    <>{p.currency === "gems" ? <Gem size={12} /> : <Coins size={12} />} {p.price === 0 ? "Free" : p.price}</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </>)}

      {tab === "skins" && (<>
        <h2 className="mv-page-title">Skins</h2>
        <p className="mv-page-sub">Cosmetic only — every skin plays identically. Style, never advantage.</p>
        <div className="mv-skingrid">
          {SKINS.map((s) => {
            const owned = meta.owned.includes(s.id);
            const equipped = meta.skin === s.id;
            return (
              <div key={s.id} className="mv-skincard" onClick={() => onPreviewSkin(s.id)}>
                <div className="mv-skinswatch" style={{ background: `linear-gradient(150deg, ${s.v.bg2}, ${s.v.bg})` }}>
                  <span className="mv-swatch-target" style={{ background: s.v.target, boxShadow: `0 0 18px rgba(${s.v.tg},.7)` }} />
                  <span className="mv-swatch-tile" style={{ background: `linear-gradient(160deg, ${s.v.tile}, ${s.v.tile2})`, color: s.v.ttx }}>7</span>
                  {equipped && <span className="mv-equipped"><Check size={12} /></span>}
                </div>
                <div className="mv-skinmeta">
                  <div className="mv-skinname">{s.name}</div>
                  <div className="mv-skinvibe">{s.vibe}</div>
                </div>
                <button className={"mv-skinbtn" + (equipped ? " equipped" : owned ? " owned" : "")}
                  onClick={(e) => { e.stopPropagation(); owned ? onEquipSkin(s.id) : onBuySkin(s); }}>
                  {equipped ? "Equipped" : owned ? "Equip" : (
                    <>{s.currency === "gems" ? <Gem size={12} /> : <Coins size={12} />} {s.price}</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </>)}

      {tab === "boosts" && (<>
      <h2 className="mv-page-title">Boosts</h2>
      <p className="mv-page-sub">Handy helpers — convenience only, never an unfair edge.</p>
      <div className="mv-boostgrid">
        <div className="mv-boostcard">
          <div className="mv-boosticon" style={{ background: "rgba(255,180,60,.16)" }}><Coins size={22} /></div>
          <div className="mv-boostinfo">
            <div className="mv-skinname">Double Coins · 24h</div>
            <div className="mv-skinvibe">{boostActive ? "Active now" : "2× every coin you earn"}</div>
          </div>
          <button className="mv-skinbtn" onClick={onBoost} disabled={boostActive}><Gem size={12} /> {ECONOMY.BOOST_COST_GEMS}</button>
        </div>
        <div className="mv-boostcard">
          <div className="mv-boosticon" style={{ background: "rgba(90,200,255,.16)" }}><Flame size={22} /></div>
          <div className="mv-boostinfo">
            <div className="mv-skinname">Streak Freeze ×{meta.freezes}</div>
            <div className="mv-skinvibe">Auto-saves your streak if you miss a day</div>
          </div>
          <button className="mv-skinbtn" onClick={onFreeze}><Gem size={12} /> {ECONOMY.FREEZE_COST_GEMS}</button>
        </div>
        <div className="mv-boostcard soon">
          <div className="mv-boosticon" style={{ background: "rgba(160,140,255,.16)" }}><Trophy size={22} /></div>
          <div className="mv-boostinfo">
            <div className="mv-skinname">Zen Pass · Season 1</div>
            <div className="mv-skinvibe">Seasonal reward track — coming soon</div>
          </div>
          <button className="mv-skinbtn" disabled>Soon</button>
        </div>
      </div>
      </>)}
    </div>
  );
}

/* ------------------------------- JOURNEY ---------------------------------- */
/* The world map: themed worlds of levels with star badges, all replayable up to
   the frontier (meta.level). Presentation only — a level always regenerates
   from its seed, so replays are identical and best-stars are retained. */
function Journey({ meta, campaignLevel, onPlay }) {
  const frontier = meta.level;                       // highest unlocked level
  const lastWorld = worldOfLevel(frontier).index;    // show worlds up to & incl. the frontier's world
  const worlds = Array.from({ length: lastWorld + 1 }, (_, i) => worldOfLevel(i * WORLD_SIZE + 1));
  return (
    <div className="mv-page">
      <h2 className="mv-page-title">Journey</h2>
      <p className="mv-page-sub">Tap any level to play or replay it. Earn stars, unlock new worlds.</p>
      {worlds.map((w) => {
        const levels = [];
        for (let l = w.from; l <= w.to; l++) levels.push(l);
        const collected = levels.reduce((a, l) => a + (meta.stars[pidOf(l)] || 0), 0);
        return (
          <div key={w.world.id} className="mv-worldcard">
            <div className="mv-worldhead">
              <span className="mv-worldface">{w.world.face}</span>
              <div className="mv-worldmeta">
                <div className="mv-worldname">{w.world.name}</div>
                <div className="mv-skinvibe">{w.world.blurb}</div>
              </div>
              <span className="mv-worldstars"><Star size={13} fill="currentColor" /> {collected}/{levels.length * 3}</span>
            </div>
            <div className="mv-levelgrid">
              {levels.map((l) => {
                const unlocked = l <= frontier;
                const stars = meta.stars[pidOf(l)] || 0;
                const current = l === campaignLevel;
                return (
                  <button key={l} disabled={!unlocked}
                    className={"mv-lvlnode" + (unlocked ? "" : " locked") + (current ? " current" : "") + (stars > 0 ? " done" : "")}
                    onClick={() => onPlay(l)} aria-label={`Level ${l}${unlocked ? "" : " (locked)"}`}>
                    {unlocked ? <><span className="mv-lvlnum">{l}</span>
                      <span className="mv-lvlstars">{[0, 1, 2].map((i) => <span key={i} className={"mv-lvlstar" + (i < stars ? " lit" : "")}>★</span>)}</span></>
                      : <Lock size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- STATS ----------------------------------- */
function Stats({ meta }) {
  const totalStars = Object.values(meta.stars).reduce((a, b) => a + b, 0);
  const rows = [
    { icon: <Home size={18} />, label: "Level reached", val: meta.level },
    { icon: <Check size={18} />, label: "Puzzles solved", val: meta.solved },
    { icon: <Star size={18} />, label: "Stars earned", val: totalStars },
    { icon: <Sparkles size={18} />, label: "Bonus solutions", val: meta.bonus },
    { icon: <Flame size={18} />, label: "Current streak", val: meta.streak },
    { icon: <Trophy size={18} />, label: "Best streak", val: meta.best },
    { icon: <Palette size={18} />, label: "Skins owned", val: `${meta.owned.length}/${SKINS.length}` },
    { icon: <Users size={18} />, label: "Pals collected", val: `${meta.ownedPals.length}/${PALS.length}` },
  ];
  return (
    <div className="mv-page">
      <h2 className="mv-page-title">Your journey</h2>
      <div className="mv-statgrid">
        {rows.map((r, i) => (
          <div key={i} className="mv-statcard">
            <div className="mv-staticon">{r.icon}</div>
            <div className="mv-statval">{r.val}</div>
            <div className="mv-statlbl">{r.label}</div>
          </div>
        ))}
      </div>
      <div className="mv-streakbanner">
        <Flame size={26} className="mv-flame" />
        <div>
          <div className="mv-streaknum">{meta.streak} day streak</div>
          <div className="mv-skinvibe">Play the Daily Challenge to keep it burning.</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ OVERLAYS ---------------------------------- */
function WinOverlay({ data, onNext, onShare, mode }) {
  return (
    <div className="mv-scrim">
      <div className="mv-modal mv-win">
        <div className="mv-win-glow" />
        <div className="mv-win-title">{mode === "daily" ? "Daily Complete" : "Solved!"}</div>
        <div className="mv-stars">
          {[0, 1, 2].map((i) => (
            <Star key={i} size={42} className={"mv-star" + (i < data.stars ? " lit" : "")}
              fill={i < data.stars ? "currentColor" : "none"} style={{ animationDelay: i * 0.12 + "s" }} />
          ))}
        </div>
        <div className="mv-star-conds">
          <Cond ok={data.star1} label="Reach the target" />
          <Cond ok={data.star2} label="Find a two-number solution" />
          <Cond ok={data.star3} label="Discover 2+ bonus solutions" />
        </div>
        <div className="mv-win-stat">
          <span><b>{data.found}</b>/{data.total} found</span>
          <span className="mv-win-coins"><Coins size={15} /> +{data.coinGain}</span>
        </div>
        {data.dailyMsg && <div className="mv-daily-note"><Flame size={14} className="mv-flame" /> {data.dailyMsg}</div>}
        <div className="mv-win-actions">
          <button className="mv-btn ghost" onClick={onShare}><Share2 size={16} /> Share</button>
          <button className="mv-btn primary" onClick={onNext}>{mode === "daily" ? "Back to levels" : "Next level"} <ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
function Cond({ ok, label }) {
  return (
    <div className={"mv-cond" + (ok ? " ok" : "")}>
      <span className="mv-cond-dot">{ok ? <Check size={12} /> : <Lock size={11} />}</span>{label}
    </div>
  );
}

function HowToOverlay({ onClose }) {
  const steps = [
    { n: "1", t: "Build an equation", d: "Tap a number, then an operator, then a number… × and ÷ apply before + and −." },
    { n: "2", t: "Hit the target", d: "The moment your equation equals it, it banks itself — no submit button." },
    { n: "3", t: "Find every way", d: "Fill the dots to clear the level. Extra finds pay bonus coins." },
    { n: "4", t: "Collect Pals", d: "Spend coins in the Shop on cheerful friends who root you on!" },
  ];
  return (
    <div className="mv-scrim" onClick={onClose}>
      <div className="mv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mv-modal-head"><h3>How to play</h3><button className="mv-icobtn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="mv-howto">
          {steps.map((s) => (
            <div key={s.n} className="mv-howstep">
              <span className="mv-hownum">{s.n}</span>
              <div><div className="mv-howt">{s.t}</div><div className="mv-howd">{s.d}</div></div>
            </div>
          ))}
        </div>
        <div className="mv-howkeys">Keyboard: <b>1–5</b> tiles · <b>+ − × ÷</b> ops · <b>⌫</b> undo · <b>Esc</b> clear · <b>S</b> shuffle · <b>Enter</b> next</div>
        <button className="mv-btn primary" style={{ width: "100%" }} onClick={onClose}>Let's play</button>
      </div>
    </div>
  );
}

function SettingsOverlay({ meta, onClose, onToggleSound, onToggleMotion, onToggleHaptics, onExit, onReset }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mv-scrim" onClick={onClose}>
      <div className="mv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mv-modal-head"><h3>Settings</h3><button className="mv-icobtn" onClick={onClose}><X size={18} /></button></div>
        <Row label="Sound" on={meta.sound} onClick={onToggleSound} icon={meta.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} />
        <Row label="Animations" on={meta.motion} onClick={onToggleMotion} icon={<Sparkles size={18} />} />
        <Row label="Haptics" on={meta.haptics} onClick={onToggleHaptics} icon={<Vibrate size={18} />} />
        {/* Sky Wolf portal exit — returns to the games hub (or closes the frame when embedded). */}
        <button className="mv-btn ghost mv-exit" style={{ width: "100%", marginTop: 12 }} onClick={onExit}>
          <LogOut size={16} /> All Sky Wolf games
        </button>
        <div className="mv-set-note">Tally saves your progress on this device automatically.</div>
        {!confirm ? (
          <button className="mv-btn danger" onClick={() => setConfirm(true)}>Reset all progress</button>
        ) : (
          <div className="mv-confirm">
            <span>Erase everything?</span>
            <div>
              <button className="mv-btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="mv-btn danger" onClick={onReset}>Erase</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Row({ label, on, onClick, icon }) {
  return (
    <button className="mv-setrow" onClick={onClick}>
      <span className="mv-setrow-l">{icon} {label}</span>
      <span className={"mv-switch" + (on ? " on" : "")}><span className="mv-knob" /></span>
    </button>
  );
}

function SkinPreview({ skin, owned, meta, onBuy, onClose }) {
  const equipped = meta.skin === skin.id;
  return (
    <div className="mv-scrim" onClick={onClose}>
      <div className="mv-modal mv-preview" onClick={(e) => e.stopPropagation()}
        style={{ background: `linear-gradient(160deg, ${skin.v.surf}, ${skin.v.bg})` }}>
        <button className="mv-icobtn mv-preview-x" onClick={onClose} style={{ color: skin.v.text }}><X size={18} /></button>
        <div className="mv-preview-beacon" style={{ background: skin.v.target, color: skin.v.ttext, boxShadow: `0 0 40px rgba(${skin.v.tg},.7)` }}>{20}</div>
        <div className="mv-preview-tiles">
          {[3, 8, 12, 5].map((x, i) => (
            <span key={i} style={{ background: `linear-gradient(160deg, ${skin.v.tile}, ${skin.v.tile2})`, color: skin.v.ttx, borderColor: skin.v.edge }}>{x}</span>
          ))}
        </div>
        <div className="mv-preview-name" style={{ color: skin.v.text }}>{skin.name}</div>
        <div className="mv-preview-vibe" style={{ color: skin.v.muted }}>{skin.vibe}</div>
        <button className="mv-btn primary mv-preview-buy"
          style={{ background: skin.v.acc, color: skin.v.ttext }}
          onClick={() => onBuy(skin)}>
          {equipped ? "Equipped" : owned ? "Equip" : (
            <>Unlock · {skin.price} {skin.currency === "gems" ? "💎" : "🪙"}</>
          )}
        </button>
      </div>
    </div>
  );
}

function PalPreview({ pal, owned, meta, onBuy, onClose }) {
  const equipped = meta.pal === pal.id;
  return (
    <div className="mv-scrim" onClick={onClose}>
      <div className="mv-modal mv-preview" onClick={(e) => e.stopPropagation()}
        style={{ background: `radial-gradient(circle at 50% 20%, ${pal.color}33, var(--surf))` }}>
        <button className="mv-icobtn mv-preview-x" onClick={onClose}><X size={18} /></button>
        <div className="mv-preview-pal" style={{ "--pc": pal.color }}>{pal.face}</div>
        <div className="mv-preview-name">{pal.name}</div>
        <div className="mv-preview-vibe" style={{ color: "var(--muted)" }}>{pal.vibe}</div>
        <div className="mv-preview-say">“{pal.cheers[0]}”</div>
        <button className="mv-btn primary mv-preview-buy" onClick={() => onBuy(pal)}>
          {equipped ? "Cheering for you!" : owned ? "Equip" : (
            <>Unlock · {pal.price === 0 ? "Free" : pal.price} {pal.currency === "gems" ? "💎" : pal.price === 0 ? "" : "🪙"}</>
          )}
        </button>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge }) {
  return (
    <button className={"mv-navbtn" + (active ? " active" : "")} onClick={onClick}>
      <span className="mv-navico">{icon}{badge && <span className="mv-navbadge" />}</span>
      <span className="mv-navlbl">{label}</span>
    </button>
  );
}

/* ================================ STYLES ================================== */
function StyleTag() {
  return (
    <style>{`
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    html, body { margin: 0; padding: 0; }
    body { overscroll-behavior: none; }
    .mv-root {
      --bg:#0d1326; --bg2:#182246; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      position: relative; width: 100%; min-height: 100%; max-width: 520px; margin: 0 auto;
      background: radial-gradient(120% 90% at 50% -10%, var(--bg2), var(--bg));
      color: var(--text); display: flex; flex-direction: column; overflow: hidden;
      height: 100vh; height: 100dvh; user-select: none;
    }
    .mv-root, .mv-root * { font-variant-numeric: tabular-nums; }

    /* splash */
    .mv-splash { align-items: center; justify-content: center; gap: 10px; }
    .mv-splash-logo { font-size: 34px; letter-spacing: -1px; }
    .mv-splash-logo b { color: var(--target); }
    .mv-splash-sub { color: var(--muted); font-size: 13px; letter-spacing: .5px; }

    /* top bar */
    .mv-top { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px 4px; flex-shrink: 0; }
    .mv-brand { font-size: 19px; font-weight: 800; letter-spacing: -.5px; }
    .mv-brand b { color: var(--target); font-weight: 800; }
    .mv-wallet { display: flex; align-items: center; gap: 6px; }
    .mv-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 700;
      background: color-mix(in srgb, var(--surf) 80%, transparent); padding: 5px 9px; border-radius: 999px; color: var(--text); }
    .mv-chip svg { opacity: .95; }
    .mv-flame { color: #ff8a3d; }
    .mv-boost { background: rgba(255,180,60,.2); color: var(--target); }
    .mv-icobtn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
      border: none; border-radius: 10px; background: color-mix(in srgb, var(--surf) 70%, transparent); color: var(--text); cursor: pointer; }
    .mv-icobtn:active { transform: scale(.94); }

    .mv-main { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

    /* board — a column that fills all space between the top bar and the nav */
    .mv-board { flex: 1; min-height: 0; padding: 2px 16px 8px; display: flex; flex-direction: column; align-items: center; }
    .mv-mode-row { width: 100%; display: flex; justify-content: space-between; align-items: center; margin: 2px 0; min-height: 20px; }
    .mv-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--acc); }
    .mv-progress { display: inline-flex; align-items: center; gap: 6px; }
    .mv-pdot { width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--muted) 40%, transparent);
      border: 1px solid color-mix(in srgb, var(--line) 70%, transparent); transition: all .3s; }
    .mv-pdot.on { background: var(--good); border-color: transparent; box-shadow: 0 0 8px color-mix(in srgb, var(--good) 60%, transparent); }
    .mv-pbonus { display: inline-flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 800; color: var(--target);
      margin-left: 2px; }

    /* target beacon */
    .mv-target-wrap { margin: 2px 0; position: relative; flex-shrink: 0; }
    .mv-beacon { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: clamp(74px, 13vh, 104px); height: clamp(74px, 13vh, 104px); border-radius: 34% 66% 62% 38% / 42% 40% 60% 58%;
      background: radial-gradient(circle at 38% 32%, color-mix(in srgb, var(--target) 90%, #fff 30%), var(--target));
      color: var(--ttext); box-shadow: 0 0 40px rgba(var(--tg), .5), inset 0 -8px 18px rgba(0,0,0,.15);
      animation: mv-breathe 4.6s ease-in-out infinite; }
    .mv-beacon::before { content:""; position: absolute; inset: -12px; border-radius: inherit; z-index: -1;
      background: conic-gradient(from 0deg, rgba(var(--tg),.0), rgba(var(--tg),.5), rgba(var(--tg),0)); filter: blur(9px);
      animation: mv-spin 9s linear infinite; }
    .mv-beacon-label { font-size: 9px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; opacity: .65; margin-top: -1px; }
    .mv-beacon-num { font-size: clamp(34px, 7vh, 46px); font-weight: 800; line-height: .92; letter-spacing: -1px; }
    @keyframes mv-breathe { 0%,100% { transform: translateY(0) scale(1);} 50% { transform: translateY(-3px) scale(1.03);} }
    @keyframes mv-spin { to { transform: rotate(360deg);} }
    .mv-shake { animation: mv-shk .42s ease; }
    @keyframes mv-shk { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }

    /* found solutions — one compact horizontally-scrolling row */
    .mv-finds { width: 100%; display: flex; gap: 6px; justify-content: flex-start; align-items: center;
      margin: 4px 0; min-height: 30px; overflow-x: auto; overflow-y: hidden; padding-bottom: 1px;
      scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent); }
    .mv-finds::-webkit-scrollbar { display: none; }
    .mv-finds-empty { color: var(--muted); font-size: 12.5px; font-weight: 600; white-space: nowrap; opacity: .85; }
    .mv-findchip { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 800; white-space: nowrap;
      padding: 5px 10px; border-radius: 999px; flex-shrink: 0; color: var(--text);
      background: color-mix(in srgb, var(--good) 16%, var(--surf)); border: 1px solid color-mix(in srgb, var(--good) 42%, transparent);
      animation: mv-pop .3s ease; }
    .mv-findchip svg { color: var(--good); }
    .mv-findchip.revealed { opacity: .6; font-style: italic; }
    @keyframes mv-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }

    /* equation builder + live total */
    .mv-builder { width: 100%; flex-shrink: 0; min-height: 54px; margin: 3px 0; border-radius: 15px;
      background: color-mix(in srgb, var(--surf) 62%, transparent); border: 1.5px solid color-mix(in srgb, var(--line) 80%, transparent);
      display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; transition: border-color .2s, box-shadow .2s, background .2s; }
    .mv-builder-eq-area { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; overflow: hidden; }
    .mv-builder-hint { color: var(--muted); font-size: 14px; font-weight: 500; }
    .mv-tok-num { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -.5px; }
    .mv-tok-op { font-size: 20px; font-weight: 800; color: var(--acc); }
    .mv-builder-total { display: inline-flex; align-items: center; gap: 5px; padding: 5px 13px; border-radius: 11px; flex-shrink: 0;
      background: color-mix(in srgb, var(--bg2) 55%, var(--surf2)); min-width: 66px; justify-content: center; }
    .mv-eq-sign { font-size: 16px; font-weight: 700; color: var(--muted); }
    .mv-builder-total b { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -.5px; }
    .mv-builder.wrong .mv-builder-total { background: color-mix(in srgb, var(--warn) 22%, var(--surf)); }
    .mv-builder.wrong .mv-builder-total b, .mv-builder.wrong .mv-eq-sign { color: var(--warn); }
    .mv-builder.bank { border-color: var(--good); background: color-mix(in srgb, var(--good) 14%, var(--surf));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--good) 26%, transparent); }
    .mv-builder.bank .mv-builder-total { background: var(--good); }
    .mv-builder.bank .mv-builder-total b, .mv-builder.bank .mv-eq-sign { color: #06231a; }

    /* operators — big, evenly spread, thumb-friendly */
    .mv-ops { display: flex; align-items: center; gap: 8px; width: 100%; margin: 3px 0 6px; flex-shrink: 0; }
    .mv-op { flex: 1; height: clamp(46px, 7vh, 56px); border-radius: 15px; border: none; cursor: pointer;
      background: linear-gradient(160deg, var(--surf2), var(--surf)); color: var(--acc);
      font-size: 26px; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08);
      display: flex; align-items: center; justify-content: center; transition: transform .08s, box-shadow .08s; }
    .mv-op:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,.2); }

    /* number ring — fills the remaining vertical space, sized in JS via --cd */
    .mv-circle-region { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
    .mv-circle { position: relative; }
    .mv-tile { position: absolute; transform: translate(-50%, -50%);
      width: calc(var(--cd) * .30); height: calc(var(--cd) * .30);
      border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--edge) 55%, transparent); cursor: pointer;
      background: radial-gradient(circle at 36% 30%, var(--tile), var(--tile2)); color: var(--ttx);
      box-shadow: 0 6px 14px rgba(0,0,0,.32), inset 0 2px 3px rgba(255,255,255,.55), inset 0 -4px 8px rgba(0,0,0,.14);
      display: flex; align-items: center; justify-content: center; transition: transform .12s, opacity .18s, filter .18s; padding: 0; }
    .mv-tile span { font-size: calc(var(--cd) * .123); font-weight: 800; letter-spacing: -.5px; }
    .mv-tile:active { transform: translate(-50%, -50%) scale(.9); }
    .mv-tile.used { opacity: .26; filter: grayscale(.5); pointer-events: none; transform: translate(-50%, -50%) scale(.8); }
    .mv-center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: calc(var(--cd) * .22); height: calc(var(--cd) * .22); min-width: 40px; min-height: 40px;
      border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--acc) 45%, transparent); cursor: pointer;
      background: color-mix(in srgb, var(--surf) 85%, transparent); color: var(--acc);
      display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .mv-center:active { transform: translate(-50%, -50%) rotate(90deg) scale(.92); }

    /* controls */
    .mv-controls { display: flex; gap: 8px; width: 100%; flex-shrink: 0; }
    .mv-ctrl { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 8px; border-radius: 12px; border: none; cursor: pointer; font-size: 13px; font-weight: 700;
      background: color-mix(in srgb, var(--surf) 70%, transparent); color: var(--text); transition: transform .08s; }
    .mv-ctrl:active { transform: scale(.96); }
    .mv-ctrl:disabled { opacity: .4; cursor: default; }
    .mv-ctrl.hint { background: color-mix(in srgb, var(--target) 22%, var(--surf)); color: var(--text); }
    .mv-ctrl.hint em { font-style: normal; font-size: 11px; opacity: .8; display: inline-flex; align-items: center; gap: 2px; }
    .mv-ctrl.next { flex: 1.3; background: linear-gradient(160deg, color-mix(in srgb, var(--good) 90%, #fff 12%), var(--good));
      color: #06231a; font-weight: 800; box-shadow: 0 3px 0 rgba(0,0,0,.24), 0 0 20px color-mix(in srgb, var(--good) 45%, transparent);
      animation: mv-pulse 1.5s ease-in-out infinite; }
    @keyframes mv-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }

    /* pages */
    .mv-page { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 8px 16px 20px; -webkit-overflow-scrolling: touch; }
    .mv-page-title { font-size: 20px; font-weight: 800; letter-spacing: -.4px; margin: 6px 0 2px; }
    .mv-page-sub { color: var(--muted); font-size: 13px; margin: 0 0 12px; }

    .mv-skingrid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
    .mv-skincard { background: color-mix(in srgb, var(--surf) 60%, transparent); border-radius: 16px; padding: 9px; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--line) 60%, transparent); transition: transform .1s; }
    .mv-skincard:active { transform: scale(.98); }
    .mv-skinswatch { position: relative; height: 92px; border-radius: 11px; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .mv-swatch-target { width: 30px; height: 30px; border-radius: 40% 60% 55% 45%; }
    .mv-swatch-tile { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; box-shadow: inset 0 2px 3px rgba(255,255,255,.5); }
    .mv-equipped { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 50%; background: var(--good); color: #06231a; display: flex; align-items: center; justify-content: center; }
    .mv-skinmeta { padding: 8px 4px 4px; }
    .mv-skinname { font-size: 14.5px; font-weight: 800; }
    .mv-skinvibe { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
    .mv-skinbtn { width: 100%; margin-top: 8px; padding: 8px; border-radius: 10px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 800; background: var(--acc); color: #071a2e; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
    .mv-skinbtn.owned { background: color-mix(in srgb, var(--surf2) 90%, transparent); color: var(--text); }
    .mv-skinbtn.equipped { background: color-mix(in srgb, var(--good) 30%, var(--surf)); color: var(--good); }
    .mv-skinbtn:disabled { opacity: .5; cursor: default; }

    .mv-boostgrid { display: flex; flex-direction: column; gap: 10px; }
    .mv-boostcard { display: flex; align-items: center; gap: 12px; background: color-mix(in srgb, var(--surf) 60%, transparent);
      border-radius: 15px; padding: 12px; border: 1px solid color-mix(in srgb, var(--line) 55%, transparent); }
    .mv-boostcard.soon { opacity: .8; }
    .mv-boosticon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--text); }
    .mv-boostinfo { flex: 1; }
    .mv-boostcard .mv-skinbtn { width: auto; padding: 9px 14px; }

    /* stats */
    .mv-statgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .mv-statcard { background: color-mix(in srgb, var(--surf) 60%, transparent); border-radius: 15px; padding: 15px 12px; text-align: center;
      border: 1px solid color-mix(in srgb, var(--line) 50%, transparent); }
    .mv-staticon { color: var(--acc); display: flex; justify-content: center; margin-bottom: 6px; }
    .mv-statval { font-size: 27px; font-weight: 800; letter-spacing: -1px; }
    .mv-statlbl { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
    .mv-streakbanner { margin-top: 14px; display: flex; align-items: center; gap: 14px; padding: 16px;
      border-radius: 16px; background: linear-gradient(120deg, rgba(255,138,61,.18), color-mix(in srgb, var(--surf) 60%, transparent));
      border: 1px solid rgba(255,138,61,.28); }
    .mv-streaknum { font-size: 18px; font-weight: 800; }

    /* nav */
    .mv-nav { display: flex; padding: 5px 8px calc(5px + env(safe-area-inset-bottom)); gap: 4px; flex-shrink: 0;
      background: color-mix(in srgb, var(--bg) 82%, #000 6%); border-top: 1px solid color-mix(in srgb, var(--line) 40%, transparent); }
    .mv-navbtn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px;
      border: none; background: none; cursor: pointer; color: var(--muted); border-radius: 12px; transition: color .15s; }
    .mv-navbtn.active { color: var(--acc); }
    .mv-navico { position: relative; }
    .mv-navbadge { position: absolute; top: -2px; right: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--target); box-shadow: 0 0 8px var(--target); }
    .mv-navlbl { font-size: 11px; font-weight: 700; }

    /* toast */
    .mv-toast { position: absolute; left: 50%; bottom: 78px; transform: translateX(-50%); z-index: 60;
      padding: 10px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 700; white-space: nowrap;
      background: color-mix(in srgb, var(--surf2) 94%, #000 4%); color: var(--text); box-shadow: 0 8px 24px rgba(0,0,0,.4);
      animation: mv-toast-in .25s ease; border: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }
    .mv-toast-good { border-color: var(--good); }
    .mv-toast-warn { border-color: var(--warn); color: var(--warn); }
    @keyframes mv-toast-in { from { opacity: 0; transform: translate(-50%, 8px);} to { opacity: 1; transform: translate(-50%, 0);} }

    /* motes */
    .mv-mote { position: absolute; bottom: 34%; z-index: 55; border-radius: 50%; pointer-events: none;
      background: radial-gradient(circle, var(--part), transparent 70%); animation: mv-rise linear forwards; }
    @keyframes mv-rise { 0% { opacity: 0; transform: translateY(0) translateX(0) scale(.5);} 
      15% { opacity: 1;} 100% { opacity: 0; transform: translateY(-220px) translateX(var(--drift)) scale(1.1);} }

    /* scrim + modal */
    .mv-scrim { position: absolute; inset: 0; z-index: 70; background: rgba(4,6,14,.62); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 22px; animation: mv-fade .2s ease; }
    @keyframes mv-fade { from { opacity: 0;} to { opacity: 1;} }
    .mv-modal { width: 100%; max-width: 360px; background: linear-gradient(165deg, var(--surf2), var(--surf));
      border: 1px solid color-mix(in srgb, var(--line) 70%, transparent); border-radius: 22px; padding: 20px;
      box-shadow: 0 24px 60px rgba(0,0,0,.5); animation: mv-modal-in .28s cubic-bezier(.2,.9,.3,1.2); position: relative; overflow: hidden; }
    @keyframes mv-modal-in { from { opacity: 0; transform: translateY(18px) scale(.96);} to { opacity: 1; transform: none;} }
    .mv-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .mv-modal-head h3 { font-size: 18px; font-weight: 800; margin: 0; }

    /* win */
    .mv-win { text-align: center; }
    .mv-win-glow { position: absolute; top: -60px; left: 50%; transform: translateX(-50%); width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(var(--tg),.5), transparent 70%); pointer-events: none; }
    .mv-win-title { font-size: 25px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 8px; }
    .mv-stars { display: flex; justify-content: center; gap: 8px; margin: 4px 0 12px; }
    .mv-star { color: color-mix(in srgb, var(--muted) 60%, transparent); }
    .mv-star.lit { color: var(--target); animation: mv-starpop .5s cubic-bezier(.2,.9,.3,1.4) both; filter: drop-shadow(0 0 10px rgba(var(--tg),.7)); }
    @keyframes mv-starpop { 0% { transform: scale(0) rotate(-40deg); opacity: 0;} 70% { transform: scale(1.25) rotate(8deg);} 100% { transform: scale(1) rotate(0); opacity: 1;} }
    .mv-star-conds { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 14px; text-align: left; }
    .mv-cond { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--muted); font-weight: 600; }
    .mv-cond.ok { color: var(--text); }
    .mv-cond-dot { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--surf) 70%, transparent); color: var(--muted); flex-shrink: 0; }
    .mv-cond.ok .mv-cond-dot { background: var(--good); color: #06231a; }
    .mv-win-stat { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border-radius: 12px;
      background: color-mix(in srgb, var(--surf) 55%, transparent); font-size: 14px; font-weight: 700; margin-bottom: 8px; }
    .mv-win-stat b { font-size: 17px; }
    .mv-win-coins { display: inline-flex; align-items: center; gap: 5px; color: var(--target); }
    .mv-daily-note { display: inline-flex; align-items: center; gap: 6px; justify-content: center; font-size: 13px; font-weight: 700;
      color: #ff8a3d; background: rgba(255,138,61,.14); padding: 8px 12px; border-radius: 10px; margin-bottom: 12px; width: 100%; }
    .mv-win-actions { display: flex; gap: 8px; }

    .mv-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 14px;
      border-radius: 13px; border: none; cursor: pointer; font-size: 14.5px; font-weight: 800; transition: transform .08s; }
    .mv-btn:active { transform: scale(.97); }
    .mv-btn.primary { background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 88%, #fff 12%), var(--acc)); color: #071a2e; }
    .mv-btn.ghost { background: color-mix(in srgb, var(--surf) 70%, transparent); color: var(--text); flex: 0 0 auto; padding: 13px 16px; }
    .mv-btn.danger { background: color-mix(in srgb, var(--warn) 88%, #000 4%); color: #2a0a0a; width: 100%; margin-top: 6px; }

    /* settings */
    .mv-setrow { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 13px 4px;
      border: none; background: none; cursor: pointer; color: var(--text); font-size: 15px; font-weight: 600;
      border-bottom: 1px solid color-mix(in srgb, var(--line) 40%, transparent); }
    .mv-setrow-l { display: inline-flex; align-items: center; gap: 11px; }
    .mv-setrow-l svg { color: var(--acc); }
    .mv-switch { width: 44px; height: 26px; border-radius: 999px; background: color-mix(in srgb, var(--surf) 90%, #000 8%); position: relative; transition: background .2s; }
    .mv-switch.on { background: var(--good); }
    .mv-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .2s; }
    .mv-switch.on .mv-knob { transform: translateX(18px); }
    .mv-set-note { font-size: 12px; color: var(--muted); margin: 12px 0; line-height: 1.5; }
    .mv-confirm { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; align-items: center; font-size: 14px; font-weight: 700; }
    .mv-confirm > div { display: flex; gap: 8px; width: 100%; }

    /* how to play */
    .mv-howto { display: flex; flex-direction: column; gap: 12px; margin: 10px 0 12px; }
    .mv-howstep { display: flex; gap: 12px; align-items: flex-start; }
    .mv-hownum { width: 26px; height: 26px; border-radius: 50%; background: rgba(var(--tg),.18); color: var(--target);
      display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; }
    .mv-howt { font-weight: 800; font-size: 14.5px; }
    .mv-howd { color: var(--muted); font-size: 12.5px; margin-top: 1px; line-height: 1.45; }
    .mv-howkeys { font-size: 11.5px; color: var(--muted); background: color-mix(in srgb, var(--surf) 55%, transparent);
      border-radius: 10px; padding: 8px 10px; margin-bottom: 12px; text-align: center; }
    .mv-howkeys b { color: var(--text); }

    /* preview */
    .mv-preview { text-align: center; padding: 28px 20px; }
    .mv-preview-x { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,.12) !important; }
    .mv-preview-beacon { width: 90px; height: 90px; margin: 6px auto 18px; border-radius: 36% 64% 60% 40%;
      display: flex; align-items: center; justify-content: center; font-size: 38px; font-weight: 800; }
    .mv-preview-tiles { display: flex; justify-content: center; gap: 9px; margin-bottom: 16px; }
    .mv-preview-tiles span { width: 46px; height: 46px; border-radius: 50%; border: 1.5px solid; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; box-shadow: inset 0 2px 3px rgba(255,255,255,.4); }
    .mv-preview-name { font-size: 22px; font-weight: 800; }
    .mv-preview-vibe { font-size: 13px; margin-top: 2px; margin-bottom: 18px; }
    .mv-preview-buy { width: 100%; }
    .mv-preview-pal { font-size: 82px; line-height: 1; margin: 8px auto 14px; filter: drop-shadow(0 8px 18px color-mix(in srgb, var(--pc, #000) 55%, transparent));
      animation: mv-palbob 2.4s ease-in-out infinite; }
    .mv-preview-say { font-size: 15px; font-weight: 700; color: var(--text); margin: -6px 0 16px; font-style: italic; }

    /* eyebrow-as-button (opens the map) */
    .mv-eyebrow-btn { background: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 2px 0; }
    .mv-eyebrow-btn svg { opacity: .85; }
    .mv-eyebrow-btn:active { transform: scale(.96); }

    /* companion Pal — absolutely placed so it never affects the one-screen layout */
    .mv-pal { position: absolute; left: 10px; bottom: 66px; z-index: 40; pointer-events: none;
      display: flex; flex-direction: column; align-items: center; }
    .mv-pal-face { font-size: 40px; line-height: 1; filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--pc, #000) 50%, transparent));
      animation: mv-palbob 2.6s ease-in-out infinite; }
    .mv-pal-face.cheer { animation: mv-palhop .55s cubic-bezier(.2,.9,.3,1.3); }
    .mv-pal-bubble { max-width: 130px; margin-bottom: 4px; padding: 6px 10px; border-radius: 13px 13px 13px 3px;
      background: color-mix(in srgb, var(--pc, var(--acc)) 24%, var(--surf2)); color: var(--text);
      border: 1.5px solid color-mix(in srgb, var(--pc, var(--acc)) 60%, transparent);
      font-size: 12px; font-weight: 800; text-align: center; line-height: 1.2; white-space: normal;
      box-shadow: 0 6px 16px rgba(0,0,0,.3); animation: mv-bubblein .3s cubic-bezier(.2,.9,.3,1.3); }
    @keyframes mv-palbob { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-5px);} }
    @keyframes mv-palhop { 0% { transform: translateY(0) scale(1);} 35% { transform: translateY(-16px) scale(1.14);} 60% { transform: translateY(0) scale(.96);} 100% { transform: translateY(0) scale(1);} }
    @keyframes mv-bubblein { from { opacity: 0; transform: translateY(6px) scale(.85);} to { opacity: 1; transform: none;} }

    /* shop tabs */
    .mv-shoptabs { display: flex; gap: 6px; margin: 4px 0 10px; }
    .mv-shoptab { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 9px 6px;
      border-radius: 12px; border: none; cursor: pointer; font-size: 13px; font-weight: 800;
      background: color-mix(in srgb, var(--surf) 55%, transparent); color: var(--muted); transition: all .15s; }
    .mv-shoptab.on { background: color-mix(in srgb, var(--acc) 26%, var(--surf)); color: var(--text); }

    /* pal cards in the shop */
    .mv-palswatch { position: relative; height: 92px; border-radius: 11px; overflow: hidden; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--surf2) 60%, transparent); }
    .mv-palface { font-size: 50px; line-height: 1; animation: mv-palbob 2.8s ease-in-out infinite; filter: drop-shadow(0 4px 8px rgba(0,0,0,.3)); }

    /* journey / world map */
    .mv-worldcard { background: color-mix(in srgb, var(--surf) 55%, transparent); border-radius: 18px; padding: 12px; margin-bottom: 14px;
      border: 1px solid color-mix(in srgb, var(--line) 55%, transparent); }
    .mv-worldhead { display: flex; align-items: center; gap: 11px; margin-bottom: 11px; }
    .mv-worldface { font-size: 30px; line-height: 1; }
    .mv-worldmeta { flex: 1; min-width: 0; }
    .mv-worldname { font-size: 16px; font-weight: 800; letter-spacing: -.3px; }
    .mv-worldstars { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 800; color: var(--target); flex-shrink: 0; }
    .mv-levelgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
    .mv-lvlnode { position: relative; aspect-ratio: 1; border-radius: 14px; border: 1.5px solid color-mix(in srgb, var(--line) 60%, transparent);
      background: color-mix(in srgb, var(--surf2) 75%, transparent); color: var(--text); cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: transform .1s; padding: 0; }
    .mv-lvlnode:active { transform: scale(.94); }
    .mv-lvlnode.done { background: color-mix(in srgb, var(--good) 16%, var(--surf2)); border-color: color-mix(in srgb, var(--good) 40%, transparent); }
    .mv-lvlnode.current { border-color: var(--acc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--acc) 45%, transparent); }
    .mv-lvlnode.locked { opacity: .45; cursor: default; color: var(--muted); }
    .mv-lvlnum { font-size: 19px; font-weight: 800; letter-spacing: -.5px; }
    .mv-lvlstars { display: flex; gap: 1px; font-size: 9px; line-height: 1; }
    .mv-lvlstar { color: color-mix(in srgb, var(--muted) 45%, transparent); }
    .mv-lvlstar.lit { color: var(--target); }

    /* reduced motion */
    .mv-nomotion .mv-beacon, .mv-nomotion .mv-beacon::before,
    .mv-nomotion .mv-star.lit, .mv-nomotion .mv-mote, .mv-nomotion .mv-findchip,
    .mv-nomotion .mv-pal-face, .mv-nomotion .mv-preview-pal, .mv-nomotion .mv-palface { animation: none !important; }
    @media (prefers-reduced-motion: reduce) {
      .mv-beacon, .mv-beacon::before, .mv-mote, .mv-pal-face, .mv-preview-pal, .mv-palface { animation: none !important; }
    }
    button:focus-visible, .mv-tile:focus-visible { outline: 3px solid var(--acc); outline-offset: 2px; }
    `}</style>
  );
}
