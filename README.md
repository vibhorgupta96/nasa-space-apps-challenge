# Sprout Station

A cozy pixel-art farming game for kids aged 7–12. Choose Mars or the Moon, keep its greenhouse alive through a 10-day mission, then travel to the other world for the campaign finale. NASA data supplies the historical science context; weather hazards, power cycles, crop yields, rover terrain, and game time are simulations. Built for **NASA Space Apps 2026: Build a Junior Astronaut Mission Trainer**.

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

Every file in `public/data/` records `source`, `fetched` and `mock`. When a data file for the current world is `"mock": true`, the game shows a yellow **MOCK DATA** badge.

> **Current data status:** Check each data file's own `mock` field before describing it as fetched. The game displays a **MOCK DATA** badge if a dataset for the current world has `mock: true`.

See [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md) for source details, [docs/REFERENCES.md](docs/REFERENCES.md) for the deduplicated reference list, and [docs/SUBMISSION.md](docs/SUBMISSION.md) for the project-page draft and demo materials. The [Space Force team page](https://www.spaceappschallenge.org/2026/find-a-team/space-force4/) lists the Universal Event. Other project fields were empty when checked; the game has not been submitted. See [submission status](docs/SUBMISSION_STATUS.json) before sharing links.

## How to play

- **Move:** arrows or WASD. **Act:** SPACE, or click a nearby square.
- **Tools:** 1–5 seeds · 6 watering can · 7 hand (harvest, or clear a wilted plant).
- **Each morning:** split power cells between grow lights, thermal control, storm shelter and rover battery. Mars has 6 cells; Moon has 8 in light and 6 in darkness, less any dust.
- **Rover:** go through the airlock (the door at the top). Click the map to plan a route, press 🏠 Return, then Send Bolt.
- **Kitchen:** harvests go to the pantry; cook recipes for the current world or eat crops raw.
- **Shortcuts:** TAB storm board · H help · P photo album · ESC closes panels.
- **Moon:** hold SHIFT for a short low-gravity hop. Clean rover dust at the airlock to restore tomorrow’s power budget. Moon crops are greenhouse experiments; the lunar terrain and discoveries are illustrated game simulations.

Choose the order of the two missions at the start of a new campaign. Mars uses archived InSight weather and real historical solar-event records; the Moon mission compresses long bright and dark stretches into ten short game days and uses simulated radiation scenarios. Completing the first mission opens travel to the other world. A rescue lets you retry the current mission.

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
| Moon gravity, no-wind/no-rain environment, lunar regolith research | NASA Moon facts and lunar plant experiments | **Real facts**; the short hop, lunar greenhouse crops and their yields are game simulations |

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

The reviewed build is live at [Sprout Station](https://vibhorgupta96.github.io/nasa-space-apps-challenge/). The seven-slide demo deck is available as [PDF](https://vibhorgupta96.github.io/nasa-space-apps-challenge/demo.pdf) and [PPTX](https://vibhorgupta96.github.io/nasa-space-apps-challenge/demo.pptx). GitHub Actions deployed revision `fee644e4c44a440c4f80ab27e9fd55511a17e9c8`; the workflow also publishes pushes to `main` and `codex/person-c-completion`. See [validation evidence](docs/VALIDATION.md) and [submission status](docs/SUBMISSION_STATUS.json).
