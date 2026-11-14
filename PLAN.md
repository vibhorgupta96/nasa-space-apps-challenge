# Sol Sprouts — Team Build Plan

> NASA Space Apps 2026 · Challenge: **Build a Junior Astronaut Mission Trainer**
> https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/
>
> **Hard deadline: Sunday Nov 15, 11:59 p.m. (our Local Event time).** We submit by **21:00** to keep a buffer.
>
> This file is the single source of truth. Humans and AI agents: read all of it before writing code. If something here is wrong, change this file first (in its own commit), then the code.

---

## 1. The game in one paragraph

A cozy, top-down pixel-art farming game for kids aged 7–12. You keep the greenhouse of a small Mars dome at **Elysium Planitia** (InSight's landing site, so the weather data matches the place). Each **sol** (Mars day), you split a limited supply of **power cells** between grow lights, the heater and the storm shelter. You can also charge the rover so **Bolt** (our robot) can drive out on real Mars terrain to bring back ice, soil and supplies. Real NASA data drives the game: real solar storms (DONKI), real Mars weather (InSight), crops that astronauts really grew in space (OSDR / Veggie), and the real Earth–Mars radio delay (JPL Horizons). **No choice is free.**

**30-second demo moment:** cozy farm morning → storm board flashes → Bolt races a real solar storm home → crops survive → *"This storm really happened: May 2024."*

## 2. Design rules (do not break these)

1. **Only 3 resources the player tracks: ⚡ Power, 🫁 Air, 🥕 Food.** Water, ice and regolith are *items*, not meters. The challenge says too many systems overwhelm kids.
2. **Every choice costs something.** If a playtest finds a "free" safe option, that's a bug.
3. **Real data only, and say where it came from.** Every number shown to the player must come from a file in `public/data/` with a `source` URL. Never invent "plausible" statistics. If data is saved rather than live, the UI says so ("Real data from May 2024"), never "live".
4. **Kid language.** Short sentences. Explain science words the first time they appear (e.g., *"A **sol** is one day on Mars, about 40 minutes longer than an Earth day."*).
5. **Failure is soft.** No game over screen. A supply ship "rescues" the crew and Bolt says "Let's try a new plan!", then you can replay with a different storm week.
6. **No NASA logos, flags or mission insignia** anywhere (contest rule). No assets copied from existing games.
7. **No images, voice or likeness of anyone under 18** (contest rule).

## 3. Tech stack (decided, don't change)

| Thing | Choice |
|---|---|
| Engine | **Phaser 3** (v3.80.x) |
| Language | **TypeScript** |
| Build tool | **Vite** |
| Hosting | **GitHub Pages** (or Netlify). Public link, no login required |
| Saving | `localStorage` (wrapped in try/catch, game must work without it) |
| Resolution | 640×360 game canvas, scaled up with `pixelArt: true` |
| Tile size | **32×32** |

**NASA data strategy:** a Node script (`scripts/fetch-nasa-data.mjs`) downloads everything **once** and saves it as JSON in `public/data/`. We commit those files. The game reads local JSON, so it works offline, doesn't hit rate limits and can't break during judging. Optional extra: a "Today's Sun" button fetches live DONKI data in the browser (DONKI allows browser requests) and falls back to saved data if it fails.

**API key:** get a free key at https://api.nasa.gov (the shared `DEMO_KEY` hits its rate limit after a few calls). Keep it in `.env` (`NASA_API_KEY=...`), which is in `.gitignore`. The script reads it from there, so it never goes into the game code or the repo.

### Verified API status (tested Nov 14)

| API | Works? | Browser can call directly? | Use in game |
|---|---|---|---|
| DONKI CME / SEP / GST (`api.nasa.gov/DONKI/...`) | ✅ | ✅ | Storm board |
| DONKI FLR (flares) | ❌ 404 in our test | — | Skip |
| InSight Mars Weather (`api.nasa.gov/insight_weather/`) | ✅ (archived 2020 data) | — | Daily weather |
| OSDR (`osdr.nasa.gov/osdr/data/search`) | ✅ | ❌ (save at build time) | Seed packet facts |
| JPL Horizons (`ssd.jpl.nasa.gov/api/horizons.api`) | ✅ | ❌ (save at build time) | Radio delay |
| NASA Image and Video Library (`images-api.nasa.gov`) | ✅ | ✅ | Rock sample rewards |
| Mars Trek tiles (Viking color mosaic, MOLA color-shaded elevation) | ✅ | ✅ | Rover map |
| APOD, EPIC, NeoWs | ✅ | ✅ | Stretch goals |
| Mars Rover Photos API | ❌ 404 (retired) | — | Use Image Library instead |

## 4. Who does what (3 parallel workstreams)

Each person owns **folders**, not features. **Don't edit another person's folders.** Ask the owner instead. That's how three people and their agents avoid merge conflicts.

### 🅰 Person A: Core game and farm
**Owns:** `src/core/`, `src/scenes/FarmScene.ts`, `src/farm/`, `src/main.ts`, `index.html`, `package.json`, `vite.config.ts`

- [ ] **Hour 0–1 (do first, everyone waits on this):** scaffold the project (Vite + Phaser + TS). Commit `src/core/types.ts`, `src/core/events.ts` and `src/core/rules.ts` **exactly as in section 5**, plus empty scenes that switch between each other. Push to `main`.
- [ ] Game state store + sol loop (morning → plan power → day actions → night → next sol).
- [ ] Power split UI: drag 6 power-cell icons into slots (Grow lights / Heater / Shelter / Rover battery).
- [ ] Farm: 3×4 grid of plots. Plant, water (uses water items), grow, harvest. Crops come from `crops.json`.
- [ ] Air and food calculations at the end of each sol (formulas in section 6).
- [ ] Walkable dome with the player and 3 crew members (simple idle and walk animations).
- [ ] Soft failure → rescue screen → replay.
- **Done when:** you can play 10 sols of farming with mock data, without rover or storms.

### 🅱 Person B: Rover and Mars map
**Owns:** `src/scenes/RoverScene.ts`, `src/rover/`, `public/data/terrain*.{png,json}`, `scripts/build-terrain.mjs`

- [ ] Download one Mars Trek tile area around Elysium Planitia (Viking color mosaic for looks, MOLA color-shaded elevation for difficulty). Write `scripts/build-terrain.mjs` to turn it into a 40×24 grid of driving costs (`terrain.json`) and a background image (`terrain.png`). Save the tile URLs as the `source`.
- [ ] Rover scene with a top-down map. **Plan mode:** click tiles to draw a route, the battery cost updates as you draw, press **Send** and watch Bolt drive. Optional **free drive** with arrow keys for younger kids.
- [ ] Battery: starts with however many cells the player put in the Rover slot. Each tile costs `terrain cost × RULES.roverCostPerTile`.
- [ ] Finds scattered on the map: 🧊 ice, 🪨 regolith, 📦 supply drop, 🔬 rock sample. Picking one up emits `ROVER_ITEM_FOUND`.
- [ ] **Storm race:** when `STORM_WARNING` fires while the rover is out, show a countdown. If Bolt isn't back in the dome when it runs out, emit `ROVER_DAMAGED` (rover needs 1 sol of repair).
- [ ] Battery runs out → Bolt is stranded → towed home next sol (costs a sol, no other penalty).
- **Done when:** you can plan a route, drive, collect items and get home, all with mock data.

### 🅲 Person C: NASA data, storm board, story UI and submission
**Owns:** `scripts/fetch-nasa-data.mjs`, `public/data/` (except terrain), `src/data/`, `src/ui/`, `src/scenes/TitleScene.ts`, `src/scenes/DebriefScene.ts`, `docs/`, the README and the project submission page

- [ ] **Hour 0–1:** commit **mock** versions of every data file (section 7 schemas) with `"mock": true`, so A and B can work right away.
- [ ] `fetch-nasa-data.mjs`: pull real data and replace the mocks.
  - DONKI CME/SEP/GST → `storms.json`. Pick 3 real storm weeks, including **May 8–14, 2024** (the big Gannon storm).
  - InSight weather → `weather.json`
  - OSDR + NASA Veggie / Advanced Plant Habitat pages → `crops.json`. Crops really grown in space include red romaine lettuce, mizuna, radish, chile peppers and zinnia. **Verify each fact and link the source.**
  - Horizons → `delay.json` (today's Earth–Mars distance → one-way light delay in minutes)
  - Image Library → `photos.json` (Mars rocks and rover images, with credits)
- [ ] `src/data/loaders.ts`: loads every file. If any file has `"mock": true`, show a small "MOCK DATA" badge in the corner so we never present it as real by mistake.
- [ ] **Storm board** (overlay UI): shows upcoming storms with a kid-friendly strength scale (1–3 suns) and the real date. Emits `STORM_WARNING` and `STORM_HIT` (section 5).
- [ ] **Radio delay:** messages from Mission Control appear `oneWayMinutes` of game time late, with a little "📡 arrived after N minutes" label.
- [ ] **Science cards:** after each sol, Bolt shares 1 true fact linked to what the player just did, with the source.
- [ ] Title screen, how-to-play (3 short screens), end-of-mission debrief ("your storms were real: here are their dates"), and a **"NASA Data We Used"** credits screen.
- [ ] Submission: project page text, demo video (≤ 30 s, with English subtitles), references list, AI-use statement. See section 10.
- **Done when:** the game runs on real data with no MOCK badge, and the credits screen lists every source.

### Assets (shared: see section 9)
Whoever is free first takes the next unclaimed row in the asset table and writes their initial in the **Owner** column. Default split: **A** = farm, crops, crew; **B** = rover, Mars map, finds; **C** = UI, icons, storm board, audio, font.

## 5. Shared contracts (Person A commits these in hour 1, then they're frozen)

Changing these needs agreement from all three people. Agents: **import these, never redefine them.**

```ts
// src/core/types.ts
export type ItemId = 'water' | 'ice' | 'regolith' | 'seed' | 'parts' | 'sample';
export type PowerSlot = 'growLights' | 'heater' | 'shelter' | 'rover';

export interface GameState {
  sol: number;                       // starts at 1
  power: { cellsToday: number; split: Record<PowerSlot, number> };
  air: number;                       // 0–100
  food: number;                      // 0–100
  shield: number;                    // 0–3, extra regolith layers on the dome
  inventory: Record<ItemId, number>;
  plots: Plot[];
  rover: { status: 'home' | 'out' | 'stranded' | 'repairing'; battery: number };
  stormWeekId: string;               // which real storm week this run uses
  log: string[];                     // kid-readable messages, newest last
}

export interface Plot {
  id: number;
  cropId: string | null;             // matches crops.json id
  plantedSol: number | null;
  wateredToday: boolean;
}
```

```ts
// src/core/events.ts — one shared Phaser.Events.EventEmitter, `bus`
export const EV = {
  SOL_START: 'sol:start',                 // payload: { sol }
  SOL_END: 'sol:end',                     // payload: { sol }
  POWER_SPLIT_SET: 'power:split',         // payload: { split }
  STORM_WARNING: 'storm:warning',         // payload: { stormId, strength, arrivesInSols, realDate }
  STORM_HIT: 'storm:hit',                 // payload: { stormId, strength }
  ROVER_DEPART: 'rover:depart',           // payload: { battery }
  ROVER_ITEM_FOUND: 'rover:item',         // payload: { item: ItemId, amount }
  ROVER_RETURN: 'rover:return',           // payload: { items }
  ROVER_DAMAGED: 'rover:damaged',
  RADIO_MESSAGE: 'radio:message',         // payload: { text, delayMinutes }
  SCIENCE_CARD: 'science:card',           // payload: { text, source }
} as const;
```

## 6. Game rules (starting numbers, all in `src/core/rules.ts`)

Balance by changing **only** this file. These numbers are game-balance choices, not NASA data, so don't present them as real measurements.

```ts
export const RULES = {
  cellsPerSol: 6,           // dust storm sols: 4
  airLossPerSol: 10,        // crew breathing
  airPerGrowingCrop: 3,     // each healthy crop adds air
  foodLossPerSol: 8,
  heaterNeededBelowC: -70,  // if InSight min temp is colder, heater needs 1 cell or crops lose a growth day
  shelterCellsPerStrength: 1, // storm strength 2 needs 2 shelter cells (minus shield layers)
  roverCostPerTile: 0.1,    // cells per tile × terrain cost (1–3)
  iceToWater: 2,
  regolithPerShieldLayer: 3,
  stormWarningSols: 2,
};
```

**Storm outcome:** if `shelter cells + shield layers >= storm strength`, the crew is safe. Otherwise air drops 15 (the crew hides in the small shelter and grow lights go off) and 1 crop wilts. Kid message: *"The shelter was too weak, so the crew hid and some plants didn't get light."*

## 7. Data file schemas (`public/data/`, owned by C)

Every file has a top-level `"source"` (URL or list of URLs), `"fetched"` (ISO date) and `"mock"` (boolean).

```jsonc
// storms.json — real storm timelines mapped onto game sols (timeline is compressed: say so in the UI)
{ "weeks": [ { "id": "2024-05", "label": "May 2024 superstorm",
    "events": [ { "sol": 3, "type": "CME", "strength": 3, "realTime": "2024-05-08T05:36Z",
                  "link": "https://...DONKI/view/..." } ] } ] }

// weather.json — real InSight sols
{ "sols": [ { "marsSol": 675, "earthDate": "2020-10-19", "minC": -96.9, "maxC": -15.9, "windAvg": 7.2 } ] }

// crops.json
{ "crops": [ { "id": "red-romaine", "name": "Red Romaine Lettuce", "growSols": 4, "food": 20,
               "fact": "Astronauts on the Space Station grew and ate this lettuce in 2015.",
               "factSource": "https://..." } ] }

// delay.json
{ "date": "2026-11-14", "distanceKm": 0, "oneWayMinutes": 0 }

// photos.json
{ "photos": [ { "nasaId": "...", "title": "...", "url": "...", "credit": "NASA/JPL-Caltech" } ] }

// terrain.json (owned by B)
{ "width": 40, "height": 24, "cost": [[1,1,2,3,...]], "dome": [20,12], "source": ["https://trek.nasa.gov/..."] }
```

## 8. Timeline (local event time)

| When | Milestone | Who |
|---|---|---|
| **Sat, hour 0–1** | Scaffold + contracts (A). Mock data files (C). Terrain spike (B). | All |
| **Sat evening** | **Sync 1:** merge everything into `main`. Farm loop works, rover drives, storm board shows mock storms. | All |
| **Sat night** | Real data in. Placeholder art replaced by first real art. | C (data), all (art) |
| **Sun 12:00** | **Sync 2 / feature freeze.** Full sol loop with rover and storms on real data. From now on only fixes and polish. | All |
| **Sun 12:00–16:00** | Playtest (ideally with a real 7–12 year old), balance `rules.ts`, fix bugs, deploy to GitHub Pages | A + B |
| **Sun 16:00–18:00** | Record and edit the ≤ 30 s demo video, write the project page | C (+ one helper) |
| **Sun 19:00** | Test every link in a private browser window | All |
| **Sun 21:00** | **Click "Submit for Judging".** Edits are still allowed until 23:59. | Team Owner |

**Cut list** (drop in this order if we're behind): exoplanet telescope → APOD/EPIC extras → free-drive mode → crew walking animations → 3rd storm week. **Never cut:** the storm race, real DONKI data, the credits screen.

## 9. Asset list

Style: 32×32 pixel art, warm cozy palette with dusty Mars reds and soft greenhouse greens. Keep it simple: clarity matters more than polish.

**Where assets can come from:**
1. **Made by us** (Aseprite, Piskel, LibreSprite). Best option.
2. **CC0 or open-licence packs** (e.g., Kenney.nl, OpenGameArt). Record the licence and URL in `docs/ASSETS.md`. These go in the References field.
3. **AI-generated:** allowed, but contest rules require a **visible watermark** on AI images and video, plus a note in our text and metadata. That's awkward on small sprites, so **prefer options 1 and 2**. If you use AI for an asset, mark it in the table below.
4. **Real NASA images** (Image Library, Mars Trek): use them for photos and maps, always with credit. Never use logos or insignia.

| # | Asset | Size / frames | Used by | Owner | Source | AI? | Status |
|---|---|---|---|---|---|---|---|
| **Tiles** |
| 1 | Dome floor tile | 32×32 | A | | | | ☐ |
| 2 | Dome wall / glass edge (set) | 32×32 × ~8 | A | | | | ☐ |
| 3 | Farm plot: dry, wet, wilted | 32×32 × 3 | A | | | | ☐ |
| 4 | Mars ground, sand, rock, slope tiles (for map overlay) | 32×32 × 4 | B | | | | ☐ |
| **Crops** (4 growth stages each: seed, sprout, growing, ready) |
| 5 | Red romaine lettuce | 32×32 × 4 | A | | | | ☐ |
| 6 | Mizuna | 32×32 × 4 | A | | | | ☐ |
| 7 | Radish | 32×32 × 4 | A | | | | ☐ |
| 8 | Chile pepper | 32×32 × 4 | A | | | | ☐ |
| 9 | Zinnia (flower, lifts crew mood) | 32×32 × 4 | A | | | | ☐ |
| **Characters** |
| 10 | Player (greenhouse keeper): idle + walk, 4 directions | 32×32 × ~16 | A | | | | ☐ |
| 11 | Crew member ×3 (idle, 2-frame) | 32×32 × 6 | A | | | | ☐ |
| 12 | Bolt the robot: idle, happy, worried | 32×32 × 3 | C | | | | ☐ |
| 13 | Bolt portrait for dialogue | 64×64 | C | | | | ☐ |
| **Rover and map** |
| 14 | Rover, 4 directions + driving dust | 32×32 × 8 | B | | | | ☐ |
| 15 | Finds: ice, regolith, supply crate, rock sample | 32×32 × 4 | B | | | | ☐ |
| 16 | Route marker dots + "Send" flag | 16×16 × 2 | B | | | | ☐ |
| 17 | Dome icon on the map | 32×32 | B | | | | ☐ |
| 18 | Mars terrain background (from Mars Trek, processed) | 1280×768 | B | B | NASA Mars Trek | No | ☐ |
| **UI** |
| 19 | Icons: power cell, air, food, water, shield, parts | 16×16 × 6 | C | | | | ☐ |
| 20 | Power slot panels: grow lights, heater, shelter, rover | 48×48 × 4 | C | | | | ☐ |
| 21 | Panel / dialogue box (9-slice) | 48×48 | C | | | | ☐ |
| 22 | Buttons: normal, hover, pressed | 3 frames | C | | | | ☐ |
| 23 | Resource bars (frame + fill) | — | C | | | | ☐ |
| 24 | Storm board frame + sun strength icons (1–3) | — | C | | | | ☐ |
| 25 | Radio message bubble with 📡 | — | C | | | | ☐ |
| 26 | Science card frame | — | C | | | | ☐ |
| 27 | Title screen art + game logo (our own, **no NASA logo**) | 640×360 | C | | | | ☐ |
| **Effects** |
| 28 | Solar storm screen effect (particles / tint) | — | C | | | | ☐ |
| 29 | Dust storm overlay | — | B | | | | ☐ |
| 30 | Harvest sparkle, planting puff | 4 frames each | A | | | | ☐ |
| **Audio** (CC0 or our own) |
| 31 | Cozy background music loop (farm) | ~1–2 min | C | | | | ☐ |
| 32 | Tense loop (storm race) | ~30 s | C | | | | ☐ |
| 33 | SFX: plant, water, harvest, pickup, alarm, rover hum, button click, radio beep | 8 clips | C | | | | ☐ |
| **Font** |
| 34 | Pixel font with an open licence (e.g., Pixelify Sans or Press Start 2P, both OFL) | — | C | | | | ☐ |

**Placeholder rule:** until real art exists, use coloured rectangles with text labels. Never block code on art.

## 10. Submission checklist (from the official guides)

- [ ] All 3 members confirmed at the **same Local Event** (not waitlisted) and listed on the team's Members tab
- [ ] **Project Name:** Sol Sprouts
- [ ] **High-Level Summary**
- [ ] **Demo link:** video ≤ **30 s** (or ≤ 7 slides). Public, no login. English subtitles if anyone speaks another language. **Over the limit = not eligible for Global Judging.**
- [ ] **Final Project link:** the GitHub Pages game URL + the GitHub repo. Test in a private window.
- [ ] **Detailed Description:** what it does, how it works, benefits, goals, tools (Phaser, TypeScript, Vite, the NASA APIs)
- [ ] **NASA Data:** list every NASA API/dataset and *what it does in the game* (section 3 table)
- [ ] **References:** every asset pack, font, library and data source, with licences (`docs/ASSETS.md`)
- [ ] **AI (SI) use:** describe how we used AI coding agents and any AI assets. Acknowledge AI-generated code in the README and any AI images with a visible watermark.
- [ ] Everything in **English**
- [ ] Optional: FortiGuard web filter classification request for our game site
- [ ] Tick **Terms and Conditions** + **All Work is Original**, then click **Submit for Judging** (target 21:00)
- [ ] Check the confirmation banner appeared

## 11. Instructions for AI coding agents

Paste this section into your agent's instructions (e.g., `CLAUDE.md` / `AGENTS.md`) along with this whole file.

1. **Stay in your folders.** Your human's workstream (section 4) lists the folders you may edit. Don't modify other folders, `src/core/types.ts` or `src/core/events.ts`. If you need a change there, stop and tell your human.
2. **Use the contracts.** Import `GameState`, `EV` and `RULES` from `src/core/`. Talk to other systems only through the event bus and the game state, never by importing another workstream's scene internals.
3. **No made-up data.** Every science number or fact shown to players must come from `public/data/*.json` with a source. If you don't have real data, use the mock files and leave the MOCK badge on.
4. **Keep to 3 player resources** (power, air, food) and kid-friendly language (ages 7–12, short sentences, explain science words).
5. **Small commits on your own branch** (`a/farm`, `b/rover`, `c/data-ui`). Merge to `main` only at sync points, after `npm run build` passes.
6. **Placeholders over blocking.** If art isn't ready, draw a labelled rectangle.
7. **Don't add dependencies** beyond Phaser, TypeScript and Vite without asking the team.
8. **Never commit** `.env` or API keys.
9. **No copyrighted or trademarked material**: no NASA logos, no assets or names from existing games.
10. When you finish a task, tick its box in section 4 of this file in the same commit.
