# Plan: tune Sprout Station towards a Global Award (teaching first)

Plan only, no implementation. It sharpens FEATURES.md; where they disagree, this file wins.

## What the 2025 Global Winners tell us

Source: <https://www.spaceappschallenge.org/2025/awards/global-winners/>. The ten award categories and winners: Galactic Impact (Astro Sweepers), Global Connection (Gaia+LEO), **Best Use of Storytelling (HerCode Space, "Stellar Stories: Space Weather Through the Eyes of Earthlings")**, Most Inspirational (Photonics Odyssey), **Best Mission Concept (PureFlow, "Your Home in Space: Habitat Layout Creator")**, **Local Impact (QUEÑARIS, BloomWatch flowering phenology)**, Best Use of Data (Resonant Exoplanets), Best Use of Science (SpaceGenes+), Best Use of Technology (Twisters), **Art & Technology (Zumorroda-X, "NASA Farm Navigators: NASA data in agriculture")**.

The individual project pages didn't load for us, so the lessons below come from the titles and challenges only. They are our own inference:

1. Space weather told as a **story people feel**, rather than a chart, won Storytelling. That's our storm mechanic.
2. **Farming with NASA data** won Art & Technology. That's our core loop.
3. A **habitat you plan yourself** won Mission Concept. That's our dome.
4. **Local relevance** won its own award: connect the science to the player's own place.

Our best award targets are **Storytelling**, **Art & Technology**, **Local Impact** and **Most Inspirational**. Every change below aims to make kids *learn something they can say out loud afterwards*.

## The teaching spine (the main change)

Give every sol **one learning goal**, taught in three beats: **See it → Try it → Say it**.

| Sol | Kids learn | See it (NASA source) | Try it (in game) | Say it (1-question check) |
|---|---|---|---|---|
| 1 | Plants need light, water, warmth | Veggie on the ISS | Plant and water | "What 3 things does a plant need?" |
| 2 | A sol is longer than a day | Mars facts | Watch the clock | "Is a sol longer or shorter than a day?" |
| 3 | The Sun has storms | DONKI CME record (real date) | Shelter the crew | "Where do solar storms come from?" |
| 4 | Mars is very cold | InSight weather | Heater choice | "Why do plants need a heater on Mars?" |
| 5 | Messages take minutes | Earth–Mars delay (JPL Horizons) | Delayed radio | "Why can't Mars call Earth instantly?" |
| 6 | Water from ice | Phoenix ice finding | Melter, dog's trick | "Where can astronauts find water on Mars?" |
| 7 | Making oxygen | MOXIE | Air meter | "How can we make air on Mars?" |
| 8 | Robots explore first | Curiosity/Perseverance photo | Rover trip | "Why send a rover before people?" |
| 9 | A balanced diet | Space crops | Kitchen recipes | "Why plant different crops?" |
| 10 | Teamwork and planning | Crew roles | Final storm | "What would you change next time?" |

- **Say it** is a single tap-to-answer question in the night report. A wrong answer shows the right one kindly; you never fail.
- Each correct answer earns a **training badge**. The debrief turns badges into a **printable Junior Astronaut certificate**.
- Add an optional **2-minute pre/post quiz** (the same 5 questions at the title and in the debrief). The debrief then shows "You learned 4 new things!" That gives judges a **measured learning gain** (Impact). One test class or a few kids' results makes a strong line in the submission.

## Storytelling (target: Best Use of Storytelling)

- **Frame:** you're a trainee astronaut keeping a mission journal. Each sol ends with one auto-written journal line in the player's own words, built from their choices ("Sol 3: The storm came from the Sun. I gave the shelter 3 cells. Everyone was safe.").
- **Crew roles teach.** Each crew member owns a topic: Rosa covers the Sun and storms, Theo plants and food, Priya power and machines, and Bolt robots and maps. Each crew member asks one question per sol, which is the "Say it" check.
- **Real anchor:** "This storm really happened on 10 May 2024. On Earth it made auroras." Keep the "real vs game" labels.

## Local relevance (target: Local Impact)

- **"Your sky vs Mars sky" card:** the player picks their city (no location access, just a list). One card compares today's Mars temperature (InSight archive) with a typical temperature in their city, plus "Did the May 2024 storm make auroras near you?"
- **Farm at home:** the debrief suggests growing one of the space crops (lettuce or radish) at home or in class, with the NASA "Growing Beyond Earth" classroom link (verify the link before shipping).

## Art & Technology / Most Inspirational

- Keep the cozy pixel style, music, customised astronaut and pet. Kids see *themselves* on Mars.
- **30-second demo:** the kid customises an astronaut → a storm warning arrives with the real date → kid shelters the crew → cooks Mars Chile Tacos → certificate. Narrated by what the kid learned, not by features.
- **Accessibility as inspiration:** text size, reduced motion, mute, colour-blind-safe plots, and later Spanish.

## Cut or freeze (to protect the deadline)

- Freeze new mechanics after the kitchen. No Ingenuity, sample tubes, multiplayer or night-sky scenes.
- Every remaining hour goes into the teaching spine (questions, badges, certificate, journal), the demo and the submission text.

## Who does what (no code until the team agrees)

| Owner | Task |
|---|---|
| **C** | Write the 10 learning goals and 10 questions with NASA sources (`public/data/lessons.json`). Write the night-report question UI, the certificate, the city card, the teacher guide and the submission text that leads with learning. |
| **A** | ✅ Done on `a/farm`: lesson state (answers, badges, pre/post quiz score), journal lines, and the "Say it" question: the pet brings it once a sol and a right answer wins a Wiz Card plus a pet reward (players without a pet get it after the night report). The morning-panel lesson banner was removed because it cluttered the panel. The 10 lessons are in `src/core/training.ts`. C can reword them or move them into `public/data/lessons.json`. |
| **B** | Rover lesson (sol 8) with a real rover photo, and a map label for the dome site and Gale/Jezero. |
| **All** | Record the 30-second demo, test with 2–3 real kids if possible, and quote one sentence they said. |

## How we'll know it works

- A kid can answer at least 7 of the 10 questions after one playthrough. Check with the pre/post quiz.
- Every fact on screen links to a NASA source and is labelled real or game.
- `await selftest()` and `await playtest()` pass, and the demo fits in 30 seconds.
