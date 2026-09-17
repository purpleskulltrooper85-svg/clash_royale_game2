/* ============================================================
   TRASH CLASH ROYALE — complete arena battler
   ============================================================ */
'use strict';

/* ---------------- constants ---------------- */
const W = 400, H = 600;             // game coordinates
const CH = 700;                     // canvas pixel height (extra margin top/bottom)
const VS = CH / H;                  // vertical scale for background fill
const VXOFF = -(W * VS - W) / 2;    // horizontal offset from uniform scale
const RIVER_Y = 260, RIVER_HALF = 14;
const BRIDGE_L = 95, BRIDGE_R = 305, BRIDGE_HALF = 18;
const TILE = W / 18;                // CR-style 18-tile-wide grid
const FIELD = { x0: 30, x1: 370, y0: 72, y1: 440 };  // playable placement area
const MATCH_TIME = 180, OVERTIME = 60;
const ELIXIR_RATE = 1 / 2.8, ELIXIR_MAX = 10;
const IMGDIR = 'assets/img/';

/* ---------------- card definitions ---------------- */
const CARDS = {
  knight:      { key:'knight',      label:'Knight',       cost:3, count:1, hp:1766, dmg:202,  hitSpeed:1.2, range:18, speed:38, radius:9,  sprite:'Knight',      targets:'ground' },
  archers:     { key:'archers',     label:'Archers',      cost:3, count:2, hp:304,  dmg:112,  hitSpeed:0.9, range:49, speed:38, radius:7, sprite:'Archer',     targets:'any', projectile:'arrow' },
  skeletons:   { key:'skeletons',   label:'Skeletons',    cost:1, count:3, hp:81,   dmg:81,   hitSpeed:1.1, range:14, speed:49, radius:6,  sprite:'Skeleton',    targets:'ground' },
  giant:       { key:'giant',       label:'Giant',        cost:5, count:1, hp:4090, dmg:253,  hitSpeed:1.5, range:20, speed:22, radius:12, sprite:'Giant',       targets:'ground', buildingsOnly:true },
  minipekka:   { key:'minipekka',   label:'Mini P.E.K.K.A', cost:4, count:1, hp:1300, dmg:715, hitSpeed:1.6, range:16, speed:45, radius:9, sprite:'PekkaMini', targets:'ground', scale:1.17 },
  babydragon:  { key:'babydragon',  label:'Baby Dragon',  cost:4, count:1, hp:1152, dmg:161,  hitSpeed:1.5, range:42, speed:34, radius:10, sprite:'DragonBaby',  targets:'any', flying:true, splash:38, projectile:'fireball' },
  speargoblins:{ key:'speargoblins',label:'Spear Goblins',cost:2, count:3, hp:133,  dmg:81,   hitSpeed:1.7, range:49, speed:57, radius:6, sprite:'GoblinSpear', targets:'any', projectile:'spear' },
  golem:       { key:'golem',       label:'Golem',        cost:8, count:1, hp:5120, dmg:312,  hitSpeed:2.5, range:20, speed:22, radius:14, sprite:'Golem',       targets:'ground', buildingsOnly:true, deathSpawn:{ sprite:'Golemite', hp:1039, dmg:84, hitSpeed:2.5, range:16, speed:38, radius:10, targets:'ground', buildingsOnly:true }, deathCount:2 },
  cannon:      { key:'cannon',      label:'Cannon',       cost:3, count:1, hp:824,  dmg:212,  hitSpeed:0.9, range:122, speed:0, radius:11, building:true, sprite:'Cannon', targets:'ground', lifetime:30, projectile:'canonball' },
  fireball:    { key:'fireball',    label:'Fireball',     cost:4, spell:true, dmg:688, radius:42, towerFactor:0.4 },
  poison:      { key:'poison',      label:'Poison',       cost:4, spell:true, dps:92, duration:8, radius:45, towerFactor:0.4 },
};
const ALL_CARD_KEYS = ['knight','archers','skeletons','giant','minipekka','babydragon','speargoblins','golem','cannon','fireball','poison'];
const DEFAULT_DECK = ['knight','archers','skeletons','giant','minipekka','babydragon','speargoblins','fireball'];

/* ---------------- sound ---------------- */
const SFX = (() => {
  return {
    deploy(){}, spell(){}, win(){}, lose(){}, beep(){},
    towerDown(){
      const a = SFX.towerAudio || (SFX.towerAudio = new Audio('assets/sound/tower-down.wav'));
      const inst = a.cloneNode();
      inst.volume = 0.8;
      inst.play().catch(()=>{});
    },
    click(){
      const a = SFX.clickAudio || (SFX.clickAudio = new Audio('assets/sound/click.mp3'));
      const inst = a.cloneNode();
      inst.volume = 0.55;
      inst.play().catch(()=>{});
    },
    music(){
      const a = SFX.musicAudio || (SFX.musicAudio = new Audio('assets/sound/menu.mp3'));
      a.loop = true;
      a.volume = 0.5;
      if (!a.paused) return;
      a.play().catch(() => { SFX.musicPending = true; });
    },
    stopMusic(){
      if (SFX.musicAudio){ SFX.musicAudio.pause(); SFX.musicPending = false; }
    },
    battle(){
      SFX.stopMusic();
      if (SFX.battle2Audio) SFX.battle2Audio.pause();
      SFX.battle2Playing = false;
      const a = SFX.battle1Audio || (SFX.battle1Audio = new Audio('assets/sound/battle1.mp3'));
      a.loop = false;
      a.volume = 0.5;
      a.currentTime = 0;
      a.onended = () => {
        if (SFX.battle1Plays === undefined || SFX.battle1Plays < 2){
          SFX.battle1Plays = (SFX.battle1Plays || 0) + 1;
          if (SFX.battle1Plays < 2){ a.currentTime = 0; a.play().catch(()=>{}); return; }
        }
        // played 2x -> switch to the secondary loop forever
        const b = SFX.battle2Audio || (SFX.battle2Audio = new Audio('assets/sound/battle2.mp3'));
        b.loop = true;
        b.volume = 0.5;
        SFX.battle2Playing = true;
        b.play().catch(()=>{});
      };
      SFX.battle1Plays = 0;
      a.play().catch(()=>{});
    },
    stopBattle(){
      if (SFX.battle1Audio) SFX.battle1Audio.pause();
      if (SFX.battle2Audio) SFX.battle2Audio.pause();
      SFX.battle2Playing = false;
      SFX.battle1Plays = 0;
    },
    retryMusic(){
      if (!SFX.musicPending) return;
      SFX.musicPending = false;
      SFX.music();
    },
    startup(){
      const a = SFX.startupAudio || (SFX.startupAudio = new Audio('assets/sound/startup.mp3'));
      a.volume = 0.8;
      a.currentTime = 0;
      a.play().then(() => { SFX.startupPlayed = true; }).catch(() => { SFX.startupPending = true; });
    },
    retryStartup(){
      if (!SFX.startupPending) return;
      SFX.startupPending = false;
      SFX.startup();
    },
  };
})();

/* ---------------- asset loading ---------------- */
const IMG = {};   // key -> HTMLImageElement
const FRAMES = {}; // troop sprite -> { move:[], attack:[] }
let loadTotal = 1, loadDone = 0;

function tryLoad(src){
  return new Promise(res => {
    const i = new Image();
    i.onload = () => { loadDone++; res(i); };
    i.onerror = () => res(null);
    i.src = src;
  });
}
function loadImg(key, src){
  return tryLoad(src).then(i => { if (i) IMG[key] = i; });
}
async function loadAnim(sprite, folder){
  // probe frames in parallel chunks until the first gap
  const probe = async makeSrc => {
    const out = [];
    for (let start = 0; start < 60; start += 12){
      const batch = [];
      for (let i = start; i < start+12 && i < 60; i++) batch.push(tryLoad(makeSrc(i)));
      const res = await Promise.all(batch);
      for (const r of res){ if (!r) return out; out.push(r); }
    }
    return out;
  };
  const base = folder ? `Troop/${folder}/` : '';
  const move = await probe(i => `${IMGDIR}${base}${sprite}Move${i}.png`);
  const attack = await probe(i => `${IMGDIR}${base}${sprite}Attack${i}.png`);
  FRAMES[sprite] = { move, attack };
}
function tintImage(img, color){
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const cx = c.getContext('2d');
  cx.filter = 'hue-rotate(215deg) saturate(1.15)';
  cx.drawImage(img, 0, 0);
  return c;
}
async function loadAllAssets(){
  const single = [
    ['bgGame','BackgroundGame.png'],['bgScreen','BackgroundScreen.png'],['bgDiff','BackgroundDifficulty.png'],
    ['logo','ScreenLogo.png'],['menuText','MenuText.png'],['screenText','ScreenText.png'],
    ['btnStart','ButtonStart.png'],['btnEasy','ButtonEasy.png'],['btnMedium','ButtonMedium.png'],['btnHard','ButtonHard.png'],
    ['towerUpKing','TowerUpKing.png'],['towerUpPrincess','TowerUpPrincess.png'],
    ['towerUpKingBlue','TowerUpKingBlue.png'],['towerUpPrincessBlue','TowerUpPrincessBlue.png'],
    ['towerDownKing','TowerDownKing.png'],['towerDownPrincess','TowerDownPrincess.png'],['towerDownPrincessDead','TowerDownPrincessDestroyed.png'],
    ['cannon','Cannon.png'],['cannonBase','CannonBase.png'],['cannonBarrel','CannonBarrel.png'],
    ['pjArrow','ProjectileArrow.png'],['pjSpear','ProjectileSpear.png'],['pjCanonball','ProjectileCanonball.png'],['pjFireball','ProjectileFireball.png'],
    ['endVictory','EndVictory.png'],['endDefeat','EndDefeat.png'],['endDraw','EndDraw.png'],
    ['doubleElixir','TextDoubleElixir.png'],['cardNext','CardNext.png'],
    ['circleFireball','CircleFireball.png'],['circlePoison','CirclePoison.png'],
    ['towerDestroyed','TowerDestroyed.png'],['crown','Crown.png'],
  ];
  for (let s = 0; s <= 3; s++) single.push(['score'+s, `Score${s}.png`]);
  const step = (from, to) => {
    let done = 0; const total = Math.max(1, to - from);
    return () => { done++; const p = from + to ? from + (to-from)*done/total : 0;
      ui.loadBar.style.width = Math.min(99, p) + '%';
      ui.loadStep.textContent = `Loading cards… ${Math.round(Math.min(99,p))}%`; };
  };
  const phase = (from, to) => { const tick = step(from, to); return p => p.then(r => { tick(); return r; }); };

  // phase 1: single images (0-35%)
  await Promise.all(single.map(([k,f]) => phase(0,35)(loadImg(k, IMGDIR+f))));
  // phase 2: card images (35-50%)
  const cardName = {archers:'Archer',babydragon:'DragonBaby',fireball:'Fireball',giant:'Giant',speargoblins:'GoblinSpear',golem:'Golem',knight:'Knight',minipekka:'PekkaMini',poison:'Poison',skeletons:'Skeleton',cannon:'Cannon'};
  await Promise.all(ALL_CARD_KEYS.map(k => phase(35,50)(loadImg('card_'+k, IMGDIR+'Card'+cardName[k]+'.png'))));
  // phase 3: spell animations (50-60%)
  {
    const mv = [], at = [];
    const probeChunk = async (makeSrc, cap) => {
      const out = [];
      for (let s0 = 0; s0 < cap; s0 += 12){
        const res = await Promise.all(Array.from({length: Math.min(12, cap-s0)}, (_,j) => tryLoad(makeSrc(s0+j))));
        for (const r of res){ if (!r) return out; out.push(r); }
      }
      return out;
    };
    const pm = probeChunk(i => `${IMGDIR}Spell/Fireball/FireballMove${i}.png`, 20);
    const pa = probeChunk(i => `${IMGDIR}Spell/Fireball/FireballAttack${i}.png`, 20);
    const pp = probeChunk(i => `${IMGDIR}Spell/Poison/PoisonAttack${i}.png`, 60);
    const [rm, ra, rp] = await Promise.all([pm, pa, pp].map(p => phase(50,60)(p)));
    FRAMES.SpellFireball = { move:rm, attack:ra };
    FRAMES.SpellPoison = { move:[], attack:rp };
  }
  // phase 4: troop animations (60-100%)
  const troops = [['Knight','Knight'],['Archer','Archer'],['Skeleton','Skeleton'],['Giant','Giant'],['PekkaMini','PekkaMini'],['DragonBaby','DragonBaby'],['GoblinSpear','GoblinSpear'],['Golem','Golem'],['Golemite','Golemite']];
  await Promise.all(troops.map(([s,f]) => phase(60,100)(loadAnim(s,f))));
  ui.loadBar.style.width = '100%'; ui.loadStep.textContent = 'Ready!';
}

/* ---------------- DOM helpers ---------------- */
const $ = id => document.getElementById(id);
const ui = {};
['loadBar','loadStep','screen-intro','screen-loading','screen-title','screen-menu','screen-deck','screen-difficulty','screen-battle','screen-result',
 'introVideo','introArt',
 'deckGrid','deckSlots','deckCount','handRow','nextCard','elixirBar','elixirFill','elixirNum','gameCanvas','canvasWrap','timerLabel','phaseLabel',
 'playerCrowns','enemyCrowns','resultImg','resultCrowns','howModal','pauseModal','toastRoot'].forEach(id => ui[id.replace(/-(\w)/g,(m,c)=>c.toUpperCase())] = $(id));

function showScreen(id){
  ['screen-intro','screen-loading','screen-title','screen-menu','screen-deck','screen-difficulty','screen-battle','screen-result']
    .forEach(s => ui[s.replace(/-(\w)/g,(m,c)=>c.toUpperCase())].classList.toggle('hidden', s !== id));
}
function toast(msg){
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  ui.toastRoot.appendChild(t); setTimeout(()=>t.remove(), 1800);
}

/* ---------------- state ---------------- */
const G = {
  screenState: 'menu',
  difficulty: localStorage.getItem('tcr_diff') || 'medium',
  deck: JSON.parse(localStorage.getItem('tcr_deck') || 'null') || DEFAULT_DECK.slice(),
};

/* ================= DECK BUILDER ================= */
function renderDeckScreen(){
  // 8 deck slots
  ui.deckSlots.innerHTML = '';
  for (let i = 0; i < 8; i++){
    const slot = document.createElement('div');
    slot.className = 'deck-slot';
    const k = G.deck[i];
    if (k){
      slot.innerHTML = `<img src="${IMG['card_'+k].src}" alt=""><span class="cost-badge">${CARDS[k].cost}</span>`;
      slot.addEventListener('click', () => { G.deck.splice(i,1); renderDeckScreen(); SFX.beep(); });
    } else {
      slot.innerHTML = `<span class="slot-plus">+</span>`;
    }
    ui.deckSlots.appendChild(slot);
  }
  // scrollable collection
  ui.deckGrid.innerHTML = '';
  ALL_CARD_KEYS.forEach(k => {
    const c = CARDS[k];
    const el = document.createElement('div');
    el.className = 'deck-card' + (G.deck.includes(k) ? ' selected' : '');
    el.dataset.key = k;
    el.innerHTML = `<img draggable="false" src="${IMG['card_'+k].src}" alt="${c.label}"><span class="cost-badge">${c.cost}</span><span class="card-name">${c.label}</span>`;
    el.addEventListener('click', () => {
      if (dragScroll.moved) return;   // ignore click at end of a scroll drag
      const i = G.deck.indexOf(k);
      const fromRect = el.getBoundingClientRect();
      if (i >= 0){
        // deselect: card flies back from deck slot to the collection
        G.deck.splice(i,1);
        renderDeckScreen();
        const cardEl = ui.deckGrid.querySelector(`.deck-card[data-key="${k}"]`);
        if (cardEl){
          const toRect = cardEl.getBoundingClientRect();
          cardEl.style.visibility = 'hidden';
          flyClone(IMG['card_'+k].src, fromRect, toRect, () => {
            cardEl.style.visibility = '';
            cardEl.classList.add('landed');
            setTimeout(()=>cardEl.classList.remove('landed'), 340);
          });
        }
      } else {
        if (G.deck.length >= 8){ toast('Deck is full — tap a deck card to remove it'); shakeEl(ui.deckSlots); return; }
        // select: card flies from the collection into the empty deck slot
        G.deck.push(k);
        const slotIdx = G.deck.length - 1;
        renderDeckScreen();
        const slot = ui.deckSlots.children[slotIdx];
        if (slot){
          const toRect = slot.getBoundingClientRect();
          slot.style.visibility = 'hidden';
          flyClone(IMG['card_'+k].src, fromRect, toRect, () => {
            slot.style.visibility = '';
            slot.classList.add('landed');
            setTimeout(()=>slot.classList.remove('landed'), 340);
          });
        }
      }
      SFX.beep();
    });
    ui.deckGrid.appendChild(el);
  });
  updateDeckCount();
}
const dragScroll = { moved:false };
const deckCardDrag = { active:false };
function shakeEl(el){
  el.classList.remove('shake-x'); void el.offsetWidth;
  el.classList.add('shake-x'); setTimeout(()=>el.classList.remove('shake-x'), 320);
}
function flyClone(src, from, to, done){
  const c = document.createElement('div');
  c.className = 'fly-clone';
  c.innerHTML = `<img draggable="false" src="${src}">`;
  c.style.left = from.left+'px'; c.style.top = from.top+'px';
  c.style.width = from.width+'px'; c.style.height = from.height+'px';
  document.body.appendChild(c);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    c.style.transform = `translate(${to.left-from.left}px, ${to.top-from.top}px) scale(${to.width/from.width}, ${to.height/from.height})`;
  }));
  setTimeout(() => { c.remove(); if (done) done(); }, 390);
}
function wireDeckScroll(){
  const grid = ui.deckGrid;
  let drag = null;
  // mouse: drag to pan (touch/trackpad use native scrolling)
  grid.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'mouse') return;
    drag = { y0: ev.clientY, top0: grid.scrollTop, moved: false, id: ev.pointerId };
  });
  window.addEventListener('pointermove', ev => {
    if (deckCardDrag.active) return;   // card drag takes priority over scroll pan
    if (!drag || ev.pointerId !== drag.id) return;
    const dy = ev.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 6){ drag.moved = true; grid.classList.add('dragging'); }
    grid.scrollTop = drag.top0 - dy;
  });
  window.addEventListener('pointerup', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    dragScroll.moved = drag.moved;
    drag = null;
    grid.classList.remove('dragging');
    setTimeout(() => { dragScroll.moved = false; }, 60);
  });
}
function wireDeckCardDrag(){
  let st = null;
  ui.deckGrid.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('.deck-card');
    if (!card || ev.pointerType !== 'mouse') return;
    st = { key: card.dataset.key, el: card, x0: ev.clientX, y0: ev.clientY, r: card.getBoundingClientRect(), active:false, clone:null, overSlot:null };
  });
  window.addEventListener('pointermove', ev => {
    if (!st) return;
    if (!st.active){
      if (Math.hypot(ev.clientX-st.x0, ev.clientY-st.y0) < 8) return;
      st.active = true; deckCardDrag.active = true;
      st.clone = document.createElement('div');
      st.clone.className = 'fly-clone holding';
      st.clone.innerHTML = `<img draggable="false" src="${IMG['card_'+st.key].src}">`;
      st.clone.style.left = st.r.left+'px'; st.clone.style.top = st.r.top+'px';
      st.clone.style.width = st.r.width+'px'; st.clone.style.height = st.r.height+'px';
      document.body.appendChild(st.clone);
      st.el.classList.add('drag-origin');
    }
    ev.preventDefault();
    st.clone.style.left = (ev.clientX - st.r.width/2)+'px';
    st.clone.style.top  = (ev.clientY - st.r.height/2)+'px';
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const slot = under && under.closest ? under.closest('.deck-slot') : null;
    document.querySelectorAll('.deck-slot.drop-target').forEach(s => s.classList.remove('drop-target'));
    if (slot) slot.classList.add('drop-target');
    st.overSlot = slot;
  });
  window.addEventListener('pointerup', () => {
    if (!st) return;
    if (st.active){
      deckCardDrag.active = false;
      dragScroll.moved = true; setTimeout(()=>{ dragScroll.moved = false; }, 60);
      const slot = st.overSlot;
      document.querySelectorAll('.deck-slot.drop-target').forEach(s => s.classList.remove('drop-target'));
      st.clone.remove();
      st.el.classList.remove('drag-origin');
      if (slot){
        const idx = [...ui.deckSlots.children].indexOf(slot);
        const key = st.key;
        const at = G.deck.indexOf(key);
        const occupant = G.deck[idx];
        if (idx >= 0 && idx !== at){
          if (at >= 0){
            if (occupant){ G.deck[at] = occupant; G.deck[idx] = key; }   // swap two deck cards
            else { G.deck.splice(at,1); G.deck.splice(idx,0,key); }      // reorder
          } else {
            G.deck[idx] = key;                                           // replace / fill slot
          }
          renderDeckScreen(); SFX.beep();
        }
      }
    }
    st = null;
  });
}
function updateDeckCount(){
  ui.deckCount.textContent = `${G.deck.length} / 8`;
  ui.deckCount.style.color = G.deck.length === 8 ? '#8ee6ff' : '#ffb0b0';
}

/* ================= BATTLE MODEL ================= */
let battle = null;

function makeSide(side){
  return {
    side, elixir: 5, crowns: 0,
    queue: [], hand: [], next: null,
    princessDead: { L:false, R:false },
  };
}
function shuffle(a){ for (let i = a.length-1; i > 0; i--){ const j = (Math.random()*(i+1))|0; [a[i],a[j]] = [a[j],a[i]]; } return a; }
function initHand(side, deck){
  const q = shuffle(deck.slice());
  side.hand = q.slice(0,4); side.next = q[4]; side.queue = q.slice(5);
}
function cycleCard(side, idx){
  const played = side.hand.splice(idx,1)[0];
  side.hand.push(side.next);
  side.queue.push(played);
  side.next = side.queue.shift();
}

function makeTower(side, kind, x, y, lane){
  return {
    kind, side, lane, x, y,
    hp: kind==='king' ? 5593 : 3052,
    maxHp: kind==='king' ? 5593 : 3052,
    dmg: kind==='king' ? 335 : 109,
    hitSpeed: kind==='king' ? 1.0 : 0.8,
    range: 44,
    radius: kind==='king' ? 21 : 17,
    active: kind!=='king',
    cd: 0, dead: false,
  };
}

function startBattle(){
  SFX.battle();
  const deck = G.deck.length === 8 ? G.deck : DEFAULT_DECK;
  battle = {
    time: MATCH_TIME, overtime: false, over: false, resultShown: false,
    units: [], towers: [], projectiles: [], effects: [], banners: [],
    player: makeSide('player'), enemy: makeSide('enemy'),
    doubleElixir: false, doubleBannerT: 0,
    startBannerT: 2.0,
    aiTimer: 2.0, selected: -1, dragCanvas: null, pointerPos: null,
    idc: 0,
  };
  initHand(battle.player, deck);
  initHand(battle.enemy, deck);
  const t = battle.towers;
  t.push(makeTower('enemy','king',200,83));
  t.push(makeTower('enemy','princess',95,131,'L'));
  t.push(makeTower('enemy','princess',305,131,'R'));
  t.push(makeTower('player','king',200,406));
  t.push(makeTower('player','princess',95,378,'L'));
  t.push(makeTower('player','princess',305,378,'R'));
  battle.ai = makeAI(G.difficulty);
  showScreen('screen-battle');
  renderHand();
  SFX.beep();
}

/* ---------------- units ---------------- */
function spawnUnit(sideKey, card, x, y, isSpawnChild){
  const b = battle;
  const stat = isSpawnChild || card;
  const offsets = [];
  const n = isSpawnChild ? 1 : card.count;
  if (n === 1) offsets.push([0,0]);
  else if (n === 2) offsets.push([-11,0],[11,0]);
  else offsets.push([0,-10],[-11,8],[11,8]);
  const made = [];
  offsets.forEach(o => {
    const u = {
      id: ++b.idc, side: sideKey,
      cardKey: (!isSpawnChild && card) ? card.key : null,
      sprite: isSpawnChild ? stat.sprite : card.sprite,
      hp: isSpawnChild ? stat.hp : card.hp, maxHp: isSpawnChild ? stat.hp : card.hp,
      dmg: isSpawnChild ? stat.dmg : card.dmg,
      hitSpeed: isSpawnChild ? stat.hitSpeed : card.hitSpeed,
      range: isSpawnChild ? stat.range : card.range,
      speed: isSpawnChild ? stat.speed : card.speed,
      radius: isSpawnChild ? stat.radius : card.radius,
      targets: isSpawnChild ? stat.targets : card.targets,
      buildingsOnly: !!stat.buildingsOnly,
      flying: !!stat.flying,
      splash: stat.splash || 0,
      projectile: stat.projectile || null,
      building: !!stat.building,
      lifetime: stat.lifetime || 0,
      deathSpawn: stat.deathSpawn || null,
      deathCount: stat.deathCount || 0,
      aimAng: 0,
      scale: stat.scale || 1.3,
      x: x + o[0], y: y + o[1],
      target: null, retargetT: 0, atkCd: 0,
      animT: Math.random()*10, walkDist: 0,
      attackAnimT: -1, attackAnimDur: 0, pendingHit: null, hitDone: false,
      dead: false, spawnT: 0.35,
    };
    if (u.projectile === 'fireball') u.projectileSprite = 'pjFireball';
    if (u.projectile === 'canonball') u.projectileSprite = 'pjCanonball';
    battle.units.push(u); made.push(u);
  });
  // a newly placed building pulls nearby troops off their tower target
  if (!isSpawnChild && card && card.building && made.length){
    const bld = made[0];
    for (const f of battle.units){
      if (f.side === sideKey || f.dead || !f.target || f.target.dead) continue;
      if (f.target.kind){   // currently bound to a tower
        if (dist(f, bld) < dist(f, f.target)) f.target = bld;
      }
    }
  }
  battle.effects.push({ type:'spawn', x, y, t:0, dur:0.4 });
  return made;
}

function inField(x,y){ return x > FIELD.x0 && x < FIELD.x1 && y > FIELD.y0 && y < FIELD.y1; }

function deployValid(cardKey, x, y, sideKey){
  const card = CARDS[cardKey];
  if (!inField(x,y)) return false;
  if (card.spell) return true;
  const side = sideKey === 'player' ? battle.player : battle.enemy;
  if (sideKey === 'player'){
    if (y >= RIVER_Y + 12) return true;
    // enemy territory: allowed in a lane if that princess tower is destroyed
    const lane = x < 200 ? 'L' : 'R';
    const pIdx = lane === 'L' ? 1 : 2;
    return y > 195 && battle.towers[pIdx].dead;
  } else {
    if (y <= RIVER_Y - 12) return true;
    const lane = x < 200 ? 'L' : 'R';
    const pIdx = lane === 'L' ? 4 : 5;
    return y < 405 && battle.towers[pIdx].dead;
  }
}

function playerDeploy(cardKey, x, y){
  const card = CARDS[cardKey];
  if (battle.player.elixir < card.cost) return false;
  if (!deployValid(cardKey, x, y, 'player')) return false;
  battle.player.elixir -= card.cost;
  if (card.spell) castSpell('player', cardKey, x, y);
  else spawnUnit('player', card, x, y);
  SFX.deploy();
  return true;
}
function enemyDeploy(cardKey, x, y){
  const card = CARDS[cardKey];
  if (battle.enemy.elixir < card.cost) return false;
  if (!deployValid(cardKey, x, y, 'enemy')) return false;
  battle.enemy.elixir -= card.cost;
  if (card.spell) castSpell('enemy', cardKey, x, y);
  else spawnUnit('enemy', card, x, y);
  SFX.deploy();
  return true;
}

function castSpell(side, cardKey, x, y){
  const card = CARDS[cardKey];
  if (cardKey === 'fireball'){
    battle.projectiles.push({
      type:'spellFireball', side, x, y: Math.max(40, y-160), tx:x, ty:y,
      speed: 320, dmg: card.dmg, radius: card.radius, towerFactor: card.towerFactor,
      animT: 0, done:false,
    });
    SFX.spell();
  } else if (cardKey === 'poison'){
    battle.effects.push({ type:'poison', side, x, y, r: card.radius, dps: card.dps, towerFactor: card.towerFactor, t:0, dur: card.duration, tickT:0 });
    SFX.spell();
  }
}

/* ---------------- targeting & movement ---------------- */
function enemiesOf(sideKey){ return battle.units.filter(u => u.side !== sideKey && !u.dead); }
function buildingsOf(sideKey){
  const list = battle.towers.filter(t => t.side === sideKey && !t.dead);
  return list.concat(battle.units.filter(u => u.side === sideKey && u.building && !u.dead));
}
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
// ranged fire can't cross the river except over a bridge
function riverBlocked(a, b){
  const aTop = a.y < RIVER_Y, bTop = b.y < RIVER_Y;
  if (aTop === bTop) return false;
  const mx = (a.x + b.x) / 2;
  return !(Math.abs(mx - BRIDGE_L) <= BRIDGE_HALF + 8 || Math.abs(mx - BRIDGE_R) <= BRIDGE_HALF + 8);
}

function kingTargetable(u, king){
  // troops always hit a standing princess first; the king opens up in its lane
  const defenderSide = king.side;
  const prs = battle.towers.filter(t => t.side === defenderSide && t.kind === 'princess' && !t.dead);
  if (prs.length === 0) return true;                    // both down -> king free
  if (prs.length === 2) return false;                   // pocket placements go to a princess first
  // one princess down: king is only fair game on that side of the arena
  const deadLaneX = battle.towers.find(t => t.side === defenderSide && t.kind === 'princess' && t.dead).x;
  return (u.x < 200) === (deadLaneX < 200);
}
function acquireTarget(u){
  const foes = enemiesOf(u.side);
  let best = null, bestD = 1e9;
  const ranged = u.range > 30;
  if (!u.buildingsOnly){
    for (const f of foes){
      if (f.building) continue;
      if (f.flying && u.targets === 'ground') continue;
      if (ranged && riverBlocked(u, f)) continue;
      const d = dist(u,f) - f.radius;
      if (d < bestD && d < 95){ best = f; bestD = d; }
    }
  }
  if (!best){
    bestD = 1e9;
    for (const b of buildingsOf(u.side === 'player' ? 'enemy' : 'player')){
      if (b.kind === 'king' && !kingTargetable(u, b)) continue;
      if (ranged && riverBlocked(u, b)) continue;
      const d = dist(u,b);
      if (d < bestD){ best = b; bestD = d; }
    }
    if (!best){
      // everything was river-blocked — walk toward the nearest tower anyway;
      // bridge pathing will carry the unit across
      for (const b of buildingsOf(u.side === 'player' ? 'enemy' : 'player')){
        if (b.kind === 'king' && !kingTargetable(u, b)) continue;
        const d = dist(u,b);
        if (d < bestD){ best = b; bestD = d; }
      }
    }
  }
  u.target = best;
}

function moveUpdate(u, dt){
  if (!u.target || u.target.dead || (u.target.hp !== undefined && u.target.hp <= 0)) { acquireTarget(u); }
  const tgt = u.target;
  if (!tgt) return;
  const reach = u.range + u.radius + (tgt.radius || 8);
  const d = dist(u, tgt);
  if (d <= reach){ /* in range */ }
  else {
    let gx = tgt.x, gy = tgt.y;
    if (!u.flying && u.speed > 0){
      const myTop = u.y < RIVER_Y, tgtTop = tgt.y < RIVER_Y;
      if (myTop !== tgtTop){
        const bx = Math.abs(u.x - BRIDGE_L) < Math.abs(u.x - BRIDGE_R) ? BRIDGE_L : BRIDGE_R;
        if (Math.abs(u.x - bx) > 8){
          gx = bx; gy = myTop ? RIVER_Y - 30 : RIVER_Y + 30;
        } else {
          gx = bx; gy = myTop ? RIVER_Y + 30 : RIVER_Y - 30;
        }
      }
    }
    const dx = gx - u.x, dy = gy - u.y, dd = Math.hypot(dx,dy) || 1;
    const step = u.speed * dt;
    u.x += dx/dd * step; u.y += dy/dd * step;
    u.walkDist += step;
    if (u.flying) u.y += Math.sin(battle.time + u.id) * 6 * dt; // gentle bob
  }
  // keep ground units out of the river unless on a bridge
  if (!u.flying && Math.abs(u.y - RIVER_Y) <= RIVER_HALF &&
      Math.abs(u.x - BRIDGE_L) > BRIDGE_HALF && Math.abs(u.x - BRIDGE_R) > BRIDGE_HALF){
    u.y = RIVER_Y + (u.y >= RIVER_Y ? 1 : -1) * (RIVER_HALF + 1);
  }
  u.x = Math.max(14, Math.min(386, u.x));
  u.y = Math.max(30, Math.min(585, u.y));
}

function attackUpdate(u, dt){
  const tgt = u.target;
  if (!tgt || tgt.dead || tgt.hp <= 0){ u.attackAnimT = -1; return; }
  const reach = u.range + u.radius + (tgt.radius || 8);
  if (dist(u,tgt) > reach){ u.attackAnimT = -1; u.pendingHit = null; return; }
  if (u.range > 30 && riverBlocked(u, tgt)) return;   // no sniping across the river
  u.atkCd -= dt;
  if (u.building && tgt) u.aimAng = Math.atan2(tgt.y - u.y, tgt.x - u.x);
  if (u.atkCd <= 0 && u.attackAnimT < 0){
    const fr = FRAMES[u.sprite];
    const n = fr && fr.attack.length ? fr.attack.length : 6;
    u.attackAnimT = 0;
    u.attackAnimDur = Math.max(0.3, Math.min(u.hitSpeed, n/12));
    u.pendingHit = { t: u.attackAnimDur * 0.55, target: tgt };
    u.hitDone = false;
    u.atkCd = u.hitSpeed;
  }
  if (u.attackAnimT >= 0){
    u.attackAnimT += dt;
    if (u.attackAnimT >= u.attackAnimDur){ u.attackAnimT = -1; }  // anim finished — allow next swing
    if (u.pendingHit && !u.hitDone){
      u.pendingHit.t -= dt;
      if (u.pendingHit.t <= 0){
        u.hitDone = true;
        const victim = u.pendingHit.target;
        if (victim && !victim.dead && victim.hp > 0){
          if (u.projectile){
            battle.projectiles.push({
              type:'unit', x:u.x, y:u.y - 8, target:victim, side:u.side,
              speed: 300, dmg: u.dmg, splash: u.splash, sprite: u.projectileSprite || 'pjArrow',
            });
          } else {
            dealDamage(victim, u.dmg, u.side);
          }
        }
        u.pendingHit = null;
      }
    }
  }
}

function dealDamage(victim, dmg, fromSide){
  if (victim.dead || victim.hp <= 0) return;
  if (victim.building) dmg *= 0.7;   // buildings are tanky vs tanks like giant/golem/minipekka
  victim.hp -= dmg;
  if (victim.kind){ // tower
    if (!victim.active){ victim.active = true; }
    if (victim.hp <= 0) destroyTower(victim);
  } else if (victim.hp <= 0){
    killUnit(victim);
  }
}

function killUnit(u){
  u.dead = true;
  if (u.deathSpawn){
    for (let i = 0; i < u.deathCount; i++){
      spawnUnit(u.side, null, u.x + (i? 14 : -14), u.y, Object.assign({ sprite:u.deathSpawn.sprite, hp:u.deathSpawn.hp, dmg:u.deathSpawn.dmg, hitSpeed:u.deathSpawn.hitSpeed, range:u.deathSpawn.range, speed:u.deathSpawn.speed, radius:u.deathSpawn.radius, targets:u.deathSpawn.targets, buildingsOnly:u.deathSpawn.buildingsOnly }, {}));
    }
  }
}

function destroyTower(t){
  t.dead = true; t.hp = 0;
  const scorer = t.side === 'enemy' ? battle.player : battle.enemy;
  const kingIdx = battle.towers.indexOf(t);
  if (t.kind === 'king'){
    scorer.crowns = 3;
  } else {
    scorer.crowns = Math.min(3, scorer.crowns + 1);
    // activate the king on the defeated side
    const king = battle.towers.find(k => k.side === t.side && k.kind === 'king');
    if (king) king.active = true;
    const defender = t.side === 'enemy' ? battle.enemy : battle.player;
    defender.princessDead[t.lane] = true;
  }
  battle.banners.push({ text: t.side === 'enemy' ? 'ENEMY TOWER DESTROYED!' : 'YOUR TOWER DESTROYED!', t:0, dur:2.2, color: t.side === 'enemy' ? '#8ee6ff' : '#ff8080' });
  // fire explosion at the fallen tower + crown popup + short burning rubble
  const frS = FRAMES.SpellFireball;
  if (frS && frS.attack.length) battle.effects.push({ type:'explosion', x:t.x, y:t.y-8, t:0, dur: Math.max(0.5, frS.attack.length/14) });
  if (frS && frS.attack.length) battle.effects.push({ type:'rubbleFire', x:t.x, y:t.y-(t.kind==='king'?24:20), t:0, dur:3.5 });
  battle.effects.push({ type:'crown', x:t.x, y:t.y-40, t:0, dur:2.4 });
  SFX.towerDown();
  // sudden death: first crown wins
  if (battle.overtime && (battle.player.crowns !== battle.enemy.crowns)) endBattle();
  if (t.kind === 'king') endBattle();
}

/* ---------------- projectiles ---------------- */
function projUpdate(p, dt){
  p.animT += dt;
  let tx, ty;
  if (p.type === 'spellFireball'){ tx = p.tx; ty = p.ty; }
  else { if (!p.target || p.target.dead || p.target.hp <= 0){ p.done = true; return; } tx = p.target.x; ty = p.target.y - 6; }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx,dy);
  const step = p.speed * dt;
  if (d <= step){
    p.x = tx; p.y = ty; p.done = true;
    if (p.type === 'spellFireball'){
      battle.effects.push({ type:'explosion', x:p.x, y:p.y, t:0, dur: FRAMES.SpellFireball.attack.length/14 });
      areaDamage(p.side, p.x, p.y, p.radius, p.dmg, p.towerFactor);
    } else {
      if (p.splash) areaDamage(p.side, p.x, p.y, p.splash, p.dmg, 1);
      else dealDamage(p.target, p.dmg, p.side);
    }
  } else {
    p.x += dx/d*step; p.y += dy/d*step;
  }
}
function areaDamage(fromSide, x, y, radius, dmg, towerFactor){
  for (const u of enemiesOf(fromSide)){
    const d = dist({x,y}, u);
    if (d <= radius + u.radius){
      if (u.kind || u.building) dealDamage(u, dmg * (towerFactor||1), fromSide);
      else dealDamage(u, dmg, fromSide);
    }
  }
  // towers included
  for (const t of battle.towers){
    if (t.side === fromSide || t.dead) continue;
    if (dist({x,y}, t) <= radius + t.radius) dealDamage(t, dmg*(towerFactor||1), fromSide);
  }
}

/* ---------------- AI ---------------- */
function makeAI(diff){
  const cfg = {
    easy:   { interval:[2.4,3.6], skipChance:0.45, defendChance:0.8,  spellIQ:0, pushElixir:8, defendElixir:0 },
    medium: { interval:[1.6,2.6], skipChance:0.2,  defendChance:1.0,  spellIQ:1, pushElixir:7, defendElixir:0 },
    hard:   { interval:[0.9,1.7], skipChance:0.05, defendChance:1.0,  spellIQ:2, pushElixir:6, defendElixir:0 },
  }[diff];
  return { cfg, timer: 2.5, lock: {} };
}

function enemyFieldHas(cardKey){
  return battle.units.some(u => u.side==='enemy' && !u.dead && u.cardKey === cardKey);
}
function aiSpend(cardKey, x, y){
  if (!enemyDeploy(cardKey, x, y)) return false;
  const ai = battle.ai;
  // after playing a card, it's locked until the AI has played 4 more cards
  ai.lock[cardKey] = 4;
  for (const k in ai.lock){ if (k !== cardKey && ai.lock[k] > 0) ai.lock[k]--; }
  return true;
}

function aiThink(dt){
  const ai = battle.ai, b = battle;
  ai.timer -= dt;  if (ai.timer > 0) return;
  const c = ai.cfg;
  ai.timer = c.interval[0] + Math.random()*(c.interval[1]-c.interval[0]);
  if (Math.random() < c.skipChance) return;

  const e = b.enemy;
  let affordable = e.hand.map((k,i)=>({k,i,c:CARDS[k]})).filter(o => o.c.cost <= e.elixir);
  // one copy of each troop/building at a time + no instant re-play of the last card
  affordable = affordable.filter(o =>
    !enemyFieldHas(o.k) && !(ai.lock[o.k] > 0));
  if (!affordable.length) return;

  // threats: player units on enemy side or crossing
  const threats = b.units.filter(u => u.side==='player' && !u.dead && !u.building && u.y < RIVER_Y + 40);
  threats.sort((a,b2)=>a.y - b2.y);

  // spell logic
  if (c.spellIQ > 0){
    const spells = affordable.filter(o => o.c.spell);
    for (const sp of spells){
      const groups = clusterPlayerUnits(sp.c.radius);
      let target = null;
      for (const g of groups){
        const value = g.units.reduce((s,u)=>s+ (u.hp + u.dmg*8), 0);
        if (g.units.length >= 3 || (c.spellIQ >= 2 && value > 900)) { target = g; break; }
      }
      if (target){ aiSpend(sp.k, target.x, target.y); return; }
    }
  }

  // defense first: react to any player push
  if (threats.length && Math.random() < c.defendChance){
    const th = threats[0];
    const many = threats.length >= 3;
    const bigHp = threats.some(u => u.hp > 1200);
    const air = threats.some(u => u.flying);
    let pick = null;
    const troopOpts = affordable.filter(o => !o.c.spell && !o.c.building);
    if (air) pick = troopOpts.find(o => o.c.targets === 'any') || troopOpts.find(o=>o.c.count>=2);
    else if (many) pick = troopOpts.find(o => o.c.splash) || troopOpts.find(o => o.c.count >= 3) || troopOpts.find(o => o.c.cost <= 3);
    else if (bigHp) pick = troopOpts.find(o => o.k==='minipekka') || troopOpts.find(o => o.c.dmg >= 80);
    if (!pick) pick = troopOpts[(Math.random()*troopOpts.length)|0];
    if (pick){
      // place defensively: behind the threatened tower, between it and the threat
      const towers = b.towers.filter(t => t.side==='enemy' && !t.dead);
      towers.sort((a,b2)=>dist(a,th)-dist(b2,th));
      const tw = towers[0];
      const px = tw ? tw.x + Math.sign(th.x - tw.x || 1)*24 : th.x;
      const py = tw ? Math.max(148, Math.min(240, tw.y + 48)) : Math.max(150, Math.min(230, th.y - 30));
      if (deployValid(pick.k, px, py, 'enemy')){ aiSpend(pick.k, px, py); return; }
      if (deployValid(pick.k, th.x, 200, 'enemy')){ aiSpend(pick.k, th.x, 200); return; }
    }
    return; // defending — save remaining elixir, no simultaneous push
  }

  // player has nothing down (or defense roll skipped): attack
  const wantsPush = e.elixir >= c.pushElixir ||
    (affordable.some(o=>o.k==='golem'||o.k==='giant') && e.elixir >= CARDS.giant.cost + 2);
  if (wantsPush){
    const tank = affordable.find(o => o.k==='golem') || affordable.find(o => o.k==='giant');
    const lane = Math.random() < 0.5 ? BRIDGE_L : BRIDGE_R;
    if (tank){ aiSpend(tank.k, lane + (Math.random()*24-12), 190 + Math.random()*30); return; }
    const troop = affordable.filter(o=>!o.c.spell)[0];
    if (troop){ aiSpend(troop.k, lane + (Math.random()*40-20), 205); return; }
  }
  // otherwise bank elixir like a real player — no free dumps
}

function clusterPlayerUnits(radius){
  const units = battle.units.filter(u => u.side==='player' && !u.dead && !u.building);
  const groups = [];
  for (const u of units){
    let g = groups.find(g => Math.hypot(g.x-u.x, g.y-u.y) < radius);
    if (!g){ g = { x:u.x, y:u.y, units:[] }; groups.push(g); }
    g.units.push(u);
  }
  groups.forEach(g => { g.x = g.units.reduce((s,u)=>s+u.x,0)/g.units.length; g.y = g.units.reduce((s,u)=>s+u.y,0)/g.units.length; });
  return groups;
}

/* ---------------- battle update ---------------- */
function updateBattle(dt){
  const b = battle;
  if (b.over) return;
  if (b.startBannerT > 0){ b.startBannerT -= dt; }

  // timer
  b.time -= dt;
  if (!b.overtime && b.time <= 60 && !b.doubleElixir){
    b.doubleElixir = true; b.doubleBannerT = 2.6;
  }
  if (b.time <= 0){
    if (!b.overtime){
      if (b.player.crowns !== b.enemy.crowns){ endBattle(); return; }
      b.overtime = true; b.time = OVERTIME;
      b.banners.push({ text:'SUDDEN DEATH — FIRST CROWN WINS!', t:0, dur:2.6, color:'#ffd45a' });
      if (!b.doubleElixir){ b.doubleElixir = true; b.doubleBannerT = 2.6; }
    } else { endBattle(); return; }
  }

  // elixir
  const rate = ELIXIR_RATE * (b.doubleElixir ? 2 : 1);
  b.player.elixir = Math.min(ELIXIR_MAX, b.player.elixir + rate*dt);
  b.enemy.elixir = Math.min(ELIXIR_MAX, b.enemy.elixir + rate*dt);
  if (b.doubleBannerT > 0) b.doubleBannerT -= dt;

  // towers
  for (const t of b.towers){
    if (t.dead) continue;
    t.cd -= dt;
    if (!t.active) continue;
    if (t.cd <= 0){
      // shoot nearest enemy unit in range
      let best = null, bestD = 1e9;
      for (const u of enemiesOf(t.side)){
        if (u.building) continue;
        if (riverBlocked(t, u)) continue;
        const d = dist(t,u) - u.radius;
        if (d < bestD && d <= t.range){ best = u; bestD = d; }
      }
      if (best){
        b.projectiles.push({ type:'unit', x:t.x, y:t.y-14, target:best, side:t.side, speed:300, dmg:t.dmg, splash:0, sprite: t.kind==='king' ? 'pjCanonball' : 'pjArrow' });
        t.cd = t.hitSpeed;
      }
    }
  }

  // units
  for (const u of b.units){
    if (u.dead) continue;
    if (u.spawnT > 0){ u.spawnT -= dt; continue; }
    if (u.building && u.lifetime > 0){
      u.lifetime -= dt;
      u.hp -= (u.maxHp / 30) * dt;   // decays to zero over its lifetime
      if (u.lifetime <= 0 || u.hp <= 0){ u.hp = 0; killUnit(u); continue; }
    }
    u.retargetT -= dt;
    if (u.retargetT <= 0){
      u.retargetT = 0.4 + Math.random()*0.2;
      const tgt = u.target;
      const valid = tgt && !tgt.dead && (tgt.hp === undefined || tgt.hp > 0);
      if (!valid){ acquireTarget(u); }
      else {
        const reach = u.range + u.radius + (tgt.radius || 8);
        const attacking = dist(u, tgt) <= reach;                        // in range — stay locked
        const committed = u.buildingsOnly || !!(tgt.kind || tgt.building); // walking to a building
        if (!attacking && !committed){
          acquireTarget(u);                                             // free-walking: aggro nearby troops
        } else if (!attacking && committed && !u.buildingsOnly){
          // building-bound troops only get distracted by enemies right on top of them
          const near = enemiesOf(u.side).find(f => !f.building && (!f.flying || u.targets === 'any') && dist(u, f) - f.radius < 40);
          if (near) u.target = near;
        }
      }
    }
    moveUpdate(u, dt);
    attackUpdate(u, dt);
    u.animT += dt;
  }
  // light separation between allied ground units
  const alive = b.units.filter(u=>!u.dead && !u.building && !u.flying);
  for (let i = 0; i < alive.length; i++){
    for (let j = i+1; j < alive.length; j++){
      const a = alive[i], c = alive[j];
      if (a.side !== c.side) continue;
      const dx = c.x-a.x, dy = c.y-a.y, d = Math.hypot(dx,dy);
      const min = a.radius + c.radius - 2;
      if (d > 0 && d < min){
        const push = (min-d)/2;
        a.x -= dx/d*push*0.6; a.y -= dy/d*push*0.6;
        c.x += dx/d*push*0.6; c.y += dy/d*push*0.6;
      }
    }
  }
  b.units = b.units.filter(u => !u.dead);

  // projectiles
  for (const p of b.projectiles) projUpdate(p, dt);
  b.projectiles = b.projectiles.filter(p => !p.done);

  // effects
  for (const e of b.effects){
    e.t += dt;
    if (e.type === 'poison'){
      e.tickT -= dt;
      if (e.tickT <= 0){
        e.tickT = 0.5;
        areaDamage(e.side, e.x, e.y, e.r, e.dps*0.5, e.towerFactor);
      }
    }
  }
  b.effects = b.effects.filter(e => e.t < e.dur);
  for (const bn of b.banners) bn.t += dt;
  b.banners = b.banners.filter(bn => bn.t < bn.dur);

  aiThink(dt);
  updateHandAffordability();
}

function endBattle(){
  if (battle.over) return;
  battle.over = true;
  let p = battle.player.crowns, e = battle.enemy.crowns;
  if (p === e){
    // real CR tiebreaker: the side whose weakest tower has the lowest HP% loses
    const minPct = side => Math.min(...battle.towers.filter(t => t.side === side).map(t => t.hp / t.maxHp));
    const mp = minPct('player'), me = minPct('enemy');
    if (mp < me){ p = 0; e = 1; battle.banners.push({ text:'LOWEST TOWER HP LOSES!', t:0, dur:2.0, color:'#ffd45a' }); }
    else if (me < mp){ p = 1; e = 0; battle.banners.push({ text:'LOWEST TOWER HP LOSES!', t:0, dur:2.0, color:'#ffd45a' }); }
  }
  battle.finalResult = p > e ? 'victory' : (p < e ? 'defeat' : 'draw');
  setTimeout(showResult, 900);
}

function showResult(){
  if (battle.resultShown) return;
  battle.resultShown = true;
  const r = battle.finalResult;
  ui.resultImg.src = IMG[r === 'victory' ? 'endVictory' : r === 'defeat' ? 'endDefeat' : 'endDraw'].src;
  ui.resultCrowns.textContent = `Crowns  ${battle.player.crowns} — ${battle.enemy.crowns}`;
  showScreen('screen-result');
  SFX.stopBattle();
  if (r === 'victory') SFX.win(); else SFX.lose();
}

/* ---------------- rendering ---------------- */
const canvas = ui.gameCanvas;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

function snapTile(p){
  // half-tile grid: tile centers AND midpoints between them, clamped so the
  // outer half-tile ring stays unplaceable (zone boundary unchanged)
  const hs = TILE / 2;
  let x = Math.round((p.x - TILE/2) / hs) * hs + TILE/2;
  let y = Math.round((p.y - TILE/2) / hs) * hs + TILE/2;
  x = Math.max(FIELD.x0 + TILE/2, Math.min(FIELD.x1 - TILE/2, x));
  y = Math.max(FIELD.y0 + TILE/2, Math.min(FIELD.y1 - TILE/2, y));
  return { x, y };
}

function draw(){
  const b = battle;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,CH);
  ctx.fillStyle = '#0a1a33'; ctx.fillRect(0,0,W,CH);
  // world transform: uniform scale to fill canvas height, crop sides
  ctx.setTransform(VS,0,0,VS,VXOFF,0);
  ctx.drawImage(IMG.bgGame, 0, 0, W, H);

  // deploy zone overlay while dragging
  const selKey = (b.selected >= 0) ? b.player.hand[b.selected] : null;
  if (selKey){
    const card = CARDS[selKey];
    ctx.save();
    if (!card.spell){
      // zone fill
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(FIELD.x0, RIVER_Y+12, FIELD.x1-FIELD.x0, FIELD.y1-(RIVER_Y+12));
      if (b.towers[1].dead) ctx.fillRect(FIELD.x0, 195, 176, RIVER_Y+12-195);
      if (b.towers[2].dead) ctx.fillRect(200, 195, FIELD.x1-200, RIVER_Y+12-195);
      // CR-style tile grid
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = Math.ceil(FIELD.x0/TILE); gx*TILE <= FIELD.x1; gx++){ const x = gx*TILE; ctx.moveTo(x, RIVER_Y+12); ctx.lineTo(x, FIELD.y1); }
      for (let gy = Math.ceil((RIVER_Y+12)/TILE); gy*TILE <= FIELD.y1; gy++){ const y = gy*TILE; ctx.moveTo(FIELD.x0, y); ctx.lineTo(FIELD.x1, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(FIELD.x0, RIVER_Y+12, FIELD.x1-FIELD.x0, FIELD.y1-(RIVER_Y+12));
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([6,6]);
      ctx.strokeRect(12,40,376,545);
    }
    ctx.restore();
  }

  // spell target circle while dragging spell (snapped to grid like troops)
  if (selKey && b.pointerPos){
    if (CARDS[selKey].spell){
      const sp = snapTile(b.pointerPos);
      const r = CARDS[selKey].radius;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI*2);
      ctx.fillStyle = selKey==='poison' ? 'rgba(160,60,200,0.25)' : 'rgba(255,120,50,0.25)';
      ctx.fill(); ctx.strokeStyle = selKey==='poison' ? 'rgba(220,120,255,0.8)' : 'rgba(255,160,80,0.9)';
      ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // effects below units (spawn rings)
  for (const e of b.effects){
    if (e.type === 'spawn'){
      const pr = e.t/e.dur;
      ctx.beginPath(); ctx.arc(e.x, e.y, 6+pr*22, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,255,255,${0.7*(1-pr)})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }

  // towers (dead first for layering) — blue for player, red for enemy
  const towersSorted = b.towers.slice().sort((a,c)=>(a.dead?0:1)-(c.dead?0:1));
  for (const t of towersSorted){
    if (t.dead){
      const rh = t.kind==='king' ? 48 : 41, rw = 60;
      if (IMG.towerDestroyed) ctx.drawImage(IMG.towerDestroyed, t.x-rw/2, t.y-rh/2, rw, rh);
      continue;
    }
    const upKey = (t.kind==='king' ? 'towerUpKing' : 'towerUpPrincess') + (t.side==='player' ? 'Blue' : '');
    ctx.drawImage(IMG[upKey], t.x-30, t.y-30, 60, t.kind==='king'?63:51);
    drawBar(t.x, t.y - (t.kind==='king'?38:34), 30, t.hp/t.maxHp, t.side);
    // tower HP number
    ctx.font = 'bold 9px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const hpTxt = String(Math.max(0, Math.ceil(t.hp)));
    const numY = t.y - (t.kind==='king'?44:40);
    ctx.strokeText(hpTxt, t.x, numY); ctx.fillText(hpTxt, t.x, numY);
  }

  // units
  const units = b.units.slice().sort((a,c)=>a.y-c.y);
  for (const u of units){
    // shadow
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.radius*0.55, u.radius*0.9, u.radius*0.38, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    // side ring
    ctx.beginPath(); ctx.arc(u.x, u.y + u.radius*0.55, u.radius*0.55, 0, Math.PI*2);
    ctx.fillStyle = u.side==='player' ? 'rgba(70,140,255,0.55)' : 'rgba(255,70,70,0.55)'; ctx.fill();

    const fr = FRAMES[u.sprite];
    let img = null;
    if (u.attackAnimT >= 0 && fr && fr.attack.length){
      const fi = Math.min(fr.attack.length-1, Math.floor(u.attackAnimT / u.attackAnimDur * fr.attack.length));
      img = fr.attack[fi];
    } else if (fr && fr.move.length){
      const fi = Math.floor(u.walkDist / 6) % fr.move.length;
      img = fr.move[fi];
    }
    if (u.building && IMG.cannonBase && IMG.cannonBarrel){
      // cannon: static base + barrel that rotates toward the target
      const bs = 46;
      if (u.spawnT > 0) ctx.globalAlpha = 0.5 + 0.5*Math.sin(u.spawnT*30);
      ctx.drawImage(IMG.cannonBase, u.x-bs/2, u.y-bs/2, bs, bs);
      ctx.save();
      ctx.translate(u.x, u.y - 4);
      ctx.rotate(u.aimAng + Math.PI/2);
      ctx.drawImage(IMG.cannonBarrel, -17, -19, 34, 34);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (u.hp < u.maxHp) drawBar(u.x, u.y - 30, 26, u.hp/u.maxHp, u.side);
      continue;
    }
    const scale = u.scale || 1.3;
    const dw = (img ? img.width : 30) * scale, dh = (img ? img.height : 30) * scale;
    if (img){
      if (u.spawnT > 0) ctx.globalAlpha = 0.5 + 0.5*Math.sin(u.spawnT*30);
      if (u.side === 'enemy'){
        // enemies face down toward the player
        ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(Math.PI);
        ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, u.x-dw/2, u.y-dh/2, dw, dh);
      }
      ctx.globalAlpha = 1;
    }
    if (u.hp < u.maxHp) drawBar(u.x, u.y - dh/2 - 8, Math.max(20, dw*0.55), u.hp/u.maxHp, u.side);
  }

  // projectiles
  for (const p of b.projectiles){
    if (p.type === 'spellFireball'){
      const fr = FRAMES.SpellFireball;
      if (fr && fr.move.length){
        const fi = Math.floor(p.animT*14) % fr.move.length;
        ctx.drawImage(fr.move[fi], p.x-22, p.y-22, 44, 44);
      }
    } else {
      const img = IMG[p.sprite] || IMG.pjArrow;
      const tx = p.target ? p.target.x : p.x, ty = p.target ? p.target.y : p.y;
      const ang = Math.atan2(ty-p.y, tx-p.x);
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(ang);
      ctx.drawImage(img, -img.width*0.9, -img.height*0.9, img.width*1.8, img.height*1.8);
      ctx.restore();
    }
  }

  // poison clouds + explosions
  for (const e of b.effects){
    if (e.type === 'poison'){
      const fr = FRAMES.SpellPoison;
      if (fr && fr.attack.length){
        const fi = Math.floor(e.t*10) % fr.attack.length;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(fr.attack[fi], e.x-e.r*1.15, e.y-e.r*1.15, e.r*2.3, e.r*2.3);
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fillStyle='rgba(150,60,190,0.4)'; ctx.fill();
      }
    } else if (e.type === 'explosion'){
      const fr = FRAMES.SpellFireball;
      if (fr && fr.attack.length){
        const fi = Math.min(fr.attack.length-1, Math.floor(e.t/e.dur * fr.attack.length));
        ctx.drawImage(fr.attack[fi], e.x-40, e.y-40, 80, 80);
      }
    } else if (e.type === 'rubbleFire'){
      const fr = FRAMES.SpellFireball;
      if (fr && fr.attack.length){
        const fi = Math.min(fr.attack.length-1, Math.floor(e.t/e.dur * fr.attack.length * 2));
        ctx.globalAlpha = e.t > e.dur - 1 ? Math.max(0, (e.dur - e.t)) : 0.85;
        ctx.drawImage(fr.attack[fi], e.x-17, e.y-24, 34, 34);
        ctx.globalAlpha = 1;
      }
    } else if (e.type === 'crown'){
      if (IMG.crown){
        const HOLD = 0.6;   // wait a little at full size, then shrink away
        const k = Math.max(0, Math.min(1, (e.t - HOLD) / (e.dur - HOLD)));
        const cw = 30 * (1 - k);
        if (cw > 0.5){
          ctx.globalAlpha = 1 - k;
          ctx.drawImage(IMG.crown, e.x-cw/2, e.y - k*20 - cw/2, cw, cw*IMG.crown.height/IMG.crown.width);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // drop indicator (snapped to tile grid for troops)
  if (selKey && b.pointerPos){
    const pos = snapTile(b.pointerPos);
    const ok = deployValid(selKey, pos.x, pos.y, 'player') && b.player.elixir >= CARDS[selKey].cost;
    if (!CARDS[selKey].spell){
      // highlight the target tile
      ctx.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : 'rgba(255,125,125,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x-TILE/2, pos.y-TILE/2, TILE, TILE);
    }
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 13, 0, Math.PI*2);
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.30)' : 'rgba(230,70,70,0.35)';
    ctx.fill(); ctx.lineWidth = 2;
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : '#ff7d7d'; ctx.stroke();
  }

  // ----- UI layer (canvas pixels, not world coords) -----
  ctx.setTransform(1,0,0,1,0,0);
  drawBanner('center');
  if (b.startBannerT > 0) drawBanner('start');
  if (b.doubleBannerT > 0 && IMG.doubleElixir){
    const a = Math.min(1, b.doubleBannerT/0.5);
    ctx.globalAlpha = a;
    ctx.drawImage(IMG.doubleElixir, W/2-110, 240, 220, 220*IMG.doubleElixir.height/IMG.doubleElixir.width);
    ctx.globalAlpha = 1;
  }

  function drawBanner(mode){
    let list = [];
    if (mode==='center') list = b.banners;
    else if (b.startBannerT > 0) list = [{ text:'BATTLE!', t: 2.0-b.startBannerT, dur:2.0, color:'#ffd45a' }];
    for (const bn of list){
      const a = bn.t < 0.25 ? bn.t/0.25 : (bn.t > bn.dur-0.4 ? (bn.dur-bn.t)/0.4 : 1);
      ctx.globalAlpha = Math.max(0,a);
      ctx.font = 'bold 17px Trebuchet MS, sans-serif';
      ctx.textAlign='center';
      const w = ctx.measureText(bn.text).width + 28;
      ctx.fillStyle = 'rgba(8,14,30,0.82)';
      roundRect(W/2-w/2, 310, w, 30, 15); ctx.fill();
      ctx.strokeStyle = bn.color; ctx.lineWidth = 1.5; roundRect(W/2-w/2, 310, w, 30, 15); ctx.stroke();
      ctx.fillStyle = bn.color; ctx.fillText(bn.text, W/2, 330);
      ctx.globalAlpha = 1;
    }
  }
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawBar(x, y, w, frac, side){
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(x-w/2-1, y-1, w+2, 6);
  ctx.fillStyle = side==='player' ? '#54e04a' : '#ff4a4a';
  ctx.fillRect(x-w/2, y, w*frac, 4);
}

/* ---------------- hand UI ---------------- */
function renderHand(){
  const b = battle;
  ui.handRow.innerHTML = '';
  b.player.hand.forEach((k,i) => {
    const card = CARDS[k];
    const el = document.createElement('div');
    el.className = 'hand-card';
    el.style.backgroundImage = `url('${IMG['card_'+k].src}')`;
    el.innerHTML = `<span class="cost">${card.cost}</span>`;
    el.dataset.idx = i;
    ui.handRow.appendChild(el);
  });
  ui.nextCard.style.backgroundImage = `url('${IMG['card_'+b.player.next].src}')`;
  updateHandAffordability();
}
function updateHandAffordability(){
  if (!battle) return;
  [...ui.handRow.children].forEach((el,i) => {
    const k = battle.player.hand[i]; if (!k) return;
    el.classList.toggle('unaffordable', battle.player.elixir < CARDS[k].cost);
    el.classList.toggle('selected', battle.selected === i);
  });
  ui.elixirFill.style.width = (battle.player.elixir/ELIXIR_MAX*100)+'%';
  ui.elixirNum.textContent = Math.floor(battle.player.elixir);
  ui.elixirBar.classList.toggle('full', battle.player.elixir >= ELIXIR_MAX - 0.01);
}

/* ---------------- input ---------------- */
function canvasPos(ev){
  const r = canvas.getBoundingClientRect();
  const cx = (ev.clientX - r.left) / r.width * W;     // canvas px
  const cy = (ev.clientY - r.top) / r.height * CH;
  return { x: (cx - VXOFF) / VS, y: cy / VS };        // invert world transform
}
let dragInfo = null; // { idx, x0, y0, moved }

function tryDeployAt(pos){
  const b = battle;
  const k = b.player.hand[b.selected];
  const p = snapTile(pos);
  if (playerDeploy(k, p.x, p.y)){
    cycleCard(b.player, b.selected);
    b.selected = -1; b.pointerPos = null; dragInfo = null;
    renderHand();
    return true;
  }
  toast(deployValid(k,p.x,p.y,'player') ? 'Not enough elixir!' : "You can't deploy there!");
  return false;
}

ui.handRow.addEventListener('pointerdown', ev => {
  const el = ev.target.closest('.hand-card');
  if (!el || !battle || battle.over) return;
  ev.preventDefault();
  const idx = +el.dataset.idx;
  const k = battle.player.hand[idx];
  if (battle.selected === idx){
    // tap the selected card again to deselect — springs back down
    battle.selected = -1; battle.pointerPos = null; dragInfo = null;
    el.classList.add('settle');
    setTimeout(()=>el.classList.remove('settle'), 260);
    updateHandAffordability();
    return;
  }
  if (battle.player.elixir < CARDS[k].cost){
    el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'), 320);
    toast('Not enough elixir!');
    return;
  }
  battle.selected = idx;
  dragInfo = { idx, x0: ev.clientX, y0: ev.clientY, moved: false };
  battle.pointerPos = null;
  updateHandAffordability();
});
window.addEventListener('pointermove', ev => {
  if (!battle || battle.over) return;
  if (battle.selected < 0) return;
  if (dragInfo && (Math.abs(ev.clientX-dragInfo.x0) > 10 || Math.abs(ev.clientY-dragInfo.y0) > 10)) dragInfo.moved = true;
  // ghost preview only follows the cursor when it is truly over the grid,
  // not over the hand / elixir bar / UI that sit on top of the canvas
  const under = document.elementFromPoint(ev.clientX, ev.clientY);
  battle.pointerPos = (under === canvas) ? canvasPos(ev) : null;
});
window.addEventListener('pointerup', ev => {
  if (!battle || battle.over) return;
  if (battle.selected < 0) return;
  // only place if the cursor is actually on the grid (canvas) at release —
  // releasing over the hand, elixir bar, or any UI keeps the card selected
  const under = document.elementFromPoint(ev.clientX, ev.clientY);
  if (under === canvas){
    tryDeployAt(canvasPos(ev));
  }
});
canvas.addEventListener('pointerdown', ev => {
  if (!battle || battle.over) return;
  if (battle.selected < 0) return;
  ev.preventDefault();
  battle.pointerPos = canvasPos(ev);
});
window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && battle){ battle.selected = -1; battle.pointerPos = null; dragInfo = null; updateHandAffordability(); } });

/* ---------------- main loop ---------------- */
let lastT = 0, rafId = 0;
function loop(ts){
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - lastT)/1000 || 0.016);
  lastT = ts;
  if (!battle) return;
  if (ui.screenBattle.classList.contains('hidden')) return;
  updateBattle(dt);
  draw();
  updateTopBar();
}
function updateTopBar(){
  const t = Math.max(0, Math.ceil(battle.time));
  ui.timerLabel.textContent = `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  ui.timerLabel.classList.toggle('urgent', battle.time <= 10.5);
  ui.phaseLabel.textContent = battle.overtime ? 'OVERTIME' : (battle.doubleElixir ? '2× ELIXIR' : '');
  ui.playerCrowns.src = IMG['score'+Math.min(3,battle.player.crowns)].src;
  ui.enemyCrowns.src = IMG['score'+Math.min(3,battle.enemy.crowns)].src;
}

/* ---------------- screens & wiring ---------------- */
function wireUI(){
  ui.screenTitle.addEventListener('click', () => { showScreen('screen-menu'); SFX.beep(); });
  $('btnBattle').addEventListener('click', () => {
    if (G.deck.length !== 8){ renderDeckScreen(); showScreen('screen-deck'); toast('Choose 8 cards first!'); return; }
    showScreen('screen-difficulty');
  });
  $('btnDeck').addEventListener('click', () => { renderDeckScreen(); showScreen('screen-deck'); });
  $('btnHow').addEventListener('click', () => ui.howModal.classList.remove('hidden'));
  $('btnHowClose').addEventListener('click', () => ui.howModal.classList.add('hidden'));
  $('btnDeckBack').addEventListener('click', () => showScreen('screen-menu'));
  $('btnDeckReset').addEventListener('click', () => { G.deck = DEFAULT_DECK.slice(); renderDeckScreen(); SFX.beep(); });
  $('btnDeckSave').addEventListener('click', () => {
    if (G.deck.length !== 8){ toast('Pick exactly 8 cards!'); return; }
    localStorage.setItem('tcr_deck', JSON.stringify(G.deck));
    toast('Deck saved!'); showScreen('screen-menu');
  });
  ['Easy','Medium','Hard'].forEach(d => {
    $('btn'+d).addEventListener('click', () => {
      G.difficulty = d.toLowerCase(); localStorage.setItem('tcr_diff', G.difficulty);
      startBattle();
    });
  });
  $('btnDiffBack').addEventListener('click', () => showScreen('screen-menu'));
  $('btnQuit').addEventListener('click', () => { if (battle && !battle.over) ui.pauseModal.classList.remove('hidden'); });
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    else document.documentElement.requestFullscreen().catch(()=>toast('Fullscreen blocked by browser'));
  };
  $('btnFs').addEventListener('click', toggleFs);
  window.addEventListener('keydown', ev => { if (ev.key === 'f' || ev.key === 'F') toggleFs(); });
  $('btnResume').addEventListener('click', () => ui.pauseModal.classList.add('hidden'));
  $('btnQuitConfirm').addEventListener('click', () => {
    ui.pauseModal.classList.add('hidden');
    SFX.stopBattle();
    battle = null; showScreen('screen-menu'); SFX.music();
  });
  $('btnAgain').addEventListener('click', () => startBattle());
  $('btnMenu').addEventListener('click', () => { battle = null; showScreen('screen-menu'); SFX.music(); });
}

/* ---------------- boot ---------------- */
function runIntro(onDone){
  showScreen('screen-intro');
  setTimeout(() => SFX.startup(), 100);                 // sound at 0.1s
  const vid = ui.introVideo;
  vid.classList.remove('gone');
  vid.currentTime = 0;
  vid.play().catch(()=>{});
  setTimeout(() => {                                    // hide video, splash art at 2.1s
    vid.pause();
    vid.classList.add('gone');
    ui.introArt.classList.add('show');
  }, 2100);
  setTimeout(onDone, 4100);                             // 2.1s video + 2s art
}
async function boot(){
  wireUI();
  wireDeckScroll();
  wireDeckCardDrag();
  $('btnRandom').addEventListener('click', () => {
    const pool = ALL_CARD_KEYS.slice();
    for (let i = pool.length-1; i > 0; i--){ const j = (Math.random()*(i+1))|0; [pool[i],pool[j]] = [pool[j],pool[i]]; }
    G.deck = pool.slice(0,8);
    renderDeckScreen(); SFX.beep(); toast('Random deck!');
  });
  // click sound on interactive elements (not blank space / canvas)
  document.addEventListener('pointerdown', ev => {
    if (ev.target.closest('button, .hand-card, .deck-card, .deck-slot, .modal-card')) SFX.click();
  });
  window.addEventListener('pointerdown', () => { SFX.retryStartup(); SFX.retryMusic(); });  // autoplay-blocked fallback
  let introDone = false, assetsDone = false;
  const proceed = () => { if (introDone && assetsDone){ showScreen('screen-menu'); SFX.music(); } };
  runIntro(() => { introDone = true; proceed(); });
  loadAllAssets().then(() => { assetsDone = true; proceed(); });
  rafId = requestAnimationFrame(loop);
}
boot();
