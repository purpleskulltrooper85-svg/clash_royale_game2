/* ============================================================
   CROWNFRONT: ARENA DUEL — Command Card Database
   All cards are 100% original to this prototype.
   kind: 'unit' | 'spell' | 'struct'
   s: base stats at level 1.
      hp, dmg, rng (px), as (attacks/sec), spd (px/s), cnt (spawn count),
      sight (px), targets: 'ground'|'air'|'both'|'build', fly: 1,
      splash (px radius), shield, life (seconds, structures),
      proj ('ember'|'bolt'|'shard'|'hex'|'sling'), firstHit (x multiplier on
      first attack), evade (0..1), reflect (0..1), heal (per pulse),
      healR (radius), slowAura {pct,r}, onDeath {dmg,r} | {spawn:cardId,cnt},
      deployAnywhere: 1
   fx (spells): { type:'burst'|'dot'|'root'|'chain'|'pull', dmg, radius,
      dur, slow, stun, delay, chains, pull }
   role: AI usage tags.  unlock: Rank Marks required to unlock.
   ============================================================ */

const RARITY_ORDER = { standard: 0, elite: 1, arcane: 2, mythic: 3 };
const RARITY_LABEL = { standard: 'Standard', elite: 'Elite', arcane: 'Arcane', mythic: 'Mythic' };
const RARITY_COLOR = {
  standard: '#7FA6C8',
  elite:    '#F5A44A',
  arcane:   '#B26CFF',
  mythic:   '#5DEBFF'
};
const RARITY_FRAG_MULT = { standard: 1, elite: 2, arcane: 4, mythic: 10 };

/* Fragments needed per upgrade step (level n -> n+1), 14 steps to lvl 15 */
const UPGRADE_FRAGS = [2, 4, 10, 20, 50, 100, 200, 400, 800, 1400, 2400, 3800, 5600, 8000];

function fragsForLevel(card, level) {
  const step = UPGRADE_FRAGS[Math.min(level - 1, UPGRADE_FRAGS.length - 1)];
  return Math.ceil(step * RARITY_FRAG_MULT[card.rarity]);
}
function coinsForLevel(card, level) {
  return fragsForLevel(card, level) * (card.rarity === 'mythic' ? 60 : card.rarity === 'arcane' ? 30 : card.rarity === 'elite' ? 15 : 8);
}

const CARDS = [
  /* ---------------- Starter kit (always unlocked) ---------------- */
  {
    id: 'iron_squire', name: 'Iron Squire', cat: 'Vanguard Unit', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'knight', unlock: 0,
    desc: 'A dutiful trainee in polished plate. A balanced melee fighter for any front.',
    tags: ['Ground', 'Melee'], role: ['tank', 'defense'],
    s: { hp: 940, dmg: 145, rng: 26, as: 1.1, spd: 62, cnt: 1, sight: 190, targets: 'ground' }
  },
  {
    id: 'ember_slingers', name: 'Ember Slingers', cat: 'Ranger', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'archer', proj: 'ember', unlock: 0,
    desc: 'Twin scouts hurling glowing slingstones. Fragile, but their combined fire stings.',
    tags: ['Ground', 'Ranged', 'x2'], role: ['ranged', 'defense'],
    s: { hp: 250, dmg: 85, rng: 170, as: 1.15, spd: 62, cnt: 2, sight: 200, targets: 'both', proj: 'ember' }
  },
  {
    id: 'mosslings', name: 'Mosslings', cat: 'Swarm Unit', kind: 'unit', rarity: 'standard',
    cost: 2, vis: 'swarm', unlock: 0,
    desc: 'Four tiny forest bulbs that hop at anything that moves. Great for surrounding.',
    tags: ['Ground', 'Swarm', 'Melee', 'Cycle'], role: ['swarm', 'defense'],
    s: { hp: 115, dmg: 52, rng: 22, as: 0.9, spd: 98, cnt: 4, sight: 170, targets: 'ground' }
  },
  {
    id: 'bastion_guard', name: 'Bastion Guard', cat: 'Guardian', kind: 'unit', rarity: 'elite',
    cost: 4, vis: 'guard', unlock: 0,
    desc: 'A shield-bearer whose aegis absorbs the first blows of any assault.',
    tags: ['Ground', 'Tank', 'Shield'], role: ['tank', 'defense'],
    s: { hp: 1350, dmg: 95, rng: 28, as: 1.25, spd: 55, cnt: 1, sight: 180, targets: 'ground', shield: 220 }
  },
  {
    id: 'gear_ram', name: 'Gear Ram', cat: 'Siege Unit', kind: 'unit', rarity: 'elite',
    cost: 5, vis: 'ram', unlock: 0,
    desc: 'A clockwork battering ram that charges straight for structures. Splits into gearlings when destroyed.',
    tags: ['Ground', 'Building Target', 'Siege'], role: ['wincon', 'siege', 'building'],
    s: { hp: 1500, dmg: 170, rng: 30, as: 1.6, spd: 72, cnt: 1, sight: 200, targets: 'build', bldgMult: 4, onDeath: { spawn: 'mirror_mites', cnt: 2 } }
  },
  {
    id: 'storm_flask', name: 'Storm Flask', cat: 'Tactic', kind: 'spell', rarity: 'standard',
    cost: 4, vis: 'flask', unlock: 0,
    desc: 'Lightning bottled at dawn. Shatters into area damage and leaves foes sluggish.',
    tags: ['Area Damage', 'Slow'], role: ['spell', 'splash'],
    fx: { type: 'burst', dmg: 300, radius: 115, slow: 0.45, dur: 2.5, delay: 0.6 }
  },
  {
    id: 'sky_manta', name: 'Sky Manta', cat: 'Flyer', kind: 'unit', rarity: 'elite',
    cost: 3, vis: 'manta', proj: 'bolt', unlock: 0,
    desc: 'A rune-marked glider that drifts over the rift and strikes air and ground alike.',
    tags: ['Air', 'Ranged'], role: ['air', 'antiair', 'ranged'],
    s: { hp: 470, dmg: 100, rng: 150, as: 1.1, spd: 85, cnt: 1, sight: 200, targets: 'both', fly: 1, proj: 'bolt' }
  },
  {
    id: 'root_snare', name: 'Root Snare', cat: 'Tactic', kind: 'spell', rarity: 'standard',
    cost: 2, vis: 'snare', unlock: 0,
    desc: 'Thorny vines erupt from the soil, pinning small groups in place.',
    tags: ['Root', 'Utility'], role: ['spell', 'utility'],
    fx: { type: 'root', dmg: 60, radius: 105, dur: 1.8, delay: 0.3 }
  },
  {
    id: 'bolt_pixies', name: 'Bolt Pixies', cat: 'Flyer', kind: 'unit', rarity: 'standard',
    cost: 2, vis: 'pixie', proj: 'bolt', unlock: 0,
    desc: 'Three crackling sprites that zip across the field and pepper targets with sparks.',
    tags: ['Air', 'Swarm', 'Ranged', 'Cycle'], role: ['air', 'swarm', 'cycle'],
    s: { hp: 105, dmg: 48, rng: 115, as: 0.75, spd: 105, cnt: 3, sight: 180, targets: 'both', fly: 1, proj: 'bolt' }
  },
  {
    id: 'granite_brute', name: 'Granite Brute', cat: 'Guardian', kind: 'unit', rarity: 'arcane',
    cost: 7, vis: 'golem', unlock: 1200,
    desc: 'A walking monolith with a molten core. Its collapse scatters burning stone.',
    tags: ['Ground', 'Tank', 'Melee'], role: ['tank', 'push'],
    s: { hp: 3400, dmg: 270, rng: 30, as: 1.7, spd: 40, cnt: 1, sight: 180, targets: 'ground', onDeath: { dmg: 150, r: 100 } }
  },
  {
    id: 'prism_cannon', name: 'Prism Cannon', cat: 'Structure', kind: 'struct', rarity: 'elite',
    cost: 5, vis: 'turret', unlock: 0,
    desc: 'A three-legged crystal turret. Refracts aether bolts at air and ground for a limited time.',
    tags: ['Structure', 'Anti-Air', 'Ranged'], role: ['structure', 'antiair', 'defense'],
    s: { hp: 950, dmg: 115, rng: 265, as: 1.0, spd: 0, cnt: 1, sight: 280, targets: 'both', life: 30, proj: 'prism' }
  },
  {
    id: 'comet_drop', name: 'Comet Drop', cat: 'Tactic', kind: 'spell', rarity: 'arcane',
    cost: 6, vis: 'comet', unlock: 0,
    desc: 'Call a burning fragment from the aether stream. Slow to land, devastating on arrival.',
    tags: ['Area Damage', 'Big Spell'], role: ['spell', 'bigspell'],
    fx: { type: 'burst', dmg: 650, radius: 135, delay: 1.3 }
  },

  /* ---------------- Unlocked by Rank Marks ---------------- */
  {
    id: 'mirror_mites', name: 'Mirror Mites', cat: 'Swarm Unit', kind: 'unit', rarity: 'standard',
    cost: 1, vis: 'swarm', unlock: 0,
    desc: 'Three chrome flecks that scuttle and pinch. The cheapest distraction in the Frontier.',
    tags: ['Ground', 'Swarm', 'Cycle'], role: ['swarm', 'cycle'],
    s: { hp: 85, dmg: 42, rng: 20, as: 0.8, spd: 105, cnt: 3, sight: 150, targets: 'ground' }
  },
  {
    id: 'clockwork_hound', name: 'Clockwork Hound', cat: 'Vanguard Unit', kind: 'unit', rarity: 'standard',
    cost: 2, vis: 'hound', unlock: 0,
    desc: 'A wind-up tracker with snapping jaws. Bites far faster than it should.',
    tags: ['Ground', 'Fast', 'Melee'], role: ['cycle', 'defense'],
    s: { hp: 430, dmg: 72, rng: 24, as: 1.7, spd: 108, cnt: 1, sight: 190, targets: 'ground' }
  },
  {
    id: 'frostbell', name: 'Frostbell', cat: 'Tactic', kind: 'spell', rarity: 'standard',
    cost: 3, vis: 'bell', unlock: 0,
    desc: 'A chime of winter. The ring chills and slows everything caught nearby.',
    tags: ['Area Damage', 'Slow'], role: ['spell', 'splash'],
    fx: { type: 'burst', dmg: 150, radius: 120, slow: 0.6, dur: 3, delay: 0.5 }
  },
  {
    id: 'bloom_bomb', name: 'Bloom Bomb', cat: 'Tactic', kind: 'spell', rarity: 'standard',
    cost: 3, vis: 'bloom', unlock: 0,
    desc: 'A seedpod of hungering blossoms that drain anything standing in their patch.',
    tags: ['Area Damage', 'DoT Zone'], role: ['spell', 'splash'],
    fx: { type: 'dot', dmg: 55, radius: 110, dur: 4, delay: 0.4 }
  },
  {
    id: 'sand_skimmer', name: 'Sand Skimmer', cat: 'Ranger', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'skimmer', proj: 'shard', unlock: 100,
    desc: 'A dune-gliding marksman who fires glass shards while staying just out of reach.',
    tags: ['Ground', 'Ranged', 'Fast'], role: ['ranged', 'defense'],
    s: { hp: 520, dmg: 95, rng: 140, as: 1.0, spd: 92, cnt: 1, sight: 200, targets: 'ground', proj: 'shard' }
  },
  {
    id: 'raven_courier', name: 'Raven Courier', cat: 'Flyer', kind: 'unit', rarity: 'standard',
    cost: 2, vis: 'raven', unlock: 100,
    desc: 'A swift messenger bird that forgot to deliver its letter — and takes it out on you.',
    tags: ['Air', 'Fast', 'Melee'], role: ['air', 'cycle'],
    s: { hp: 300, dmg: 75, rng: 24, as: 0.9, spd: 125, cnt: 1, sight: 210, targets: 'both', fly: 1 }
  },
  {
    id: 'windstep_duelist', name: 'Windstep Duelist', cat: 'Vanguard Unit', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'duelist', unlock: 200,
    desc: 'A blade dancer who slips a quarter of incoming blows with perfect footwork.',
    tags: ['Ground', 'Fast', 'Evade'], role: ['defense', 'counter'],
    s: { hp: 780, dmg: 155, rng: 26, as: 1.0, spd: 98, cnt: 1, sight: 190, targets: 'ground', evade: 0.25 }
  },
  {
    id: 'alloy_archer', name: 'Alloy Archer', cat: 'Ranger', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'archer', proj: 'shard', unlock: 200,
    desc: 'A long-range sharpshooter with a drawn-steel bow. Hits air and ground with ease.',
    tags: ['Ground', 'Ranged', 'Anti-Air'], role: ['ranged', 'antiair'],
    s: { hp: 470, dmg: 130, rng: 200, as: 1.05, spd: 60, cnt: 1, sight: 220, targets: 'both', proj: 'shard' }
  },
  {
    id: 'void_bats', name: 'Void Bats', cat: 'Flyer', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'bat', unlock: 250,
    desc: 'Five shadow-winged nibblers boiling out of a fold in the sky.',
    tags: ['Air', 'Swarm', 'Melee'], role: ['air', 'swarm'],
    s: { hp: 90, dmg: 45, rng: 22, as: 0.85, spd: 108, cnt: 5, sight: 180, targets: 'both', fly: 1 }
  },
  {
    id: 'sunseed_healer', name: 'Sunseed Healer', cat: 'Support', kind: 'unit', rarity: 'standard',
    cost: 3, vis: 'healer', unlock: 300,
    desc: 'Carries a glowing seed that mends nearby allies every second. Keep it sheltered.',
    tags: ['Ground', 'Support', 'Heal'], role: ['support', 'heal'],
    s: { hp: 520, dmg: 40, rng: 130, as: 0.6, spd: 55, cnt: 1, sight: 190, targets: 'ground', heal: 55, healR: 120, proj: 'seed' }
  },
  {
    id: 'static_coil', name: 'Static Coil', cat: 'Tactic', kind: 'spell', rarity: 'elite',
    cost: 4, vis: 'coil', unlock: 350,
    desc: 'Unleashes a forked arc that leaps between targets and briefly stuns each one.',
    tags: ['Chain', 'Stun', 'Area Damage'], role: ['spell', 'splash'],
    fx: { type: 'chain', dmg: 190, radius: 140, chains: 3, stun: 0.5, delay: 0.4 }
  },
  {
    id: 'moon_archivist', name: 'Moon Archivist', cat: 'Support', kind: 'unit', rarity: 'elite',
    cost: 4, vis: 'archivist', proj: 'hex', unlock: 400,
    desc: 'Scholar of lunar scripts. Restores allies with silver pulses and jots down attackers.',
    tags: ['Ground', 'Support', 'Heal'], role: ['support', 'heal', 'ranged'],
    s: { hp: 680, dmg: 60, rng: 150, as: 0.7, spd: 55, cnt: 1, sight: 200, targets: 'both', heal: 130, healR: 140, proj: 'hex' }
  },
  {
    id: 'scrap_barricade', name: 'Scrap Barricade', cat: 'Structure', kind: 'struct', rarity: 'elite',
    cost: 2, vis: 'barricade', unlock: 400,
    desc: 'A slapped-together wall of spare plates. Ground units stubbornly chew through it.',
    tags: ['Structure', 'Wall'], role: ['structure', 'defense'],
    s: { hp: 850, dmg: 0, rng: 0, as: 0, spd: 0, cnt: 1, sight: 0, targets: 'none', life: 22 }
  },
  {
    id: 'thorn_rider', name: 'Thorn Rider', cat: 'Vanguard Unit', kind: 'unit', rarity: 'elite',
    cost: 4, vis: 'rider', unlock: 450,
    desc: 'A bramble-courier on a spined steed. Its opening charge strikes twice as hard.',
    tags: ['Ground', 'Fast', 'Charge'], role: ['counter', 'push'],
    s: { hp: 1150, dmg: 150, rng: 28, as: 1.2, spd: 92, cnt: 1, sight: 200, targets: 'ground', firstHit: 2 }
  },
  {
    id: 'mist_stalker', name: 'Mist Stalker', cat: 'Vanguard Unit', kind: 'unit', rarity: 'elite',
    cost: 4, vis: 'stalker', unlock: 500,
    desc: 'It walks out of the fog already swinging. Its ambush opening hits nearly twice over.',
    tags: ['Ground', 'Ambush', 'Melee'], role: ['counter', 'defense'],
    s: { hp: 920, dmg: 250, rng: 28, as: 1.4, spd: 88, cnt: 1, sight: 200, targets: 'ground', firstHit: 1.8 }
  },
  {
    id: 'echo_totem', name: 'Echo Totem', cat: 'Structure', kind: 'struct', rarity: 'elite',
    cost: 4, vis: 'totem', unlock: 550,
    desc: 'Hums a heavy drone that drags at the legs of every enemy nearby.',
    tags: ['Structure', 'Slow Aura'], role: ['structure', 'utility'],
    s: { hp: 680, dmg: 0, rng: 0, as: 0, spd: 0, cnt: 1, sight: 0, targets: 'none', life: 26, slowAura: { pct: 0.3, r: 160 } }
  },
  {
    id: 'meteor_beetle', name: 'Meteor Beetle', cat: 'Vanguard Unit', kind: 'unit', rarity: 'elite',
    cost: 5, vis: 'beetle', unlock: 600,
    desc: 'A shell-plated charger whose horn sweep cracks everything in a small arc.',
    tags: ['Ground', 'Tank', 'Splash'], role: ['tank', 'push'],
    s: { hp: 1650, dmg: 210, rng: 30, as: 1.5, spd: 55, cnt: 1, sight: 180, targets: 'ground', splash: 55 }
  },
  {
    id: 'crystal_drakes', name: 'Crystal Drakes', cat: 'Flyer', kind: 'unit', rarity: 'elite',
    cost: 5, vis: 'drake', proj: 'prism', unlock: 650,
    desc: 'A mated pair of facet-winged drakes breathing refracted light.',
    tags: ['Air', 'Ranged', 'x2'], role: ['air', 'push', 'ranged'],
    s: { hp: 620, dmg: 135, rng: 140, as: 1.3, spd: 75, cnt: 2, sight: 210, targets: 'both', fly: 1, proj: 'prism' }
  },
  {
    id: 'thornback_turtle', name: 'Thornback Turtle', cat: 'Guardian', kind: 'unit', rarity: 'elite',
    cost: 4, vis: 'turtle', unlock: 700,
    desc: 'An ancient shellback. Attackers regret every blow — it returns a fifth of the pain.',
    tags: ['Ground', 'Tank', 'Reflect'], role: ['tank', 'defense'],
    s: { hp: 1900, dmg: 85, rng: 26, as: 1.5, spd: 34, cnt: 1, sight: 170, targets: 'ground', reflect: 0.2 }
  },
  {
    id: 'orbital_beacon', name: 'Orbital Beacon', cat: 'Structure', kind: 'struct', rarity: 'arcane',
    cost: 6, vis: 'beacon', unlock: 800,
    desc: 'A spire that calls down focused starlight across an enormous reach.',
    tags: ['Structure', 'Ranged', 'Anti-Air'], role: ['structure', 'antiair', 'defense'],
    s: { hp: 720, dmg: 95, rng: 330, as: 1.2, spd: 0, cnt: 1, sight: 350, targets: 'both', life: 40, proj: 'prism' }
  },
  {
    id: 'rift_miner', name: 'Rift Miner', cat: 'Siege Unit', kind: 'unit', rarity: 'arcane',
    cost: 3, vis: 'miner', unlock: 850,
    desc: 'Tunnels through aether seams — deploy anywhere on your side, even far behind the line.',
    tags: ['Ground', 'Building Target', 'Deploy Anywhere'], role: ['wincon', 'siege', 'building'],
    s: { hp: 850, dmg: 130, rng: 26, as: 1.3, spd: 72, cnt: 1, sight: 190, targets: 'build', bldgMult: 2.4, deployAnywhere: 1 }
  },
  {
    id: 'lantern_witch', name: 'Lantern Witch', cat: 'Ranger', kind: 'unit', rarity: 'arcane',
    cost: 5, vis: 'witch', proj: 'hex', unlock: 900,
    desc: 'Swings a drifting lantern that bursts in green fire, scorching whole clusters.',
    tags: ['Ground', 'Ranged', 'Splash', 'Anti-Air'], role: ['splash', 'antiair', 'ranged'],
    s: { hp: 640, dmg: 175, rng: 185, as: 1.5, spd: 55, cnt: 1, sight: 210, targets: 'both', splash: 70, proj: 'hex' }
  },
  {
    id: 'pulse_golem', name: 'Pulse Golem', cat: 'Guardian', kind: 'unit', rarity: 'arcane',
    cost: 6, vis: 'golem', unlock: 1000,
    desc: 'A resonating sentinel whose fistfall sends a shockwave through nearby armor.',
    tags: ['Ground', 'Tank', 'Splash'], role: ['tank', 'push'],
    s: { hp: 2650, dmg: 185, rng: 115, as: 1.5, spd: 45, cnt: 1, sight: 190, targets: 'ground', splash: 60 }
  },
  {
    id: 'gravity_well', name: 'Gravity Well', cat: 'Tactic', kind: 'spell', rarity: 'mythic',
    cost: 4, vis: 'well', unlock: 1100,
    desc: 'Folds space inward, yanking enemies to a point and leaving them heavy and slow.',
    tags: ['Pull', 'Slow', 'Area'], role: ['spell', 'utility'],
    fx: { type: 'pull', dmg: 110, radius: 140, slow: 0.3, dur: 2, delay: 0.6 }
  },
  {
    id: 'cinder_colossus', name: 'Cinder Colossus', cat: 'Guardian', kind: 'unit', rarity: 'mythic',
    cost: 8, vis: 'colossus', unlock: 1500,
    desc: 'A furnace-titan of slag and ember. Its footsteps scorch, and its fall is an eruption.',
    tags: ['Ground', 'Tank', 'Splash'], role: ['tank', 'push', 'bigunit'],
    s: { hp: 4300, dmg: 310, rng: 34, as: 1.8, spd: 34, cnt: 1, sight: 190, targets: 'ground', splash: 40, onDeath: { dmg: 200, r: 110 } }
  }
];

const CARD_BY_ID = {};
CARDS.forEach(c => CARD_BY_ID[c.id] = c);

function getCard(id) { return CARD_BY_ID[id]; }

/* Per-level scaling: hp +9%/lvl, dmg +8%/lvl */
function scaledStats(card, level) {
  const m = 1 + 0.08 * (level - 1);
  const h = 1 + 0.09 * (level - 1);
  const s = card.s || {};
  const out = Object.assign({}, s);
  if (s.hp) out.hp = Math.round(s.hp * h);
  if (s.dmg) out.dmg = Math.round(s.dmg * m);
  if (card.fx && card.fx.dmg) { out.fx = Object.assign({}, card.fx); out.fx.dmg = Math.round(card.fx.dmg * m); }
  return out;
}
function fxAtLevel(card, level) {
  if (!card.fx) return null;
  const f = Object.assign({}, card.fx);
  f.dmg = Math.round(f.dmg * (1 + 0.08 * (level - 1)));
  return f;
}

/* DPS helper shown in collection */
function dpsEstimate(card) {
  if (card.kind !== 'unit' && card.kind !== 'struct') return 0;
  const s = card.s;
  if (!s.dmg || !s.as) return 0;
  return Math.round(s.dmg * s.as * (s.cnt || 1) * (s.bldgMult ? 1.5 : 1));
}
