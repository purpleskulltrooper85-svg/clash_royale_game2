/* ============================================================
   CROWNFRONT: ARENA DUEL — Frontiers (arenas)
   Each frontier is a rank-gated visual theme for the battlefield.
   ============================================================ */

const FRONTIERS = [
  {
    id: 'meadow_outpost', name: 'Meadow Outpost', rank: 0,
    desc: 'Rolling green fields where new commanders take their first oath.',
    theme: { g1: '#3E7C4F', g2: '#356B45', path: '#8A7A55', river: '#2FB8B0', riverGlow: '#7DF0E4', deco: '#2C5A3A', accent: '#8FE38B' }
  },
  {
    id: 'ember_valley', name: 'Ember Valley', rank: 300,
    desc: 'Warm stone terraces lit by slow rivers of ember light.',
    theme: { g1: '#7A4630', g2: '#69392A', path: '#A9885E', river: '#E07030', riverGlow: '#FFB060', deco: '#4E2A1E', accent: '#FFB060' }
  },
  {
    id: 'tidal_reach', name: 'Tidal Reach', rank: 600,
    desc: 'Sea-spray battlements above a restless teal tide.',
    theme: { g1: '#2E6C78', g2: '#265A66', path: '#7E98A0', river: '#2FA8D8', riverGlow: '#8FE8FF', deco: '#1E4650', accent: '#8FE8FF' }
  },
  {
    id: 'frostgate_hollow', name: 'Frostgate Hollow', rank: 900,
    desc: 'A silent pass where lanterns burn blue against the frost.',
    theme: { g1: '#5B7290', g2: '#4C6280', path: '#9FB2C8', river: '#7ED8F0', riverGlow: '#D0F6FF', deco: '#394B64', accent: '#BFE8FF' }
  },
  {
    id: 'skyward_spires', name: 'Skyward Spires', rank: 1300,
    desc: 'Cloud-piercing pillars where aether winds sing through stone.',
    theme: { g1: '#5E6FA8', g2: '#4F5F98', path: '#A8B0DC', river: '#6FA0FF', riverGlow: '#B8D8FF', deco: '#3D4A78', accent: '#B8D8FF' }
  },
  {
    id: 'cogspire_depths', name: 'Cogspire Depths', rank: 1700,
    desc: 'An underground forge-city of gears, steam, and brass banners.',
    theme: { g1: '#5C5040', g2: '#4C4234', path: '#96866A', river: '#C8A028', riverGlow: '#FFDE7A', deco: '#382F26', accent: '#FFDE7A' }
  },
  {
    id: 'aetherwild_grove', name: 'Aetherwild Grove', rank: 2200,
    desc: 'The season\'s namesake: glowing flora and firefly-lit ruins.',
    theme: { g1: '#3A5C74', g2: '#314C62', path: '#7C94A8', river: '#B86CFF', riverGlow: '#D98CFF', deco: '#25384A', accent: '#D98CFF' }
  },
  {
    id: 'obsidian_court', name: 'Obsidian Court', rank: 2800,
    desc: 'Black-glass halls where only the sharpest commanders duel.',
    theme: { g1: '#3A3A4C', g2: '#30303F', path: '#6A6A85', river: '#B84FFF', riverGlow: '#E0A8FF', deco: '#232330', accent: '#E0A8FF' }
  },
  {
    id: 'crown_summit', name: 'Crown Summit', rank: 3500,
    desc: 'The highest platform in the Frontier. Crownmasters only.',
    theme: { g1: '#8A6E2F', g2: '#755D27', path: '#D8BC70', river: '#FFD45A', riverGlow: '#FFF0B0', deco: '#5C4A1F', accent: '#FFF0B0' }
  }
];

function frontierForRank(marks) {
  let f = FRONTIERS[0];
  for (const fr of FRONTIERS) if (marks >= fr.rank) f = fr;
  return f;
}
function nextFrontier(marks) {
  for (const fr of FRONTIERS) if (marks < fr.rank) return fr;
  return null;
}
