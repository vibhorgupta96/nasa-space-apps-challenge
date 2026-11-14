# Assets and references

| Asset | Source | Licence / terms | Notes |
|---|---|---|---|
| Character, crop, machine, tile and icon sprites | Drawn in code (`src/**/art.ts`, `src/ui/icons.ts`); prior AI disclosure reports Claude contributed pixel-art grids | Review authorship and reuse terms with team | Text-grid art; see AI_USAGE.md |
| Mars map tiles (`public/data/terrain/*.jpg`) | NASA Mars Trek, Viking MDIM 2.1 colour mosaic | Follow the source's current credit and reuse terms | Credited on the rover screen |
| Driving-cost grid | Derived from NASA Mars Trek MOLA colour shaded relief | Follow the source's current data terms | Game abstraction |
| Rover photos (loaded at runtime) | NASA Image and Video Library | Follow each asset's credit and reuse terms | Credit shown on each photo card |
| DotGothic16 font (Fontworks) | Google Fonts stylesheet referenced in `index.html` | Verify current font license metadata before redistribution | See [References](REFERENCES.md) |
| Phaser 3.80.1 | npm package metadata in `package-lock.json` | MIT per lockfile | See [References](REFERENCES.md) |
| Vite 5.4.10, TypeScript 5.6.3 | npm package metadata in `package-lock.json` | MIT and Apache-2.0 per lockfile | Build tools; see [References](REFERENCES.md) |
| Lunar theme (`public/audio/moon-theme.mp3`) | Upbeat 61 s instrumental loop supplied by Muskan, AI-generated (confirm the tool, e.g. Suno, before submission) | AI-generated; follow the generator's terms for the account plan it was made on | For the planned Moon mode (ideas.md #1); not played in the game yet |
| Background music (`public/audio/mars-morning.mp3`) | "Mars Morning", a 45 s loop supplied by Muskan, made with the Suno AI music generator | AI-generated; follow Suno's terms for the account plan it was made on | Disclosed in AI_USAGE.md/.json; loops quietly from the first click or key press |
| Sound effects (`public/audio/*.ogg`, 19 clips) | Kenney: [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), [RPG Audio](https://kenney.nl/assets/rpg-audio) | CC0 1.0 (public domain); credit optional | Renamed by use (e.g. `water.ogg` = Sci-fi `slime_000`); full mapping below |

## Sound effect sources

All from Kenney (CC0 1.0), renamed for what they play on:

| File | Original clip | Plays when |
|---|---|---|
| `click.ogg` | Interface `click_002` | Any menu button or power cell is pressed |
| `confirm.ogg` | Interface `confirmation_001` | The day starts |
| `found.ogg` | Interface `confirmation_002` | Bolt finds an item |
| `error.ogg` | Interface `error_004` | A farm action is refused |
| `harvest.ogg` | Interface `pluck_001` | A crop is harvested |
| `storm-warning.ogg` | Interface `question_002` | A storm warning arrives (played twice) |
| `new-sol.ogg` | Interface `maximize_003` | A new sol begins |
| `water.ogg` | Sci-fi `slime_000` | A plot is watered |
| `melter.ogg` | Sci-fi `forceField_000` | Ice is melted into water |
| `craft.ogg` | Sci-fi `impactMetal_000` | A shield is crafted |
| `rover-depart.ogg` | Sci-fi `spaceEngineSmall_000` | Bolt leaves (cut to 1.8 s) |
| `rover-return.ogg` | Sci-fi `doorOpen_000` | Bolt gets home |
| `rover-damaged.ogg` | Sci-fi `explosionCrunch_000` | Bolt is damaged |
| `storm-hit.ogg` | Sci-fi `lowFrequency_explosion_000` | A storm hits the dome |
| `radio.ogg` | Sci-fi `computerNoise_001` | A radio message arrives (cut to 1.2 s) |
| `plant.ogg` | RPG `dropLeather` | A seed is planted |
| `clear.ogg` | RPG `chop` | A wilted plot is cleared |
| `step-1.ogg`, `step-2.ogg` | RPG `footstep00`, `footstep01` | The player walks on the farm |
