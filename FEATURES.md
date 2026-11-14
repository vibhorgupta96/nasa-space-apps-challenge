# Sprout Station: feature roadmap to win

> Challenge: **Build a Junior Astronaut Mission Trainer**. Judges score **Impact, Creativity, Validity, Relevance and Presentation** (PLAN.md section 11).
> Deadline: **Sun Nov 15, 11:59 p.m. local**. Submit by 9 p.m. (PLAN.md section 8).
>
> **The pitch this list builds towards:** *"Sprout Station trains kids the way NASA trains astronauts: you practise one real mission skill each sol (life support, power, communication, radiation safety, teamwork), every skill is tied to a real NASA mission or dataset, and you finish with a training certificate."*

Folder ownership is the same as PLAN.md section 4. **A** = core, farm, `main.ts`. **B** = rover and Mars map. **C** = NASA data, UI, story, docs and submission. Every new fact goes in `public/data/` with a NASA source URL and a "real / game" label (PLAN.md design rule 3). Facts marked **(verify)** must be checked against the linked page before shipping.

## Already done (this branch)

- Background music loop, 19 CC0 sound effects, M to mute.
- Readable font (DotGothic16), sharper text on small screens.
- Sleeping in a bed ends the sol; four beds (you and the crew).
- "Make your astronaut": girl or boy, hair style and colour, skin tone, suit, trousers.
- Pets (cat, dog, Mars alien) that follow you and do one helpful trick per sol. The dog's trick cites the Phoenix lander finding ice in 2008.
- Kitchen and recipes: harvests go to a pantry; mixed recipes feed the crew more than raw crops.
- **Person A training layer (Sun):** badge logic (#1, 13 badges), MOXIE oxygen maker (#3), dusty solar panels that the player or pet cleans (#4), daily schedule and treadmill (#8), crew requests on sols 2–9 (#9), `store.shelterProtection()` for the radiation meter (#13), and settings hooks for reduced motion and music/sound volume in `src/core/settings.ts` (#14). The settings screen and badge icons on the HUD are still Person C's.
- **Training certificate (#2, built by A):** the player types their name on the "Make your astronaut" screen; the debrief opens a certificate with the name, an earned title (Astronaut Cadet, Flight Engineer, Mission Specialist or Mars Mission Commander), the astronaut and pet, badges, lessons, Wiz Cards and the real DONKI date, plus a Save picture button.
- Teaching spine from WINNING_PLAN.md: once a sol your pet brings a quiz card (today's lesson question); a right answer wins a **Wiz Card** (the lesson's sourced NASA fact) and the pet's reward. Petting also shows hearts and plays a pet sound. Players without a pet get the question after the night report. Also: the mission journal, and the pre/post quiz score in the store (`store.recordQuiz`). The quiz screens are still Person C's.
- **Moonwalk (Moon only, built by A):** a spacesuit rack by the airlock. Once a day the player suits up (an EVA suit with their skin tone and suit colour) and picks a task outside: collect rock samples, leave footprints or look back at Earth. Each task shows a real NASA fact with its source (Apollo's 382 kg of samples, footprints that last millions of years, Earth staying still in the near-side sky). The suit uses 4 air, the walk brings back regolith, dust comes back in on the suit (1 fewer cell tomorrow until the airlock is cleaned, as on Apollo), and nobody goes out on a radiation-alert day (game rules). The lunar night now runs on 5 power cells instead of 6. It ticks Science on the schedule and writes a journal line. Code: `src/farm/moonwalk.ts`, `src/farm/MoonwalkPanel.ts`, `store.moonwalk()`.
- **Moon dust where it really goes (A):** the Moon has no wind, so its dust comes in on boots and wheels. On the Moon it now shows as grey patches on the floor by the airlock (the solar panel stays clean), and the cost is worded as the airlock filters using power. Clean it at the airlock door. Mars keeps its dusty solar panel.
- **Earth phases window (Moon, A):** the habitat's Earth window shows Earth's phase each day, from New Earth to Full Earth and back (a month squeezed into 10 days, full in the middle of the lunar night). Tapping it says the opposite phase people on Earth see; a first-time line gives the real NASA fact ([Moon Phases](https://science.nasa.gov/moon/moon-phases/)). Code: `src/farm/earthPhase.ts`.
- **Artemis radio call (Moon, A):** on day 5 Mission Control sends dated real news: Artemis II flew four astronauts around the Moon, launching 1 April 2026, travelling 252,756 miles from Earth and splashing down 10 April 2026. The text is the `artemis-ii` fact in `public/data/moon/science.json`, checked against the [NASA recap](https://www.nasa.gov/centers-and-facilities/johnson/artemis-ii-mission-milestones-an-image-and-video-recap/); a test makes sure Moon radio letters only use sourced facts.

## Tier 1: must have (by Sun noon)

Small builds with the most effect on the judges. Each one adds a real NASA link.

| # | Feature | Owner | NASA resource | Why judges care |
|---|---|---|---|---|
| 1 | **Training badges.** Earn a badge the first time you show a skill: *Life Support* (keep air up 3 sols), *Power Planner* (no wasted cells), *Radiation Safe* (shelter a storm), *Comms Officer* (read a delayed radio message), *Rover Pilot* (bring Bolt home safely), *Botanist* (harvest 3 crops), *Team Player* (talk to every crew member). Shown on the HUD and in the debrief. | **A** (store and meta logic), **C** (badge UI and icons) | Uses the skills taught by NASA's astronaut training pages: <https://www.nasa.gov/humans-in-space/astronauts/> | Turns "farming game" into a **Mission Trainer** (Relevance). |
| 2 | **Training certificate** at the end: the player's astronaut sprite, the badges earned, the storm week's real DONKI date, and "Print / Save". | **C** | DONKI event record link per storm | Kids take something home (Impact). Makes a strong last slide in the demo (Presentation). |
| 3 | **MOXIE oxygen maker.** A new machine in the dome: 1 power cell turns CO₂ into +air. A fact card says Perseverance's MOXIE made oxygen on Mars, about 122 g over 16 runs **(verify)**. | **A** (machine, rule in `rules.ts`), **C** (fact in `science.json`) | <https://mars.nasa.gov/mars2020/spacecraft/instruments/moxie/> | Real life-support tech in a choice about power vs. air (Validity, Relevance). |
| 4 | **Dusty solar panels.** Some mornings dust covers a panel and you get one fewer cell until someone cleans it (the player, or your pet!). A fact card says dust ended InSight's mission in Dec 2022 **(verify)**. | **A** | InSight mission page <https://mars.nasa.gov/insight/>; weather already uses InSight data | A real risk using data we already have. Gives the pet a second task. |
| 5 | **"What Curiosity saw on this sol."** After each drive, Bolt shows a real rover photo with its sol number and credit. | **B** (fetch and placement), **C** (album UI) | NASA Image and Video Library (already used) or the Mars Rover Photos API on api.nasa.gov (**check it still responds**, fall back to the Image Library) | More real NASA images, tied to the sol mechanic (Validity). |
| 6 | **Teacher and parent guide** (one page): what each sol teaches, NGSS-style links (energy, life science, space science), and a 10-minute classroom activity. | **C** | NASA STEM resources <https://www.nasa.gov/learning-resources/> | Judges look for real-world use (Impact). |
| 7 | **Demo refresh.** Re-record the ≤30 s video or update the ≤7 slides to show the customiser, a badge, MOXIE and the certificate. Keep the AI-music disclosure. | **C** (with A/B for footage) | — | Presentation is a fifth of the score. |

## Tier 2: should have (Sun afternoon, if Tier 1 is green)

| # | Feature | Owner | NASA resource | Notes |
|---|---|---|---|---|
| 8 | **Astronaut daily schedule.** The morning panel shows "Today: farm, exercise, science, sleep". Doing the exercise task (a 10-second treadmill mini-game) keeps the crew happy. Fact: ISS crews exercise about 2 hours a day **(verify)**. | **A** | NASA Human Research Program <https://www.nasa.gov/hrp/> | Pairs with the new sleep feature. |
| 9 | **Crew requests.** Each sol a crew member asks for one thing ("Theo needs 2 mizuna for an experiment") with a short NASA-sourced reason. Completing it gives a badge point. | **A** (logic), **C** (lines in `script.ts`) | Veggie plant growth system <https://www.nasa.gov/missions/station/iss-research/veggie/> | Teamwork skill; reuses crop data. |
| 10 | **Real landing sites on the map.** Pins for Gale (Curiosity), Jezero (Perseverance) and Elysium Planitia (InSight, our dome) with one fact each. | **B** | NASA Mars Trek <https://trek.nasa.gov/mars/> (already credited) | Cheap geography lesson; uses data we already credit. |
| 11 | **Ingenuity scout flight.** Once per mission, spend a cell to fly a tiny helicopter that reveals the next find on the map. Fact: Ingenuity made 72 flights **(verify)**. | **B** | <https://mars.nasa.gov/technology/helicopter/> | Ties into the existing propeller easter egg. |
| 12 | **Rock sample tubes.** Rover samples go into tubes you can label ("dusty", "layered", "shiny"). The debrief compares them with Perseverance's real sample list. | **B** (finds), **C** (debrief) | Mars Sample Return / Perseverance samples <https://mars.nasa.gov/mars-rock-samples/> | Science-practice skill (observe, classify). |
| 13 | **Radiation meter.** During a storm, a dial shows "shelter vs. outside" as a simple comparison. Fact from Curiosity's RAD instrument. | **C** (UI), **A** (value from shelter strength) | RAD <https://mars.nasa.gov/msl/spacecraft/instruments/rad/> | Makes the storm lesson concrete without claiming real doses. |
| 14 | **Accessibility settings.** Text size, reduced motion (no screen shake or flash), colour-blind-safe plot colours, sound and music sliders. | **C** (settings UI), **A** (hooks: camera shake, audio volumes) | — | Impact: playable by more kids. Mention in the submission. |
| 15 | **Astronomy Picture of the Day** in the photo album, cached at build time like the other data. | **C** | APOD via <https://api.nasa.gov/> (use the team's own key, never commit it) | One more NASA API with very little work. |

## Tier 3: stretch (only if everything above ships)

| # | Feature | Owner | NASA resource |
|---|---|---|---|
| 16 | **Mission difficulty:** Cadet (gentle storms) / Specialist / Commander (real storm timing from the busiest DONKI weeks). | A | DONKI (already used) |
| 17 | **Earth call.** Type a short message to Mission Control and watch it travel at light speed with the current Earth–Mars delay; the reply comes back later. | C | JPL Horizons distances (`delay.json`, already used) |
| 18 | **Analog-mission mode** inspired by CHAPEA, NASA's year-long Mars habitat simulation in Houston: a 30-sol "long mission" with crew mood. | A | <https://www.nasa.gov/humans-in-space/chapea/> |
| 19 | **Pet upgrades:** a collar or hat chosen in the customiser; the alien glows at night; the cat warns you before storms (only from real warnings in the data). | A | — |
| 20 | **Night sky:** after sleeping, a short scene shows Earth as a bright "star" from Mars, with a real Curiosity photo of Earth from Mars. | B | NASA Image Library: "Earth from Mars" (PIA17936 **(verify)**) |
| 21 | **Spanish language option** for all UI and story text. | C | — |
| 22 | **Multiplayer classroom board:** a shared high-score/badge board for a class (no accounts, a join code only). | C | — |

## Rules for everyone while building these

1. Every fact needs a NASA source URL in `public/data/` and a visible "real / game" label. If you can't find the source, the fact doesn't ship.
2. Keep to the three meters (Power, Air, Food). New things are **items** or **badges**, never new meters (design rule 1).
3. Stay in your own folders. If you must touch someone else's file, say so in the PR description.
4. No API keys in the repo. Data is fetched at build time with the team's own `.env` key.
5. Run the regression tests, `npm run build` and `await selftest()` before every push.
6. Update `docs/AI_USAGE.md` and `.json` for any AI-generated code, text, art or audio.

## Suggested split for Sunday

| Time | A | B | C |
|---|---|---|---|
| Morning | #1 badge logic, #3 MOXIE, #4 dusty panels | #5 rover photo of the sol | #6 teacher guide, #1 badge UI |
| Midday | #8 schedule, #9 crew requests | #10 landing-site pins | #2 certificate, #13 radiation meter |
| Afternoon | Bug-fix and balance pass | #11 Ingenuity | #7 demo refresh, submission fields |
| 9 p.m. | **Freeze. Submit.** | | |
