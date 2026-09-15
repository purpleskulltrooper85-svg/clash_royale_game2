# CROWNFRONT: ARENA DUEL

An **original** real-time lane-based tower battler for desktop and mobile browsers, built with plain HTML, CSS, and JavaScript (HTML5 Canvas). No backend, no build tools, no external assets — every visual and sound is procedurally generated.

> This is an original prototype. It is **not affiliated with**, and contains **no assets, names, art, audio, or UI from**, any existing commercial game.

## How to Run

1. Download / clone this folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox; Safari where practical). No server needed.
3. Wait for the loading bar, then **Tap to Start** (this also unlocks audio, per browser autoplay rules).

## File Structure

```
/index.html      — app shell, all screens, canvas elements
/style.css       — full UI theme, responsive layout, accessibility modes
/game.js         — engine: save, audio, UI, battle sim, AI, progression, tutorial, debug
/data/cards.js   — Command Card database (37 cards) + rarity/upgrade math
/data/arenas.js  — Frontier (arena) themes and rank thresholds
/data/rewards.js — crates, Vanguard Path, Season Pass, quests, bots, tips
/assets/sprites/ — original AI-generated PNG art (cards, towers, backgrounds)
/README.md
```

### Art: hybrid sprite system

`assets/sprites/` holds **original, AI-generated art created for this project** — card art for the
starter kit and iconic units, both towers, and the arena/menu backgrounds. The `Sprites` manager in
`game.js` loads them at startup and uses them for **non-directional visuals only**:

- Card icons (hand, next-card preview, collection, deck builder, card detail)
- Citadel Core and Bastion Tower (with recoil squash, hit flash, sleep dimming, cracks on top)
- Arena battlefield background and main-menu vista

Battlefield **units stay procedural vector drawings** because they animate — walk bob, attack lunge,
facing flips, death squash — which single-pose PNGs can't provide. If any PNG is missing or fails to
load, the game silently falls back to the original procedural drawing, so the project always runs.

## Controls

**Desktop**
- Click a hand card to select (or hotkeys `1`–`4`)
- Click a legal arena spot to deploy; click away on invalid ground shows a red indicator
- Right-click or `Esc` cancels selection
- `M` mute, `Space` pause (training only), `F2` or `` ` `` — Prototype Debug Tools

**Mobile**
- Tap card to select, tap again to cancel, tap the arena to deploy
- Full touch targets, safe-area insets, no page scroll during battle

## Core Systems

- **Match**: 3:00, Final Surge (last 60s, double Aether), overtime with sudden death, Citadel Pressure tiebreaker, Crests for destroyed Bastions, instant win on Citadel destruction.
- **Cards**: 8-card Battle Kit, 4-card hand + NEXT preview, cycling queue, Aether costs, 4 rarities, levels 1–15 with fragment/coin upgrades.
- **AI**: 7 personalities × 6 difficulty tiers, reaction delays, threat evaluation, spell value targeting, counterpushes — never cheats resources.
- **Progression**: Rank Marks & 11 divisions, Vanguard Path milestones, 5 Supply Crate types with real-time unlock timers (offline progress via `Date.now()`), 30-tier Crownfront Season Pass (free + locked demo Commander Track), 3 rotating daily quests, 7-day login rewards.
- **Tutorial**: scripted 8-step walkthrough with Archivist Luma, skippable and re-runnable via debug tools.
- **Save**: versioned JSON in `localStorage` (`crownfront_save_v1`), corruption fallback, export/import from Settings.

## How Saves Work

`localStorage` key `crownfront_save_v1` stores profile, currencies, collection (levels/fragments/mastery), decks, crates (with absolute unlock timestamps), quests (per local date), season pass, settings, and match history. If parsing fails or the shape is invalid, a fresh default profile is created. Use **Settings → Export/Import Save JSON** to back up or move progress.

## Adding a New Command Card

1. Open `data/cards.js` and append an entry to `CARDS`:

```js
{
  id: 'my_card', name: 'My Card', cat: 'Ranger', kind: 'unit', rarity: 'elite',
  cost: 4, vis: 'archer', proj: 'shard', unlock: 500,
  desc: 'Flavor text.', tags: ['Ground', 'Ranged'], role: ['ranged', 'antiair'],
  s: { hp: 600, dmg: 110, rng: 170, as: 1.1, spd: 60, cnt: 1, sight: 200, targets: 'both' }
}
```

- `kind`: `'unit'` | `'spell'` | `'struct'`. Spells use an `fx` block (`type: burst|dot|root|chain|pull`, `dmg`, `radius`, `delay`, `slow`, `stun`, `dur`, `chains`).
- `vis` picks a procedural drawing family (knight, archer, swarm, guard, ram, golem, manta, pixie, turret, barricade, totem, or one of the generic silhouettes).
- `role` tags drive bot deck-building and the Auto Build algorithm.
- The card instantly appears in Collection, Deck Builder, crates, and AI decks. Balance scaling (+9% HP, +8% damage per level) is automatic.

## Adding a New Frontier (Arena)

Add an entry to `FRONTIERS` in `data/arenas.js` with a `rank` gate and a `theme` object (ground/river/deco/accent colors). It becomes the backdrop once the player passes its Rank threshold.

## Tuning Balance

- **Cards**: edit base stats in `data/cards.js`; per-level growth lives in `scaledStats()`.
- **Towers**: `TOWER_DEFS` in `game.js` (HP, damage, range, attack speed).
- **Match pacing**: `AETHER_RATE`, match length (`time: 180`), and Final Surge multipliers in `updateBattle()`.
- **AI strength**: `BOT_DIFFICULTIES` (reaction delays, mistake rate) and `BOT_PERSONALITIES` weights in `data/rewards.js`.
- DPS estimates shown in Collection come from `dpsEstimate()`.

## Debug Tools

Press `F2` (or `` ` ``) for "Prototype Debug Tools": toggle AI, add Aether/currencies/crates, force Final Surge/overtime, damage towers, speed 0.5–4×, unlock all cards, instant crate unlock, and more. Some actions require an active battle.

## Known Limitations

- All art is procedural vector placeholders; all audio is synthesized (Web Audio API) — hooks are ready for real assets/music.
- Multiplayer, guilds, and signals are placeholders (clearly labeled in UI).
- The Commander (premium) pass track is a locked demo — no payments exist anywhere.
- Crate timers are prototype-shortened (30s–8min) for testability.

## Future Expansion Ideas

- Real multiplayer via WebRTC/WebSocket
- Replays, more frontiers, seasonal events, guild wars
- Sprite-sheet support behind the existing `vis` drawing hooks
- Deeper mastery/proficiency rewards
