/* ============================================================
   CROWNFRONT: ARENA DUEL — Rewards, Crates, Pass, Quests, Bots
   ============================================================ */

/* ---------------- Supply Crates ---------------- */
const CRATE_TYPES = {
  scout: {
    id: 'scout', name: 'Scout Crate', color: '#7FA6C8', icon: 'crate1',
    unlockSecs: 30,               /* prototype-shortened timers */
    coins: [40, 90], frags: 12, eliteChance: 0.10, arcaneChance: 0, shardChance: 0.12,
    desc: 'Standard issue supplies. Coins and Standard fragments.'
  },
  vanguard: {
    id: 'vanguard', name: 'Vanguard Crate', color: '#F5A44A', icon: 'crate2',
    unlockSecs: 90,
    coins: [90, 160], frags: 26, eliteChance: 0.55, arcaneChance: 0.08, shardChance: 0.25,
    desc: 'Field rations and reinforcement fragments. Good Elite odds.'
  },
  arcane: {
    id: 'arcane', name: 'Arcane Crate', color: '#B26CFF', icon: 'crate3',
    unlockSecs: 240,
    coins: [150, 260], frags: 46, eliteChance: 0.9, arcaneChance: 0.4, shardChance: 0.5,
    desc: 'Resonant cargo. Solid Arcane odds and Shards.'
  },
  frontier: {
    id: 'frontier', name: 'Frontier Crate', color: '#5DEBFF', icon: 'crate4',
    unlockSecs: 480,
    coins: [260, 420], frags: 80, eliteChance: 1, arcaneChance: 0.7, shardChance: 0.8,
    desc: 'A expedition chest. Guaranteed multiple card types.'
  },
  crown: {
    id: 'crown', name: 'Crown Crate', color: '#FFD45A', icon: 'crate5',
    unlockSecs: 300,
    coins: [300, 500], frags: 70, eliteChance: 1, arcaneChance: 0.85, shardChance: 1,
    desc: 'Seasonal spoils. The strongest rewards in the Frontier.'
  }
};

/* Crate fragment target rarity roll */
function rollCrateRarity(ct) {
  const r = Math.random();
  if (r < ct.arcaneChance) return 'arcane';
  if (r < ct.arcaneChance + ct.eliteChance * 0.5) return 'elite';
  return 'standard';
}

/* ---------------- Vanguard Path milestones ---------------- */
/* Generated: every 150 marks up to 3900, escalating rewards */
const VANGUARD_MILESTONES = (function () {
  const list = [];
  let marks = 100;
  let i = 0;
  while (marks <= 3900) {
    const tier = Math.floor(i / 4);
    let reward;
    const kind = i % 4;
    if (kind === 0) reward = { type: 'coins', amount: 120 + tier * 60, label: 'Coins' };
    else if (kind === 1) reward = { type: 'frags', card: pickVanguardCard(tier, kind), amount: 20 + tier * 15, label: 'Fragments' };
    else if (kind === 2) reward = { type: 'crate', crate: tier >= 4 ? 'arcane' : tier >= 2 ? 'vanguard' : 'scout', label: 'Supply Crate' };
    else reward = { type: 'shards', amount: 5 + tier * 3, label: 'Shards' };
    list.push({ marks, reward, id: 'vm_' + i });
    marks += 150;
    i++;
  }
  list.push({ marks: 4000, reward: { type: 'crate', crate: 'crown', label: 'Crown Crate' }, id: 'vm_final' });
  return list;
})();
function pickVanguardCard(tier, salt) {
  const pool = ['mirror_mites', 'clockwork_hound', 'sand_skimmer', 'raven_courier', 'windstep_duelist', 'alloy_archer',
    'static_coil', 'moon_archivist', 'thorn_rider', 'mist_stalker', 'meteor_beetle', 'crystal_drakes',
    'orbital_beacon', 'rift_miner', 'lantern_witch', 'pulse_golem', 'cinder_colossus', 'gravity_well'];
  return pool[(tier * 2 + salt) % pool.length];
}

/* ---------------- Season Pass (Aetherwild Season) ---------------- */
const SEASON_NAME = 'The Aetherwild Season';
const PASS_TIER_XP = 100;
const PASS_TIERS = (function () {
  const tiers = [];
  for (let t = 1; t <= 30; t++) {
    let free, prem;
    const m = t % 5;
    if (m === 1) { free = { type: 'coins', amount: 60 + t * 6, label: 'Coins' }; prem = { type: 'shards', amount: 4 + Math.floor(t / 5), label: 'Shards' }; }
    else if (m === 2) { free = { type: 'frags', card: ['mirror_mites', 'sand_skimmer', 'static_coil', 'meteor_beetle', 'rift_miner', 'gravity_well'][Math.floor(t / 5) % 6], amount: 10 + t * 2, label: 'Fragments' }; prem = { type: 'frags', card: ['moon_archivist', 'lantern_witch', 'crystal_drakes', 'pulse_golem', 'cinder_colossus', 'gravity_well'][Math.floor(t / 5) % 6], amount: 15 + t * 2, label: 'Fragments' }; }
    else if (m === 3) { free = { type: 'xp', amount: 40 + t * 4, label: 'Season XP Boost' }; prem = { type: 'coins', amount: 150 + t * 10, label: 'Coins' }; }
    else if (m === 4) { free = { type: 'crate', crate: 'scout', label: 'Scout Crate' }; prem = { type: 'crate', crate: 'arcane', label: 'Arcane Crate' }; }
    else { free = { type: 'banner', banner: 'aetherwild_' + (Math.floor(t / 5) + 1), label: 'Banner' }; prem = { type: 'crate', crate: 'crown', label: 'Crown Crate' }; }
    tiers.push({ tier: t, free, prem });
  }
  return tiers;
})();

/* Commander Banner cosmetics (unlockable) */
const BANNERS = [
  { id: 'default', name: 'Commander Standard', color: '#36C8FF', color2: '#0D1630', unlock: 0 },
  { id: 'aetherwild_1', name: 'Firefly Vigil', color: '#6DE38B', color2: '#15244A', unlock: -1 },
  { id: 'aetherwild_2', name: 'Mistline Crest', color: '#5EE8D7', color2: '#0D1630', unlock: -1 },
  { id: 'aetherwild_3', name: 'Crystal Moon', color: '#B26CFF', color2: '#15244A', unlock: -1 },
  { id: 'aetherwild_4', name: 'Ember Court', color: '#F5A44A', color2: '#2A1A10', unlock: -1 },
  { id: 'aetherwild_5', name: 'Crownmaster Gold', color: '#FFD45A', color2: '#3A2A08', unlock: -1 },
  { id: 'aetherwild_6', name: 'Aetherwild Sovereign', color: '#D98CFF', color2: '#1A1030', unlock: -1 }
];

/* ---------------- Quest pool ---------------- */
const QUEST_POOL = [
  { id: 'q_play3', text: 'Play 3 matches', metric: 'matches', goal: 3, reward: { coins: 60, xp: 40 } },
  { id: 'q_win2', text: 'Win 2 matches', metric: 'wins', goal: 2, reward: { coins: 90, xp: 60 } },
  { id: 'q_deploy_vanguard', text: 'Deploy 20 Vanguard Units', metric: 'vanguardUnits', goal: 20, reward: { coins: 70, xp: 45 } },
  { id: 'q_towerdmg', text: 'Deal 10,000 tower damage', metric: 'towerDamage', goal: 10000, reward: { coins: 110, xp: 70 } },
  { id: 'q_tactics', text: 'Use 15 Tactics', metric: 'tactics', goal: 15, reward: { coins: 80, xp: 50 } },
  { id: 'q_bastions', text: 'Destroy 5 Bastion Towers', metric: 'bastions', goal: 5, reward: { coins: 120, xp: 80 } },
  { id: 'q_aether', text: 'Spend 100 Aether', metric: 'aetherSpent', goal: 100, reward: { coins: 70, xp: 45 } },
  { id: 'q_flyers', text: 'Play 10 flying units', metric: 'flyingUnits', goal: 10, reward: { coins: 75, xp: 50 } },
  { id: 'q_crate', text: 'Open 1 Supply Crate', metric: 'cratesOpened', goal: 1, reward: { coins: 50, xp: 30 } },
  { id: 'q_cheapwin', text: 'Win with an average Battle Kit cost under 3.5', metric: 'cheapWin', goal: 1, reward: { coins: 130, xp: 85 } }
];

/* ---------------- Daily login rewards (7-day cycle) ---------------- */
const DAILY_REWARDS = [
  { coins: 60 },
  { coins: 80 },
  { frags: { card: 'mirror_mites', amount: 15 } },
  { shards: 3 },
  { coins: 120 },
  { frags: { card: 'bolt_pixies', amount: 25 } },
  { crate: 'vanguard', banner: 'aetherwild_1' }
];

/* ---------------- Bot opponents ---------------- */
const BOT_NAMES = ['EmberFox', 'MossWarden', 'GearHawk', 'PrismScout', 'RiftRunner', 'ThornCaptain',
  'NovaMoth', 'IronCrest', 'LanternVale', 'StormRook', 'BrambleByte', 'FrostCircuit',
  'DuskMarrow', 'Cinderquill', 'TideCaller', 'VexHopps', 'QuartzFlinch', 'SolarMist'];

const BOT_DIFFICULTIES = {
  training: { label: 'Training', reaction: [1200, 1800], mistakes: 0.55 },
  easy:     { label: 'Easy',     reaction: [900, 1400],  mistakes: 0.40 },
  normal:   { label: 'Normal',   reaction: [650, 1000],  mistakes: 0.22 },
  hard:     { label: 'Hard',     reaction: [400, 700],   mistakes: 0.10 },
  expert:   { label: 'Expert',   reaction: [250, 500],   mistakes: 0.04 },
  boss:     { label: 'Frontier Boss', reaction: [300, 550], mistakes: 0.02 }
};

const BOT_PERSONALITIES = [
  { id: 'balanced', name: 'Balanced Commander', aggression: 0.5, defense: 0.7, spellUse: 0.5, cycle: 0.4 },
  { id: 'rush', name: 'Rush Commander', aggression: 0.9, defense: 0.35, spellUse: 0.35, cycle: 0.8 },
  { id: 'fortress', name: 'Fortress Commander', aggression: 0.3, defense: 0.95, spellUse: 0.5, cycle: 0.3 },
  { id: 'swarm', name: 'Swarm Commander', aggression: 0.7, defense: 0.5, spellUse: 0.4, cycle: 0.9 },
  { id: 'siege', name: 'Siege Commander', aggression: 0.55, defense: 0.6, spellUse: 0.45, cycle: 0.35 },
  { id: 'spell', name: 'Spell Commander', aggression: 0.5, defense: 0.6, spellUse: 0.95, cycle: 0.5 },
  { id: 'boss', name: 'Boss Commander', aggression: 0.8, defense: 0.85, spellUse: 0.8, cycle: 0.6 }
];

/* Bot deck templates (8 cards each) — all valid card ids */
const BOT_DECKS = {
  balanced: ['iron_squire', 'ember_slingers', 'mosslings', 'bastion_guard', 'gear_ram', 'storm_flask', 'sky_manta', 'root_snare'],
  rush: ['clockwork_hound', 'mosslings', 'mirror_mites', 'thorn_rider', 'gear_ram', 'bolt_pixies', 'ember_slingers', 'root_snare'],
  fortress: ['bastion_guard', 'thornback_turtle', 'prism_cannon', 'granite_brute', 'echo_totem', 'storm_flask', 'alloy_archer', 'scrap_barricade'],
  swarm: ['mosslings', 'mirror_mites', 'void_bats', 'bolt_pixies', 'bloom_bomb', 'windstep_duelist', 'raven_courier', 'root_snare'],
  siege: ['gear_ram', 'rift_miner', 'prism_cannon', 'granite_brute', 'scrap_barricade', 'frostbell', 'alloy_archer', 'mirror_mites'],
  spell: ['storm_flask', 'comet_drop', 'static_coil', 'frostbell', 'gravity_well', 'iron_squire', 'alloy_archer', 'mosslings'],
  boss: ['cinder_colossus', 'gear_ram', 'lantern_witch', 'crystal_drakes', 'static_coil', 'bastion_guard', 'frostbell', 'comet_drop']
};

/* ---------------- Loading tips & defeat suggestions ---------------- */
const LOADING_TIPS = [
  'Save Aether before committing to a big push.',
  'Defend efficiently, then counterattack.',
  'Watch the opponent\u2019s card cycle.',
  'Spells can secure damage when time is low.',
  'Split-lane pressure can force difficult choices.',
  'A cheap card can help you rotate back to your strongest unit.',
  'Flying units ignore the river \u2014 keep anti-air ready.',
  'The Gear Ram only cares about structures. Chip it down fast.'
];

const DEFEAT_SUGGESTIONS = [
  'Try saving Storm Flask for clustered swarms.',
  'Your Battle Kit may lack a reliable air counter \u2014 visit the Deck Builder.',
  'Avoid spending all Aether in one lane without a defense plan.',
  'Defend first, then counterattack with surviving units.',
  'A cheap cycle card helps you reach your strongest unit faster.',
  'Place ranged units behind your tanks, not in front.',
  'Watch the bridges \u2014 a lone ram can slip past a distracted defense.'
];

/* Rank divisions */
const RANK_DIVISIONS = [
  { name: 'Recruit I', min: 0 }, { name: 'Recruit II', min: 200 },
  { name: 'Pathfinder I', min: 400 }, { name: 'Pathfinder II', min: 700 },
  { name: 'Vanguard I', min: 1000 }, { name: 'Vanguard II', min: 1400 },
  { name: 'Warden I', min: 1800 }, { name: 'Warden II', min: 2200 },
  { name: 'Champion I', min: 2600 }, { name: 'Champion II', min: 3100 },
  { name: 'Crownmaster', min: 3700 }
];
function divisionForMarks(marks) {
  let d = RANK_DIVISIONS[0];
  for (const div of RANK_DIVISIONS) if (marks >= div.min) d = div;
  return d;
}
function nextDivision(marks) {
  for (const div of RANK_DIVISIONS) if (marks < div.min) return div;
  return null;
}
