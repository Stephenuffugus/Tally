/* --------------------------------- SKINS ---------------------------------- */
/* A skin re-themes every surface via CSS tokens. Cosmetic only — never changes
   difficulty, solutions, or scoring. "Style, never advantage." */
const SKINS = [
  { id: "twilight", name: "Twilight", vibe: "Dusk & amber", price: 0, currency: "coins",
    v: { bg:"#0d1326", bg2:"#182246", surf:"#1c2749", surf2:"#26335f", target:"#f5b544", tg:"245,181,68", ttext:"#2a1c00", tile:"#e9eefb", tile2:"#c3cef0", ttx:"#1a2444", edge:"#ffffff", act:"#ffd98a", acc:"#4fd1c5", acc2:"#7f9cf5", line:"#3b4a7a", fill:"#22305c", text:"#eaf0ff", muted:"#8ea0cf", good:"#5be3b0", warn:"#ff9a9a", part:"#ffd98a" } },
  { id: "sunrise", name: "Sunrise", vibe: "Coral morning", price: 0, currency: "coins",
    v: { bg:"#241026", bg2:"#6d2f43", surf:"#8f3a48", surf2:"#a94a4f", target:"#ffd36b", tg:"255,211,107", ttext:"#3a1500", tile:"#fff2e0", tile2:"#ffd9b0", ttx:"#4a2415", edge:"#ffffff", act:"#ffcaa0", acc:"#ff9e7a", acc2:"#ffc46b", line:"#b5626a", fill:"#7e3540", text:"#fff0e8", muted:"#e0a9a0", good:"#8be0b0", warn:"#ffd0d0", part:"#ffd36b" } },
  { id: "forest", name: "Deep Forest", vibe: "Moss & lime", price: 250, currency: "coins",
    v: { bg:"#0c1a12", bg2:"#123020", surf:"#173d29", surf2:"#1f4f36", target:"#c6f24a", tg:"198,242,74", ttext:"#1a2600", tile:"#eafbe6", tile2:"#c2e6b8", ttx:"#183020", edge:"#ffffff", act:"#d6f5a8", acc:"#5bd68a", acc2:"#9fe07a", line:"#2f6045", fill:"#12301f", text:"#e7f7ea", muted:"#8fbfa0", good:"#7ef0a8", warn:"#ffc0a0", part:"#c6f24a" } },
  { id: "ink", name: "Sumi Ink", vibe: "Paper & seal", price: 350, currency: "coins",
    v: { bg:"#efe7d6", bg2:"#e3d8c0", surf:"#f6f0e2", surf2:"#eae0cc", target:"#c0392b", tg:"192,57,43", ttext:"#fff4ee", tile:"#2b2620", tile2:"#3d372e", ttx:"#f3ecdd", edge:"#5a5142", act:"#4a4336", acc:"#7a6f57", acc2:"#c0392b", line:"#c3b79a", fill:"#e0d5bf", text:"#2b2620", muted:"#7a6f57", good:"#3f7d5a", warn:"#b0402f", part:"#c0392b" } },
  { id: "ocean", name: "Abyss", vibe: "Deep sea teal", price: 400, currency: "coins",
    v: { bg:"#04121c", bg2:"#0a2740", surf:"#0e3350", surf2:"#134463", target:"#39e0d0", tg:"57,224,208", ttext:"#002420", tile:"#e6fbf8", tile2:"#b8e6e0", ttx:"#0a2f30", edge:"#ffffff", act:"#a8f0e6", acc:"#39c0e0", acc2:"#39e0a0", line:"#2a6070", fill:"#0c3048", text:"#e7f7f7", muted:"#8fbcc8", good:"#7ef0d8", warn:"#ffc0b0", part:"#39e0d0" } },
  { id: "sakura", name: "Sakura", vibe: "Petal & plum", price: 500, currency: "coins",
    v: { bg:"#2a1626", bg2:"#5a2b46", surf:"#7a3d5c", surf2:"#8f4a6a", target:"#ff8fc0", tg:"255,143,192", ttext:"#3a0022", tile:"#fff0f6", tile2:"#ffd0e4", ttx:"#4a1730", edge:"#ffffff", act:"#ffc0dc", acc:"#ff9ecb", acc2:"#d9a7ff", line:"#a05c7c", fill:"#6e3552", text:"#fff0f7", muted:"#e0a9c4", good:"#a0e6c0", warn:"#ffd0d8", part:"#ff8fc0" } },
  { id: "neon", name: "Arcade", vibe: "Neon circuit", price: 900, currency: "coins",
    v: { bg:"#07070f", bg2:"#0e0b1e", surf:"#141033", surf2:"#1b1642", target:"#22e0ff", tg:"34,224,255", ttext:"#001318", tile:"#181242", tile2:"#241a52", ttx:"#eafcff", edge:"#22e0ff", act:"#2a2170", acc:"#ff3df0", acc2:"#22e0ff", line:"#3a2f7a", fill:"#150f38", text:"#eafcff", muted:"#8f86c8", good:"#3dffb0", warn:"#ff5db0", part:"#22e0ff" } },
  { id: "ember", name: "Ember", vibe: "Molten core", price: 15, currency: "gems",
    v: { bg:"#150705", bg2:"#3a1108", surf:"#4a1810", surf2:"#5f2214", target:"#ff7a2f", tg:"255,122,47", ttext:"#2a0800", tile:"#ffe9d0", tile2:"#ffc48f", ttx:"#4a1808", edge:"#ffffff", act:"#ffb070", acc:"#ff5a2f", acc2:"#ffb03f", line:"#7a3220", fill:"#4a1810", text:"#ffeede", muted:"#e0a488", good:"#ffca8b", warn:"#ff9a7a", part:"#ff7a2f" } },
  { id: "aurora", name: "Aurora", vibe: "Polar lights", price: 25, currency: "gems",
    v: { bg:"#050e12", bg2:"#0a2233", surf:"#0e2a3a", surf2:"#123648", target:"#8affc0", tg:"138,255,192", ttext:"#00230f", tile:"#eafcff", tile2:"#c0e6f0", ttx:"#0a2430", edge:"#ffffff", act:"#b0f0d0", acc:"#7affc0", acc2:"#b08aff", line:"#2a5060", fill:"#0c2a3a", text:"#e7fbff", muted:"#8fbccc", good:"#8affc0", warn:"#ffc0c0", part:"#b08aff" } },
  { id: "bubblegum", name: "Bubblegum", vibe: "Candy pop", price: 300, currency: "coins",
    v: { bg:"#2a0f3a", bg2:"#7d2a8f", surf:"#9a3aa8", surf2:"#b24fbf", target:"#ffe14d", tg:"255,225,77", ttext:"#3a2a00", tile:"#fff0fb", tile2:"#ffc8ee", ttx:"#5a1a52", edge:"#ffffff", act:"#ffd0f4", acc:"#4be3ff", acc2:"#ff7ad6", line:"#b568c0", fill:"#7a2a88", text:"#fff2fc", muted:"#e0b0dc", good:"#7effc8", warn:"#ffd0e0", part:"#ffe14d" } },
];
const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

/* --------------------------------- PALS ----------------------------------- */
/* Pals are cheerful companions that sit beside the board and root the player on.
   100% cosmetic — a Pal never changes difficulty, solutions, or scoring. Each
   Pal has its own voice (`cheers` on a solve, `win` on a level clear). Buying
   more Pals is the game's "collect friends" ecosystem. */
const PALS = [
  { id: "pip", name: "Pip", face: "🦊", vibe: "The plucky fox", price: 0, currency: "coins", color: "#ff9e5a",
    cheers: ["Nice one!", "You got this!", "Woohoo!", "Keep going!", "So smart!"],
    win: "You did it! High five! 🐾" },
  { id: "hoot", name: "Hoot", face: "🦉", vibe: "The wise owl", price: 0, currency: "coins", color: "#a98bff",
    cheers: ["Clever!", "Well figured!", "Brilliant.", "Hoo-ray!", "Sharp thinking!"],
    win: "A puzzle well solved. Whoo-hoo!" },
  { id: "bram", name: "Bram", face: "🐻", vibe: "The cozy bear", price: 200, currency: "coins", color: "#c88a5a",
    cheers: ["Beary good!", "Yesss!", "Sweet!", "Nice math!", "Un-bear-ievable!"],
    win: "Big bear hug for that one! 🤗" },
  { id: "nibble", name: "Nibble", face: "🐰", vibe: "The hoppy bunny", price: 300, currency: "coins", color: "#ff8fb0",
    cheers: ["Hop hop!", "Ooh nice!", "Speedy!", "Yay!", "Carrot-tastic!"],
    win: "That was egg-cellent! Hop hop! 🥕" },
  { id: "sprout", name: "Sprout", face: "🐸", vibe: "The chill frog", price: 400, currency: "coins", color: "#7ee06a",
    cheers: ["Ribbit-tastic!", "Leap of genius!", "Cool!", "Nice hop!", "So fresh!"],
    win: "You leaped right to it! Ribbit! 🌿" },
  { id: "cosmo", name: "Cosmo", face: "🐱", vibe: "The curious cat", price: 550, currency: "coins", color: "#ffcf5a",
    cheers: ["Purr-fect!", "Meow yes!", "Slick!", "Paws-itively great!", "Nice!"],
    win: "Purr-fectly solved! 🐾" },
  { id: "bolt", name: "Bolt", face: "🤖", vibe: "The math robot", price: 750, currency: "coins", color: "#4be3ff",
    cheers: ["Computing… correct!", "Beep boop yes!", "Optimal!", "Affirmative!", "Processing joy!"],
    win: "Calculation complete. You win! ⚡" },
  { id: "splash", name: "Splash", face: "🐳", vibe: "The gentle whale", price: 900, currency: "coins", color: "#5ab8ff",
    cheers: ["Whale done!", "Splash-tastic!", "Deep thinking!", "Making waves!", "Bloop!"],
    win: "You made a whale of a splash! 🌊" },
  { id: "flame", name: "Flare", face: "🐲", vibe: "The friendly dragon", price: 12, currency: "gems", color: "#ff7a3d",
    cheers: ["Fire!", "Blazing fast!", "Roar-some!", "Smokin'!", "Legendary!"],
    win: "That was fire! Roooar! 🔥" },
  { id: "star", name: "Star", face: "🦄", vibe: "The magic unicorn", price: 20, currency: "gems", color: "#d9a7ff",
    cheers: ["Magical!", "Sparkle!", "Wondrous!", "Pure magic!", "Shine on!"],
    win: "Absolutely magical! ✨🦄" },
];
const palById = (id) => PALS.find((p) => p.id === id) || PALS[0];

/* -------------------------------- WORLDS ---------------------------------- */
/* The Journey groups the endless campaign into themed worlds of 8 levels each.
   Purely a presentation layer over the level number — level N always generates
   from seed 1000+N regardless of which world it's shown in. Beyond the last
   named world, "Endless Expanse" carries on forever. */
const WORLD_SIZE = 8;
const WORLDS = [
  { id: "meadow", name: "Meadow Meadows", face: "🌼", blurb: "Where every journey begins." },
  { id: "bay", name: "Bubble Bay", face: "🫧", blurb: "Numbers that go splash." },
  { id: "candy", name: "Candy Peaks", face: "🍭", blurb: "Sweet sums ahead." },
  { id: "city", name: "Starlight City", face: "🌆", blurb: "Bright lights, big totals." },
  { id: "valley", name: "Dino Valley", face: "🦕", blurb: "Prehistoric puzzles." },
  { id: "space", name: "Space Station", face: "🚀", blurb: "Math among the stars." },
];
// Which world a 1-indexed level belongs to. Returns the world plus its level span.
function worldOfLevel(level) {
  const i = Math.floor((level - 1) / WORLD_SIZE);
  const span = { from: i * WORLD_SIZE + 1, to: (i + 1) * WORLD_SIZE };
  if (i < WORLDS.length) return { world: WORLDS[i], index: i, isEndless: false, ...span };
  return { world: { id: "endless", name: "Endless Expanse", face: "♾️", blurb: "The numbers never stop." }, index: i, isEndless: true, ...span };
}

/* ------------------------------- ECONOMY ---------------------------------- */
// Every tunable reward/cost number in the game. Change here, not inline.
export const ECONOMY = {
  START_COINS: 130,
  START_GEMS: 6,
  SOLVE_COINS: 14,       // coins per required solution found
  BONUS_COINS: 9,        // coins per bonus solution found
  STAR_COINS: 12,        // coins per star at puzzle end
  HINT_COST: 25,         // coins
  DAILY_GEMS: 1,         // gems for finishing the daily
  FREEZE_COST_GEMS: 3,
  BOOST_COST_GEMS: 5,
  BOOST_HOURS: 24,
};

export { SKINS, skinById, PALS, palById, WORLDS, WORLD_SIZE, worldOfLevel };
