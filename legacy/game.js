/* ============================================================
   CROWNFRONT: ARENA DUEL — game.js
   Original browser game prototype. No external assets.
   Sections:
     1. Utilities & constants
     2. SaveManager
     3. AudioManager (Web Audio synth placeholders)
     4. UI core: screens, toasts, modals, topbar
     5. Menu / Collection / Deck / Profile / Settings screens
     6. Progression: Vanguard Path, Crates, Pass, Quests, Daily
     7. Battle engine: entities, pathing, combat, spells, particles
     8. Battle controller: HUD, input, phases, win conditions
     9. Bot AI
    10. Matchmaking, versus, results
    11. Tutorial
    12. Debug tools, init, main loop
   ============================================================ */
'use strict';

/* ==================== 1. UTILITIES ==================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function daysBetween(ts1, ts2) { return Math.floor((ts2 - ts1) / 86400000); }

/* Team colors (with colorblind alternative) */
function teamColor(team) {
  if (SAVE.settings.colorblind) return team === 'player' ? '#4AA8FF' : '#FFB000';
  return team === 'player' ? '#36C8FF' : '#FF6A67';
}
function teamColor2(team) {
  return team === 'player' ? '#1E7ED8' : '#C84040';
}

/* ==================== 2. SAVE MANAGER ==================== */
const SAVE_KEY = 'crownfront_save_v1';
const SAVE_VERSION = 1;

let SAVE = null;

const STARTER_KIT = ['iron_squire', 'ember_slingers', 'mosslings', 'bastion_guard', 'gear_ram', 'storm_flask', 'sky_manta', 'root_snare'];

function createDefaultSaveData() {
  const collection = {};
  for (const c of CARDS) {
    collection[c.id] = { unlocked: c.unlock === 0, level: 1, frags: 0, mastery: 0 };
  }
  return {
    version: SAVE_VERSION,
    created: Date.now(),
    profile: {
      name: 'Commander', level: 1, xp: 0, marks: 0, highestMarks: 0,
      frontier: 'meadow_outpost', wins: 0, losses: 0, draws: 0, totalCrests: 0,
      streak: 0, lossShield: 3, tutorialDone: false, banner: 'default',
      lastDaily: null, dailyStreak: 0
    },
    currencies: { coins: 500, shards: 20 },
    collection,
    decks: [{ name: 'Starter Kit', cards: STARTER_KIT.slice() }],
    activeDeck: 0,
    crates: [],
    quests: { date: todayStr(), list: [] },
    pass: { xp: 0, claimedFree: [], claimedPrem: [], previewPremium: false },
    daily: { day: 0, lastClaim: null },
    history: [],
    settings: {
      masterVol: 0.8, musicVol: 0.6, sfxVol: 0.9, muted: false,
      shake: true, reducedMotion: false, damageNumbers: true,
      highContrast: false, colorblind: false, tooltips: true
    },
    stats: { towerDamage: 0, aetherSpent: 0, tacticsUsed: 0, vanguardUnits: 0, flyingUnits: 0, bastions: 0, cratesOpened: 0, matches: 0, wins: 0 },
    vanguardClaimed: []
  };
}

function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSaveData();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.profile || !data.collection) {
      console.warn('Corrupted save detected; resetting.');
      return createDefaultSaveData();
    }
    const base = createDefaultSaveData();
    /* shallow-merge with defaults so new fields exist */
    for (const k of Object.keys(base)) {
      if (data[k] === undefined) data[k] = base[k];
    }
    for (const k of Object.keys(base.settings)) {
      if (data.settings[k] === undefined) data.settings[k] = base.settings[k];
    }
    for (const k of Object.keys(base.stats)) {
      if (data.stats[k] === undefined) data.stats[k] = base.stats[k];
    }
    if (!Array.isArray(data.decks) || !data.decks.length) data.decks = base.decks;
    if (data.version !== SAVE_VERSION) data.version = SAVE_VERSION;
    return data;
  } catch (e) {
    console.warn('Save load failed; using fresh data.', e);
    return createDefaultSaveData();
  }
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }
  catch (e) { console.warn('Save failed (storage unavailable?)', e); }
}

function resetSaveData() {
  SAVE = createDefaultSaveData();
  saveGame();
  applySettingsToDOM();
  renderHome();
  showScreen('home');
  toast('Progress reset.', 'good');
}

function exportSaveData() {
  const json = JSON.stringify(SAVE, null, 2);
  modal(`<h3>Export Save</h3><p style="font-size:12px;color:var(--dim);margin-bottom:8px">Copy this JSON somewhere safe.</p>
    <textarea style="width:100%;height:180px;background:#0A1226;color:#9FE8FF;border:1px solid #36C8FF;border-radius:8px;padding:8px;font-family:monospace;font-size:11px" readonly>${esc(json)}</textarea>
    <div class="modal-actions"><button class="btn small" data-close>Close</button></div>`);
}

function importSaveData() {
  modal(`<h3>Import Save</h3>
    <textarea id="importArea" style="width:100%;height:180px;background:#0A1226;color:#9FE8FF;border:1px solid #B26CFF;border-radius:8px;padding:8px;font-family:monospace;font-size:11px" placeholder="Paste save JSON here"></textarea>
    <div class="modal-actions"><button class="btn small" data-close>Cancel</button><button class="btn small primary" id="doImport">Import</button></div>`);
  $('#doImport').onclick = () => {
    try {
      const data = JSON.parse($('#importArea').value);
      if (!data.profile || !data.collection) throw new Error('Invalid format');
      SAVE = data;
      for (const k of Object.keys(createDefaultSaveData().settings)) if (SAVE.settings[k] === undefined) SAVE.settings[k] = createDefaultSaveData().settings[k];
      saveGame();
      applySettingsToDOM();
      closeModal();
      renderHome();
      showScreen('home');
      toast('Save imported!', 'good');
    } catch (e) { toast('Invalid save data.', 'bad'); }
  };
}

/* ==================== 3. AUDIO MANAGER ==================== */
const AudioMan = {
  ctx: null, master: null, sfxGain: null, musicGain: null, musicTimer: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.applyVolumes();
    } catch (e) { console.warn('Audio unavailable'); }
  },
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = SAVE.settings.muted ? 0 : SAVE.settings.masterVol;
    this.sfxGain.gain.value = SAVE.settings.sfxVol;
    this.musicGain.gain.value = SAVE.settings.musicVol * 0.4;
  },
  tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null, delay = 0) {
    if (!this.ctx || SAVE.settings.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, filterFreq = 800, delay = 0) {
    if (!this.ctx || SAVE.settings.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'ui': this.tone(600, 0.06, 'sine', 0.25); break;
      case 'select': this.tone(500, 0.08, 'triangle', 0.3, 700); break;
      case 'deploy': this.tone(300, 0.15, 'triangle', 0.4, 150); this.noise(0.1, 0.15, 600); break;
      case 'poor': this.tone(200, 0.12, 'sawtooth', 0.2, 140); break;
      case 'aether': this.tone(880, 0.07, 'sine', 0.15, 1100); break;
      case 'hit': this.noise(0.06, 0.25, 1200); this.tone(180, 0.05, 'square', 0.15); break;
      case 'shot': this.tone(700, 0.08, 'sine', 0.2, 400); break;
      case 'impact': this.noise(0.1, 0.3, 900); break;
      case 'towershot': this.tone(520, 0.1, 'triangle', 0.3, 260); break;
      case 'towerdown': this.noise(0.6, 0.5, 400); this.tone(120, 0.5, 'sawtooth', 0.4, 40); break;
      case 'spell': this.tone(400, 0.3, 'sawtooth', 0.25, 900); break;
      case 'spellhit': this.noise(0.35, 0.45, 700); this.tone(200, 0.3, 'square', 0.25, 60); break;
      case 'death': this.tone(300, 0.2, 'triangle', 0.25, 90); break;
      case 'victory': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.35, null, i * 0.13)); break;
      case 'defeat': [400, 330, 262, 200].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.3, null, i * 0.18)); break;
      case 'crate': this.noise(0.3, 0.3, 500); [600, 800, 1000].forEach((f, i) => this.tone(f, 0.15, 'sine', 0.3, null, 0.2 + i * 0.1)); break;
      case 'claim': this.tone(660, 0.12, 'sine', 0.3, 990); break;
      case 'rankup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.35, null, i * 0.1)); break;
      case 'tick': this.tone(1200, 0.03, 'sine', 0.12); break;
    }
  },
  /* simple procedural music loop: calm arpeggio */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220, 262, 330, 392, 440, 523, 587, 659];
    let step = 0;
    const tickFn = () => {
      if (!SAVE.settings.muted && this.ctx) {
        const f = scale[(step * 3) % scale.length] * (step % 16 < 8 ? 1 : 0.75);
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        o.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t + 1.3);
        if (step % 4 === 0) {
          const o2 = this.ctx.createOscillator();
          const g2 = this.ctx.createGain();
          o2.type = 'triangle'; o2.frequency.value = scale[0] / 2;
          g2.gain.setValueAtTime(0.06, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o2.connect(g2); g2.connect(this.musicGain);
          o2.start(t); o2.stop(t + 0.55);
        }
      }
      step++;
    };
    this.musicTimer = setInterval(tickFn, 450);
  }
};

/* ==================== 4. UI CORE ==================== */
let currentScreen = 'loading';

function showScreen(name) {
  currentScreen = name;
  $$('.screen').forEach(s => s.classList.add('hidden'));
  const el = $('#screen-' + name);
  if (el) el.classList.remove('hidden');
  AudioMan.play('ui');
}

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toastRoot').appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

function modal(html, opts = {}) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-bg"><div class="modal-box">${html}</div></div>`;
  root.querySelector('.modal-bg').addEventListener('click', (e) => {
    if (e.target === e.currentTarget && !opts.sticky) closeModal();
  });
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  return root;
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

function applySettingsToDOM() {
  document.body.classList.toggle('hc', !!SAVE.settings.highContrast);
  document.body.classList.toggle('cb', !!SAVE.settings.colorblind);
  document.body.classList.toggle('rm', !!SAVE.settings.reducedMotion);
  AudioMan.applyVolumes();
}

/* ---- Top bar ---- */
function renderTopbar(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const b = getBanner();
  el.innerHTML = `
    <div class="topbar">
      <div class="avatar" style="border-color:${b.color}">${avatarEmoji()}</div>
      <div style="min-width:0">
        <div class="pname">${esc(SAVE.profile.name)}</div>
        <div class="plevel">Lv ${SAVE.profile.level} \u00B7 ${divisionForMarks(SAVE.profile.marks).name}</div>
      </div>
      <div class="grow"></div>
      <div class="pill marks"><span class="ico">\u2691</span><span data-cur="marks">${fmt(SAVE.profile.marks)}</span></div>
      <div class="pill coins"><span class="ico">\u25CF</span><span data-cur="coins">${fmt(SAVE.currencies.coins)}</span></div>
      <div class="pill shards"><span class="ico">\u25C7</span><span data-cur="shards">${SAVE.currencies.shards}</span></div>
      <button class="btn small" data-nav="settings" aria-label="Settings">\u2699</button>
    </div>`;
  el.querySelector('[data-nav="settings"]').onclick = () => { renderSettings(); showScreen('settings'); };
}

function avatarEmoji() { return ['\u{1F9E9}', '\u2694\uFE0F', '\u{1F3F9}', '\u{1F409}', '\u{1F31F}', '\u{1F98A}'][SAVE.profile.level % 6]; }
function getBanner() { return BANNERS.find(b => b.id === SAVE.profile.banner) || BANNERS[0]; }

function refreshCurrencies() {
  const map = { marks: fmt(SAVE.profile.marks), coins: fmt(SAVE.currencies.coins), shards: SAVE.currencies.shards };
  $$('[data-cur]').forEach(el => {
    const v = map[el.dataset.cur];
    if (v !== undefined && el.textContent !== v) {
      el.textContent = v;
      const pill = el.closest('.pill');
      if (pill && !SAVE.settings.reducedMotion) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
    }
  });
  updateBottomBadges();
}

/* ---- Bottom nav ---- */
function renderBottomNav() {
  const el = $('#bottomnav');
  if (!el) return;
  const items = [
    ['home', '\u{1F3E0}', 'Home'], ['deck', '\u{1F0CF}', 'Kit'], ['battle', '\u2694\uFE0F', 'Battle'],
    ['vanguard', '\u2691', 'Rewards'], ['social', '\u{1F465}', 'Guild']
  ];
  el.innerHTML = items.map(([id, ico, label]) =>
    `<button class="navbtn" data-nav="${id}" aria-label="${label}"><span class="ni">${ico}</span>${label}</button>`).join('');
  el.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const id = b.dataset.nav;
    if (id === 'battle') { startMatchmaking('normal'); return; }
    if (id === 'home') { renderHome(); showScreen('home'); return; }
    if (id === 'deck') { renderDeck(); showScreen('deck'); return; }
    if (id === 'vanguard') { renderVanguard(); showScreen('vanguard'); return; }
    if (id === 'social') toast('Guilds are a future prototype feature \u2014 coming soon!');
  });
}
function updateBottomBadges() {
  /* hook for claim badges on nav (kept light) */
}

/* ==================== SPRITE MANAGER ==================== */
/* Optional PNG art in assets/sprites/ (original, AI-generated for this project).
   Used for non-directional visuals: card art, towers, backgrounds.
   Battlefield units stay procedural so they keep walk/attack/death animation.
   Any missing sprite falls back to the procedural drawing automatically. */
const Sprites = {
  map: {},
  names: ['arena_bg', 'menu_bg', 'citadel', 'bastion',
    'iron_squire', 'ember_slingers', 'mosslings', 'bastion_guard', 'gear_ram',
    'storm_flask', 'sky_manta', 'root_snare', 'bolt_pixies', 'granite_brute',
    'prism_cannon', 'comet_drop'],
  load() {
    if (typeof Image === 'undefined') return; /* headless/test safety */
    for (const n of this.names) {
      const img = new Image();
      const entry = { img, ok: false };
      this.map[n] = entry;
      img.onload = () => { entry.ok = true; };
      img.onerror = () => { /* keep procedural fallback */ };
      img.src = 'assets/sprites/' + n + '.png';
    }
  },
  get(name) { const e = this.map[name]; return e && e.ok ? e.img : null; }
};

function drawSpriteFit(ctx, img, cx, cy, maxW, maxH) {
  const s = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

/* ==================== CARD ICON DRAWING (shared) ==================== */
/* Draws a card's placeholder icon onto a small canvas. Pure original vector art. */
function drawCardIcon(canvas, card, size = 64) {
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  /* sprite art when available */
  const sp = Sprites.get(card.id);
  if (sp) {
    const pad = size * 0.05;
    drawSpriteFit(ctx, sp, size / 2, size / 2, size - pad * 2, size - pad * 2);
    return;
  }
  const s = size / 64;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(32, 34);
  drawVisShape(ctx, card.vis, card.rarity, 1);
  ctx.restore();
}

/* Visual families: knight, archer, swarm, guard, ram, golem, manta, pixie,
   turret, spell visuals, plus misc unit silhouettes. */
function drawVisShape(ctx, vis, rarity, team /* 1 = neutral icon */) {
  const rc = RARITY_COLOR[rarity] || '#7FA6C8';
  ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  const F = (c) => { ctx.fillStyle = c; };
  const O = (c) => { ctx.strokeStyle = c; };
  switch (vis) {
    case 'knight': // helmet + shield
      F('#B8C4D8'); O('#31405C');
      ctx.beginPath(); ctx.arc(0, -10, 12, Math.PI, 0); ctx.lineTo(12, 2); ctx.lineTo(-12, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      F(rc); ctx.fillRect(-3, -24, 6, 5);
      F('#5A7396'); ctx.beginPath();
      ctx.moveTo(-10, 4); ctx.lineTo(10, 4); ctx.lineTo(10, 16); ctx.lineTo(0, 24); ctx.lineTo(-10, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'archer': // hood + bow
      F('#8A5A3A'); O('#3D2818');
      ctx.beginPath(); ctx.arc(0, -8, 11, Math.PI * 0.9, Math.PI * 0.1); ctx.quadraticCurveTo(0, 6, -11, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      O('#D8B878'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(12, 0, 14, -1.2, 1.2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(16, -13); ctx.lineTo(16, 13); ctx.stroke();
      F(rc); ctx.beginPath(); ctx.arc(16, 0, 4, 0, 7); ctx.fill();
      break;
    case 'swarm': // three bulbs
      for (const [x, y, r] of [[-10, 4, 8], [10, 6, 7], [0, -8, 9]]) {
        F('#6DBE6A'); O('#2E5A30');
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
        F(rc); ctx.beginPath(); ctx.arc(x, y - r - 3, 2.5, 0, 7); ctx.fill();
      }
      break;
    case 'guard': // shield wall
      F('#7E8CAC'); O('#2C3A58');
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, -12); ctx.lineTo(15, 10); ctx.lineTo(0, 22); ctx.lineTo(-15, 10); ctx.lineTo(-15, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
      F(rc); ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
      break;
    case 'ram': // clockwork ram
      F('#9A8A5A'); O('#4A3E20');
      roundRect(ctx, -20, -6, 40, 16, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, 2); ctx.lineTo(32, -2); ctx.lineTo(32, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      F(rc); for (const wx of [-10, 2]) { ctx.beginPath(); ctx.arc(wx, 12, 7, 0, 7); ctx.fill(); ctx.stroke(); }
      break;
    case 'golem': case 'colossus': // rock body with core
      const big = vis === 'colossus' ? 1.25 : 1;
      ctx.save(); ctx.scale(big, big);
      F('#8A8A96'); O('#3A3A48');
      ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(-16, -8); ctx.lineTo(-6, -18); ctx.lineTo(8, -16); ctx.lineTo(16, -2); ctx.lineTo(12, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      F(rc); ctx.beginPath(); ctx.arc(0, -4, 5, 0, 7); ctx.fill();
      F('#6A6A78'); ctx.fillRect(-14, 12, 9, 8); ctx.fillRect(5, 12, 9, 8);
      ctx.restore();
      break;
    case 'manta': case 'drake': // flying glider
      F(rc); O('#1A2A4A');
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(22, 2, 14, 8); ctx.quadraticCurveTo(6, 4, 0, 12);
      ctx.quadraticCurveTo(-6, 4, -14, 8); ctx.quadraticCurveTo(-22, 2, 0, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      F('#FFFFFF'); ctx.beginPath(); ctx.arc(0, -6, 2.5, 0, 7); ctx.fill();
      break;
    case 'pixie': case 'bat': // spark sprites
      for (const [x, y] of [[-9, -6], [9, -4], [0, 8]]) {
        F(rc); O('#2A1A3A');
        ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    case 'turret': case 'beacon': // crystal turret
      F('#6A7A8A'); O('#2C3844');
      ctx.beginPath(); ctx.moveTo(-14, 18); ctx.lineTo(0, 4); ctx.lineTo(14, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
      F(rc); O('#1A2A4A');
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(8, 2); ctx.lineTo(0, 10); ctx.lineTo(-8, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (vis === 'beacon') { F('#FFFFFF'); ctx.beginPath(); ctx.arc(0, -24, 3, 0, 7); ctx.fill(); }
      break;
    case 'barricade': // wall
      F('#7A6A5A'); O('#3A2E20');
      roundRect(ctx, -18, -8, 36, 24, 4); ctx.fill(); ctx.stroke();
      F(rc); ctx.fillRect(-18, -2, 36, 4);
      break;
    case 'totem': // stacked totem
      F('#5A8A6A'); O('#1E3A2A');
      roundRect(ctx, -10, -18, 20, 14, 4); ctx.fill(); ctx.stroke();
      roundRect(ctx, -12, -4, 24, 14, 4); ctx.fill(); ctx.stroke();
      F(rc); ctx.beginPath(); ctx.arc(0, 2, 4, 0, 7); ctx.fill();
      break;
    case 'raven': case 'stalker': case 'hound': case 'skimmer': case 'duelist': case 'rider': case 'beetle': case 'miner': case 'turtle': case 'witch': case 'archivist': case 'healer':
      // generic creature/humanoid silhouettes with rarity accent
      F('#7E8CAC'); O('#2C3A58');
      ctx.beginPath(); ctx.arc(0, -8, 10, 0, 7); ctx.fill(); ctx.stroke();      // head
      roundRect(ctx, -9, 2, 18, 16, 6); ctx.fill(); ctx.stroke();               // body
      if (vis === 'witch' || vis === 'archivist') { // hat
        ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(0, -26); ctx.lineTo(12, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (vis === 'raven' || vis === 'bat') { // wings
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-20, -8); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(20, -8); ctx.lineTo(10, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (vis === 'beetle') { // horn
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(4, -26); ctx.lineTo(-2, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (vis === 'turtle') { // shell
        F('#5A7A4A'); ctx.beginPath(); ctx.arc(0, 2, 14, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (vis === 'rider') { // steed
        roundRect(ctx, -16, 6, 32, 10, 5); ctx.fill(); ctx.stroke();
      }
      F(rc); ctx.beginPath(); ctx.arc(0, -10, 3, 0, 7); ctx.fill(); // eye/accent
      break;
    default: // spells & misc: orb with rarity glow
      const g = ctx.createRadialGradient(0, -2, 2, 0, -2, 16);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.4, rc); g.addColorStop(1, 'rgba(0,0,0,0)');
      F(g); ctx.beginPath(); ctx.arc(0, -2, 16, 0, 7); ctx.fill();
      O(rc); ctx.beginPath(); ctx.arc(0, -2, 11, 0, 7); ctx.stroke();
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ==================== 5a. HOME SCREEN ==================== */
let homeFx = null;

function renderHome() {
  renderTopbar('topbar');
  renderBottomNav();
  const fr = frontierForRank(SAVE.profile.marks);
  const next = nextFrontier(SAVE.profile.marks);
  const b = getBanner();
  const nd = nextDivision(SAVE.profile.marks);
  const div = divisionForMarks(SAVE.profile.marks);
  $('#homeCenter').innerHTML = `
    <canvas id="homeCanvas"></canvas>
    <div class="home-overlay">
      <div class="frontier-name">${esc(fr.name)}</div>
      <div class="frontier-sub">${nd ? 'Next: ' + esc(next.name) + ' at ' + nd.min + ' \u2691' : 'Top of the Frontier'}</div>
      <div class="banner-chip"><span class="banner-swatch" style="background:linear-gradient(135deg,${b.color},${b.color2})"></span>${esc(b.name)}</div>
    </div>`;
  $('#homeButtons').innerHTML = `
    <div class="battle-btn-wrap"><button class="btn primary big pulse" id="btnBattleMain" aria-label="Battle">BATTLE</button></div>
    <button class="btn" data-h="deck">\u{1F0CF} Battle Kit</button>
    <button class="btn" data-h="collection">\u{1F5C2}\uFE0F Collection</button>
    <button class="btn" data-h="vanguard">\u2691 Vanguard Path</button>
    <button class="btn" data-h="crates">\u{1F4E6} Supply Crates</button>
    <button class="btn" data-h="pass">\u{1F396}\uFE0F Season Pass</button>
    <button class="btn" data-h="quests">\u{1F4DC} Quests</button>
    <button class="btn" data-h="profile">\u{1F464} Profile</button>
    <button class="btn" data-h="training">\u{1F393} Training</button>`;
  $('#btnBattleMain').onclick = () => startMatchmaking('normal');
  $('#homeButtons').querySelectorAll('[data-h]').forEach(btn => btn.onclick = () => openPanel(btn.dataset.h));
  startHomeFx();
  refreshCurrencies();
}

function openPanel(id) {
  switch (id) {
    case 'deck': renderDeck(); showScreen('deck'); break;
    case 'collection': renderCollection(); showScreen('collection'); break;
    case 'vanguard': renderVanguard(); showScreen('vanguard'); break;
    case 'crates': renderCrates(); showScreen('crates'); break;
    case 'pass': renderPass(); showScreen('pass'); break;
    case 'quests': renderQuests(); showScreen('quests'); break;
    case 'profile': renderProfile(); showScreen('profile'); break;
    case 'training': renderTraining(); showScreen('training'); break;
    case 'settings': renderSettings(); showScreen('settings'); break;
  }
}

/* animated menu backdrop: drifting particles + banner shapes */
function startHomeFx() {
  const cv = $('#homeCanvas');
  if (!cv) return;
  homeFx = { cv, ctx: cv.getContext('2d'), parts: [], t: 0 };
  for (let i = 0; i < 26; i++) homeFx.parts.push({
    x: Math.random(), y: Math.random(), s: rand(2, 6), v: rand(0.01, 0.05), ph: rand(0, 7)
  });
}
function renderHomeFx(dt) {
  if (!homeFx || !document.body.contains(homeFx.cv)) { homeFx = null; return; }
  const { cv, ctx, parts } = homeFx;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const fr = frontierForRank(SAVE.profile.marks);
  const bgImg = Sprites.get('menu_bg');
  if (bgImg) {
    const bs = Math.max(w / bgImg.width, h / bgImg.height);
    const bw = bgImg.width * bs, bh = bgImg.height * bs;
    ctx.drawImage(bgImg, (w - bw) / 2, (h - bh) / 2, bw, bh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0D1630'); g.addColorStop(1, fr.theme.g2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    /* stylized frontier silhouette: towers + ground */
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(0, h * 0.72);
    for (let x = 0; x <= w; x += w / 8) ctx.lineTo(x, h * 0.72 + Math.sin(x * 0.01 + homeFx.t * 0.2) * 10);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  }
  homeFx.t += dt;
  /* banner poles */
  const b = getBanner();
  for (const px of [w * 0.18, w * 0.82]) {
    ctx.fillStyle = '#31405C'; ctx.fillRect(px - 3, h * 0.35, 6, h * 0.4);
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.moveTo(px + 3, h * 0.35); ctx.lineTo(px + 46, h * 0.35 + 12 + Math.sin(homeFx.t) * 4); ctx.lineTo(px + 3, h * 0.35 + 34); ctx.fill();
  }
  /* drifting sparkles */
  const cnt = SAVE.settings.reducedMotion ? 8 : parts.length;
  for (let i = 0; i < cnt; i++) {
    const p = parts[i];
    const y = ((p.y - homeFx.t * p.v) % 1 + 1) % 1;
    const x = p.x + Math.sin(homeFx.t * 0.5 + p.ph) * 0.02;
    ctx.fillStyle = fr.theme.riverGlow;
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(homeFx.t * 2 + p.ph);
    ctx.beginPath(); ctx.arc(x * w, y * h, p.s, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ==================== 5b. COLLECTION ==================== */
let collectionSort = 'rarity';

function renderCollection() {
  renderTopbar('topbar2');
  const body = $('#collectionBody');
  const sorts = ['rarity', 'level', 'cost', 'category', 'unlocked', 'name'];
  body.innerHTML = `
    <div class="panel-head"><h2>Collection</h2>
      <div class="filterbar">${sorts.map(s => `<button class="chipbtn ${collectionSort === s ? 'active' : ''}" data-sort="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
    </div>
    <div class="card-grid" id="collGrid"></div>`;
  body.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { collectionSort = b.dataset.sort; renderCollection(); });

  let list = CARDS.slice();
  const col = SAVE.collection;
  switch (collectionSort) {
    case 'rarity': list.sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || a.cost - b.cost); break;
    case 'level': list.sort((a, b) => (col[b.id].unlocked ? col[b.id].level : 0) - (col[a.id].unlocked ? col[a.id].level : 0)); break;
    case 'cost': list.sort((a, b) => a.cost - b.cost); break;
    case 'category': list.sort((a, b) => a.cat.localeCompare(b.cat) || a.cost - b.cost); break;
    case 'unlocked': list.sort((a, b) => (col[b.id].unlocked ? 1 : 0) - (col[a.id].unlocked ? 1 : 0)); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
  }
  const grid = $('#collGrid');
  grid.innerHTML = '';
  for (const c of list) {
    const cd = col[c.id];
    const need = fragsForLevel(c, cd.level);
    const div = document.createElement('div');
    div.className = 'ccard' + (cd.unlocked ? '' : ' locked');
    div.style.setProperty('--rc', RARITY_COLOR[c.rarity]);
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', c.name + (cd.unlocked ? ', level ' + cd.level : ', locked'));
    div.innerHTML = `
      <div class="cost">${c.cost}</div>
      ${cd.unlocked ? `<div class="lvl">Lv ${cd.level}</div>` : ''}
      <div class="art"><canvas></canvas></div>
      <div class="nm">${esc(c.name)}</div>
      ${cd.unlocked ? `<div class="fragbar"><div style="width:${Math.min(100, cd.frags / need * 100)}%"></div></div>` : '<div class="lock-tag">\u{1F512} ' + c.unlock + ' \u2691</div>'}`;
    drawCardIcon(div.querySelector('canvas'), c);
    div.onclick = () => showCardDetail(c.id);
    grid.appendChild(div);
  }
}

function showCardDetail(id, opts = {}) {
  const c = getCard(id);
  const cd = SAVE.collection[id];
  const need = fragsForLevel(c, cd.level);
  const s = scaledStats(c, cd.level);
  const canUp = cd.unlocked && cd.level < 15 && cd.frags >= need && SAVE.currencies.coins >= coinsForLevel(c, cd.level);
  const statHp = c.kind === 'unit' || c.kind === 'struct';
  modal(`<div class="card-detail" style="--rc:${RARITY_COLOR[c.rarity]}">
    <div class="art"><canvas></canvas></div>
    <h3 style="color:${RARITY_COLOR[c.rarity]}">${esc(c.name)} <span style="font-size:12px;color:var(--dim)">${RARITY_LABEL[c.rarity]} \u00B7 ${esc(c.cat)}</span></h3>
    <div class="tagrow">${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <p style="font-size:13px;color:var(--dim);margin:6px 0">${esc(c.desc)}</p>
    ${c.fx ? `<div class="statrow"><span>Tactic Damage</span><b>${fxAtLevel(c, cd.level).dmg}</b></div>
              <div class="statrow"><span>Radius</span><b>${c.fx.radius}px</b></div>` : ''}
    ${statHp && c.s.dmg ? `<div class="statrow"><span>Damage</span><b>${s.dmg}</b></div>` : ''}
    ${statHp ? `<div class="statrow"><span>Health</span><b>${s.hp}</b></div>
      <div class="statrow"><span>DPS (est.)</span><b>${dpsEstimate(c)}</b></div>` : ''}
    ${c.s && c.s.cnt > 1 ? `<div class="statrow"><span>Count</span><b>x${c.s.cnt}</b></div>` : ''}
    <div class="statrow"><span>Aether Cost</span><b>${c.cost}</b></div>
    <div class="statrow"><span>Level</span><b>${cd.level}${cd.level < 15 ? ' \u2192 ' + (cd.level + 1) : ' (MAX)'}</b></div>
    <div class="statrow"><span>Fragments</span><b>${cd.frags} / ${need}</b></div>
    <div class="statrow"><span>Proficiency</span><b>${cd.mastery} pts</b></div>
    ${cd.unlocked && cd.level < 15 ? `<button class="btn ${canUp ? 'gold' : ''} small" id="upgBtn" style="width:100%;margin-top:10px" ${canUp ? '' : 'disabled'}>
      Upgrade \u00B7 ${need} frags \u00B7 ${coinsForLevel(c, cd.level)} \u25CF</button>`
      : cd.unlocked ? '<p style="text-align:center;color:var(--gold);margin-top:8px">MAX LEVEL</p>'
      : `<p style="text-align:center;color:var(--warn);margin-top:8px">Unlocks at ${c.unlock} Rank Marks</p>`}
    <div class="modal-actions"><button class="btn small" data-close>Close</button></div>
  </div>`);
  drawCardIcon($('.card-detail canvas'), c, 100);
  const up = $('#upgBtn');
  if (up) up.onclick = () => doUpgrade(id);
}

function doUpgrade(id) {
  const c = getCard(id);
  const cd = SAVE.collection[id];
  const need = fragsForLevel(c, cd.level);
  const cost = coinsForLevel(c, cd.level);
  if (cd.frags < need || SAVE.currencies.coins < cost) { toast('Not enough fragments or coins.', 'bad'); return; }
  cd.frags -= need;
  SAVE.currencies.coins -= cost;
  cd.level++;
  refreshCurrencies(); saveGame();
  AudioMan.play('claim');
  toast(c.name + ' upgraded to Lv ' + cd.level + '!', 'good');
  showCardDetail(id);
}

/* ==================== 5c. DECK BUILDER ==================== */
let deckEditIdx = -1; // currently selected slot

function activeDeck() { return SAVE.decks[SAVE.activeDeck] || SAVE.decks[0]; }

function deckAvgCost(deck) {
  return deck.cards.reduce((a, id) => a + getCard(id).cost, 0) / Math.max(1, deck.cards.length);
}

function deckAnalysis(deck) {
  const cards = deck.cards.map(getCard).filter(Boolean);
  const has = (role) => cards.some(c => c.role && c.role.includes(role));
  const antiAir = cards.some(c => (c.s && (c.s.targets === 'both' || c.s.targets === 'air')) || (c.fx && c.fx.type === 'chain'));
  const tactic = cards.some(c => c.kind === 'spell');
  const avg = deckAvgCost(deck);
  const units = cards.filter(c => c.kind === 'unit').length;
  const warns = [], goods = [];
  if (!antiAir) warns.push('No anti-air! Flying units will have free rein.');
  if (!tactic) warns.push('No direct-damage Tactic in this kit.');
  if (avg > 4.2) warns.push('Average Aether cost is high (' + avg.toFixed(1) + '). Avoid overcommitting.');
  if (units < 5) warns.push('Too few units for consistent defense.');
  if (avg <= 3.5) goods.push('Your Battle Kit cycles quickly and can pressure often.');
  if (has('splash')) goods.push('You have splash coverage against swarms.');
  if (has('wincon') || has('siege')) goods.push('You have strong structure pressure.');
  if (has('tank')) goods.push('A durable tank anchors your pushes.');
  if (!goods.length) goods.push('A balanced kit \u2014 adapt to what the opponent plays.');
  const composition = {
    'Ground defense': cards.filter(c => c.kind === 'unit' && c.s.targets !== 'air' && !c.fly).length,
    'Air defense': antiAir ? cards.filter(c => c.s && c.s.targets === 'both').length : 0,
    'Structure pressure': cards.filter(c => c.role && (c.role.includes('wincon') || c.role.includes('siege'))).length,
    'Area damage': cards.filter(c => c.s && c.s.splash || c.fx).length,
    'Cycle speed': cards.filter(c => c.cost <= 2).length,
    'Tank presence': cards.filter(c => c.role && c.role.includes('tank')).length,
    'Tactic coverage': cards.filter(c => c.kind === 'spell').length
  };
  return { avg, warns, goods, composition, antiAir, tactic };
}

function autoBuildDeck() {
  const unlocked = CARDS.filter(c => SAVE.collection[c.id].unlocked);
  const pick = (roles, fallbackRoles) => {
    for (const r of roles) {
      const opts = unlocked.filter(c => c.role && c.role.includes(r) && !chosen.includes(c.id));
      if (opts.length) return choice(opts).id;
    }
    const fb = unlocked.filter(c => fallbackRoles.some(r => c.role && c.role.includes(r)) && !chosen.includes(c.id));
    if (fb.length) return choice(fb).id;
    const rest = unlocked.filter(c => !chosen.includes(c.id));
    return rest.length ? choice(rest).id : null;
  };
  const chosen = [];
  const plan = [['tank', 'defense'], ['wincon', 'siege'], ['splash', 'antiair'], ['spell', 'utility'],
    ['antiair', 'ranged'], ['swarm', 'cycle'], ['support', 'ranged'], ['cycle', 'counter']];
  for (const [r, f] of plan) { const id = pick([r], [f]); if (id) chosen.push(id); }
  while (chosen.length < 8) { const rest = unlocked.filter(c => !chosen.includes(c.id)); if (!rest.length) break; chosen.push(choice(rest).id); }
  return chosen.slice(0, 8);
}

function renderDeck() {
  renderTopbar('topbar3');
  const body = $('#deckBody');
  const deck = activeDeck();
  const an = deckAnalysis(deck);
  body.innerHTML = `
    <div class="panel-head"><h2>Battle Kit</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <select id="deckSelect" aria-label="Choose kit">${SAVE.decks.map((d, i) => `<option value="${i}" ${i === SAVE.activeDeck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          <option value="new">+ New Kit</option></select>
        <button class="btn small" id="autoBtn">Auto Build</button>
      </div>
    </div>
    <div class="deck-slots" id="deckSlots"></div>
    <div class="deck-info">
      <div class="info-box">Average Aether: <b>${an.avg.toFixed(1)}</b></div>
      <div class="info-box">Composition breakdown below</div>
    </div>
    <div id="deckWarn"></div>
    <div class="info-box" style="margin-top:8px">
      ${Object.entries(an.composition).map(([k, v]) => `<div class="statrow"><span>${k}</span><b>${v}</b></div>`).join('')}
    </div>
    <h3 style="margin:14px 0 8px;color:var(--gold)">Tap a card below to add it</h3>
    <div class="card-grid" id="deckPicker"></div>`;

  $('#deckSelect').onchange = (e) => {
    if (e.target.value === 'new') {
      if (SAVE.decks.length >= 5) { toast('Kit slots full (5).', 'bad'); renderDeck(); return; }
      SAVE.decks.push({ name: 'Kit ' + (SAVE.decks.length + 1), cards: STARTER_KIT.filter(id => SAVE.collection[id].unlocked).slice(0, 8) });
      SAVE.activeDeck = SAVE.decks.length - 1;
    } else SAVE.activeDeck = +e.target.value;
    saveGame(); renderDeck();
  };
  $('#autoBtn').onclick = () => {
    deck.cards.splice(0, 8, ...autoBuildDeck());
    saveGame(); toast('Auto-built a balanced kit!', 'good'); renderDeck();
  };

  const slots = $('#deckSlots');
  deck.cards.forEach((id, i) => {
    const c = getCard(id);
    const div = document.createElement('div');
    div.className = 'deck-slot filled' + (i === deckEditIdx ? ' selected' : '');
    div.innerHTML = `<div class="cost">${c.cost}</div><canvas class="slotArt" width="52" height="52"></canvas><div class="nm2">${esc(c.name)}</div><div class="remove" data-i="${i}" role="button" aria-label="Remove ${esc(c.name)}">\u00D7</div>`;
    drawCardIcon(div.querySelector('canvas'), c, 52);
    div.querySelector('.remove').onclick = (e) => {
      e.stopPropagation();
      deck.cards.splice(i, 1); saveGame(); renderDeck();
    };
    div.onclick = () => { deckEditIdx = i; renderDeck(); };
    slots.appendChild(div);
  });
  while (deck.cards.length < 8) {
    const div = document.createElement('div');
    div.className = 'deck-slot';
    div.textContent = 'Empty';
    slots.appendChild(div);
  }

  const warn = $('#deckWarn');
  warn.innerHTML = an.warns.map(w => `<div class="warnbox">\u26A0\uFE0F ${w}</div>`).join('') +
    (an.warns.length === 0 ? `<div class="okbox">\u2714 No weaknesses detected.</div>` : '') +
    an.goods.map(g => `<div class="okbox">${g}</div>`).join('');

  const picker = $('#deckPicker');
  for (const c of CARDS) {
    const cd = SAVE.collection[c.id];
    if (!cd.unlocked) continue;
    const inDeck = deck.cards.includes(c.id);
    const div = document.createElement('div');
    div.className = 'ccard' + (inDeck ? '' : '');
    div.style.setProperty('--rc', RARITY_COLOR[c.rarity]);
    if (inDeck) div.style.opacity = 0.45;
    div.innerHTML = `<div class="cost">${c.cost}</div><div class="art"><canvas></canvas></div><div class="nm">${esc(c.name)}</div>`;
    drawCardIcon(div.querySelector('canvas'), c);
    div.onclick = () => {
      if (inDeck) { toast('Already in kit.'); return; }
      if (deckEditIdx >= 0 && deckEditIdx < 8) {
        deck.cards[deckEditIdx] = c.id; deckEditIdx = -1;
      } else if (deck.cards.length < 8) {
        deck.cards.push(c.id);
      } else { toast('Kit is full \u2014 remove a card first.', 'bad'); return; }
      saveGame(); AudioMan.play('select'); renderDeck();
    };
    picker.appendChild(div);
  }
}

/* ==================== 5d. PROFILE ==================== */
function renderProfile() {
  renderTopbar('topbar8');
  const p = SAVE.profile;
  const total = p.wins + p.losses + p.draws;
  const wr = total ? Math.round(p.wins / total * 100) : 0;
  const bannerList = BANNERS.filter(b => b.unlock >= 0);
  $('#profileBody').innerHTML = `
    <div class="panel-head"><h2>Profile</h2></div>
    <div class="statgrid">
      <div class="statbox"><div class="sv">${p.level}</div><div class="sl">Commander Level</div></div>
      <div class="statbox"><div class="sv">${fmt(p.marks)}</div><div class="sl">Rank Marks</div></div>
      <div class="statbox"><div class="sv">${fmt(p.highestMarks)}</div><div class="sl">Highest Marks</div></div>
      <div class="statbox"><div class="sv">${wr}%</div><div class="sl">Win Rate (${total} matches)</div></div>
      <div class="statbox"><div class="sv">${p.wins} / ${p.losses} / ${p.draws}</div><div class="sl">W / L / D</div></div>
      <div class="statbox"><div class="sv">${p.totalCrests}</div><div class="sl">Total Crests</div></div>
      <div class="statbox"><div class="sv">${fmt(SAVE.stats.towerDamage)}</div><div class="sl">Lifetime Tower Damage</div></div>
      <div class="statbox"><div class="sv">${divisionForMarks(p.marks).name}</div><div class="sl">Current Division</div></div>
    </div>
    <h3 style="margin:14px 0 8px;color:var(--gold)">Commander Banner</h3>
    <div class="card-grid" id="bannerGrid"></div>
    <h3 style="margin:14px 0 8px;color:var(--gold)">Match History</h3>
    <div id="histList">${SAVE.history.slice(0, 12).map(h => `
      <div class="histitem"><span class="res ${h.result}">${h.result.toUpperCase()}</span>
      <span>vs ${esc(h.enemy)}</span><span style="margin-left:auto">${h.crests}\u2013${h.enemyCrests}</span>
      <span class="pill" style="padding:2px 8px;font-size:11px">${h.marks >= 0 ? '+' : ''}${h.marks} \u2691</span></div>`).join('') || '<p style="color:var(--dim);font-size:13px">No matches yet \u2014 go earn some Crests!</p>'}</div>`;
  const bg = $('#bannerGrid');
  for (const b of bannerList) {
    const owned = b.id === 'default' || (SAVE.profile.banner === b.id) || bannerOwned(b);
    const div = document.createElement('div');
    div.className = 'ccard';
    div.style.setProperty('--rc', b.color);
    div.innerHTML = `<div class="art" style="background:linear-gradient(135deg,${b.color},${b.color2})"></div>
      <div class="nm">${esc(b.name)}</div>${owned ? '' : '<div class="lock-tag">Season rewards</div>'}`;
    div.onclick = () => {
      if (!owned) { toast('Earn this banner through the Season Pass or events.', 'bad'); return; }
      SAVE.profile.banner = b.id; saveGame(); renderProfile(); toast('Banner equipped!', 'good');
    };
    bg.appendChild(div);
  }
}
function bannerOwned(b) {
  return SAVE.pass.claimedFree.includes('banner:' + b.id) || SAVE.pass.claimedPrem.includes('banner:' + b.id) ||
    SAVE.vanguardClaimed.includes('banner:' + b.id);
}

/* ==================== 5e. SETTINGS ==================== */
function renderSettings() {
  renderTopbar('topbar9');
  const s = SAVE.settings;
  const toggles = [
    ['muted', 'Mute all audio'], ['shake', 'Screen shake'], ['reducedMotion', 'Reduced motion'],
    ['damageNumbers', 'Floating damage numbers'], ['highContrast', 'High contrast mode'],
    ['colorblind', 'Colorblind team colors'], ['tooltips', 'Show card tooltips']
  ];
  $('#settingsBody').innerHTML = `
    <div class="panel-head"><h2>Settings</h2></div>
    ${[['masterVol', 'Master Volume'], ['musicVol', 'Music Volume'], ['sfxVol', 'Effects Volume']].map(([k, label]) => `
      <div class="setrow"><label for="set_${k}">${label}</label>
        <input type="range" id="set_${k}" min="0" max="1" step="0.05" value="${s[k]}"></div>`).join('')}
    ${toggles.map(([k, label]) => `
      <div class="setrow"><label>${label}</label><div class="toggle ${s[k] ? 'on' : ''}" data-tog="${k}" role="switch" aria-checked="${!!s[k]}" aria-label="${label}" tabindex="0"></div></div>`).join('')}
    <h3 style="margin:14px 0 8px;color:var(--gold)">Data</h3>
    <div class="setrow"><label>Player name</label><input type="text" id="nameInput" maxlength="16" value="${esc(SAVE.profile.name)}"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <button class="btn small" id="btnExport">Export Save JSON</button>
      <button class="btn small" id="btnImport">Import Save JSON</button>
      <button class="btn small danger" id="btnReset">Reset All Progress</button>
    </div>
    <div class="setrow"><label>Prototype Debug Tools</label><button class="btn small" id="btnDebug">Toggle (F2)</button></div>
    <p style="color:var(--dim);font-size:12px;margin-top:16px;text-align:center">
      CROWNFRONT: Arena Duel \u00B7 v1.0 prototype<br>An original game. Not affiliated with any existing game or studio.</p>`;
  for (const [k] of [['masterVol'], ['musicVol'], ['sfxVol']]) {
    $('#set_' + k).oninput = (e) => { SAVE.settings[k] = +e.target.value; AudioMan.applyVolumes(); saveGame(); };
  }
  $$('[data-tog]').forEach(t => {
    const flip = () => {
      const k = t.dataset.tog;
      SAVE.settings[k] = !SAVE.settings[k];
      applySettingsToDOM(); saveGame(); renderSettings();
    };
    t.onclick = flip;
    t.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') flip(); };
  });
  $('#nameInput').onchange = (e) => { SAVE.profile.name = e.target.value.trim() || 'Commander'; saveGame(); toast('Name updated.'); };
  $('#btnExport').onclick = exportSaveData;
  $('#btnImport').onclick = importSaveData;
  $('#btnDebug').onclick = () => toggleDebug();
  $('#btnReset').onclick = () => {
    modal(`<h3>Reset all progress?</h3><p style="font-size:13px">This permanently deletes your collection, rank, and rewards. This cannot be undone.</p>
      <div class="modal-actions"><button class="btn small" data-close>Cancel</button><button class="btn small danger" id="confirmReset">Yes, reset</button></div>`);
    $('#confirmReset').onclick = () => { closeModal(); resetSaveData(); };
  };
}

/* ==================== 5f. TRAINING SELECT ==================== */
function renderTraining() {
  renderTopbar('topbar10');
  $('#trainingBody').innerHTML = `
    <div class="panel-head"><h2>Training</h2></div>
    <p style="color:var(--dim);font-size:13px;margin-bottom:12px">Practice against gentle AI. No Rank Marks at stake \u2014 small rewards only.</p>
    <div class="card-grid">
      ${['training', 'easy', 'normal'].map(d => `
        <div class="ccard" data-d="${d}" style="--rc:${d === 'training' ? '#6DE38B' : d === 'easy' ? '#FFCD5C' : '#FF7070'}">
          <div class="art" style="font-size:34px;display:flex;align-items:center;justify-content:center">${d === 'training' ? '\u{1F393}' : d === 'easy' ? '\u{1F9CA}' : '\u2694\uFE0F'}</div>
          <div class="nm">${BOT_DIFFICULTIES[d].label} Bot</div>
        </div>`).join('')}
    </div>
    <div class="okbox" style="margin-top:12px">Training matches run at your deck's average level so upgrades always matter, never intimidate.</div>`;
  $$('[data-d]').forEach(el => el.onclick = () => startMatchmaking(el.dataset.d));
}

/* ==================== 6a. VANGUARD PATH ==================== */
function renderVanguard() {
  renderTopbar('topbar4');
  const marks = SAVE.profile.marks;
  const items = VANGUARD_MILESTONES;
  let html = `<div class="panel-head"><h2>Vanguard Path</h2></div>
    <div class="youmarker">\u2691 ${fmt(marks)} Rank Marks \u2014 ${divisionForMarks(marks).name}</div><div class="vpath"><div class="vline"></div>`;
  let reachedShown = false;
  for (const m of items) {
    const reached = marks >= m.marks;
    const claimed = SAVE.vanguardClaimed.includes(m.id);
    if (reached && !reachedShown) { reachedShown = true; }
    const r = m.reward;
    const rlabel = r.type === 'frags' ? `${r.amount} ${getCard(r.card).name} frags`
      : r.type === 'crate' ? r.label + ' (' + CRATE_TYPES[r.crate].name + ')'
      : r.type === 'banner' ? 'Banner'
      : `${r.amount} ${r.label}`;
    html += `<div class="vitem ${reached ? 'reached' : 'locked'}">
      <div class="dot"></div>
      <div class="vbox">
        <span class="rlabel">${m.marks} \u2691</span>
        <span style="flex:1;font-size:13px">${rlabel}</span>
        ${claimed ? '<span style="color:var(--ok);font-weight:900">\u2714</span>'
          : reached ? `<button class="btn small gold" data-claim="${m.id}">Claim</button>`
          : '<span style="color:var(--dim);font-size:11px">\u{1F512} Locked</span>'}
      </div></div>`;
  }
  html += '</div>';
  $('#vanguardBody').innerHTML = html;
  $$('[data-claim]').forEach(b => b.onclick = () => {
    const m = items.find(x => x.id === b.dataset.claim);
    if (!m || SAVE.vanguardClaimed.includes(m.id) || SAVE.profile.marks < m.marks) return;
    SAVE.vanguardClaimed.push(m.id);
    grantReward(m.reward);
    AudioMan.play('claim');
    saveGame(); renderVanguard();
  });
}

function grantReward(r) {
  if (r.type === 'coins') { SAVE.currencies.coins += r.amount; toast('+' + r.amount + ' Coins!', 'good'); }
  else if (r.type === 'shards') { SAVE.currencies.shards += r.amount; toast('+' + r.amount + ' Shards!', 'good'); }
  else if (r.type === 'frags') { SAVE.collection[r.card].frags += r.amount; toast('+' + r.amount + ' ' + getCard(r.card).name + ' fragments!', 'good'); }
  else if (r.type === 'crate') { addCrate(r.crate); }
  else if (r.type === 'xp') { SAVE.pass.xp += r.amount; toast('+' + r.amount + ' Season XP', 'good'); }
  else if (r.type === 'banner') {
    if (!bannerOwned(getBannerById(r.banner))) { /* banner becomes claimable via ownership check */ }
    SAVE.vanguardClaimed.push('banner:' + r.banner);
    SAVE.profile.banner = r.banner;
    toast('Banner unlocked!', 'good');
  }
  refreshCurrencies();
}
function getBannerById(id) { return BANNERS.find(b => b.id === id) || BANNERS[0]; }

/* ==================== 6b. SUPPLY CRATES ==================== */
function addCrate(type) {
  if (SAVE.crates.length >= 4) { toast('Crate slots full! Crate lost.', 'bad'); return false; }
  SAVE.crates.push({ type, state: 'locked', unlockStart: 0 });
  toast(CRATE_TYPES[type].name + ' earned!', 'good');
  return true;
}

function renderCrates() {
  renderTopbar('topbar5');
  const body = $('#cratesBody');
  let html = `<div class="panel-head"><h2>Supply Crates</h2>
    <span style="font-size:12px;color:var(--dim)">Only one unlocks at a time. Unlock all: 20 \u25C7</span></div>
    <div class="crate-slots">`;
  for (let i = 0; i < 4; i++) {
    const c = SAVE.crates[i];
    if (!c) { html += `<div class="crate-cell"><div class="cname" style="color:var(--dim)">Empty Slot</div><div class="ctime">Win matches to earn crates</div></div>`; continue; }
    const ct = CRATE_TYPES[c.type];
    let statusHtml;
    if (c.state === 'locked') {
      const anyUnlocking = SAVE.crates.some(x => x.state === 'unlocking');
      statusHtml = `<button class="btn small primary" data-start="${i}" ${anyUnlocking ? 'disabled' : ''}>${anyUnlocking ? 'Another is unlocking' : 'Start Unlock'}</button>`;
    } else if (c.state === 'unlocking') {
      const remain = Math.max(0, c.unlockEnd - Date.now());
      statusHtml = `<div class="progressbar"><div data-cratebar="${i}" style="width:${(1 - remain / (ct.unlockSecs * 1000)) * 100}%"></div></div>
        <div class="ctime" data-cratetime="${i}">${fmtTime(remain)}</div>
        <button class="btn small" data-skip="${i}" ${SAVE.currencies.shards >= 10 ? '' : 'disabled'}>Finish \u00B7 10 \u25C7</button>`;
    } else {
      statusHtml = `<button class="btn small gold pulse" data-open="${i}">Open!</button>`;
    }
    html += `<div class="crate-cell" data-cell="${i}">
      <div class="crate-art"><canvas width="76" height="64" data-crateart="${i}"></canvas></div>
      <div class="cname" style="color:${ct.color}">${ct.name}</div>
      <div class="ctime">${ct.desc}</div>${statusHtml}</div>`;
  }
  html += `</div>`;
  body.innerHTML = html;

  $$('[data-crateart]').forEach(cv => {
    const i = +cv.dataset.crateart;
    drawCrate(cv.getContext('2d'), CRATE_TYPES[SAVE.crates[i].type]);
  });
  $$('[data-start]').forEach(b => b.onclick = () => {
    const c = SAVE.crates[+b.dataset.start];
    if (SAVE.crates.some(x => x.state === 'unlocking')) return;
    c.state = 'unlocking';
    c.unlockStart = Date.now();
    c.unlockEnd = Date.now() + CRATE_TYPES[c.type].unlockSecs * 1000;
    saveGame(); AudioMan.play('select'); renderCrates();
  });
  $$('[data-skip]').forEach(b => b.onclick = () => {
    if (SAVE.currencies.shards < 10) { toast('Not enough Shards.', 'bad'); return; }
    SAVE.currencies.shards -= 10;
    const c = SAVE.crates[+b.dataset.skip];
    c.state = 'ready'; c.unlockEnd = 0;
    refreshCurrencies(); saveGame(); renderCrates();
  });
  $$('[data-open]').forEach(b => b.onclick = () => openCrate(+b.dataset.open));
}

function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
  if (s >= 60) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return s + 's';
}

function drawCrate(ctx, ct) {
  ctx.clearRect(0, 0, 76, 64);
  ctx.save();
  ctx.fillStyle = '#5A4632'; ctx.strokeStyle = '#2E2418'; ctx.lineWidth = 3;
  roundRect(ctx, 8, 22, 60, 36, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ct.color;
  roundRect(ctx, 6, 14, 64, 14, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ct.color;
  ctx.fillRect(32, 22, 12, 14);
  ctx.strokeStyle = '#FFF'; ctx.globalAlpha = 0.5;
  ctx.strokeRect(32, 22, 12, 14);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function openCrate(i) {
  const c = SAVE.crates[i];
  if (!c || c.state !== 'ready') return;
  const ct = CRATE_TYPES[c.type];
  /* roll rewards */
  const coins = randi(ct.coins[0], ct.coins[1]);
  const rarity1 = rollCrateRarity(ct);
  const rarity2 = rollCrateRarity(ct);
  const pool1 = CARDS.filter(x => x.rarity === rarity1);
  const pool2 = CARDS.filter(x => x.rarity === rarity2);
  const card1 = choice(pool1), card2 = choice(pool2);
  const shards = Math.random() < ct.shardChance ? randi(2, 6) : 0;
  SAVE.crates.splice(i, 1);
  SAVE.currencies.coins += coins;
  SAVE.collection[card1.id].frags += 10;
  SAVE.collection[card2.id].frags += 10;
  if (shards) SAVE.currencies.shards += shards;
  SAVE.stats.cratesOpened++;
  questEvent('cratesOpened', 1);
  saveGame();
  AudioMan.play('crate');
  const cell = document.querySelector(`[data-cell="${i}"]`);
  if (cell && !SAVE.settings.reducedMotion) cell.classList.add('shaking');
  setTimeout(() => {
    modal(`<h3 style="text-align:center;color:${ct.color}">${ct.name} opened!</h3>
      <div class="res-rewards" style="margin-top:14px">
        <div class="res-reward" style="color:var(--gold)">+${coins} Coins</div>
        <div class="res-reward" style="color:${RARITY_COLOR[card1.rarity]}">+10 ${esc(card1.name)}</div>
        <div class="res-reward" style="color:${RARITY_COLOR[card2.rarity]}">+10 ${esc(card2.name)}</div>
        ${shards ? `<div class="res-reward" style="color:var(--teal)">+${shards} Shards</div>` : ''}
      </div>
      <div class="modal-actions" style="justify-content:center"><button class="btn primary" data-close>Nice!</button></div>`);
    refreshCurrencies();
  }, SAVE.settings.reducedMotion ? 50 : 500);
  /* refresh underlying screen if still open */
  setTimeout(() => { if (currentScreen === 'crates') renderCrates(); }, SAVE.settings.reducedMotion ? 60 : 520);
}

/* offline timer progress: called on load & when opening crates screen */
function updateCrateTimers() {
  for (const c of SAVE.crates) {
    if (c.state === 'unlocking' && Date.now() >= c.unlockEnd) {
      c.state = 'ready';
      toast(CRATE_TYPES[c.type].name + ' is ready to open!', 'good');
    }
  }
}

/* ==================== 6c. SEASON PASS ==================== */
function passTier() { return Math.floor(SAVE.pass.xp / PASS_TIER_XP); }
function passProgress() { return SAVE.pass.xp % PASS_TIER_XP; }

function renderPass() {
  renderTopbar('topbar6');
  const cur = passTier();
  const p = SAVE.pass;
  const prem = p.previewPremium;
  $('#passBody').innerHTML = `
    <div class="pass-header">
      <h2>${SEASON_NAME}</h2>
      <p style="font-size:12px;color:var(--dim);margin:4px 0 10px">Crownfront Season Pass \u2014 earn Season XP from matches and quests.</p>
      <div class="progressbar"><div style="width:${passProgress() / PASS_TIER_XP * 100}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:5px">
        <span>Tier ${Math.min(cur, 30)} / 30</span><span>${passProgress()} / ${PASS_TIER_XP} XP</span>
      </div>
      <label class="setrow" style="margin-top:10px;border:none;background:rgba(0,0,0,0.25)">
        <label style="flex:1">Preview Commander Track rewards (demo \u2014 no purchases)</label>
        <div class="toggle ${prem ? 'on' : ''}" id="premToggle" role="switch" aria-checked="${prem}"></div>
      </label>
    </div>
    <div class="pass-track" id="passTrack"></div>`;
  $('#premToggle').onclick = () => { p.previewPremium = !p.previewPremium; saveGame(); renderPass(); };
  const track = $('#passTrack');
  for (const t of PASS_TIERS) {
    const unlocked = cur >= t.tier;
    const fClaimed = p.claimedFree.includes(t.tier);
    const pClaimed = p.claimedPrem.includes(t.tier);
    const div = document.createElement('div');
    div.className = 'pass-tier';
    div.innerHTML = `<div class="tnum">${t.tier}</div>
      <div class="pass-reward ${fClaimed ? 'claimed' : unlocked ? 'claimable' : ''}" data-claim="free:${t.tier}">
        ${passRewardLabel(t.free)}<div class="pl">FREE</div></div>
      <div class="pass-reward prem ${pClaimed ? 'claimed' : unlocked && prem ? 'claimable' : ''}" data-claim="prem:${t.tier}">
        ${prem ? passRewardLabel(t.prem) : '\u{1F512} Commander Track'}<div class="pl">PREMIUM${prem ? '' : ' (locked demo)'}</div></div>`;
    track.appendChild(div);
  }
  track.querySelectorAll('[data-claim]').forEach(el => el.onclick = () => {
    const [which, tierStr] = el.dataset.claim.split(':');
    const tier = +tierStr;
    if (passTier() < tier) { toast('Reach Tier ' + tier + ' first.', 'bad'); return; }
    if (which === 'prem' && !SAVE.pass.previewPremium) { toast('Commander Track is a locked demo \u2014 enable preview in settings.', 'bad'); return; }
    const list = which === 'free' ? SAVE.pass.claimedFree : SAVE.pass.claimedPrem;
    if (list.includes(tier)) return;
    list.push(tier);
    grantReward(which === 'free' ? PASS_TIERS[tier - 1].free : PASS_TIERS[tier - 1].prem);
    if (which === 'prem' && PASS_TIERS[tier - 1].prem.type === 'banner') {
      const b = PASS_TIERS[tier - 1].prem.banner;
      SAVE.pass.claimedPrem.push('banner:' + b);
    }
    AudioMan.play('claim');
    saveGame(); renderPass();
  });
}
function passRewardLabel(r) {
  if (r.type === 'coins') return '\u25CF ' + r.amount;
  if (r.type === 'shards') return '\u25C7 ' + r.amount;
  if (r.type === 'frags') return getCard(r.card).name.split(' ')[0] + ' x' + r.amount;
  if (r.type === 'crate') return CRATE_TYPES[r.crate].name;
  if (r.type === 'xp') return 'XP +' + r.amount;
  if (r.type === 'banner') return '\u{1F3F3}\uFE0F Banner';
  return '?';
}

/* ==================== 6d. QUESTS & DAILY ==================== */
function ensureQuests() {
  if (SAVE.quests.date !== todayStr()) {
    SAVE.quests.date = todayStr();
    const pool = QUEST_POOL.slice();
    SAVE.quests.list = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const q = pool.splice(randi(0, pool.length - 1), 1)[0];
      SAVE.quests.list.push({ id: q.id, progress: 0, claimed: false });
    }
    saveGame();
  }
}
function getQuestDef(id) { return QUEST_POOL.find(q => q.id === id); }

function questEvent(metric, amount, extra) {
  if (!SAVE || !SAVE.quests) return;
  let changed = false;
  for (const q of SAVE.quests.list) {
    const def = getQuestDef(q.id);
    if (!def || def.metric !== metric || q.progress >= def.goal) continue;
    if (metric === 'cheapWin' && !(extra && extra.cheapWin)) continue;
    q.progress = Math.min(def.goal, q.progress + amount);
    changed = true;
    if (q.progress >= def.goal) toast('Quest complete: ' + def.text, 'good');
  }
  if (changed) saveGame();
}

function renderQuests() {
  renderTopbar('topbar7');
  ensureQuests();
  const dailyDone = SAVE.daily.lastClaim === todayStr();
  let html = `<div class="panel-head"><h2>Quests</h2></div>`;
  /* daily login */
  html += `<div class="quest-item"><div class="qt">Daily Login \u2014 Day ${(SAVE.daily.day % 7) + 1} of 7</div>
    <div class="qmeta"><span style="font-size:12px;color:var(--dim)">${DAILY_REWARDS.map((r, i) => i === (SAVE.daily.day % 7) ? '\u{1F4E6}' : '\u{1F518}').join(' ')}</span>
    ${dailyDone ? '<span style="color:var(--ok);font-weight:800;margin-left:auto">\u2714 Claimed today</span>'
      : `<button class="btn small gold" id="claimDaily" style="margin-left:auto">Claim</button>`}</div></div>`;
  html += SAVE.quests.list.map((q, i) => {
    const def = getQuestDef(q.id);
    const done = q.progress >= def.goal;
    return `<div class="quest-item"><div class="qt">${def.text}</div>
      <div class="qmeta">
        <div class="progressbar"><div style="width:${Math.min(100, q.progress / def.goal * 100)}%"></div></div>
        <span style="font-size:12px;white-space:nowrap">${fmt(q.progress)}/${fmt(def.goal)}</span>
        <span style="font-size:11px;color:var(--gold);white-space:nowrap">+${def.reward.coins}\u25CF +${def.reward.xp}XP</span>
        ${q.claimed ? '<span style="color:var(--ok);font-weight:800">\u2714</span>'
          : done ? `<button class="btn small gold" data-qclaim="${i}">Claim</button>` : ''}
      </div></div>`;
  }).join('');
  $('#questsBody').innerHTML = html;
  const cd = $('#claimDaily');
  if (cd) cd.onclick = claimDailyReward;
  $$('[data-qclaim]').forEach(b => b.onclick = () => {
    const q = SAVE.quests.list[+b.dataset.qclaim];
    const def = getQuestDef(q.id);
    if (q.claimed || q.progress < def.goal) return;
    q.claimed = true;
    SAVE.currencies.coins += def.reward.coins;
    SAVE.pass.xp += def.reward.xp;
    if (Math.random() < 0.25) { SAVE.currencies.shards += 2; toast('+2 Shards bonus!', 'good'); }
    AudioMan.play('claim');
    toast('+' + def.reward.coins + ' Coins, +' + def.reward.xp + ' Season XP', 'good');
    saveGame(); refreshCurrencies(); renderQuests();
  });
}

function claimDailyReward() {
  const today = todayStr();
  if (SAVE.daily.lastClaim === today) return;
  const gap = SAVE.daily.lastClaim ? daysBetween(new Date(SAVE.daily.lastClaim).getTime(), Date.now()) : 2;
  /* soft continuation: streak resets only after 2+ missed days */
  if (gap > 1) SAVE.daily.day = 0;
  const reward = DAILY_REWARDS[SAVE.daily.day % 7];
  SAVE.daily.day++;
  SAVE.daily.lastClaim = today;
  if (reward.coins) { SAVE.currencies.coins += reward.coins; toast('+' + reward.coins + ' Coins!', 'good'); }
  if (reward.frags) { SAVE.collection[reward.frags.card].frags += reward.frags.amount; toast('+' + reward.frags.amount + ' ' + getCard(reward.frags.card).name + ' frags!', 'good'); }
  if (reward.shards) { SAVE.currencies.shards += reward.shards; toast('+' + reward.shards + ' Shards!', 'good'); }
  if (reward.crate) addCrate(reward.crate);
  if (reward.banner) { SAVE.vanguardClaimed.push('banner:' + reward.banner); SAVE.profile.banner = reward.banner; toast('Banner unlocked!', 'good'); }
  AudioMan.play('claim');
  saveGame(); refreshCurrencies(); renderQuests();
}

/* ==================== 7. BATTLE ENGINE ==================== */
const AW = 900, AH = 1600;                 /* logical arena size */
const RIVER_Y = 800, RIVER_HALF = 42;      /* river center + half height */
const RIVER_TOP = RIVER_Y - RIVER_HALF, RIVER_BOT = RIVER_Y + RIVER_HALF;
const BRIDGES = [{ x: 190 }, { x: 710 }];
const BRIDGE_W = 116;
const TOWER_DEFS = {
  bastion: { hp: 2200, dmg: 95, range: 260, as: 0.8, radius: 52 },
  citadel: { hp: 3600, dmg: 160, range: 310, as: 0.7, radius: 66 }
};
const POS = {
  player: { bastion: [[190, 1250], [710, 1250]], citadel: [450, 1440] },
  enemy:  { bastion: [[190, 350], [710, 350]], citadel: [450, 160] }
};
const MAX_AETHER = 10, AETHER_RATE = 1 / 2.8;

let B = null; /* current battle state (null outside battle) */

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randi(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeSideState(deckIds, level) {
  const deck = shuffle(deckIds.slice());
  return { deckLevel: level, hand: deck.slice(0, 4), queue: deck.slice(4) };
}

function startBattleState(difficulty, personalityId, enemyName, isTraining) {
  const deck = activeDeck();
  const avgLvl = Math.round(deck.cards.reduce((a, id) => a + SAVE.collection[id].level, 0) / 8);
  const lvl = clamp(avgLvl || 1, 1, 15);
  const botDeck = BOT_DECKS[personalityId] || BOT_DECKS.balanced;
  const pers = BOT_PERSONALITIES.find(p => p.id === personalityId) || BOT_PERSONALITIES[0];
  const diff = BOT_DIFFICULTIES[difficulty];
  B = {
    difficulty, isTraining: !!isTraining,
    enemy: { name: enemyName, personality: pers, level: clamp(lvl + randi(-1, 1), 1, 15), avatar: choice(['\u{1F98A}', '\u{1F989}', '\u{1F419}', '\u{1F996}', '\u{1F432}', '\u{1F987}']) },
    time: 180, phase: 'opening', overtime: false, suddenDeath: false, ended: false, endTimer: 0,
    aether: { player: 5, enemy: 5 },
    hands: { player: makeSideState(deck.cards, lvl), enemy: makeSideState(botDeck, lvl) },
    units: [], projectiles: [], spells: [], zones: [], particles: [], dmgNums: [],
    towers: [],
    crests: { player: 0, enemy: 0 },
    selected: -1, speed: 1, paused: false,
    shake: 0, zoom: 0,
    stats: { damageDealt: 0, towerDamage: 0, aetherSpent: 0, cardsPlayed: {}, aetherSpentEnemy: 0, longest: null, played: 0 },
    bot: { timer: 2000, lastDecide: 0 },
    tutorial: null,
    scale: 1, dpr: 1
  };
  /* towers */
  for (const team of ['player', 'enemy']) {
    for (const [x, y] of POS[team].bastion) B.towers.push(makeTower(team, 'bastion', x, y, lvl));
    const [cx, cy] = POS[team].citadel;
    B.towers.push(makeTower(team, 'citadel', cx, cy, lvl));
  }
  return B;
}

function makeTower(team, type, x, y, lvl) {
  const d = TOWER_DEFS[type];
  const m = 1 + 0.09 * (lvl - 1);
  return {
    isTower: true, isStructure: true, team, type, x, y,
    hp: Math.round(d.hp * m), maxHp: Math.round(d.hp * m),
    dmg: Math.round(d.dmg * m), range: d.range, atkInterval: 1 / d.as, atkCd: rand(0, 0.5),
    radius: d.radius, alive: true, active: type === 'bastion', wakeAnim: 0,
    aim: 0, recoil: 0, hitFlash: 0, target: null, cracks: 0
  };
}

/* ---------- deployment ---------- */
function towerAt(x, y, pad = 90) {
  return B.towers.find(t => t.alive && dist(x, y, t.x, t.y) < t.radius + pad);
}

function validPlacement(card, x, y, team) {
  if (x < 20 || x > AW - 20 || y < 20 || y > AH - 20) return false;
  if (card.kind === 'spell') return true;
  if (towerAt(x, y)) return false;
  if (card.kind === 'struct') return team === 'player' ? y > RIVER_BOT + 30 : y < RIVER_TOP - 30;
  if (card.s && card.s.deployAnywhere) return true;
  return team === 'player' ? y > RIVER_BOT : y < RIVER_TOP;
}

function deployCard(team, handIdx, x, y) {
  const side = B.hands[team];
  const cardId = side.hand[handIdx];
  if (!cardId) return false;
  const card = getCard(cardId);
  const cost = card.cost;
  if (B.aether[team] < cost) return false;
  if (!validPlacement(card, x, y, team)) return false;
  B.aether[team] -= cost;
  /* cycle */
  side.queue.push(cardId);
  side.hand[handIdx] = side.queue.shift();
  if (team === 'player') {
    B.stats.aetherSpent += cost;
    B.stats.played++;
    B.stats.cardsPlayed[cardId] = (B.stats.cardsPlayed[cardId] || 0) + 1;
    questEvent('aetherSpent', cost);
    if (card.kind === 'spell') { questEvent('tactics', 1); SAVE.stats.tacticsUsed++; }
    if (card.s && card.s.fly) questEvent('flyingUnits', card.s.cnt || 1);
    if (card.cat === 'Vanguard Unit') questEvent('vanguardUnits', card.s.cnt || 1);
    AudioMan.play('deploy');
  } else {
    B.stats.aetherSpentEnemy += cost;
  }
  /* spawn */
  if (card.kind === 'spell') {
    B.spells.push({ card, fx: fxAtLevel(card, B.hands[team].deckLevel), x, y, t: card.fx.delay, team });
    AudioMan.play('spell');
  } else {
    const st = scaledStats(card, B.hands[team].deckLevel);
    const n = st.cnt || 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ox = n > 1 ? Math.cos(a) * 16 : 0, oy = n > 1 ? Math.sin(a) * 16 : 0;
      spawnUnit(team, card, st, clamp(x + ox, 15, AW - 15), clamp(y + oy, 15, AH - 15));
    }
    spawnParticles(x, y, 8, 'spawn', teamColor(team));
  }
  return true;
}

function spawnUnit(team, card, st, x, y) {
  const u = {
    isUnit: true, isStructure: card.kind === 'struct',
    team, card, x, y,
    hp: st.hp, maxHp: st.hp, dmg: st.dmg || 0,
    range: st.rng || 26, atkInterval: st.as ? 1 / st.as : 1, atkCd: rand(0.1, 0.4),
    spd: st.spd || 0, sight: st.sight || 180, targets: st.targets || 'ground',
    fly: st.fly ? 1 : 0, splash: st.splash || 0, bldgMult: st.bldgMult || 1,
    shield: st.shield || 0, maxShield: st.shield || 0,
    evade: st.evade || 0, reflect: st.reflect || 0, firstHit: st.firstHit || 1, firstHitUsed: false,
    heal: st.heal || 0, healR: st.healR || 0, healCd: 0,
    slowAura: st.slowAura || null, life: st.life || 0,
    onDeath: st.onDeath || null, proj: st.proj || null,
    radius: card.vis === 'colossus' ? 26 : card.vis === 'golem' ? 22 : st.cnt > 1 ? 12 : 16,
    state: 'spawn', spawnT: 0.45, dieT: 0,
    target: null, retargetT: rand(0, 0.25),
    slowUntil: 0, slowPct: 0, rootUntil: 0, stunUntil: 0,
    atkAnim: 0, hurtFlash: 0, bobPh: rand(0, 7), facing: team === 'player' ? -1 : 1,
    lifetime: 0, dmgDealt: 0
  };
  B.units.push(u);
  if (team === 'player' && !B.stats.longest) B.stats.longest = { id: u.card.id, born: B.time || 180, t: 0 };
  return u;
}

/* ---------- targeting ---------- */
function canAttack(att, ent) {
  if (att.targets === 'both') return true;
  if (att.targets === 'build') return !!ent.isTower || (ent.isStructure && ent.team !== att.team);
  if (ent.fly) return att.targets === 'air';
  return att.targets !== 'air';
}

function findTarget(u, enemies) {
  if (u.targets === 'build' || (u.isStructure && u.dmg === 0)) {
    /* building-only: nearest tower; but ground units blocked by structures will hit them via proximity check */
    let best = null, bd = 1e9;
    for (const t of B.towers) {
      if (t.team === u.team || !t.alive) continue;
      const d = dist(u.x, u.y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    /* structures (barricades) intercept ground units */
    if (!u.fly) {
      for (const e of enemies) {
        if (!e.isStructure || e.team === u.team) continue;
        const d = dist(u.x, u.y, e.x, e.y);
        if (d < u.sight && d - 40 < bd) { bd = d - 40; best = e; }
      }
    }
    return best;
  }
  let best = null, bd = 1e9;
  for (const e of enemies) {
    if (!canAttack(u, e)) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bd && d <= u.sight + (e.radius || 30)) { bd = d; best = e; }
  }
  if (best) return best;
  /* nearest tower */
  let bt = null, btd = 1e9;
  for (const t of B.towers) {
    if (t.team === u.team || !t.alive) continue;
    const d = dist(u.x, u.y, t.x, t.y);
    if (d < btd) { btd = d; bt = t; }
  }
  return bt;
}

function enemiesOf(team) {
  const out = [];
  for (const u of B.units) if (u.team !== team && u.state !== 'dead' && u.state !== 'dying') out.push(u);
  for (const t of B.towers) if (t.team !== team && t.alive) out.push(t);
  return out;
}

/* ---------- movement & pathing ---------- */
function moveToward(u, tx, ty, dt, speedMul = 1) {
  const sp = u.spd * speedMul * (u.slowUntil > B.clock ? 1 - u.slowPct : 1) * dt;
  const d = dist(u.x, u.y, tx, ty);
  if (d < 0.5) return;
  u.x += (tx - u.x) / d * sp;
  u.y += (ty - u.y) / d * sp;
  if (u.spd > 0) u.facing = (tx - u.x) >= 0 ? 1 : -1;
  u.x = clamp(u.x, 12, AW - 12); u.y = clamp(u.y, 12, AH - 12);
}

/* bridge-aware waypoint for ground units */
function groundWaypoint(u, tx, ty) {
  const mySide = u.y < RIVER_Y ? -1 : 1;      /* -1 top, 1 bottom */
  const tgtSide = ty < RIVER_Y ? -1 : 1;
  if (u.fly || mySide === tgtSide) return [tx, ty];
  const withinBridgeX = BRIDGES.some(b => Math.abs(u.x - b.x) < BRIDGE_W / 2 + 10);
  if (withinBridgeX) {
    /* cross straight */
    const exitY = tgtSide === -1 ? RIVER_TOP - 6 : RIVER_BOT + 6;
    return [clamp(u.x, ...bridgeSpan(u)), exitY];
  }
  /* head for nearest bridge entry */
  let best = BRIDGES[0], bd = 1e9;
  for (const b of BRIDGES) { const d = Math.abs(u.x - b.x); if (d < bd) { bd = d; best = b; } }
  const entryY = mySide === -1 ? RIVER_TOP - 40 : RIVER_BOT + 40;
  return [clamp(best.x, ...bridgeSpan(u)), entryY];
}
function bridgeSpan(u) {
  /* don't cut corners off-arena */
  return [60, AW - 60];
}

function updateUnitMovement(u, dt) {
  const enemies = enemiesOf(u.team);
  /* heal aura */
  if (u.heal > 0) {
    u.healCd -= dt;
    if (u.healCd <= 0) {
      u.healCd = 1;
      let healed = false;
      for (const a of B.units) {
        if (a.team !== u.team || a === u || a.hp >= a.maxHp) continue;
        if (dist(u.x, u.y, a.x, a.y) <= u.healR) { a.hp = Math.min(a.maxHp, a.hp + u.heal); healed = true; if (u.team === 'player' && SAVE.settings.damageNumbers) addDmgNum(a.x, a.y - 20, '+' + Math.round(u.heal), '#6DE38B'); }
      }
      if (healed) spawnParticles(u.x, u.y, 4, 'heal', '#6DE38B');
    }
  }
  /* slow aura (echo totem) */
  if (u.slowAura) {
    for (const e of B.units) {
      if (e.team === u.team || e.state === 'dying') continue;
      if (dist(u.x, u.y, e.x, e.y) <= u.slowAura.r) { e.slowUntil = Math.max(e.slowUntil, B.clock + 0.1); e.slowPct = Math.max(e.slowPct, u.slowAura.pct); }
    }
  }
  /* lifetime */
  if (u.life > 0) {
    u.lifetime += dt;
    if (u.lifetime >= u.life) { killUnit(u, true); return; }
  }
  /* retarget periodically */
  u.retargetT -= dt;
  if (!u.target || u.retargetT <= 0 || (u.target.hp <= 0) || (u.target.alive === false)) {
    u.target = findTarget(u, enemies);
    u.retargetT = 0.3 + rand(0, 0.15);
  }
  const t = u.target;
  if (!t) return;
  const d = dist(u.x, u.y, t.x, t.y);
  const reach = u.range + (t.radius || 16);
  if (d <= reach) {
    u.state = 'attack';
    if (u.atkCd <= 0) doAttack(u, t);
  } else {
    u.state = u.spd > 0 ? 'move' : 'idle';
    if (u.spd > 0 && u.stunUntil <= B.clock && u.rootUntil <= B.clock) {
      const [wx, wy] = groundWaypoint(u, t.x, t.y);
      moveToward(u, wx, wy, dt);
    }
  }
  /* melee separation (same team, ground) */
  if (!u.fly) {
    for (const o of B.units) {
      if (o === u || o.team !== u.team || o.fly || o.state === 'dying') continue;
      const dd = dist(u.x, u.y, o.x, o.y);
      const min = (u.radius + o.radius) * 0.8;
      if (dd < min && dd > 0.01) {
        const push = (min - dd) * 0.5;
        u.x += (u.x - o.x) / dd * push * dt * 8;
        u.y += (u.y - o.y) / dd * push * dt * 8;
      }
    }
  }
}

/* ---------- combat ---------- */
function doAttack(u, t) {
  u.atkCd = u.atkInterval;
  u.atkAnim = 0.25;
  let dmg = u.dmg;
  if (u.firstHit > 1 && !u.firstHitUsed) { dmg *= u.firstHit; u.firstHitUsed = true; }
  if (u.bldgMult > 1 && (t.isTower || t.isStructure)) dmg *= u.bldgMult;
  if (u.proj) {
    B.projectiles.push({
      x: u.x, y: u.y - 14, target: t, team: u.team, spd: 340,
      dmg, splash: u.splash, kind: u.proj, owner: u,
      src: u.card ? u.card.id : 'tower'
    });
    if (u.team === 'player' || Math.random() < 0.3) AudioMan.play('shot');
  } else {
    dealDamage(t, dmg, u.team, u);
    if (u.splash) {
      for (const e of enemiesOf(u.team)) {
        if (e === t) continue;
        if (dist(e.x, e.y, t.x, t.y) <= u.splash) dealDamage(e, dmg * 0.7, u.team, u);
      }
      spawnParticles(t.x, t.y, 6, 'impact', teamColor(u.team));
    }
    spawnParticles(t.x, t.y, 3, 'melee', '#FFFFFF');
    if (dist(u.x, u.y, (u.x + t.x) / 2, (u.y + t.y) / 2) < 300) AudioMan.play('hit');
  }
}

function dealDamage(ent, amount, fromTeam, source) {
  if (ent.isTower && !ent.alive) return;
  if (ent.hp <= 0) return;
  /* evade */
  if (ent.evade && Math.random() < ent.evade) {
    if (SAVE.settings.damageNumbers) addDmgNum(ent.x, ent.y - 24, 'miss', '#B8C4D8');
    return;
  }
  let amt = amount;
  /* shield absorb */
  if (ent.shield > 0) {
    const absorbed = Math.min(ent.shield, amt);
    ent.shield -= absorbed;
    amt -= absorbed;
  }
  if (amt <= 0) { ent.hurtFlash = 0.15; return; }
  ent.hp -= amt;
  ent.hurtFlash = 0.15;
  if (ent.team === 'player' && fromTeam === 'enemy') { /* stats from player perspective */ }
  if (fromTeam === 'player') {
    B.stats.damageDealt += amt;
    if (ent.isTower) { B.stats.towerDamage += amt; questEvent('towerDamage', Math.round(amt)); }
  }
  if (source && source.dmgDealt !== undefined) source.dmgDealt += amt;
  if (SAVE.settings.damageNumbers && (ent.team === 'player' || amt > 60 || ent.isTower)) {
    addDmgNum(ent.x + rand(-8, 8), ent.y - 26, String(Math.round(amt)), ent.isTower ? '#FFD45A' : (fromTeam === 'player' ? '#8FE8FF' : '#FFB0A8'));
  }
  /* reflect */
  if (ent.reflect && source && !source.isTower && source.hp > 0) {
    dealDamage(source, amount * ent.reflect, ent.team, null);
  }
  /* citadel activation */
  if (ent.isTower && ent.type === 'citadel' && !ent.active && ent.alive) {
    ent.active = true; ent.wakeAnim = 1;
    spawnParticles(ent.x, ent.y, 14, 'wake', teamColor(ent.team));
    AudioMan.play('rankup');
  }
  if (ent.isTower) ent.cracks = 1 - ent.hp / ent.maxHp;
  if (ent.hp <= 0) {
    if (ent.isTower) destroyTower(ent, fromTeam);
    else killUnit(ent, false);
  }
}

function killUnit(u, silent) {
  if (u.state === 'dying' || u.state === 'dead') return;
  u.state = 'dying'; u.dieT = 0.4; u.target = null;
  if (u.onDeath) {
    if (u.onDeath.dmg) {
      spawnParticles(u.x, u.y, 16, 'burst', '#FFA050');
      for (const e of enemiesOf(u.team)) if (dist(u.x, u.y, e.x, e.y) <= u.onDeath.r) dealDamage(e, u.onDeath.dmg, u.team, null);
      AudioMan.play('spellhit');
    }
    if (u.onDeath.spawn) {
      const c = getCard(u.onDeath.spawn);
      const st = scaledStats(c, B.hands[u.team].deckLevel);
      for (let i = 0; i < (u.onDeath.cnt || 1); i++) spawnUnit(u.team, c, st, u.x + rand(-20, 20), u.y + rand(-20, 20));
    }
  }
  spawnParticles(u.x, u.y, 10, 'death', teamColor(u.team));
  if (!silent) AudioMan.play('death');
  /* longest surviving unit stat */
  if (u.team === 'player' && B.stats.longest && B.stats.longest.id === u.card.id) {
    const survived = (180 - (B.time || 0)) - (180 - (B.stats.longest.born || 180));
    B.stats.longest.t = Math.max(B.stats.longest.t, u.lifetime);
  }
}

function destroyTower(t, byTeam) {
  t.alive = false; t.hp = 0;
  spawnParticles(t.x, t.y, 30, 'debris', '#B8A878');
  B.shake = Math.max(B.shake, SAVE.settings.shake ? 14 : 4);
  AudioMan.play('towerdown');
  const scorer = byTeam;
  if (t.type === 'bastion') {
    B.crests[scorer] += 1;
    if (scorer === 'player') questEvent('bastions', 1);
    toast(t.team === 'player' ? 'Your Bastion fell!' : 'Enemy Bastion destroyed! +1 Crest', scorer === 'player' ? 'good' : 'bad');
    /* wake citadel of the fallen team */
    const core = B.towers.find(x => x.team === t.team && x.type === 'citadel');
    if (core && core.alive && !core.active) { core.active = true; core.wakeAnim = 1; spawnParticles(core.x, core.y, 14, 'wake', teamColor(core.team)); }
    crestBurstUI(scorer);
  } else {
    B.crests[scorer] += 3;
    endMatch(scorer === 'player' ? 'victory' : 'defeat', 'citadel');
  }
  /* overtime sudden death */
  if (B.overtime && !B.ended) {
    const other = t.team === 'player' ? 'enemy' : 'player';
    endMatch(scorer === 'player' ? 'victory' : 'defeat', 'overtime');
  }
  checkBastionWin();
}

function checkBastionWin() {
  /* destroying both bastions doesn't auto-win; core destruction ends match. */
}

/* ---------- spells ---------- */
function updateSpells(dt) {
  for (let i = B.spells.length - 1; i >= 0; i--) {
    const s = B.spells[i];
    s.t -= dt;
    if (s.t > 0) continue;
    resolveSpell(s);
    B.spells.splice(i, 1);
  }
}

function resolveSpell(s) {
  const fx = s.fx;
  const r = fx.radius;
  const enemies = enemiesOf(s.team);
  AudioMan.play('spellhit');
  B.shake = Math.max(B.shake, SAVE.settings.shake ? (fx.dmg > 400 ? 12 : 6) : 2);
  if (fx.type === 'burst' || fx.type === 'dot') {
    spawnParticles(s.x, s.y, fx.dmg > 400 ? 26 : 14, 'spell', s.team === 'player' ? '#8FE8FF' : '#FFB080');
    if (fx.type === 'burst') {
      for (const e of enemies) if (dist(s.x, s.y, e.x, e.y) <= r) dealDamage(e, fx.dmg, s.team, null);
      for (const t of B.towers) if (t.alive && t.team !== s.team && dist(s.x, s.y, t.x, t.y) <= r + t.radius) dealDamage(t, fx.dmg * 0.35, s.team, null);
    } else {
      B.zones.push({ x: s.x, y: s.y, r, dps: fx.dmg, t: fx.dur, team: s.team, tick: 0 });
    }
    if (fx.slow) for (const e of enemies) if (dist(s.x, s.y, e.x, e.y) <= r) { e.slowUntil = B.clock + (fx.dur || 2); e.slowPct = Math.max(e.slowPct, fx.slow); }
  } else if (fx.type === 'root') {
    spawnParticles(s.x, s.y, 12, 'root', '#6DBE6A');
    for (const e of enemies) if (dist(s.x, s.y, e.x, e.y) <= r && !e.fly) {
      dealDamage(e, fx.dmg, s.team, null);
      e.rootUntil = B.clock + (fx.dur || 1.8);
    }
  } else if (fx.type === 'chain') {
    let prev = { x: s.x, y: s.y };
    const hitSet = new Set();
    for (let c = 0; c < (fx.chains || 3); c++) {
      let best = null, bd = 1e9;
      for (const e of enemies) {
        if (hitSet.has(e)) continue;
        const d = dist(prev.x, prev.y, e.x, e.y);
        if (d < r + 60 && d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hitSet.add(best);
      B.lightnings = B.lightnings || [];
      B.lightnings.push({ x1: prev.x, y1: prev.y, x2: best.x, y2: best.y, t: 0.25 });
      dealDamage(best, fx.dmg, s.team, null);
      if (fx.stun) best.stunUntil = B.clock + fx.stun;
      prev = best;
    }
    spawnParticles(s.x, s.y, 10, 'spell', '#FFE86A');
  } else if (fx.type === 'pull') {
    spawnParticles(s.x, s.y, 18, 'spell', '#D98CFF');
    for (const e of enemies) {
      const d = dist(s.x, s.y, e.x, e.y);
      if (d <= r && !e.isTower) {
        dealDamage(e, fx.dmg, s.team, null);
        if (!e.isTower) {
          const pull = (r - d) * 0.7;
          e.x += (s.x - e.x) / Math.max(1, d) * pull;
          e.y += (s.y - e.y) / Math.max(1, d) * pull;
        }
        if (fx.slow) { e.slowUntil = B.clock + (fx.dur || 2); e.slowPct = Math.max(e.slowPct, fx.slow); }
      }
    }
  }
}

/* ---------- projectiles ---------- */
function updateProjectiles(dt) {
  for (let i = B.projectiles.length - 1; i >= 0; i--) {
    const p = B.projectiles[i];
    const t = p.target;
    const tx = t.x, ty = t.y - 10;
    const d = dist(p.x, p.y, tx, ty);
    const step = p.spd * dt;
    if (d <= step || (t.isTower && !t.alive) || (t.hp <= 0)) {
      /* impact */
      if (t.isTower ? t.alive : t.hp > 0) {
        if (p.splash) {
          spawnParticles(tx, ty, 8, 'impact', teamColor(p.team));
          for (const e of enemiesOf(p.team)) if (dist(e.x, e.y, tx, ty) <= p.splash) dealDamage(e, p.dmg, p.team, p.owner);
        } else {
          dealDamage(t, p.dmg, p.team, p.owner);
          spawnParticles(tx, ty, 4, 'impact', teamColor(p.team));
        }
        AudioMan.play('impact');
      }
      B.projectiles.splice(i, 1);
      continue;
    }
    p.x += (tx - p.x) / d * step;
    p.y += (ty - p.y) / d * step;
    p.ang = Math.atan2(ty - p.y, tx - p.x);
  }
}

/* ---------- zones (dot) ---------- */
function updateZones(dt) {
  for (let i = B.zones.length - 1; i >= 0; i--) {
    const z = B.zones[i];
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = 0.5;
      for (const e of enemiesOf(z.team)) if (dist(z.x, z.y, e.x, e.y) <= z.r) dealDamage(e, z.dps * 0.5, z.team, null);
    }
    if (z.t <= 0) B.zones.splice(i, 1);
  }
  if (B.lightnings) for (let i = B.lightnings.length - 1; i >= 0; i--) { B.lightnings[i].t -= dt; if (B.lightnings[i].t <= 0) B.lightnings.splice(i, 1); }
}

/* ---------- particles & numbers (pooled) ---------- */
function spawnParticles(x, y, n, kind, color) {
  if (SAVE.settings.reducedMotion) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    if (B.particles.length > 400) break;
    const a = rand(0, Math.PI * 2), sp = rand(30, 160);
    B.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(20, 60),
      life: rand(0.3, 0.8), maxLife: 0.8, size: rand(2, 5), color, kind
    });
  }
}
function addDmgNum(x, y, txt, color) {
  if (B.dmgNums.length > 60) B.dmgNums.shift();
  B.dmgNums.push({ x, y, txt, color, life: 0.9 });
}
function updateParticles(dt) {
  for (let i = B.particles.length - 1; i >= 0; i--) {
    const p = B.particles[i];
    p.life -= dt;
    if (p.life <= 0) { B.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 220 * dt;
  }
  for (let i = B.dmgNums.length - 1; i >= 0; i--) {
    const d = B.dmgNums[i];
    d.life -= dt; d.y -= 40 * dt;
    if (d.life <= 0) B.dmgNums.splice(i, 1);
  }
}

/* ==================== 8. BATTLE CONTROLLER ==================== */
let battleCanvas = null, battleCtx = null;

function beginBattle(difficulty, personalityId, enemyName, isTraining) {
  startBattleState(difficulty, personalityId, enemyName, isTraining);
  B.clock = 0;
  buildBattleHUD();
  showScreen('battle');
  battleCanvas = $('#gameCanvas');
  battleCtx = battleCanvas.getContext('2d');
  resizeBattleCanvas();
}

/* ---------- update ---------- */
function updateBattle(dt) {
  if (!B || B.paused || B.ended) { if (B && B.ended) { B.endTimer -= dt; if (B.endTimer <= 0 && !B.resultsShown) { B.resultsShown = true; showResults(); } } return; }
  const spd = B.speed;
  const sdt = dt * spd;
  B.clock = (B.clock || 0) + sdt;
  B.time -= sdt;

  /* phases */
  if (!B.overtime) {
    if (B.time <= 60 && B.phase !== 'final') {
      B.phase = 'final';
      showPhaseBanner('FINAL SURGE');
    }
    if (B.time <= 0) {
      if (B.crests.player !== B.crests.enemy) {
        endMatch(B.crests.player > B.crests.enemy ? 'victory' : 'defeat', 'time');
        return;
      } else {
        B.overtime = true; B.time = 60; B.phase = 'overtime';
        showPhaseBanner('OVERTIME');
      }
    }
  } else if (B.time <= 0) {
    /* tiebreaker: remaining tower health % */
    const hp = teamTowerHealth('player'), hpE = teamTowerHealth('enemy');
    if (Math.abs(hp - hpE) < 0.001) endMatch('draw', 'tiebreaker');
    else endMatch(hp > hpE ? 'victory' : 'defeat', 'tiebreaker');
    return;
  }

  /* aether */
  const rate = AETHER_RATE * (B.phase === 'final' || B.overtime ? 2 : 1);
  for (const team of ['player', 'enemy']) {
    const prev = B.aether[team];
    B.aether[team] = Math.min(MAX_AETHER, B.aether[team] + rate * sdt);
    if (team === 'player' && prev < MAX_AETHER && B.aether[team] >= MAX_AETHER) AudioMan.play('aether');
  }

  /* units */
  for (const u of B.units) {
    if (u.state === 'dying') { u.dieT -= sdt; if (u.dieT <= 0) u.state = 'dead'; continue; }
    if (u.state === 'dead') continue;
    if (u.spawnT > 0) { u.spawnT -= sdt; continue; }
    u.atkCd -= sdt; u.atkAnim = Math.max(0, u.atkAnim - sdt);
    u.hurtFlash = Math.max(0, u.hurtFlash - sdt);
    updateUnitMovement(u, sdt);
  }
  /* cleanup dead */
  for (let i = B.units.length - 1; i >= 0; i--) if (B.units[i].state === 'dead') B.units.splice(i, 1);

  /* towers */
  for (const t of B.towers) {
    if (!t.alive) continue;
    t.hitFlash = Math.max(0, (t.hitFlash || 0) - sdt);
    t.recoil = Math.max(0, (t.recoil || 0) - sdt * 3);
    t.wakeAnim = Math.max(0, t.wakeAnim - sdt);
    if (!t.active) continue;
    t.atkCd -= sdt;
    /* acquire target */
    let best = null, bd = 1e9;
    for (const u of B.units) {
      if (u.team === t.team || u.state === 'dying' || u.state === 'dead' || u.spawnT > 0) continue;
      const d = dist(t.x, t.y, u.x, u.y);
      if (d <= t.range && d < bd) { bd = d; best = u; }
    }
    t.target = best;
    if (best) {
      t.aim = Math.atan2(best.y - t.y, best.x - t.x);
      if (t.atkCd <= 0) {
        t.atkCd = t.atkInterval;
        t.recoil = 1;
        B.projectiles.push({
          x: t.x, y: t.y - 20, target: best, team: t.team, spd: 420,
          dmg: t.dmg, splash: 0, kind: t.type === 'citadel' ? 'core' : 'tower', owner: null,
          src: 'tower'
        });
        if (t.team === 'player' || Math.random() < 0.4) AudioMan.play('towershot');
      }
    }
  }

  updateSpells(sdt);
  updateProjectiles(sdt);
  updateZones(sdt);
  updateParticles(sdt);
  updateBot(sdt);
  if (B.tutorial) updateTutorial(sdt);

  B.shake = Math.max(0, B.shake - sdt * 30);
  updateBattleHUD();
}

function teamTowerHealth(team) {
  let hp = 0, max = 0;
  for (const t of B.towers) if (t.team === team) { max += t.maxHp; if (t.alive) hp += t.hp; }
  return max ? hp / max : 0;
}

function endMatch(result, reason) {
  if (B.ended) return;
  B.ended = true;
  B.result = result;
  B.reason = reason;
  B.endTimer = 1.4;
  AudioMan.play(result === 'victory' ? 'victory' : result === 'defeat' ? 'defeat' : 'tick');
  if (result === 'victory' && !SAVE.settings.reducedMotion) {
    for (let i = 0; i < 40; i++) {
      B.particles.push({
        x: rand(0, AW), y: rand(0, AH * 0.4), vx: rand(-40, 40), vy: rand(30, 120),
        life: rand(0.6, 1.4), maxLife: 1.4, size: rand(3, 6),
        color: choice(['#FFD45A', '#36C8FF', '#6DE38B', '#D98CFF']), kind: 'confetti'
      });
    }
  }
}
function showPhaseBanner(text) {
  const el = $('#phaseBanner');
  el.textContent = text;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth;
  el.style.animation = '';
  setTimeout(() => el.classList.add('hidden'), 1900);
  AudioMan.play('rankup');
}
function crestBurstUI(scorer) {
  const el = document.querySelector(scorer === 'player' ? '#crestP' : '#crestE');
  if (el) { el.style.transform = 'scale(1.5)'; setTimeout(() => el.style.transform = '', 300); }
}

/* ---------- rendering ---------- */
function resizeBattleCanvas() {
  if (!battleCanvas) return;
  const wrap = $('#canvasWrap');
  const availW = wrap.clientWidth, availH = wrap.clientHeight;
  const scale = Math.min(availW / AW, availH / AH);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  B.scale = scale; B.dpr = dpr;
  battleCanvas.style.width = (AW * scale) + 'px';
  battleCanvas.style.height = (AH * scale) + 'px';
  battleCanvas.width = Math.round(AW * scale * dpr);
  battleCanvas.height = Math.round(AH * scale * dpr);
}

function renderBattle() {
  if (!B || !battleCtx) return;
  const ctx = battleCtx;
  const s = B.scale * B.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#060B18';
  ctx.fillRect(0, 0, battleCanvas.width, battleCanvas.height);
  let ox = 0, oy = 0;
  if (B.shake > 0 && SAVE.settings.shake) { ox = rand(-B.shake, B.shake) * s; oy = rand(-B.shake, B.shake) * s; }
  ctx.setTransform(s, 0, 0, s, ox, oy);
  drawArena(ctx);
  /* spells pending warning */
  for (const sp of B.spells) drawSpellWarn(ctx, sp);
  /* zones */
  for (const z of B.zones) {
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(B.clock * 6);
    ctx.fillStyle = z.team === 'player' ? '#6DE38B' : '#B26CFF';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  /* placement preview under units */
  if (B.selected >= 0) drawPlacementPreview(ctx);
  /* entities sorted by y */
  const drawList = [];
  for (const u of B.units) if (u.state !== 'dead') drawList.push(u);
  for (const t of B.towers) if (t.alive) drawList.push(t);
  drawList.sort((a, b) => a.y - b.y);
  for (const e of drawList) e.isTower ? drawTower(ctx, e) : drawUnit(ctx, e);
  /* projectiles */
  for (const p of B.projectiles) drawProjectile(ctx, p);
  /* lightning */
  if (B.lightnings) for (const l of B.lightnings) drawLightning(ctx, l);
  /* particles */
  for (const p of B.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  /* damage numbers */
  ctx.font = '700 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for (const d of B.dmgNums) {
    ctx.globalAlpha = Math.min(1, d.life * 2);
    ctx.fillStyle = '#0008';
    ctx.fillText(d.txt, d.x + 1, d.y + 1);
    ctx.fillStyle = d.color;
    ctx.fillText(d.txt, d.x, d.y);
  }
  ctx.globalAlpha = 1;
}

function drawArena(ctx) {
  const fr = frontierForRank(SAVE.profile.marks);
  const th = fr.theme;
  /* ground (sprite art when available, procedural fallback) */
  const bg = Sprites.get('arena_bg');
  if (bg) {
    const bs = Math.max(AW / bg.width, AH / bg.height);
    const bw = bg.width * bs, bh = bg.height * bs;
    ctx.drawImage(bg, (AW - bw) / 2, (AH - bh) / 2, bw, bh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, AH);
    g.addColorStop(0, th.g2); g.addColorStop(0.5, th.g1); g.addColorStop(1, th.g2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, AW, AH);
    /* subtle tile checker */
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < AH; y += 100) for (let x = ((y / 100) % 2) * 50; x < AW; x += 100) ctx.fillRect(x, y, 50, 50);
    /* decorative rocks/crystals (deterministic) */
    ctx.fillStyle = th.deco;
    const deco = [[80, 600, 26], [830, 620, 30], [450, 690, 18], [60, 1080, 30], [850, 1100, 24], [450, 1150, 20], [140, 180, 22], [770, 160, 26], [450, 540, 14]];
    for (const [dx, dy, dr] of deco) { ctx.beginPath(); ctx.arc(dx, dy, dr, 0, 7); ctx.fill(); }
    ctx.fillStyle = th.accent;
    ctx.globalAlpha = 0.35;
    for (const [dx, dy, dr] of deco) { ctx.beginPath(); ctx.arc(dx, dy - 4, dr * 0.4, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  /* deployment zone tint (player side) */
  ctx.fillStyle = 'rgba(54,200,255,0.04)';
  ctx.fillRect(0, RIVER_BOT, AW, AH - RIVER_BOT);
  ctx.fillStyle = 'rgba(255,106,103,0.04)';
  ctx.fillRect(0, 0, AW, RIVER_TOP);
  /* river */
  const rg = ctx.createLinearGradient(0, RIVER_TOP, 0, RIVER_BOT);
  rg.addColorStop(0, th.river); rg.addColorStop(0.5, th.riverGlow); rg.addColorStop(1, th.river);
  ctx.fillStyle = rg;
  roundRectPath(ctx, 0, RIVER_TOP, AW, RIVER_BOT - RIVER_TOP, 20);
  ctx.fill();
  /* aether flow particles in river */
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 14; i++) {
    const px = ((i * 137 + (B.clock || 0) * 60) % (AW + 40)) - 20;
    const py = RIVER_Y + Math.sin(i * 2.3 + (B.clock || 0) * 2) * 18;
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(i + (B.clock || 0) * 3);
    ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  /* bridges */
  for (const b of BRIDGES) {
    ctx.fillStyle = '#8A6E4A';
    ctx.strokeStyle = '#5A4630'; ctx.lineWidth = 3;
    roundRectPath(ctx, b.x - BRIDGE_W / 2, RIVER_TOP - 14, BRIDGE_W, (RIVER_BOT - RIVER_TOP) + 28, 10);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,70,48,0.8)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const ly = RIVER_TOP + i * (RIVER_BOT - RIVER_TOP) / 4;
      ctx.beginPath(); ctx.moveTo(b.x - BRIDGE_W / 2 + 8, ly); ctx.lineTo(b.x + BRIDGE_W / 2 - 8, ly); ctx.stroke();
    }
  }
  /* mid line */
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, RIVER_Y); ctx.lineTo(AW, RIVER_Y); ctx.stroke();
  ctx.setLineDash([]);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSpellWarn(ctx, sp) {
  ctx.save();
  const p = 1 - sp.t / sp.card.fx.delay;
  ctx.strokeStyle = sp.team === 'player' ? 'rgba(143,232,255,0.9)' : 'rgba(255,140,110,0.9)';
  ctx.fillStyle = sp.team === 'player' ? 'rgba(143,232,255,0.15)' : 'rgba(255,140,110,0.15)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.fx.radius, 0, 7); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  /* incoming indicator */
  ctx.fillStyle = sp.team === 'player' ? '#8FE8FF' : '#FF8C6E';
  ctx.beginPath(); ctx.arc(sp.x, sp.y, 10 + p * 14, 0, 7); ctx.globalAlpha = 0.7; ctx.fill();
  ctx.restore();
}

function drawTower(ctx, t) {
  const col = teamColor(t.team);
  ctx.save();
  ctx.translate(t.x, t.y);
  /* base shadow */
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, t.radius * 0.5, t.radius * 0.9, t.radius * 0.4, 0, 0, 7); ctx.fill();
  const big = t.type === 'citadel';
  const r = t.radius;
  const sp = Sprites.get(t.type);
  if (sp) {
    /* sprite art (static structure; recoil squash + hit flash on top) */
    const tw = r * (big ? 3.6 : 2.7), thh = r * (big ? 3.4 : 3.0);
    const recoil = (t.recoil || 0) * 0.08;
    ctx.save();
    if (t.hitFlash > 0) ctx.filter = 'brightness(1.7)';
    if (big && !t.active) ctx.filter = 'brightness(0.55) saturate(0.6)';
    ctx.translate(0, recoil * 10);
    ctx.scale(1 + recoil, 1 - recoil);
    drawSpriteFit(ctx, sp, 0, -thh * 0.14, tw, thh);
    ctx.restore();
  } else {
    /* procedural body */
    ctx.fillStyle = t.hitFlash > 0 ? '#FFFFFF' : '#8A94B0';
    ctx.strokeStyle = '#31405C'; ctx.lineWidth = 4;
    roundRectPath(ctx, -r * 0.8, -r * 0.7, r * 1.6, r * 1.5, 12);
    ctx.fill(); ctx.stroke();
    /* roof */
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.7); ctx.lineTo(0, -r * 1.5); ctx.lineTo(r * 0.9, -r * 0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* crystal / eye */
    const pulse = 0.6 + 0.4 * Math.sin((B.clock || 0) * 3);
    ctx.fillStyle = t.active || t.type === 'bastion' ? col : '#4A5470';
    ctx.globalAlpha = t.type === 'citadel' && !t.active ? 0.5 : 0.9;
    ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.24 * (t.wakeAnim > 0 ? 1 + t.wakeAnim : pulse), 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    if (big) {
      /* crown spikes */
      ctx.fillStyle = '#FFD45A';
      for (const sx of [-r * 0.5, 0, r * 0.5]) {
        ctx.beginPath(); ctx.moveTo(sx - 6, -r * 0.72); ctx.lineTo(sx, -r * 0.72 - 16); ctx.lineTo(sx + 6, -r * 0.72); ctx.closePath(); ctx.fill();
      }
    }
    /* banner */
    ctx.fillStyle = col;
    ctx.beginPath();
    const wob = Math.sin((B.clock || 0) * 2 + t.x) * 4;
    ctx.moveTo(r * 0.85, -r * 1.5); ctx.lineTo(r * 0.85 + 26, -r * 1.45 + wob); ctx.lineTo(r * 0.85, -r * 1.2);
    ctx.fill();
  }
  /* cracks */
  if (t.cracks > 0.3) {
    ctx.strokeStyle = 'rgba(20,20,30,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.1, 0); ctx.lineTo(-r * 0.3, r * 0.3);
    if (t.cracks > 0.6) { ctx.moveTo(r * 0.4, -r * 0.3); ctx.lineTo(r * 0.15, r * 0.1); ctx.lineTo(r * 0.35, r * 0.4); }
    ctx.stroke();
  }
  /* hp bar */
  const bw = r * 1.7;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRectPath(ctx, -bw / 2, r * 0.95, bw, 10, 5); ctx.fill();
  ctx.fillStyle = col;
  roundRectPath(ctx, -bw / 2 + 1, r * 0.95 + 1, (bw - 2) * Math.max(0, t.hp / t.maxHp), 8, 4); ctx.fill();
  ctx.restore();
  /* range circle when placing nearby (subtle) */
  if (B.selected >= 0 && dist(B.hoverX || 0, B.hoverY || 0, t.x, t.y) < 160) {
    ctx.strokeStyle = col; ctx.globalAlpha = 0.15; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawUnit(ctx, u) {
  const col = teamColor(u.team);
  ctx.save();
  /* spawn drop-in */
  let scale = 1;
  if (u.spawnT > 0) { const p = 1 - u.spawnT / 0.45; scale = 0.4 + p * 0.6; ctx.globalAlpha = p; }
  if (u.state === 'dying') { const p = u.dieT / 0.4; scale = p; ctx.globalAlpha = p; ctx.rotate((1 - p) * 0.6); }
  const bob = u.state === 'move' ? Math.sin((B.clock || 0) * 10 + u.bobPh) * 3 : Math.sin((B.clock || 0) * 2.5 + u.bobPh) * 1.5;
  const flyOff = u.fly ? 14 + Math.sin((B.clock || 0) * 3 + u.bobPh) * 4 : 0;
  /* shadow */
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(u.x, u.y + 4, u.radius * (u.fly ? 0.7 : 0.9), u.radius * 0.35, 0, 0, 7); ctx.fill();
  /* team ring */
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.globalAlpha *= 0.9;
  ctx.beginPath(); ctx.arc(u.x, u.y, u.radius + 3, 0, 7); ctx.stroke();
  ctx.globalAlpha = u.spawnT > 0 || u.state === 'dying' ? ctx.globalAlpha : 1;
  /* body */
  ctx.translate(u.x, u.y - flyOff + bob);
  ctx.scale(scale * (u.facing || 1 >= 0 ? 1 : 1), scale);
  if (u.atkAnim > 0) ctx.translate((u.atkAnim / 0.25) * 3 * (u.target ? Math.sign(u.target.x - u.x || 1) : 1), 0);
  if (u.hurtFlash > 0) { ctx.filter = 'brightness(1.8)'; }
  drawVisShape(ctx, u.card.vis, u.card.rarity, 1);
  ctx.filter = 'none';
  ctx.restore();
  /* shield indicator */
  if (u.shield > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(u.x, u.y, u.radius + 7, 0, 7); ctx.stroke();
  }
  /* slow/root/stun icons */
  if (u.rootUntil > B.clock) drawStatusIcon(ctx, u.x, u.y - 26, '#6DBE6A', '\u{1F33F}');
  else if (u.slowUntil > B.clock) drawStatusIcon(ctx, u.x, u.y - 26, '#8FE8FF', '\u2744\uFE0F');
  if (u.stunUntil > B.clock) drawStatusIcon(ctx, u.x, u.y - 40, '#FFE86A', '\u2728');
  /* hp bar */
  if (u.hp < u.maxHp) {
    const bw = Math.max(24, u.radius * 2.2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRectPath(ctx, u.x - bw / 2, u.y - u.radius - (u.fly ? 30 : 16), bw, 6, 3); ctx.fill();
    ctx.fillStyle = col;
    roundRectPath(ctx, u.x - bw / 2 + 1, u.y - u.radius - (u.fly ? 30 : 16) + 1, (bw - 2) * Math.max(0, u.hp / u.maxHp), 4, 2); ctx.fill();
  }
}
function drawStatusIcon(ctx, x, y, color, icon) {
  ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(icon, x, y);
}

function drawProjectile(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.ang) ctx.rotate(p.ang);
  const col = teamColor(p.team);
  switch (p.kind) {
    case 'ember': ctx.fillStyle = '#FF9A50'; glowBall(ctx, 6, '#FFD090'); break;
    case 'bolt': ctx.fillStyle = '#FFE86A'; glowBall(ctx, 4, '#FFF8C0'); break;
    case 'shard': ctx.fillStyle = '#B8E8F0'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill(); break;
    case 'hex': ctx.fillStyle = '#6DE38B'; glowBall(ctx, 6, '#C0F8D0'); break;
    case 'seed': ctx.fillStyle = '#FFD45A'; glowBall(ctx, 4, '#FFF0B0'); break;
    case 'prism': ctx.fillStyle = '#5DEBFF'; glowBall(ctx, 6, '#D0F8FF'); break;
    case 'tower': ctx.fillStyle = col; glowBall(ctx, 7, '#FFFFFF'); break;
    case 'core': ctx.fillStyle = col; glowBall(ctx, 10, '#FFFFFF'); break;
    default: ctx.fillStyle = col; glowBall(ctx, 5, '#FFFFFF');
  }
  ctx.restore();
}
function glowBall(ctx, r, inner) {
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2);
  g.addColorStop(0, inner); g.addColorStop(0.5, ctx.fillStyle); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, 7); ctx.fill();
  ctx.fillStyle = inner;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill();
}
function drawLightning(ctx, l) {
  ctx.strokeStyle = '#FFE86A'; ctx.lineWidth = 3; ctx.globalAlpha = Math.min(1, l.t * 4);
  ctx.beginPath(); ctx.moveTo(l.x1, l.y1);
  const seg = 4;
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    ctx.lineTo(lerp(l.x1, l.x2, t) + rand(-8, 8), lerp(l.y1, l.y2, t) + rand(-8, 8));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlacementPreview(ctx) {
  const card = getCard(B.hands.player.hand[B.selected]);
  if (!card) return;
  const x = B.hoverX, y = B.hoverY;
  if (x === undefined) return;
  const valid = validPlacement(card, x, y, 'player') && B.aether.player >= card.cost;
  const col = valid ? 'rgba(109,227,139,0.9)' : 'rgba(255,112,112,0.9)';
  ctx.save();
  if (card.kind === 'spell') {
    ctx.strokeStyle = col; ctx.fillStyle = valid ? 'rgba(109,227,139,0.12)' : 'rgba(255,112,112,0.12)';
    ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.arc(x, y, card.fx.radius, 0, 7); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = col; ctx.fillStyle = valid ? 'rgba(109,227,139,0.15)' : 'rgba(255,112,112,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, 26, 14, 0, 0, 7); ctx.fill(); ctx.stroke();
    /* silhouette */
    ctx.globalAlpha = 0.5;
    ctx.translate(x, y);
    drawVisShape(ctx, card.vis, card.rarity, 1);
    /* structure range circle */
    if (card.kind === 'struct' && card.s.rng) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(0, 0, card.s.rng, 0, 7); ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------- battle HUD ---------- */
function buildBattleHUD() {
  const e = B.enemy;
  $('#battleTop').innerHTML = `
    <div class="bt-enemy">
      <div class="bt-avatar" style="background:var(--panel2)">${e.avatar}</div>
      <div><div class="bt-name">${esc(e.name)}</div><div class="bt-rank">${BOT_DIFFICULTIES[B.difficulty].label} \u00B7 Lv ${e.level}</div></div>
      <div class="bt-crests" id="crestE" title="Enemy Crests"></div>
    </div>
    <div class="bt-center">
      <div class="bt-timer" id="btTimer">3:00</div>
      <div class="bt-phase" id="btPhase">BATTLE START</div>
    </div>
    <div class="bt-crests" id="crestP" title="Your Crests"></div>
    <button class="bt-pause" id="btnPause" aria-label="Pause">${B.isTraining ? '\u23F8' : '\u2699'}</button>`;
  $('#btnPause').onclick = openPauseMenu;
  $('#battleBottom').innerHTML = `
    <div class="aether-bar"><div class="aether-fill" id="aetherFill"></div>
      ${[1,2,3,4,5,6,7,8,9].map(i => `<div class="aether-seg" style="left:${i * 10}%"></div>`).join('')}
      <div class="aether-num" id="aetherNum">5</div></div>
    <div class="hand-row" id="handRow"></div>`;
  renderHand();
  updateBattleHUD();
}

function renderHand() {
  const row = $('#handRow');
  const side = B.hands.player;
  let html = `<div class="next-card"><span class="nl">NEXT</span><canvas class="art2" id="nextArt" width="40" height="40"></canvas><span class="nl" style="color:var(--aether2)">${getCard(side.queue[0]).cost}</span></div>`;
  side.hand.forEach((id, i) => {
    const c = getCard(id);
    html += `<div class="hand-card" data-hand="${i}" style="--rc:${RARITY_COLOR[c.rarity]}" role="button" aria-label="${esc(c.name)}, ${c.cost} aether">
      <div class="hcost">${c.cost}</div><canvas class="hart" width="48" height="48"></canvas>
      <div class="hname">${esc(c.name)}</div></div>`;
  });
  row.innerHTML = html;
  row.querySelectorAll('[data-hand]').forEach((el, i) => {
    const c = getCard(side.hand[i]);
    drawCardIcon(el.querySelector('canvas'), c, 48);
    el.onclick = () => selectCard(i);
    if (!SAVE.settings.reducedMotion) el.classList.add('dealing');
  });
  drawCardIcon($('#nextArt'), getCard(side.queue[0]), 40);
  updateBattleHUD();
}

function selectCard(i) {
  const c = getCard(B.hands.player.hand[i]);
  if (B.aether.player < c.cost) {
    AudioMan.play('poor');
    const el = document.querySelector(`[data-hand="${i}"]`);
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    toast('Not enough Aether (' + c.cost + ' needed)', 'bad');
    return;
  }
  AudioMan.play('select');
  B.selected = B.selected === i ? -1 : i;
  updateBattleHUD();
}

function updateBattleHUD() {
  if (!B) return;
  /* timer */
  const t = Math.max(0, Math.ceil(B.time));
  const timer = $('#btTimer');
  if (timer) {
    timer.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    timer.classList.toggle('urgent', t <= 30);
  }
  const phase = $('#btPhase');
  if (phase) phase.textContent = B.overtime ? 'OVERTIME' : B.phase === 'final' ? 'FINAL SURGE' : 'BATTLE';
  /* crests */
  for (const [id, team] of [['crestE', 'enemy'], ['crestP', 'player']]) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.childElementCount !== 3) {
      el.innerHTML = [0, 1, 2].map(i => `<svg class="crest-ico" viewBox="0 0 20 16"><path fill="#FFD45A" d="M2 14h16l-1.5-8-4 3.5L10 3 7.5 9.5l-4-3.5z"/></svg>`).join('');
    }
    [...el.children].forEach((svg, i) => svg.classList.toggle('on', i < B.crests[team]));
  }
  /* aether */
  const fill = $('#aetherFill');
  if (fill) {
    fill.style.width = (B.aether.player / MAX_AETHER * 100) + '%';
    fill.classList.toggle('full', B.aether.player >= MAX_AETHER);
  }
  const num = $('#aetherNum');
  if (num) num.textContent = Math.floor(B.aether.player);
  /* card affordability */
  $$('#handRow [data-hand]').forEach((el, i) => {
    const c = getCard(B.hands.player.hand[i]);
    const ok = B.aether.player >= c.cost;
    el.classList.toggle('unaffordable', !ok);
    el.classList.toggle('playable', ok);
    el.classList.toggle('selected', B.selected === i);
    el.querySelector('.hcost').classList.toggle('poor', !ok);
  });
}

function openPauseMenu() {
  B.paused = true;
  const canSurrender = true;
  $('#pauseMenu').classList.remove('hidden');
  $('#pauseMenu').innerHTML = `<div class="modal-bg"><div class="modal-box">
    <h3>${B.isTraining ? 'Paused' : 'Battle Settings'}</h3>
    <p style="font-size:13px;color:var(--dim);margin-bottom:10px">${B.isTraining ? 'Training match in progress.' : 'Ranked match \u2014 surrender counts as a loss.'}</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" id="pmResume">Resume</button>
      ${B.isTraining ? `<button class="btn" id="pmSpeed">Speed: ${B.speed}x</button>` : ''}
      <button class="btn danger" id="pmSurrender">Surrender</button>
    </div></div></div>`;
  $('#pmResume').onclick = () => { $('#pauseMenu').classList.add('hidden'); B.paused = false; };
  const sp = $('#pmSpeed');
  if (sp) sp.onclick = () => { B.speed = B.speed >= 4 ? 1 : B.speed * 2; sp.textContent = 'Speed: ' + B.speed + 'x'; };
  $('#pmSurrender').onclick = () => { $('#pauseMenu').classList.add('hidden'); B.paused = false; endMatch('defeat', 'surrender'); };
}

/* ---------- input ---------- */
function canvasToArena(e) {
  const rect = battleCanvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  return { x: cx / B.scale, y: cy / B.scale };
}

function onBattlePointer(e) {
  if (!B || B.paused || B.ended) return;
  const pos = canvasToArena(e);
  B.hoverX = pos.x; B.hoverY = pos.y;
  if (B.selected < 0) return;
  const card = getCard(B.hands.player.hand[B.selected]);
  const afford = B.aether.player >= card.cost;
  if (afford && validPlacement(card, pos.x, pos.y, 'player')) {
    const idx = B.selected;
    B.selected = -1;
    B.hoverX = undefined;
    deployCard('player', idx, pos.x, pos.y);
    renderHand();
  } else {
    AudioMan.play('poor');
    /* red flash feedback at point */
    spawnParticles(pos.x, pos.y, 5, 'no', '#FF7070');
  }
}

/* ==================== 9. BOT AI ==================== */
function updateBot(dt) {
  if (B.ended) return;
  const bot = B.bot;
  bot.timer -= dt * 1000;
  if (bot.timer > 0) return;
  const diff = BOT_DIFFICULTIES[B.difficulty];
  bot.timer = rand(diff.reaction[0], diff.reaction[1]) / 1000;
  botDecide(diff);
}

function botThreats() {
  /* player units on/near enemy side */
  return B.units.filter(u => u.team === 'player' && u.state !== 'dying' && u.y < RIVER_BOT + 140 && u.spawnT <= 0);
}

function botClusterValue(x, y, r) {
  let n = 0, hp = 0;
  for (const u of B.units) {
    if (u.team !== 'player' || u.state === 'dying') continue;
    if (dist(x, y, u.x, u.y) <= r) { n++; hp += u.hp; }
  }
  return { n, hp };
}

function botDecide(diff) {
  const side = B.hands.enemy;
  const pers = B.enemy.personality;
  const aether = B.aether.enemy;
  const threats = botThreats();
  const mistakes = diff.mistakes;

  /* occasionally make an imperfect play at lower difficulty */
  if (Math.random() < mistakes) {
    const affordable = side.hand.map((id, i) => ({ id, i })).filter(o => getCard(o.id).cost <= aether);
    if (affordable.length) {
      const o = choice(affordable);
      const c = getCard(o.id);
      const x = choice([150, 450, 750]), y = rand(80, RIVER_TOP - 60);
      if (validPlacement(c, x, y, 'enemy')) deployCard('enemy', o.i, x, y);
    }
    return;
  }

  /* 1. emergency tower defense */
  const inDanger = B.towers.find(t => t.team === 'enemy' && t.alive && t.type === 'bastion' &&
    B.units.some(u => u.team === 'player' && dist(u.x, u.y, t.x, t.y) < 320));
  if (threats.length && (inDanger || threats.reduce((a, u) => a + u.hp, 0) > 700)) {
    const clusterCenter = { x: threats.reduce((a, u) => a + u.x, 0) / threats.length, y: threats.reduce((a, u) => a + u.y, 0) / threats.length };
    const hasFlyer = threats.some(u => u.fly);
    const swarmSize = threats.length >= 3;
    /* score each hand card for defense */
    let best = null, bestScore = -1;
    side.hand.forEach((id, i) => {
      const c = getCard(id);
      if (c.cost > aether) return;
      let sc = 0;
      if (c.kind === 'spell') {
        const cv = botClusterValue(clusterCenter.x, clusterCenter.y, (c.fx ? c.fx.radius : 100));
        sc = c.fx && c.fx.dmg ? Math.min(cv.hp, c.fx.dmg * Math.min(cv.n, 4)) / 100 : 0;
        sc *= pers.spellUse;
        if (swarmSize) sc *= 1.6;
      } else {
        const antiAirOK = !hasFlyer || (c.s && (c.s.targets === 'both' || c.s.targets === 'air'));
        if (!antiAirOK) return;
        sc = ((c.s ? c.s.hp : 100) / 300) + ((c.s ? c.s.dmg : 0) / 100) * (c.s && c.s.cnt ? c.s.cnt : 1);
        sc *= (0.7 + pers.defense);
        if (c.kind === 'struct') sc *= pers.defense;
      }
      sc *= rand(0.8, 1.2);
      if (sc > bestScore) { bestScore = sc; best = { i, c }; }
    });
    if (best && bestScore > 1.2) {
      let px = clamp(clusterCenter.x + rand(-30, 30), 40, AW - 40);
      let py = clamp(clusterCenter.y - 90, 40, RIVER_TOP - 40);
      if (best.c.kind === 'spell') { px = clusterCenter.x; py = clusterCenter.y; }
      if (validPlacement(best.c, px, py, 'enemy')) { deployCard('enemy', best.i, px, py); return; }
    }
  }

  /* 2. spell value: punish clusters or finish low tower */
  if (Math.random() < 0.4 + pers.spellUse * 0.4) {
    for (let i = 0; i < side.hand.length; i++) {
      const c = getCard(side.hand[i]);
      if (c.kind !== 'spell' || c.cost > aether || !c.fx || !c.fx.dmg) continue;
      /* finish tower */
      const pt = B.towers.find(t => t.team === 'player' && t.alive && t.hp < c.fx.dmg * 0.35);
      if (pt && Math.random() < pers.spellUse) { deployCard('enemy', i, pt.x, pt.y); return; }
      /* hit big cluster */
      let bestCl = null, bestN = 0;
      for (const u of B.units) {
        if (u.team !== 'player' || u.state === 'dying') continue;
        const cv = botClusterValue(u.x, u.y, c.fx.radius);
        if (cv.n > bestN) { bestN = cv.n; bestCl = { x: u.x, y: u.y }; }
      }
      if (bestN >= 3 && Math.random() < pers.spellUse) { deployCard('enemy', i, bestCl.x, bestCl.y); return; }
    }
  }

  /* 3. offense: build a push */
  const pushThreshold = 3 + (1 - pers.aggression) * 4; /* high aggression pushes sooner */
  if (aether >= pushThreshold && Math.random() < 0.35 + pers.aggression * 0.5) {
    const lane = choice([BRIDGES[0].x, BRIDGES[1].x]);
    /* prefer wincon/tank first, then support */
    const order = ['wincon', 'tank', 'push', 'air', 'ranged', 'swarm', 'cycle', 'defense'];
    let picked = null;
    for (const role of order) {
      const opts = side.hand.map((id, i) => ({ id, i })).filter(o => {
        const c = getCard(o.id);
        return c.cost <= aether && c.kind !== 'spell' && c.role && c.role.includes(role);
      });
      if (opts.length) { picked = choice(opts); break; }
    }
    if (!picked) {
      const opts = side.hand.map((id, i) => ({ id, i })).filter(o => getCard(o.id).cost <= aether && getCard(o.id).kind !== 'spell');
      if (opts.length) picked = choice(opts);
    }
    if (picked) {
      const c = getCard(picked.id);
      let py = c.role && (c.role.includes('wincon') || c.role.includes('tank')) ? RIVER_TOP - 60 : RIVER_TOP - 160;
      if (c.s && c.s.deployAnywhere) { py = rand(RIVER_BOT + 120, 1180); }
      const px = c.s && c.s.deployAnywhere ? lane + rand(-120, 120) : lane + rand(-40, 40);
      if (validPlacement(c, px, py, 'enemy')) { deployCard('enemy', picked.i, px, py); return; }
    }
  }

  /* 4. cycle cheap card if aether nearly full */
  if (aether >= MAX_AETHER - 0.5) {
    const opts = side.hand.map((id, i) => ({ id, i })).filter(o => getCard(o.id).cost <= 3 && getCard(o.id).kind !== 'spell');
    if (opts.length) {
      const o = opts.reduce((a, b) => getCard(a.id).cost <= getCard(b.id).cost ? a : b);
      const x = choice([190, 710]);
      const y = rand(120, 260);
      if (validPlacement(getCard(o.id), x, y, 'enemy')) { deployCard('enemy', o.i, x, y); return; }
    }
  }
}

/* ==================== 10. MATCHMAKING / VERSUS / RESULTS ==================== */
let mmState = null, radarFx = null;

function startMatchmaking(mode) {
  ensureQuests();
  const deck = activeDeck();
  if (deck.cards.length < 8) {
    toast('Your Battle Kit needs 8 cards. Open the Deck Builder.', 'bad');
    openPanel('deck');
    return;
  }
  const mm = showScreen('matchmaking');
  const marks = SAVE.profile.marks;
  let difficulty;
  if (mode === 'training' || mode === 'easy' || mode === 'normal') difficulty = mode;
  else {
    const r = Math.random();
    if (marks < 200) difficulty = r < 0.5 ? 'easy' : 'normal';
    else if (marks < 700) difficulty = r < 0.3 ? 'easy' : r < 0.85 ? 'normal' : 'hard';
    else if (marks < 1500) difficulty = r < 0.15 ? 'normal' : r < 0.8 ? 'hard' : 'expert';
    else difficulty = r < 0.5 ? 'hard' : r < 0.9 ? 'expert' : 'boss';
  }
  const personalities = difficulty === 'boss' ? ['boss'] : BOT_PERSONALITIES.filter(p => p.id !== 'boss').map(p => p.id);
  mmState = {
    t: rand(1, 3), difficulty,
    personality: choice(personalities),
    name: choice(BOT_NAMES),
    done: false
  };
  $('#mmStatus').textContent = 'Scanning the Frontier';
  const rc = $('#radarCanvas');
  radarFx = { cv: rc, ctx: rc.getContext('2d'), t: 0 };
}

function updateMatchmaking(dt) {
  if (!mmState) return;
  mmState.t -= dt;
  const st = $('#mmStatus');
  if (st) st.textContent = mmState.t > 1.5 ? 'Scanning the Frontier\u2026' : 'Opponent found!';
  if (mmState.t <= 0 && !mmState.done) {
    mmState.done = true;
    showVersus();
  }
}

function renderRadar(dt) {
  if (!radarFx || !radarFx.cv) return;
  const { ctx, cv } = radarFx;
  const w = cv.width, h = cv.height;
  radarFx.t += dt;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0A1226';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 4, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(94,232,215,0.35)';
  for (const r of [0.3, 0.6, 0.9]) { ctx.beginPath(); ctx.arc(w / 2, h / 2, (w / 2 - 8) * r, 0, 7); ctx.stroke(); }
  /* sweep */
  const a = radarFx.t * 2.4;
  const g = ctx.createConicGradient ? ctx.createConicGradient(a, w / 2, h / 2) : null;
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.rotate(a);
  const grad = ctx.createLinearGradient(0, 0, w / 2 - 8, 0);
  grad.addColorStop(0, 'rgba(94,232,215,0.5)'); grad.addColorStop(1, 'rgba(94,232,215,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, w / 2 - 8, -0.5, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  /* blips */
  for (let i = 0; i < 3; i++) {
    const ba = i * 2.1 + 1, br = 40 + i * 34;
    const bl = 0.5 + 0.5 * Math.sin(radarFx.t * 3 + i * 2);
    ctx.fillStyle = `rgba(255,106,103,${0.3 + bl * 0.6})`;
    ctx.beginPath(); ctx.arc(w / 2 + Math.cos(ba) * br, h / 2 + Math.sin(ba) * br, 4, 0, 7); ctx.fill();
  }
}

function showVersus() {
  const vs = { t: 2.2 };
  mmState.vs = vs;
  const b = getBanner();
  const e = { avatar: choice(['\u{1F98A}', '\u{1F989}', '\u{1F419}', '\u{1F996}', '\u{1F432}', '\u{1F987}']) };
  $('#vsPlayer').innerHTML = `
    <div class="vs-avatar" style="background:linear-gradient(135deg,${b.color},${b.color2})">${avatarEmoji()}</div>
    <div class="vs-name">${esc(SAVE.profile.name)}</div>
    <div class="vs-rank">Lv ${SAVE.profile.level} \u00B7 ${fmt(SAVE.profile.marks)} \u2691 \u00B7 ${divisionForMarks(SAVE.profile.marks).name}</div>`;
  $('#vsEnemy').innerHTML = `
    <div class="vs-avatar" style="background:var(--panel2);border:2px solid var(--enemy)">${e.avatar}</div>
    <div class="vs-name">${esc(mmState.name)}</div>
    <div class="vs-rank">${BOT_DIFFICULTIES[mmState.difficulty].label} \u00B7 ${esc(BOT_PERSONALITIES.find(p => p.id === mmState.personality).name)}</div>`;
  showScreen('versus');
  setTimeout(() => {
    if (currentScreen !== 'versus') return;
    beginBattle(mmState.difficulty, mmState.personality, mmState.name, mmState.difficulty === 'training');
  }, 2200);
}

/* ---------- results & rewards ---------- */
function difficultyIndex() {
  return ['training', 'easy', 'normal', 'hard', 'expert', 'boss'].indexOf(B.difficulty);
}

function applyMatchRewards() {
  const result = B.result;
  const p = SAVE.profile;
  const beforeDiv = divisionForMarks(p.marks).name;
  const di = difficultyIndex();
  let marksDelta = 0;
  if (B.isTraining) marksDelta = result === 'victory' ? 5 : 0;
  else if (result === 'victory') {
    marksDelta = 25 + di * 2 + randi(0, 6);
    p.streak++;
    if (p.streak >= 3) marksDelta += 5;
  } else if (result === 'defeat') {
    p.streak = 0;
    if (p.lossShield > 0) { p.lossShield--; marksDelta = 0; }
    else marksDelta = -(10 + randi(0, 15));
  } else {
    marksDelta = p.marks < 400 ? 2 : 0;
    p.streak = 0;
  }
  p.marks = Math.max(0, p.marks + marksDelta);
  p.highestMarks = Math.max(p.highestMarks, p.marks);
  const afterDiv = divisionForMarks(p.marks).name;

  const coins = result === 'victory' ? (B.isTraining ? 30 : 70 + randi(0, 40) + di * 8) : result === 'draw' ? 40 : 25;
  const xp = result === 'victory' ? 30 + B.crests.player * 4 : result === 'draw' ? 20 : 15;
  const seasonXp = result === 'victory' ? 35 : 18;
  SAVE.currencies.coins += coins;
  p.xp += xp;
  SAVE.pass.xp += seasonXp;
  p.totalCrests += B.crests.player;
  /* level ups */
  while (p.xp >= p.level * 100) { p.xp -= p.level * 100; p.level++; toast('Level up! You are now Lv ' + p.level, 'good'); }
  /* crate chance on win */
  let crateWon = null;
  if (result === 'victory' && SAVE.crates.length < 4 && Math.random() < (B.isTraining ? 0.15 : 0.45)) {
    const roll = Math.random();
    crateWon = roll < 0.6 ? 'scout' : roll < 0.9 ? 'vanguard' : 'arcane';
    addCrate(crateWon);
  }
  /* quests & stats */
  SAVE.stats.matches++;
  questEvent('matches', 1);
  if (result === 'victory') { SAVE.stats.wins++; questEvent('wins', 1); }
  const deckAvg = deckAvgCost(activeDeck());
  if (result === 'victory' && deckAvg < 3.5) questEvent('cheapWin', 1, { cheapWin: true });
  if (result === 'victory') { p.wins++; }
  else if (result === 'defeat') p.losses++;
  else p.draws++;
  /* card mastery: played cards gain proficiency */
  for (const id of Object.keys(B.stats.cardsPlayed)) SAVE.collection[id].mastery += B.stats.cardsPlayed[id] * 2;
  /* history */
  SAVE.history.unshift({
    result, enemy: B.enemy.name, crests: B.crests.player, enemyCrests: B.crests.enemy,
    marks: marksDelta, difficulty: B.difficulty, date: Date.now()
  });
  if (SAVE.history.length > 20) SAVE.history.length = 20;
  saveGame();
  refreshCurrencies();
  return { marksDelta, coins, xp, seasonXp, crateWon, beforeDiv, afterDiv, rankUp: beforeDiv !== afterDiv && marksDelta >= 0 };
}

function showResults() {
  const rewards = applyMatchRewards();
  const r = B.result;
  const score = B.crests.player + ' \u2013 ' + B.crests.enemy;
  const mostPlayed = Object.entries(B.stats.cardsPlayed).sort((a, b) => b[1] - a[1])[0];
  const suggest = r === 'defeat' ? choice(DEFEAT_SUGGESTIONS) : null;
  const nd = nextDivision(SAVE.profile.marks);
  const dur = Math.round(180 - Math.min(180, Math.max(0, B.time)) + (B.overtime ? 60 : 0));
  const title = r === 'victory' ? 'VICTORY' : r === 'defeat' ? 'DEFEAT' : 'DRAW';
  $('#resultsInner').innerHTML = `
    <div class="res-title ${r}">${title}</div>
    <div class="res-score">${score}</div>
    <div class="res-sub">vs ${esc(B.enemy.name)} \u00B7 ${B.reason === 'citadel' ? 'Citadel destroyed!' : B.reason === 'overtime' ? 'Overtime sudden death' : B.reason === 'tiebreaker' ? 'Citadel Pressure tiebreaker' : B.reason === 'surrender' ? 'Surrendered' : 'Time expired'}</div>
    <div class="res-rewards">
      <div class="res-reward" style="color:${rewards.marksDelta >= 0 ? 'var(--gold)' : 'var(--err)'}">${rewards.marksDelta >= 0 ? '+' : ''}${rewards.marksDelta} Rank Marks</div>
      <div class="res-reward" style="color:var(--gold)">+${rewards.coins} Coins</div>
      <div class="res-reward" style="color:var(--player)">+${rewards.xp} XP</div>
      <div class="res-reward" style="color:var(--aether2)">+${rewards.seasonXp} Season XP</div>
      ${rewards.crateWon ? `<div class="res-reward" style="color:var(--teal)">${CRATE_TYPES[rewards.crateWon].name}!</div>` : ''}
    </div>
    ${rewards.rankUp ? `<div class="okbox" style="max-width:340px;margin:8px auto;text-align:center">\u{1F3C6} Division up! You are now <b>${rewards.afterDiv}</b></div>` : ''}
    ${nd ? `<div class="rankbar-wrap"><div class="rankbar-label"><span>${rewards.afterDiv}</span><span>${nd.name} at ${nd.min} \u2691</span></div>
      <div class="progressbar"><div style="width:${Math.min(100, (SAVE.profile.marks - divisionForMarks(SAVE.profile.marks).min) / (nd.min - divisionForMarks(SAVE.profile.marks).min) * 100)}%"></div></div></div>` : ''}
    ${suggest ? `<div class="res-suggestion">\u{1F4A1} ${suggest}</div>` : ''}
    <div class="res-stats">
      <div class="statrow"><span>Match duration</span><b>${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}</b></div>
      <div class="statrow"><span>Damage dealt</span><b>${fmt(B.stats.damageDealt)}</b></div>
      <div class="statrow"><span>Tower damage</span><b>${fmt(B.stats.towerDamage)}</b></div>
      <div class="statrow"><span>Aether spent</span><b>${B.stats.aetherSpent}</b></div>
      <div class="statrow"><span>Cards played</span><b>${B.stats.played}</b></div>
      <div class="statrow"><span>Most played card</span><b>${mostPlayed ? esc(getCard(mostPlayed[0]).name) + ' x' + mostPlayed[1] : '\u2014'}</b></div>
    </div>
    <div class="res-buttons">
      <button class="btn primary" id="resAgain">Battle Again</button>
      <button class="btn" id="resKit">View Battle Kit</button>
      <button class="btn" id="resHome">Return Home</button>
    </div>`;
  showScreen('results');
  $('#resAgain').onclick = () => { B = null; startMatchmaking('normal'); };
  $('#resKit').onclick = () => { B = null; renderDeck(); showScreen('deck'); };
  $('#resHome').onclick = () => { B = null; renderHome(); showScreen('home'); };
}

/* ==================== 11. TUTORIAL ==================== */
const TUT_STEPS = [
  { text: 'Welcome, Commander! I\u2019m Archivist Luma. Let\u2019s learn the art of the Frontier.', waitClick: true },
  { text: 'Your <b>Citadel Core</b> sits at the bottom, guarded by two <b>Bastion Towers</b>. Destroy the enemy\u2019s Core to win instantly \u2014 falling Bastions grant Crests.', waitClick: true },
  { text: 'Aether regenerates over time (the purple bar). Cards cost Aether to deploy. Now <b>tap Iron Squire</b> in your hand, then <b>tap your side</b> of the field to deploy him.', cond: () => (B.stats.cardsPlayed['iron_squire'] || 0) >= 1, highlight: 'iron_squire' },
  { text: 'Great! Now deploy <b>Ember Slingers</b> just behind the Squire so they can shoot safely.', cond: () => (B.stats.cardsPlayed['ember_slingers'] || 0) >= 1, highlight: 'ember_slingers' },
  { text: 'Ground units must cross the river at the two <b>bridges</b> \u2014 left and right lanes. Flying units soar straight over.', waitClick: true },
  { text: 'Uh oh \u2014 training dummies incoming! Select <b>Storm Flask</b> and <b>tap the enemy group</b> to blast them with area damage.', cond: () => (B.stats.cardsPlayed['storm_flask'] || 0) >= 1, spawnDummies: true },
  { text: 'Played cards rotate to the back of the queue \u2014 that\u2019s <b>card cycling</b>. Watch the NEXT preview to plan ahead.', waitClick: true },
  { text: 'Golden rule: <b>defend first, then counterattack</b> with surviving units. The rest of this match is yours \u2014 good luck, Commander!', final: true }
];

function startTutorial() {
  beginBattle('training', 'balanced', 'Luma (Practice)', true);
  B.tutorial = { step: 0 };
  B.speed = 0.6;
  showTutorialBubble(0);
}

function showTutorialBubble(i) {
  const step = TUT_STEPS[i];
  if (!step) return;
  $('#tutorialOverlay').classList.remove('hidden');
  $('#lumaBubble').innerHTML = `
    <div class="luma-head">
      <svg class="luma-face" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#5EE8D7" stroke="#1A2A4A" stroke-width="3"/><circle cx="14" cy="18" r="3" fill="#0D1630"/><circle cx="26" cy="18" r="3" fill="#0D1630"/><path d="M13 26 Q20 31 27 26" stroke="#0D1630" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
      <div class="luma-name">Archivist Luma</div>
      <div style="margin-left:auto;font-size:11px;color:var(--dim)">Step ${i + 1}/${TUT_STEPS.length}</div>
    </div>
    <div class="luma-text">${step.text}</div>
    <div class="luma-actions">
      <button class="btn small" id="tutSkip">Skip Tutorial</button>
      ${step.waitClick || step.final ? '<button class="btn small primary" id="tutNext">Got it</button>' : ''}
    </div>`;
  $('#tutSkip').onclick = finishTutorial;
  const nx = $('#tutNext');
  if (nx) nx.onclick = () => { AudioMan.play('ui'); advanceTutorial(); };
}

function advanceTutorial() {
  B.tutorial.step++;
  if (B.tutorial.step >= TUT_STEPS.length) { finishTutorial(); return; }
  showTutorialBubble(B.tutorial.step);
}

function updateTutorial(dt) {
  const i = B.tutorial.step;
  const step = TUT_STEPS[i];
  if (!step) return;
  if (step.spawnDummies && !B.tutorial.dummiesSpawned) {
    B.tutorial.dummiesSpawned = true;
    const c = getCard('mosslings');
    const st = scaledStats(c, 1);
    for (let k = 0; k < 2; k++) spawnUnit('enemy', c, st, 300 + k * 120, RIVER_TOP - 120);
    toast('Training dummies deployed!');
  }
  if (step.cond && step.cond()) advanceTutorial();
}

function finishTutorial() {
  if (!B || !B.tutorial) return;
  B.tutorial = null;
  B.speed = 1;
  $('#tutorialOverlay').classList.add('hidden');
  SAVE.profile.tutorialDone = true;
  SAVE.currencies.coins += 150;
  SAVE.collection['bolt_pixies'].frags += 20;
  addCrate('scout');
  saveGame();
  toast('Tutorial complete! +150 Coins, +20 Bolt Pixies frags, +1 Scout Crate', 'good');
}

/* ==================== 12. DEBUG TOOLS ==================== */
let debugOpen = false;

function toggleDebug() {
  debugOpen = !debugOpen;
  $('#debugPanel').classList.toggle('hidden', !debugOpen);
  if (debugOpen) buildDebug();
}

function buildDebug() {
  const items = [
    ['Toggle AI', () => { B._aiOff = !B._aiOff; toast('AI ' + (B._aiOff ? 'off' : 'on')); }],
    ['+5 Aether', () => { B.aether.player = Math.min(10, B.aether.player + 5); }],
    ['Force Final Surge', () => { B.time = Math.min(B.time, 59); }],
    ['Force Overtime', () => { if (!B.overtime) { B.overtime = true; B.time = 60; B.phase = 'overtime'; showPhaseBanner('OVERTIME'); } }],
    ['Damage Enemy Bastion', () => { const t = B.towers.find(t => t.team === 'enemy' && t.type === 'bastion' && t.alive); if (t) dealDamage(t, 800, 'player', null); }],
    ['Win Match', () => endMatch('victory', 'debug')],
    ['Lose Match', () => endMatch('defeat', 'debug')],
    ['+500 Coins', () => { SAVE.currencies.coins += 500; refreshCurrencies(); saveGame(); }],
    ['+10 Shards', () => { SAVE.currencies.shards += 10; refreshCurrencies(); saveGame(); }],
    ['Add Scout Crate', () => addCrate('scout')],
    ['Unlock All Cards', () => { for (const c of CARDS) SAVE.collection[c.id].unlocked = true; saveGame(); toast('All cards unlocked'); }],
    ['Reset Tutorial', () => { SAVE.profile.tutorialDone = false; saveGame(); toast('Tutorial flag reset'); }],
    ['Speed 0.5x', () => { B.speed = 0.5; }],
    ['Speed 1x', () => { B.speed = 1; }],
    ['Speed 2x', () => { B.speed = 2; }],
    ['Speed 4x', () => { B.speed = 4; }],
    ['Instant Crate Unlock', () => { for (const c of SAVE.crates) if (c.state === 'unlocking') { c.state = 'ready'; c.unlockEnd = 0; } saveGame(); toast('Crates ready'); }],
    ['Toggle Hitboxes', () => { B._showHitboxes = !B._showHitboxes; }]
  ];
  $('#debugGrid').innerHTML = items.map((it, i) => `<button data-dbg="${i}">${it[0]}</button>`).join('');
  $('#debugGrid').querySelectorAll('[data-dbg]').forEach(b => b.onclick = () => { try { items[+b.dataset.dbg][1](); } catch (e) { toast('Requires an active battle', 'bad'); } });
  $('#debugClose').onclick = toggleDebug;
}

/* ==================== INIT & MAIN LOOP ==================== */
let lastTime = 0, vsTimer = null;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (currentScreen === 'battle' && B) {
    if (!B._aiOff) updateBattle(dt);
    else {
      /* AI off: still update everything except bot decisions */
      const saved = updateBot;
      updateBattleNoAI(dt);
    }
    if (B) renderBattle();
  } else if (currentScreen === 'home') {
    renderHomeFx(dt);
  } else if (currentScreen === 'matchmaking') {
    updateMatchmaking(dt);
    if (radarFx) renderRadar(dt);
  }
  /* crate timer ticker */
  if (currentScreen === 'crates') {
    updateCrateTimers();
    $$('[data-cratetime]').forEach(el => {
      const i = +el.dataset.cratetime;
      const c = SAVE.crates[i];
      if (c && c.state === 'unlocking') {
        el.textContent = fmtTime(Math.max(0, c.unlockEnd - Date.now()));
        const bar = document.querySelector(`[data-cratebar="${i}"]`);
        if (bar) bar.style.width = ((1 - (c.unlockEnd - Date.now()) / (CRATE_TYPES[c.type].unlockSecs * 1000)) * 100) + '%';
      }
    });
  }
}

function updateBattleNoAI(dt) {
  /* run the battle update but skip bot decisions */
  const realUpdateBot = updateBot;
  updateBot = () => {};
  updateBattle(dt);
  updateBot = realUpdateBot;
}

function render() { /* canvas rendering handled inside update paths */ }

/* ---------- loading sequence ---------- */
const LOAD_STEPS = ['Preparing battlefield', 'Summoning commanders', 'Loading frontier map', 'Calibrating Aether', 'Ready for battle'];

function runLoading() {
  let step = 0, prog = 0;
  const tipEl = $('#loadTip');
  let tipIdx = 0;
  tipEl.textContent = '\u{1F4A1} ' + LOADING_TIPS[0];
  const tipTimer = setInterval(() => { tipIdx = (tipIdx + 1) % LOADING_TIPS.length; tipEl.textContent = '\u{1F4A1} ' + LOADING_TIPS[tipIdx]; }, 1800);
  const iv = setInterval(() => {
    prog += rand(8, 20);
    if (prog >= 100) {
      prog = 100;
      clearInterval(iv);
      $('#loadStep').textContent = LOAD_STEPS[4];
      $('#btnTapStart').classList.remove('hidden');
      $('#btnTapStart').classList.add('pulse');
    } else {
      $('#loadStep').textContent = LOAD_STEPS[Math.min(3, Math.floor(prog / 25))];
    }
    $('#loadBar').style.width = prog + '%';
  }, 260);
  $('#btnTapStart').onclick = () => {
    clearInterval(tipTimer);
    AudioMan.init();
    AudioMan.startMusic();
    AudioMan.play('claim');
    enterGame();
  };
  /* loading particles */
  const fx = $('#loadingFx');
  const fctx = fx.getContext('2d');
  let ft = 0;
  (function fxLoop() {
    if ($('#screen-loading').classList.contains('hidden')) return;
    fx.width = fx.clientWidth; fx.height = fx.clientHeight;
    ft += 0.016;
    for (let i = 0; i < 40; i++) {
      const x = (i * 173.3 + ft * (20 + i % 5 * 12)) % fx.width;
      const y = (i * 97.7 + Math.sin(ft + i) * 30) % fx.height;
      fctx.fillStyle = i % 3 === 0 ? '#5DEBFF' : i % 3 === 1 ? '#B86CFF' : '#FFD45A';
      fctx.globalAlpha = 0.15 + 0.15 * Math.sin(ft * 2 + i);
      fctx.beginPath(); fctx.arc(x, y, 1.5 + (i % 3), 0, 7); fctx.fill();
    }
    fctx.globalAlpha = 1;
    requestAnimationFrame(fxLoop);
  })();
}

function enterGame() {
  ensureQuests();
  updateCrateTimers();
  /* unlock cards by rank */
  for (const c of CARDS) if (SAVE.profile.marks >= c.unlock) SAVE.collection[c.id].unlocked = true;
  applySettingsToDOM();
  renderHome();
  showScreen('home');
  if (!SAVE.profile.tutorialDone) {
    setTimeout(() => {
      modal(`<h3>Welcome to CROWNFRONT</h3>
        <p style="font-size:14px;line-height:1.5">Commander, the Frontier awaits! Would you like Archivist Luma to walk you through your first battle?</p>
        <div class="modal-actions">
          <button class="btn" id="skipTut">Skip</button>
          <button class="btn primary" id="startTut">Start Tutorial</button>
        </div>`, { sticky: true });
      $('#startTut').onclick = () => { closeModal(); startTutorial(); };
      $('#skipTut').onclick = () => { closeModal(); SAVE.profile.tutorialDone = true; saveGame(); };
    }, 400);
  }
}

/* ---------- global events ---------- */
function bindGlobalEvents() {
  window.addEventListener('resize', () => { if (B && currentScreen === 'battle') resizeBattleCanvas(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2' || e.key === '`') { e.preventDefault(); toggleDebug(); return; }
    if (currentScreen !== 'battle' || !B) return;
    if (e.key >= '1' && e.key <= '4') selectCard(+e.key - 1);
    else if (e.key === 'Escape') { B.selected = -1; updateBattleHUD(); }
    else if (e.key === 'm' || e.key === 'M') { SAVE.settings.muted = !SAVE.settings.muted; AudioMan.applyVolumes(); toast(SAVE.settings.muted ? 'Muted' : 'Sound on'); }
    else if (e.key === ' ') { e.preventDefault(); if (B.isTraining) openPauseMenu(); }
  });
  const cv = $('#gameCanvas');
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); onBattlePointer(e); });
  cv.addEventListener('pointermove', (e) => { if (!B) return; const p = canvasToArena(e); B.hoverX = p.x; B.hoverY = p.y; });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); if (B) { B.selected = -1; updateBattleHUD(); } });
  /* prevent page scroll on battle touch */
  document.addEventListener('touchmove', (e) => { if (currentScreen === 'battle') e.preventDefault(); }, { passive: false });
}

function init() {
  SAVE = loadSaveData();
  applySettingsToDOM();
  Sprites.load();
  bindGlobalEvents();
  runLoading();
  requestAnimationFrame((ts) => { lastTime = ts; requestAnimationFrame(gameLoop); });
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'interactive' || document.readyState === 'complete') { if (!SAVE) init(); }
