# Sol Sprouts

A cozy pixel-art farming game for kids aged 7–12. Keep a greenhouse dome alive through a 10-sol Mars mission by choosing how to spend power, caring for crops, and helping a rover explore. NASA data supplies the historical science context; storm strength, effects, crop yields, and game time are simulations. Built for **NASA Space Apps 2026: Build a Junior Astronaut Mission Trainer**.

The team plan is in [PLAN.md](PLAN.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
```

## Refresh the NASA data

```bash
cp .env.example .env     # put your free key from https://api.nasa.gov in .env
npm run fetch-data       # DONKI storms, InSight weather, Horizons delay, NASA images
npm run build-terrain    # Mars Trek map tiles (macOS: uses the built-in `sips`)
```

Every file in `public/data/` records `source`, `fetched` and `mock`. While any loaded file is `"mock": true`, the game shows a yellow **MOCK DATA** badge.

> **Current data status:** Check each data file's own `mock` field before describing it as fetched. The game displays a **MOCK DATA** badge if any loaded dataset still has `mock: true`.

See [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) for source details, [docs/REFERENCES.md](docs/REFERENCES.md) for the deduplicated reference list, and [docs/SUBMISSION.md](docs/SUBMISSION.md) for the project-page draft and demo materials. The [Space Force team page](https://www.spaceappschallenge.org/2026/find-a-team/space-force4/) lists the Universal Event. Other project fields were empty when checked; the game has not been submitted. See [submission status](docs/SUBMISSION_STATUS.json) before sharing links.

## How to play

- **Move:** arrows or WASD. **Act:** SPACE, or click a nearby square.
- **Tools:** 1–5 seeds · 6 watering can · 7 hand (harvest, or clear a wilted plant).
- **Each morning:** split 6 power cells between grow lights, heater, storm shelter and rover battery.
- **Rover:** go through the airlock (the door at the top). Click the map to plan a route, press 🏠 Return, then Send Bolt.
- **Shortcuts:** TAB storm board · H help · P photo album · ESC closes panels.

## What's real, what's simulated

| In the game | Source | Real or simulated |
|---|---|---|
| Storm dates, types and records | NASA DONKI (CME, SEP, GST) | **Real** records |
| Storm strength, timing and effects on the outpost | Game rules | **Simulated**, labelled in the UI |
| Daily low/high temperature and wind | NASA InSight weather (archived 2020) | **Real** |
| Radio delay | JPL Horizons Earth–Mars distance → light-minutes | **Real**, with time compressed (1 radio min = 1 game s) |
| Rover map | NASA Mars Trek Viking mosaic around InSight's landing site | **Real** imagery |
| Rough-ground driving cost | MOLA shaded relief brightness | Game abstraction |
| Crop facts | Linked NASA Veggie, Advanced Plant Habitat, and crop articles | Source-backed summaries. Growth times and food values are game balance |
| Fun-fact cards, photo album | NASA/JPL Photojournal, Image Library | **Real** |

## Code map

| Folder | What lives there | Plan owner |
|---|---|---|
| `src/core/` | Shared contract (`types.ts`, `events.ts`, `rules.ts`) and `store.ts`, which runs the clock, commands and save/load | A |
| `src/farm/`, `src/scenes/FarmScene.ts` | Dome, crops, crew, interactions, farm art | A |
| `src/rover/`, `src/scenes/RoverScene.ts`, `scripts/build-terrain.mjs` | Rover map, route planning, terrain | B |
| `src/data/`, `src/ui/`, `src/story/`, Title/Debrief scenes, `scripts/fetch-nasa-data.mjs` | Data loading, HUD and modals, storyline, credits | C |
| `src/art/pixel.ts` | Tiny helper that draws the pixel art from text grids | shared |

All art is drawn in code at startup, so the repo has no image assets of its own apart from the NASA map tiles.

Scenes never import each other. They read `store.state`, call store commands, and listen on the event bus. The UI scene runs the clock (`store.tick`), so time keeps passing while you're on the rover map.

## Credits

Open the in-game **NASA data we used** screen for the sources included in the game. Additional asset and license notes are in [docs/ASSETS.md](docs/ASSETS.md). This project is not affiliated with or endorsed by NASA. AI use is documented in [docs/AI_USAGE.md](docs/AI_USAGE.md); team verification remains pending.

## Deployment

The GitHub Pages workflow publishes the production build from `main` and `codex/person-c-completion`. A published URL is not recorded until the deployment has succeeded; check [docs/SUBMISSION_STATUS.json](docs/SUBMISSION_STATUS.json) before sharing a final-project link.
