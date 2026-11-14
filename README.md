# Sol Sprouts

A cozy pixel-art farming game for kids aged 7–12 where you keep a greenhouse dome on Mars alive for 10 sols. It's powered by real NASA data. Built for **NASA Space Apps 2026: Build a Junior Astronaut Mission Trainer**.

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

Every file in `public/data/` records `source`, `fetched` and `mock`. While any file is `"mock": true`, the game shows a yellow **MOCK DATA** badge.

> **Current status:** `storms.json` and `weather.json` are still **mock**. The shared `DEMO_KEY` hit NASA's rate limit while we were building. Run `npm run fetch-data` with a personal key to replace them. All other data files are real.

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
| Crop facts | NASA Image Library records (Veggie, Advanced Plant Habitat) | **Real** facts. Growth times and food values are balance |
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

- NASA data as listed above. This project is not affiliated with or endorsed by NASA.
- Phaser 3 (MIT), Vite, TypeScript. Font: Pixelify Sans (SIL OFL), loaded from Google Fonts.
- AI use: see [docs/AI_USAGE.md](docs/AI_USAGE.md).
