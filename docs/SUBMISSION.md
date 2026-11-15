# Faraway Garden submission draft

**Status: draft, not submitted.** A public team record reports the team as **Space Force**, the challenge as **Build a Junior Astronaut Mission Trainer**, and the registered event as the Universal Event. It lists three members. Check the latest roster and each participant’s registration status in the Members tab before submission. The record's existing project name is **Project Space Force**; **Faraway Garden** is the proposed project name for team review.

## Project name

Faraway Garden

## High-level summary

Help a small Mars greenhouse crew survive a ten-sol mission. Plant and water crops, divide limited power, shelter from a simulated solar-storm scenario, and send Bolt the rover out for supplies. Historical NASA records provide the science context; game time, storm strength and effects, crop yields, and resource costs are clearly labeled simulations.

## Detailed description

Faraway Garden is a cozy, top-down pixel-art mission trainer for ages 7–12. Each sol, players choose how to divide six power cells among grow lights, a heater, a storm shelter, and a rover battery. They plant and water crops, then see how those choices affect air, food, and the crew. They can plan Bolt's route to find supplies and samples. If resources run out, the crew is rescued and players can try a new plan.

The game uses historical NASA DONKI CME, SEP, and GST records from May 8–14, 2024 (with three selected events dated May 8–10); archived InSight weather from October 19–25, 2020; NASA plant-research pages for crop descriptions; JPL Horizons for an Earth–Mars light-time estimate at the saved November 14, 2026 epoch; NASA Image and Video Library photos; and NASA Mars Trek map tiles. The records describe observations in their original context. Game strength, timing, Mars-outpost effects, crop growth, yields, and driving cost are adaptations for play, not NASA measurements. InSight and image records are historical, not live updates. After the data files load, gameplay does not call NASA APIs.

The project uses Phaser 3, TypeScript, and Vite. It stores game progress in browser local storage when available. A saved copy or first load needs a network connection; offline operation is not promised.

## NASA data and sources

| Data shown | Source and role | Boundary shown to players |
|---|---|---|
| Solar-event history and Earth geomagnetic context | [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) CME, SEP, and GST records from May 8–10, 2024; the saved records link to their individual entries. | The observed record, date, and event type are real. Scenario strength, sol, countdown, and Mars-outpost effect are simulated. GST describes Earth geomagnetic conditions. No Mars impact is asserted. |
| Mars temperature and wind context | [NASA InSight weather archive](https://api.nasa.gov/insight_weather/), seven recorded sols from October 19–25, 2020. | Archived readings; the game may cycle through these rows. |
| Space-crop facts | [NASA Veggie and space-plant overview](https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/), [mizuna experiment](https://www.nasa.gov/image-article/mizuna-mustard-greens-are-growing-aboard-international-space-station-2/), [radish harvest](https://www.nasa.gov/missions/station/astronauts-harvest-radish-crop-on-international-space-station/), and [chile pepper harvest](https://www.nasa.gov/missions/station/nasas-second-pepper-harvest-sets-record-on-space-station/). The [OSDR search](https://osdr.nasa.gov/osdr/data/search?term=plants) is a catalogue reference, not proof for an individual crop fact. | Facts link to their supporting page. Growth time and food values are game balance values; zinnia food is zero. |
| Earth–Mars communication estimate | [JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api), Mars relative to Earth's geocenter; saved epoch: 2026-11-14 00:00 TDB, ICRF frame. | Date-specific estimate. The game compresses one radio minute into one active game second. |
| Mars rover photos | [NASA Image and Video Library](https://images.nasa.gov/), with NASA IDs and creator credits stored for each photo. | Historical, credited NASA images. Loading photos requires a network connection. |
| Rover map | [NASA Mars Trek](https://trek.nasa.gov/mars/): Viking MDIM 2.1 color mosaic and MOLA shaded relief tiles listed in [`public/data/terrain.json`](../public/data/terrain.json). | Source imagery is NASA data. Route cost is a game abstraction. |
| Activity science cards | NASA pages cited in [`public/data/science.json`](../public/data/science.json), including NASA Mars sol, cloud, and plant research facts. | Cards connect short source-backed facts to planting, watering, or rover decisions; no effect on game balance. |

All eight files currently loaded from `public/data/` record `mock: false`. This is a status of the checked-in snapshot, not a promise of live data. The game shows a MOCK DATA badge if a loaded file has `mock: true`. The full deduplicated URLs collected from those files are in [References](REFERENCES.md).

## References and asset notes

Project-created pixel art is drawn in code. The map imagery, NASA photo assets, source IDs, and photo credits are recorded in the data files and [`docs/ASSETS.md`](ASSETS.md). Package versions and license identifiers for Phaser, Vite, and TypeScript are in the lockfile and summarized in [References](REFERENCES.md). Follow each NASA source's own credit and reuse terms; this source list is not a blanket rights grant. The project does not use NASA logos or mission insignia. The team still needs to review all references and required permission wording before submission.

## AI use disclosure draft

See [`docs/AI_USAGE.md`](AI_USAGE.md) and [`docs/AI_USAGE.json`](AI_USAGE.json). The current record includes Claude and OpenAI Codex. It identifies the solution-idea history as reported in the earlier team disclosure and leaves human team review pending. The team must verify the history, tools, roles, edits, and SI form answers. The illustrated deck is AI-assisted and visibly watermarked; it is not gameplay footage.

## Demo deck and optional video storyboard

The demo alternative is a refreshed seven-slide presentation with staged screenshots of the running local game: [`public/demo.pdf`](../public/demo.pdf) and [`public/demo.pptx`](../public/demo.pptx). It now covers the Mars–Moon campaign, greenhouse and crew decisions, manual 3D rover driving, daily lessons, pet quizzes, Wiz Cards, badges and the training certificate. Speaker notes include sources and simulation limits. The deck is visibly AI-assisted, and the certificate is labeled as an example. Screenshots are not evidence of an end-to-end playthrough or measured educational impact. The refreshed files are local and await publication; older hosted-file checks do not verify these bytes. See [Demo deck notes](DEMO.md).

Optional video target, if the team later records one: 30 seconds or less, with English captions. Record only after the team has verified controls and a storm warning. Use game capture and original project audio; include no minors.

| Time | Screen action | Caption or narration |
|---|---|---|
| 0–3 s | Title, then greenhouse morning. | “Faraway Garden — a Mars mission trainer for young explorers.” |
| 3–8 s | Plant and water one crop. | “Plants need water, light, and warmth.” |
| 8–13 s | Show the power plan and allocate cells. | “Every sol, choose where six power cells go.” |
| 13–21 s | Open the storm board and show a sourced May 2024 event beside the simulated countdown/strength. | “This is a historical NASA event. Its effect on our Mars outpost is simulated.” |
| 21–26 s | Show a crop or rover decision and resulting resource HUD. | “Your choices change the crew’s air and food.” |
| 26–30 s | Credits screen with data sources. | “Built with NASA data. Storm timing and game rules are simulations.” |

This storyboard remains a proposal, not a recording or tested gameplay capture. Add a final video link only after capture and private-browser verification.

## Submission fields still to complete

- Registered event: the public team record names the Universal Event. The project schedule, team-lead timezone, and actual submission cutoff still need confirmation in the official event account.
- Roster and eligibility: the public team record lists Muskan Bararia, Vibhor Gupta, and Shresth Sahai. Confirm the Members tab and each person's registration/eligibility before submission.
- Team page: [Space Force](https://www.spaceappschallenge.org/2026/find-a-team/space-force4/). Its public project record currently says **Project Space Force**; this draft proposes **Faraway Garden**. The other required project fields are empty.
- Demo deck: refreshed seven-slide PDF/PPTX artifacts are local and await deployment and public-link verification. The official guide permits a deck of up to seven slides.
- Public gameplay video: not recorded.
- Deployed final-project URL: [project site](https://vibhorgupta96.github.io/nasa-space-apps-challenge/) returned HTTP 200; the production JavaScript asset also returned HTTP 200. This does not establish interactive browser behavior.
- Human-reviewed AI/SI answers, references, team originality and terms confirmations: not complete.
- Submitted version, submission time, and confirmation: none recorded; submit and verify in the event form after all edits.

The public team record previously reported the Universal Event and an unsubmitted project with no saved time. GitHub Pages deployment succeeded for revision `fee644e4c44a440c4f80ab27e9fd55511a17e9c8`; the game and both deck URLs returned HTTP 200, and the hosted deck files matched the reviewed local files by SHA-256. This does not change the event form: no project submission or acceptance is claimed. [`docs/SUBMISSION_STATUS.json`](SUBMISSION_STATUS.json) records the checked status and must be refreshed after any save, deploy, or submit action.

See the [2026 Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) and [2026 Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) for the registered event's current instructions. Source URLs and tool/license references are collected in [References](REFERENCES.md).
