# Initial data fixtures

These files unblock the first game scenes while the data pipeline and scene consumers are being built. Every file currently has `"mock": true`. Treat every row as synthetic fixture data, not a NASA observation or fetched record. The `fetched` date is the fixture creation date (2026-11-14); it does not mean NASA data was downloaded that day.

- `public/data/storms.json`: one test week with three synthetic CME/SEP/GST-shaped records. IDs, timestamps, targets, strengths, and scenario timing are mock values. `observedTarget` is `unknown`; no Mars arrival is asserted. `scenario` values are game adaptations. The May dates make it possible to test the planned May 8–14, 2024 presentation flow, not to claim these are records from those dates.
- `public/data/weather.json`: ten synthetic daily rows spanning both sides of the game's −70 °C heater threshold. Values are not archived InSight readings.
- `public/data/crops.json`: all five planned crop IDs and balance values. Every fact is a placeholder, not a scientific claim. Replace each fact and verify its source before using it in a science card.
- `public/data/delay.json`: positive synthetic distance and light-time values to exercise the radio UI. These are not a Horizons result for the listed date.
- `public/data/photos.json`: intentionally empty. There are no verified image records or credits yet; the scene should show its local placeholder when no photos are available.
- `public/data/terrain.json` and terrain images belong to Person B and are not included here.

All data files have `mock: true`; the loader/UI must show the planned `MOCK DATA` badge whenever any loaded file is mock. Consumers, loader, and fetch script are not built in this initial data handoff. Do not remove the badge until real records have replaced all mock values and the files have been checked.

The NASA endpoint/documentation URLs in `source` are provenance pointers for future fetching. They do not verify any fixture row. Crop facts likewise remain placeholders despite the general NASA links.

Quick validation (from repository root, Node.js only):

```sh
rtk node --input-type=module -e '
import fs from "node:fs";
for (const name of ["storms", "weather", "crops", "delay", "photos"]) {
  const data = JSON.parse(fs.readFileSync(`public/data/${name}.json`, "utf8"));
  if (data.mock !== true || !data.source || !data.fetched) throw new Error(`${name}: required mock metadata`);
}
const storms = JSON.parse(fs.readFileSync("public/data/storms.json", "utf8"));
const events = storms.weeks.flatMap(week => week.events);
if (new Set(events.map(event => event.id)).size !== events.length) throw new Error("storm IDs must be distinct");
if (events.some(event => event.observedTarget !== "unknown" || "marsArrival" in event)) throw new Error("storm fixture must not imply target or Mars arrival evidence");
if (events.some(event => event.scenario.gameSol < 1 || event.scenario.gameSol > 10 || event.scenario.hitOffsetMs !== 60000 || event.scenario.warningSols !== 2)) throw new Error("storm scenario timing");
const weather = JSON.parse(fs.readFileSync("public/data/weather.json", "utf8"));
if (weather.sols.length < 10 || !weather.sols.some(row => row.minC < -70) || !weather.sols.some(row => row.minC >= -70)) throw new Error("weather threshold coverage");
const crops = JSON.parse(fs.readFileSync("public/data/crops.json", "utf8"));
if (crops.crops.length !== 5 || crops.crops.find(crop => crop.id === "zinnia")?.food !== 0) throw new Error("crop fixture coverage");
if (crops.crops.some(crop => !crop.fact.startsWith("MOCK fact placeholder:"))) throw new Error("crop facts must stay placeholders");
const delay = JSON.parse(fs.readFileSync("public/data/delay.json", "utf8"));
if (delay.distanceKm <= 0 || delay.oneWayMinutes <= 0) throw new Error("delay fixture must be positive");
const photos = JSON.parse(fs.readFileSync("public/data/photos.json", "utf8"));
if (!Array.isArray(photos.photos)) throw new Error("photos must be an array");
console.log("Initial data fixtures: valid JSON and required mock invariants passed.");
'
```
