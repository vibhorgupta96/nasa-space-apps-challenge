# Sol Sprouts — Team Build Plan

> NASA Space Apps 2026 · Challenge: **Build a Junior Astronaut Mission Trainer**
> https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/
>
> **Submission closes Sunday, Nov 15, at 11:59 p.m. local to the registered Local Event.** The selected event, time zone, local judging schedule, and target submission time are not yet confirmed; see section 8.
>
> This file is the single source of truth. Humans and AI agents: read all of it before writing code. If something here is wrong, change this file first (in its own commit), then the code.

---

## 1. The game in one paragraph

A cozy, top-down pixel-art farming game for kids aged 7–12. You keep the greenhouse of a small Mars dome at **Elysium Planitia**. Each **sol** (Mars day), you split power cells between grow lights, the heater, the storm shelter, and Bolt's rover. NASA records provide the real-world context: DONKI solar-event observations, archived InSight weather, space-crop sources, and an Earth–Mars radio-delay estimate. The game clearly labels its compressed timeline, simulated storm effects, and balance values; a historical event is not presented as a measured storm impact at Mars.

**30-second demo moment:** cozy farm morning → a historically sourced solar-event scenario appears → Bolt races a simulated countdown → crops survive → *"This scenario is based on a real event observed in May 2024."*

## 2. Design rules (do not break these)

1. **Only 3 resources the player tracks: ⚡ Power, 🫁 Air, 🥕 Food.** Water, ice and regolith are *items*, not meters. The challenge says too many systems overwhelm kids.
2. **Choices have trade-offs.** Power, water, seeds, and regolith are finite. A permanent investment such as dome shielding has an upfront item cost; it does not cost resources again each sol.
3. **Real evidence, clearly labeled.** Scientific observations and facts shown to players come from `public/data/` with source URLs. Game timing, storm-strength categories, crop yields, and resource costs are tunable simulations, labeled as such in the UI. Never present a game adaptation as a NASA measurement. Saved history is identified as historical, never "live".
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

**NASA data strategy:** a Node script (`scripts/fetch-nasa-data.mjs`) downloads the selected data once and saves it as JSON in `public/data/`. We commit those files and bundle required game data and core assets. The deployed game needs internet to load or reload; after loading, it makes no NASA API calls. Photo rewards are optional remote images with a local placeholder if unavailable. This plan makes no offline or service-worker guarantee. A live DONKI feature is out of scope.

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

- [x] **Hour 0–1 (do first):** scaffold the project (Vite + Phaser + TS). Commit `src/core/types.ts` and `src/core/events.ts` to match section 5, and `src/core/rules.ts` to match section 6, plus empty scenes that switch between each other. Share the commit/branch with B and C.
- [x] Game state store + sol loop (morning → plan power → day actions → night → next sol).
- [x] Power split UI: drag 6 power-cell icons into slots (Grow lights / Heater / Shelter / Rover battery).
- [x] Farm: 3×4 grid of plots. Plant, water once per sol (uses water items), grow, harvest, and clear a wilted plot. Crops come from `crops.json`.
- [x] Air and food calculations at the end of each sol (formulas in section 6).
- [x] Walkable dome with the player and 3 crew members (simple idle and walk animations).
- [x] Soft failure → rescue screen → replay.
- **Done when:** you can play 10 sols of farming with mock data, without rover or storms.

### 🅱 Person B: Rover and Mars map
**Owns:** `src/scenes/RoverScene.ts`, `src/rover/`, `public/data/terrain*.{png,json}`, `scripts/build-terrain.mjs`

- [ ] Download one Mars Trek tile area around Elysium Planitia (Viking color mosaic for looks, MOLA color-shaded elevation for difficulty). Write `scripts/build-terrain.mjs` to turn it into a 40×24 grid of driving costs (`terrain.json`) and a background image (`terrain.png`). Save the tile URLs as the `source`.
- [ ] Rover scene with a top-down map. **Plan mode:** click tiles to draw a route, the battery cost updates as you draw, press **Send** and watch Bolt drive. Optional **free drive** with arrow keys for younger kids.
- [ ] Battery: starts with however many cells the player put in the Rover slot. Each tile costs `terrain cost × RULES.roverCostPerTile`.
- [ ] Finds scattered on the map: 🧊 ice, 🪨 regolith, 📦 supply drop, 🔬 rock sample. Picking one up emits `ROVER_ITEM_FOUND`.
- [ ] **Storm race:** show the shared-clock countdown for every pending warning, including if Bolt leaves after a warning began. Resolve a storm hit before a rover return at the same timestamp. An already-resolved event does not block future launches. If Bolt is outside at the hit, damage takes precedence over simultaneous battery stranding.
- [ ] Battery runs out → Bolt is stranded → recovered at the next sol boundary; cargo is lost and the rover is unavailable for that next sol.
- **Done when:** you can plan a route, drive, collect items and get home, all with mock data.

### 🅲 Person C: NASA data, storm board, story UI and submission
**Owns:** `scripts/fetch-nasa-data.mjs`, `public/data/` (except terrain), `src/data/`, `src/ui/`, `src/scenes/TitleScene.ts`, `src/scenes/DebriefScene.ts`, `docs/`, the README and the project submission page

- [ ] **Hour 0–1:** commit **mock** versions of every data file (section 7 schemas) with `"mock": true`, so A and B can work right away.
- [ ] `fetch-nasa-data.mjs`: pull real data and replace the mocks. Keep event records distinct from game scenarios.
  - DONKI CME/SEP/GST → `storms.json`. Pick up to 3 sourced historical scenarios, including events from **May 8–14, 2024**. A DONKI record proves the listed observation or analysis, not an impact at Mars. GST is Earth geomagnetic context. Record the observed target; use `unknown` where target is absent. Include a Mars arrival only when a separately sourced estimate supports it, with its provenance and `predicted`/`observed` status. Game strength (1–3), warning time, and hit time are explicitly simulated adaptations.
  - InSight weather → `weather.json`
  - OSDR + NASA Veggie / Advanced Plant Habitat pages → `crops.json`. Crops really grown in space include red romaine lettuce, mizuna, radish, chile peppers and zinnia. **Verify each fact and link the source.**
  - Horizons → `delay.json` (today's Earth–Mars distance → one-way light delay in minutes)
  - Image Library → `photos.json` (Mars rocks and rover images, with credits)
- [ ] `src/data/loaders.ts`: loads every file. If any file has `"mock": true`, show a small "MOCK DATA" badge in the corner so we never present it as real by mistake.
- [ ] **Storm board:** subscribe to core storm notifications and read shared state for countdown/deadline; show the event's sourced date, type, observed target or “target not listed”, and clearly marked simulated strength. Say the timeline is compressed and the Mars effect is a game scenario. The shared core emits the section 5 events.
- [ ] **Radio delay:** messages arrive after `oneWayMinutes × 1,000` active game milliseconds. Display that the game clock compresses one radio minute into one active second.
- [ ] **Science cards:** after each sol, Bolt shares 1 true fact linked to what the player just did, with the source.
- [ ] Title screen, how-to-play (3 short screens), end-of-mission debrief identifying which historical events inspired the simulations, and a **"NASA Data We Used"** credits screen.
- [ ] Submission: project page text, public demo video (≤ 30 s, with English subtitles when needed), references list, and complete SI disclosure. Draft `docs/AI_USAGE.md` and `docs/AI_USAGE.json` from verified actual use. Track the submitted version and re-submit after final edits. See section 10.
- **Done when:** the game runs on real data with no MOCK badge, and the credits screen lists every source.

### Assets (shared: see section 9)
Whoever is free first takes the next unclaimed row in the asset table and writes their initial in the **Owner** column. Default split: **A** = farm, crops, crew; **B** = rover, Mars map, finds; **C** = UI, icons, storm board, audio, font.

## 5. Shared contracts (Person A owns `src/core/`)

Agree and commit these interfaces before parallel scene work. Store commands validate and update `GameState`; Phaser events are notifications emitted **after** the transition, never a second path that mutates inventory. Scenes read state and dispatch commands; they do not import one another. Changes to these contracts require agreement from A, B, and C.

```ts
// src/core/types.ts — fields required for deterministic resume and event deduplication
export type ItemId = 'water' | 'ice' | 'regolith' | 'seed' | 'parts' | 'sample';
export type PowerSlot = 'growLights' | 'heater' | 'shelter' | 'rover';
export type Phase = 'planning' | 'day' | 'rescue' | 'debrief';
export type PlotCondition = 'healthy' | 'wilted';

export interface GameState {
  sol: number; // starts at 1; a successful mission ends after sol 10
  phase: Phase; // new mission: planning, sol 1
  missionElapsedMs: number; // new mission: 0; active simulation time only
  cellsToday: number;
  split: Record<PowerSlot, number>; // integers; sum <= cellsToday
  air: number; // 0–100
  food: number; // 0–100
  shield: number; // starts at 0; 0–3 permanent layers
  inventory: Record<ItemId, number>; // home inventory only
  plots: Plot[]; // exactly 12, ordered by id
  stormWeekId: string;
  stormBlackoutSol: number | null;
  processedWarnings: string[];
  processedStormHits: string[];
  radioQueue: { messageId: string; text: string; arrivesAtMs: number; delayMinutes: number }[];
  rover: RoverState;
  log: string[]; // kid-readable, newest last
}

export interface Plot {
  id: number;
  cropId: string | null;
  growthSols: number; // completed eligible growth steps, not elapsed time
  condition: PlotCondition;
  wateredToday: boolean;
}

export interface RoverState {
  status: 'home' | 'out' | 'stranded' | 'repairing';
  batteryCells: number; // fractional cells, rounded to one decimal after a tile
  expeditionId: string | null;
  lastLaunchSol: number;
  route: [number, number][];
  nextRouteIndex: number;
  routeStartedAtMs: number | null; // remaining tile time derives from this and missionElapsedMs
  cargo: Record<ItemId, number>;
  collectedFindIds: string[]; // prevents repeat collection after save/reload
  availableSol: number; // next sol when a disabled rover may launch
}
```

The shared core owns gameplay commands `setPowerSplit`, `startDay`, `plant`, `water`, `harvest`, `clearPlot`, `launchRover`, `collectRoverFind`, `returnRover`, `convertIce`, and `craftShield`. `queueRadioMessage` is an internal core scheduling entry point and may enqueue during planning; delivery still uses the active clock. Only `setPowerSplit` is allowed during planning before `startDay`; player farm/rover/item commands require the day phase. Reject invalid commands without partial state changes. `startDay` commits the split and phase; only the core advances time, rover route, and radio queue. `launchRover` checks home status, `availableSol`, and `lastLaunchSol` (one launch per sol). Any storm hit due at the current timestamp resolves before accepting a gameplay command; a resolved historical hit does not block a later launch. Rover cargo is separate from `inventory`: collection transfers a reached, unconsumed map find into cargo only; a successful return requires the active expedition ID and rover physically at the dome, then atomically transfers cargo to home inventory, sets status home, and clears/invalidate the expedition. Retrying a return is rejected/no-op. Find IDs and expedition IDs are unique. On stranding or storm damage outside, the next sol boundary recovers Bolt, forfeits cargo, and sets `availableSol` to the following sol (one full sol unavailable). A storm hit takes precedence over a simultaneous battery-stranding result. `routeStartedAtMs`, `nextRouteIndex`, and `missionElapsedMs` preserve progress partway through a 4,000 ms tile. Pending radio messages are kept in `radioQueue` against the same active clock.

```ts
// src/core/events.ts — one shared Phaser event bus; payloads describe committed changes
export const EV = {
  SOL_START: 'sol:start', // { sol }
  SOL_END: 'sol:end', // { sol }
  POWER_SPLIT_SET: 'power:split', // { split }
  STORM_WARNING: 'storm:warning', // { stormId, strength, gameHitAtMs, scenarioLabel }
  STORM_HIT: 'storm:hit', // { stormId, strength }
  ROVER_DEPART: 'rover:depart', // { expeditionId, batteryCells }
  ROVER_ITEM_FOUND: 'rover:item', // { expeditionId, findId, item, amount }
  ROVER_RETURN: 'rover:return', // { expeditionId, deliveredItems }
  ROVER_DAMAGED: 'rover:damaged', // { expeditionId, availableSol }
  RADIO_MESSAGE: 'radio:message', // { messageId, text, arrivesAtMs, delayMinutes }
  SCIENCE_CARD: 'science:card', // { text, source }
} as const;
```

## 6. Game rules (all balance values live in `src/core/rules.ts`)

Every value in this section is an untested game-balance choice, not a NASA measurement. Crop `growSols` and `food` values in `crops.json` are also balance values; set zinnia food to 0. Keep scientific observations and game rules visually distinct.

```ts
export const RULES = {
  cellsPerSol: 6,
  initialShields: 0,
  initialAir: 100,
  initialFood: 80,
  initialSeeds: 24,
  initialWater: 48,
  initialOtherItems: 0,
  plotCount: 12,
  missionSols: 10,
  resourceMax: 100,
  rescueAt: 0,
  solDurationMs: 120_000, // planning is paused; active day lasts two real minutes
  stormHitOffsetMs: 60_000, // within its game sol
  stormWarningSols: 2,
  roverMsPerTile: 4_000, // advances on the same active clock
  roverCostPerTile: 0.1, // multiplied by terrain cost 1–3
  growLightsPlotsPerCell: 4, // lowest-numbered eligible plots receive light first
  airLossPerSol: 10,
  airPerHealthyLitCrop: 3,
  foodLossPerSol: 8,
  stormAirLoss: 15,
  heaterNeededBelowC: -70, // game threshold applied to the sourced InSight minimum
  icePerWaterConversion: 1,
  waterPerIceConversion: 2,
  waterPerPlant: 1,
  waterPerPlotPerSol: 1,
  regolithPerShieldLayer: 3,
  maxShieldLayers: 3,
  roverDisabledSols: 1,
  radioMsPerMinute: 1_000,
};
```

Start in planning on sol 1 with `missionElapsedMs = 0`, zero shields, zero split, zero of each item except `RULES.initialSeeds` and `RULES.initialWater`, and `RULES.plotCount` empty plots (`growthSols: 0`, healthy, not watered). Planting consumes one seed and one water and counts as that sol's watering. Reject watering a plot a second time that sol. Each occupied healthy plot then needs one water on each later sol to remain eligible for growth. Wilted plots cannot be watered or produce air/food; `clearPlot` empties it and resets growth to zero, healthy, and not watered, then replanting consumes a new seed and water. A plot grows by one `growthSols` only when healthy, watered, lit, warm enough, and not suppressed by a storm blackout; mature plots stop at their crop's `growSols`. Harvest only a mature plot, add its crop's balance-value food clamped to 0–`resourceMax`, then empty the plot.

During planning, choose a nonnegative integer split summing to at most `cellsPerSol`; `startDay` locks it for the day. There is no mid-day reallocation or early end-sol skip. One grow-light cell lights up to four eligible plots in ascending plot ID order. If the sourced InSight minimum is below `heaterNeededBelowC`, one heater cell is needed for warmth; otherwise affected plots do not grow or add air. A shelter allocation of one cell protects against one simulated strength level, plus permanent shield layers. Craft one shield layer for `regolithPerShieldLayer` regolith, up to `maxShieldLayers`. Convert `icePerWaterConversion` ice to `waterPerIceConversion` water only at home. A home rover discards unused battery at each morning; an allocated rover slot sets its battery exactly once at launch, and no later sol recharges a rover already outside. Only one launch is allowed per sol.

The clock continuously processes every crossed due event exactly once, including after a delayed frame or scene switch. At the same timestamp, process storm hits before rover tile arrivals or returns. When the active day reaches its boundary, first process all due clock events through that boundary; then recover a disabled rover, apply daily air and food losses, advance eligible plots and add air, clamp every resource change to 0–`resourceMax`, then trigger rescue if air or food is at or below `rescueAt`, or debrief after `missionSols`. A storm hit clamps air immediately, but rescue is checked only after the night's losses and eligible growth; this soft-grace rule avoids bypassing the night sequence. Recovery never moves Bolt home before a due hit at that boundary. A storm is safe when `shelterCells + shieldLayers >= strength`. Otherwise air drops by `stormAirLoss`, the lowest-ID healthy plot wilts, and no plot grows or adds air that sol (`stormBlackoutSol`). A hit while Bolt is outside damages the rover under the contract above. Storm and rover outcomes are simulated teaching scenarios, not observed Mars effects.

At a successful nonterminal night, increment `sol`, switch to planning, reset `cellsToday` to `cellsPerSol`, zero every power split, clear `wateredToday` and `stormBlackoutSol`, and leave `missionElapsedMs` at the exact boundary. Do not reset `availableSol`; it is the earliest launch sol. A rover disabled during sol n is physically at the dome with status repairing on morning n+1; when `sol >= availableSol` (n+2), set status home and allow launch. The core advances only up to the current sol boundary; a delayed frame may end the day, but must not spend time in the next morning before `startDay`. Route and radio progress pause during planning; a rover already out keeps its route and battery without recharging. A home rover discards unused battery each morning; its locked rover allocation is consumed exactly once as battery at launch, never as a repeated recharge. Emit `SOL_START` at initial sol 1 and after each nonterminal transition.

Planning, help, and hidden-tab suspension pause the entire simulation; scene changes do not. Do not catch up from wall-clock time after suspension or reload. Persist `missionElapsedMs`, rover route state, processed warning/hit/find IDs, and the radio queue. Derive upcoming warnings and hits from `stormWeekId` plus the data file; do not keep a second competing pending-event schedule. A warning is due at `max(0, hitAtMs - warningSols × solDurationMs)`, with `hitAtMs = (gameSol - 1) × solDurationMs + hitOffsetMs`. After an event has hit, it cannot block launches in later sols. Schedule each radio arrival at current `missionElapsedMs + delayMinutes × radioMsPerMinute`.

**Worked balance example (no storm):** Four planted plots are watered and warm. One grow-light cell lights all four. Starting air 100 and food 80 become air `min(100, 100 − 10 + 4 × 3) = 100` and food `80 − 8 = 72`. Planting used four seeds and four water; watering the four plots on the following sol costs another four water. The numbers are game rules, not scientific measurements.

**Minimum play checks:** (1) a cold sol without a heater pauses growth and air production; (2) a safe shielded storm costs its regolith only when crafted; (3) a warning before departure still shows its deadline and a hit is processed once; (4) at a shared hit/return timestamp, hit resolves first; (5) collected cargo appears at home only once after return; (6) a failed trip loses cargo and makes the rover unavailable for one full sol; (7) saving/reloading does not replay a warning, hit, pickup, or route step.

## 7. Data file schemas (`public/data/`, owned by C)

Every file has a top-level `"source"` (URL or list of URLs), `"fetched"` (ISO date) and `"mock"` (boolean).

```jsonc
// storms.json — source observations and game scenario timing are separate fields
{ "source": ["https://...DONKI/..."], "fetched": "2026-11-14", "mock": true,
  "weeks": [ { "id": "2024-05", "label": "May 2024 historical scenario",
    "events": [ { "id": "source-record-id", "type": "CME", "realTime": "2024-05-08T05:36Z",
      "link": "https://...DONKI/view/...", "observedTarget": "unknown",
      "marsArrival": { "status": "predicted", "time": "...", "source": "https://..." },
      "scenario": { "strength": 3, "gameSol": 3, "hitOffsetMs": 60000,
        "warningSols": 2, "label": "simulated Mars-outpost effect" } } ] } ] }

// weather.json — real InSight sols
{ "source": "https://...InSight...", "fetched": "2026-11-14", "mock": true,
  "sols": [ { "marsSol": 675, "earthDate": "2020-10-19", "minC": -96.9, "maxC": -15.9, "windAvg": 7.2 } ] }

// crops.json — growSols and food are game-balance values; zinnia has food: 0
{ "source": ["https://..."], "fetched": "2026-11-14", "mock": true,
  "crops": [ { "id": "red-romaine", "name": "Red Romaine Lettuce", "growSols": 4, "food": 20,
               "fact": "Astronauts on the Space Station grew and ate this lettuce in 2015.",
               "factSource": "https://..." } ] }

// delay.json — source timestamp is needed to interpret a changing distance
{ "date": "2026-11-14", "distanceKm": 0, "oneWayMinutes": 0, "source": "https://...", "fetched": "2026-11-14", "mock": true }

// photos.json
{ "source": "https://images-api.nasa.gov/", "fetched": "2026-11-14", "mock": true,
  "photos": [ { "nasaId": "...", "title": "...", "url": "...", "credit": "NASA/JPL-Caltech" } ] }

// terrain.json (owned by B); displayed terrain-derived costs are game abstractions
{ "width": 40, "height": 24, "cost": [[1,1,2,3,...]], "dome": [20,12], "source": ["https://trek.nasa.gov/..."], "fetched": "2026-11-14", "mock": true }
```

NASA observations, source-derived estimates, and simulated fields must remain distinguishable in the schema and UI. DONKI source guidance: [DONKI overview](https://ccmc.gsfc.nasa.gov/tools/DONKI/) and [DONKI data reference](https://ccmc.gsfc.nasa.gov/DONKI/guide/data-reference/).

## 8. Timeline (registered event time; confirm before relying on hours)

**Event details not confirmed in this plan:**

| Detail to confirm | Value | Owner / evidence |
|---|---|---|
| Registered event name and URL | **UNCONFIRMED** | Team Owner; team page |
| Event type (Local or Universal) | **UNCONFIRMED** | Team Owner; team page |
| IANA time zone and UTC offset | **UNCONFIRMED** | Team Owner; official event page |
| Local judging/demo schedule and any local cutoff | **UNCONFIRMED** | Team Owner; Local Lead or official event page, including confirmation time |

At kickoff, the Team Owner records these facts and shares them with the team. For a Local Event, use its confirmed local schedule; for the Universal Event, use the Team Owner's local time zone. The actual submission target is the earlier of Sunday 21:00 and **60 minutes before any applicable local cutoff**. Move earlier milestones forward if that target requires it. Do not assume the 21:00 target fits the selected event until this check is complete.

| When | Milestone | Who |
|---|---|---|
| **Sat, hour 0–1** | Scaffold + contracts (A). Mock data files (C). Terrain spike (B). | All |
| **Sat evening** | **Sync 1:** merge everything into `main`. Farm loop works, rover drives, storm board shows mock storms. | All |
| **Sat night** | Real data in. Placeholder art replaced by first real art. | C (data), all (art) |
| **Sun 12:00** | **Sync 2 / feature freeze.** Full sol loop with rover and labeled historical scenarios. From now on only fixes and polish. | All |
| **Sun 12:00–16:00** | Playtest (ideally with a real 7–12 year old), balance `rules.ts`, fix bugs, deploy to GitHub Pages | A + B |
| **Sun 16:00–18:00** | Record and edit the public ≤ 30 s demo video; explain the challenge, show one working decision, identify NASA data, and state the scenario is simulated; write the project page | C (+ one helper) |
| **Sun 19:00** | Test every link in a private browser window | All |
| **Earlier of Sun 21:00 or local cutoff minus 60 min** | Submit for judging, record the submitted version/time, verify the confirmation banner, demo and final links in a private window. | Team Owner |
| **After any edit to a submitted project** | Save, click **Submit for Judging** again before the applicable cutoff, verify the new confirmation, and test the latest public version/links. "Save Progress" alone does not submit edits; the final saved submission is the version reviewed. | Team Owner |

**Cut list** (drop in this order if we're behind): exoplanet telescope → APOD/EPIC extras → free-drive mode → crew walking animations → 3rd storm week. **Never cut:** the storm race, real DONKI data, the credits screen.

## 9. Asset list

Style: 32×32 pixel art, warm cozy palette with dusty Mars reds and soft greenhouse greens. Keep it simple: clarity matters more than polish.

**Where assets can come from:**
1. **Made by us** (Aseprite, Piskel, LibreSprite). Best option.
2. **CC0 or open-licence packs** (e.g., Kenney.nl, OpenGameArt). Record the licence and URL in `docs/ASSETS.md`. These go in the References field.
3. **AI-generated:** the supplied guide says AI should not come up with the solution idea. Record the truthful origin and actual AI roles; do not invent or backfill history. If origin or tool use is uncertain, check with the team before describing it. Generated images and video need a **visible watermark**; generated audio, code, and data need acknowledgement in descriptive text and metadata. Record actual tool use and affected assets in the disclosure files and table below.
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
| 9 | Zinnia (decorative flower; food value 0) | 32×32 × 4 | A | | | | ☐ |
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

- [ ] Confirm eligibility and roster: teammates are registered for the same event and listed on the Members tab; for a Local Event, all are confirmed and not waitlisted. Check the guide's team-size rules for the selected Local or Universal Event.
- [ ] **Project Name:** Sol Sprouts
- [ ] **High-Level Summary**
- [ ] **Demo link:** public video ≤ **30 s** or slide deck ≤ **7 slides including title/intro**; no login. English content; spoken non-English video has English subtitles. Demo introduces team/challenge, shows the working project, and explains how NASA/open data matters. **Exceeding limits means ineligible for Global Judging.**
- [ ] **Final Project link:** the GitHub Pages game URL + the GitHub repo. Test in a private window.
- [ ] **Detailed Description:** what it does, how it works, benefits, goals, tools (Phaser, TypeScript, Vite, the NASA APIs)
- [ ] **NASA Data:** list at least one NASA data/resource (required for Global Award eligibility) and every NASA API/dataset with its role; distinguish observations, source estimates, and game adaptations.
- [ ] **References:** list all external code, text, images, datasets, tools, and assets, including free/open materials; include licences and use permissions where relevant (`docs/ASSETS.md`).
- [ ] **AI (SI) use:** truthfully answer the SI form about actual tools and roles. The form response is for data collection and is not shown to judges; visible project disclosures still apply. Maintain `docs/AI_USAGE.md` for descriptive disclosure and `docs/AI_USAGE.json` as machine-readable metadata listing actual tools, affected files/assets, media type, role, human edits, and disclosure/watermark location. Acknowledge AI-generated code, data, and audio in descriptive text and metadata; visibly watermark AI-generated images/video. The guide says AI must not originate the solution idea; disclose actual history truthfully.
- [ ] Everything in **English**
- [ ] Complete all required project-page fields in English; avoid images, video, audio, or other likeness of anyone under 18 in the demo and final project.
- [ ] Optional: request FortiGuard web-filter classification for the project site.
- [ ] Tick **Terms and Conditions** + **All Work is Original**, click **Submit for Judging** by the confirmed target/cutoff, and check the success banner.
- [ ] Ensure all references (including code, text, images, datasets, tools, and free/open assets) are listed; obtain permission for any copyrighted material.
- [ ] Record the submitted version and submission time. After any edit: save, resubmit, confirm the banner again, and verify the latest submitted version and public links in a private browser.

The required demo has **30 seconds or 7 slides**, not both. The submission form's demo, final-project, SI, NASA Data, and References fields are separate; completing a project page or README does not replace any required form field.

## 11. Judging evidence to plan for

The official rubric scores **Impact, Creativity, Validity, Relevance, and Presentation**. Keep the project focused on the challenge: kids make visible power, life-support, and food choices, then see consequences. For the demo and description, show a working decision and explain how sourced NASA information informs the scenario. Support scientific validity by distinguishing observations from predictions and game balance; support usability with short instructions and readable labels. These are planning prompts, not a promise of a score.

## 12. Official guide references

- [2026 Project Submission Guide (Nov. 13, 2026)](https://www.spaceappschallenge.org/resources/project-submission-guide/): event timing pp. 2, 4; project fields pp. 7–10; demo requirements/tips pp. 11–12; submission, edit/resubmit, and under-18 rules p. 13.
- [2026 Judging & Awards Guide (Nov. 13, 2026)](https://www.spaceappschallenge.org/resources/judging-awards-guide/): Global Judging eligibility p. 3; judging criteria pp. 5–7.

## 13. Instructions for AI coding agents

Paste this section into your agent's instructions (e.g., `CLAUDE.md` / `AGENTS.md`) along with this whole file.

1. **Stay in your folders.** Your human's workstream (section 4) lists the folders you may edit. Don't modify other folders, `src/core/types.ts` or `src/core/events.ts`. If you need a change there, stop and tell your human.
2. **Use the contracts.** Import `GameState`, `EV` and `RULES` from `src/core/`. Talk to other systems only through the event bus and the game state, never by importing another workstream's scene internals.
3. **No made-up science.** Every scientific observation or fact shown to players must come from `public/data/*.json` with a source. Balance values and simulated events must be labeled as game rules. If data is mock, leave the MOCK badge on.
4. **Keep to 3 player resources** (power, air, food) and kid-friendly language (ages 7–12, short sentences, explain science words).
5. **Small commits on your own branch** (`a/farm`, `b/rover`, `c/data-ui`). Merge to `main` at sync points only, after `npm run build` passes.
6. **Placeholders over blocking.** If art isn't ready, draw a labelled rectangle.
7. **Don't add dependencies** beyond Phaser, TypeScript and Vite without asking the team.
8. **Never commit** `.env` or API keys. Never expose a personal NASA API key in browser code.
9. **No copyrighted or trademarked material**: no NASA logos, no assets or names from existing games.
10. When you finish an implementation task, tick its box in section 4 only when the described behavior exists and has been checked. This plan itself does not claim those tasks are complete.
