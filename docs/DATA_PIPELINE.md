# NASA data fetch pipeline

Run the Node-only fetcher from the repository root:

```sh
NASA_API_KEY='your key' rtk node scripts/fetch-nasa-data.mjs --date 2026-11-14
```

Omit `--date` to use the current UTC date for the Horizons snapshot. `--only storms,weather` fetches a subset; `--output-dir /tmp/sol-sprouts-data` writes review copies outside `public/data/`. `--help` lists the options. The shared NASA `DEMO_KEY` is used if `NASA_API_KEY` is absent and is rate limited.

The repository currently has no `.gitignore`. Until `.env` is ignored in the repository, set `NASA_API_KEY` in the shell environment instead of creating `.env`. The fetcher can read an existing `.env`, but never creates, prints, or writes the key. Check that keys are absent from diffs before committing.

The script runs during development/build-data preparation in Node. It is not imported by the game, and the browser makes no NASA API calls. It builds every requested dataset in memory, validates the returned shapes and source fields, and only then stages JSON files next to their destinations and renames them. A failed requested fetch leaves existing files unchanged. A filesystem error during the final sequence of multiple renames can still leave a partially updated set; rerun the command after correcting the filesystem issue.

Data sources and limits:

- `storms.json`: DONKI CME, SEP, and GST queries for May 8–14, 2024. It selects at most one usable event of each type, retaining source IDs, links, times, and a small observation summary. The selected DONKI records do not contain an explicit `observedTarget` field, so it is `unknown`; this does not establish a Mars impact. The separate `scenario` fields are game adaptations; GST remains explicitly Earth geomagnetic context.
- `weather.json`: archived InSight summaries. Each output row uses the API's own per-sol `First_UTC`, `AT.mn`, `AT.mx`, and `HWS.av`. Invalid temperature rows are skipped; an average wind value can be null when absent. This archive can return fewer than ten sols.
- `crops.json`: OSDR is checked as a space-biology catalogue reference; it is not presented as proof of the crop facts. Kid-facing facts use linked NASA Veggie, Advanced Plant Habitat, mizuna, radish, and chile-pepper pages. Their expected wording is checked when fetching. `growSols` and `food` remain game-balance values; zinnia food remains zero.
- `delay.json`: JPL Horizons vector coordinates for Mars from the Earth geocenter on the requested date. The distance is the norm of X/Y/Z in kilometers; one-way delay divides by the speed of light. The output records the TDB epoch, ICRF frame, target, center, and vector units.
- `photos.json`: NASA Image and Video Library Mars searches. Results without a NASA image asset URL or creator/center credit are discarded. If no usable credited results remain, the request fails and existing data is preserved; the game should keep its local photo placeholder for an empty or unavailable collection.

All fetched files have `mock: false` only after validation. Keep `mock: true` fixtures in place until a fetch succeeds. The documented automated checks are:

```sh
rtk node --test scripts/fetch-nasa-data.test.mjs
rtk git diff --check
```

On 2026-11-14, a live run succeeded for all five datasets: 3 DONKI records (May 8–10, 2024), 7 InSight sols (675–681; October 19–25, 2020), 5 crop records, 6 credited images, and a Horizons Earth–Mars distance of 198,132,895.716 km (11.015 one-way light minutes, 2026-11-14 TDB). The reviewed output has been applied to `public/data/`; all five files are marked `mock: false`.
