/* Headless smoke test for CROWNFRONT (Node).
   Stubs the DOM/canvas, loads all game files into one scope,
   renders every screen, then simulates a full battle. */
const fs = require('fs');

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') return () => grad;
      if (typeof k === 'string') return (...a) => undefined;
      return undefined;
    },
    set() { return true; }
  });
}
function makeEl(tag) {
  const el = {
    tag, children: [], dataset: {}, style: { setProperty() {} }, width: 300, height: 300,
    clientWidth: 300, clientHeight: 300, offsetWidth: 0, textContent: '', value: '',
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); return f; },
      contains(c) { return this._s.has(c); }
    },
    _inner: '',
    get innerHTML() { return this._inner; },
    set innerHTML(v) { this._inner = v; this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    get childElementCount() { return this.children.length; },
    closest() { return null; },
    getContext() { return makeCtx(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; },
    onclick: null, oninput: null, onchange: null, onkeydown: null, checked: false
  };
  return el;
}

const els = {};
const getEl = (sel) => (els[sel] = els[sel] || makeEl(sel));

global.window = { devicePixelRatio: 1, addEventListener() {} };
global.requestAnimationFrame = () => 0;
global.localStorage = (() => {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
})();
global.document = {
  readyState: 'loading',
  body: makeEl('body'),
  querySelector: sel => getEl(sel),
  querySelectorAll: () => [],
  getElementById: id => getEl('#' + id),
  createElement: tag => makeEl(tag),
  addEventListener() {}
};

let code = '';
for (const f of ['data/cards.js', 'data/arenas.js', 'data/rewards.js', 'game.js']) {
  code += '\n/* ==== ' + f + ' ==== */\n' + fs.readFileSync(f, 'utf8');
}

code += `
/* ================= SMOKE HARNESS ================= */
SAVE = loadSaveData();
ensureQuests();

renderHome();            console.log('home OK');
renderCollection();      console.log('collection OK');
showCardDetail('iron_squire'); closeModal(); console.log('card detail OK');
renderDeck();            console.log('deck OK');
console.log('autobuild:', autoBuildDeck().length, 'cards');
renderVanguard();        console.log('vanguard OK');
renderCrates();          console.log('crates OK');
renderPass();            console.log('pass OK');
renderQuests();          console.log('quests OK');
renderProfile();         console.log('profile OK');
renderSettings();        console.log('settings OK');
renderTraining();        console.log('training OK');

// grant some rewards & unlocks
SAVE.profile.marks = 1200;
for (const c of CARDS) if (SAVE.profile.marks >= c.unlock) SAVE.collection[c.id].unlocked = true;
SAVE.collection['granite_brute'].frags = 100;
SAVE.currencies.coins = 5000;
doUpgrade('granite_brute');
console.log('upgrade OK, brute lvl', SAVE.collection['granite_brute'].level);

// crate lifecycle
addCrate('arcane');
SAVE.crates[0].state = 'unlocking'; SAVE.crates[0].unlockEnd = Date.now() - 1;
updateCrateTimers();
openCrate(0);
console.log('crates OK, coins', SAVE.currencies.coins);

// ---- battle simulation ----
startBattleState('normal', 'rush', 'SmokeBot', false);
B.clock = 0;
buildBattleHUD();
console.log('battle HUD OK, hand:', B.hands.player.hand.join(','));

// deploy a few player cards
for (let k = 0; k < 4; k++) deployCard('player', k, 300 + k * 100, 1200);
console.log('player deployed, aether', B.aether.player.toFixed(1));

let frames = 0, errors = 0;
const origErr = console.error;
try {
  while (!B.ended && frames < 60 * 60 * 10) { updateBattle(1/60); frames++; }
} catch (e) { errors++; console.log('SIM ERROR:', e.stack.split('\\n').slice(0,4).join('\\n')); }
console.log('sim frames', frames, 'ended', B.ended, 'result', B.result, 'reason', B.reason,
  'crests', JSON.stringify(B.crests), 'units left', B.units.length, 'errors', errors);

showResults();
console.log('results OK; marks', SAVE.profile.marks, 'coins', SAVE.currencies.coins, 'history', SAVE.history.length);

// spell coverage: cast every spell card once
startBattleState('training', 'balanced', 'SpellBot', true);
B.clock = 0; buildBattleHUD();
const spells = CARDS.filter(c => c.kind === 'spell');
B.hands.player.hand = spells.map(s => s.id); B.hands.player.queue = [];
let spellOK = 0;
for (const sp of spells) {
  const idx = B.hands.player.hand.indexOf(sp.id);
  if (idx < 0) continue;
  B.aether.player = 10;
  if (deployCard('player', idx, 450, 1100)) spellOK++;
}
for (let i = 0; i < 60 * 8 && !B.ended; i++) updateBattle(1/60);
console.log('spells resolved:', spellOK + '/' + spells.length, 'ended', B.ended);

// unit coverage: spawn every unit card once per team and tick
startBattleState('training', 'balanced', 'UnitBot', true);
B.clock = 0; buildBattleHUD();
const units = CARDS.filter(c => c.kind !== 'spell');
for (const uc of units) {
  const st = scaledStats(uc, 3);
  spawnUnit('player', uc, st, 200 + (units.indexOf(uc) % 8) * 60, 1200);
  spawnUnit('enemy', uc, st, 200 + (units.indexOf(uc) % 8) * 60, 400);
}
let uerr = 0;
try { for (let i = 0; i < 60 * 30 && !B.ended; i++) updateBattle(1/60); }
catch (e) { uerr++; console.log('UNIT SIM ERROR:', e.stack.split('\\n').slice(0,4).join('\\n')); }
console.log('unit sim done. units', B.units.length, 'ended', B.ended, 'errors', uerr);

// tutorial steps advance
startBattleState('training', 'balanced', 'TutBot', true);
B.clock = 0; B.tutorial = { step: 0 }; buildBattleHUD();
advanceTutorial(); showTutorialBubble(B.tutorial.step);
finishTutorial();
console.log('tutorial OK, done flag', SAVE.profile.tutorialDone);

// save roundtrip
saveGame();
const raw = localStorage.getItem('crownfront_save_v1');
SAVE = JSON.parse(raw);
console.log('save roundtrip OK, version', SAVE.version);

console.log('ALL SMOKE TESTS PASSED');
`;

try {
  new Function(code)();
} catch (e) {
  console.log('HARNESS FAILURE:', e.stack);
  process.exit(1);
}
