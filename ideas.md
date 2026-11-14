# Sol Sprouts: Feature Ideas

This shortlist contains proposals, not implementation commitments. Effort tags are relative: **M** medium, **L** large.

## 1. Choose the Moon

At mission start, choose Mars or Moon. Give the Moon its own small map, habitat, goals, and sourced environment information, so it feels like a different destination rather than a Mars reskin.

Lunar play could make sunlight and deep shadow change power and heating choices. NASA explains that the Moon lacks the significant atmosphere that causes Earth-style wind and rain; surface conditions depend strongly on sunlight and shadow. Use destination-specific sources, and label modeled hazards and effects as simulations. [NASA: Weather on the Moon](https://science.nasa.gov/moon/weather-on-the-moon/).

**Smallest useful version:** one lunar site, two light/shadow zones, one rover trip, and a debrief that separates sourced facts from simulated outcomes. **Effort: L.**

**Music ready:** the lunar theme is `public/audio/moon-theme.mp3`, an upbeat 61-second AI-generated loop supplied by Muskan. It isn't used in the game yet; play it instead of "Mars Morning" when the player picks the Moon.

## 2. Drive a crewed rover

At an expedition, choose whether to send Bolt on the existing autonomous route or ride out in a crewed rover yourself. Add simple top-down steering, braking, and reversing on the current map; share battery, storm, cargo, and return rules with Bolt’s trips.

This adds hands-on exploration while preserving the choice to let Bolt handle a route. Crew jobs could help tend the farm while the player is away. Show a safe return estimate and forgiving assist controls.

**Smallest useful version:** drive to one nearby find and return. **Effort: L.**

## 3. Explore meaningful sites

Make map stops feel like destinations, with a clear reason to visit: a rock sample, an ice clue, a terrain feature, or a photograph. At a few stops, offer a tiny activity such as photographing a feature or matching a sample to a sourced fact.

Use returned samples and discoveries in the existing photo collection and debrief. Activities should teach one idea and preserve the distinction between observation and simulation.

**Smallest useful version:** two named stops, one short sample activity, and one sourced debrief entry. **Effort: M.**

## 4. Earn parts, buy upgrades

Introduce parts as a clear reward for exploration, then let players spend them on an optional upgrade such as better route information, a rover repair, or a habitat improvement. Show the cost and benefit before choosing.

Routine trips do not currently award parts; the propeller mystery find is a one-off. Keep new parts rewards explicit and separate from the existing regolith-based shield crafting; do not turn upgrades into a new resource meter.

**Smallest useful version:** one new exploration reward, one purchase, and one visible effect. **Effort: M.**

## 5. Give crew helpful jobs

Let players assign a simple, reversible role such as garden helper, equipment checker, or map reader. A garden helper could keep one basic task going during a crewed rover drive, connecting exploration to care for the unattended habitat.

Explain what each job does and keep choices forgiving. Existing crew conversations can introduce roles and respond to discoveries.

**Smallest useful version:** two roles, including garden help during one drive. **Effort: M.**

## 6. Replayable mission challenges

Alongside the current ten-sol mission, offer a few short challenge cards with a clear goal, starting supplies, and a sourced scenario context. Examples could focus on getting a rover home before a simulated storm or keeping crops healthy through a cold stretch.

Reuse the existing power choices, crops, rover, and debrief so each challenge feels different without requiring a new game mode from scratch. Keep sourced historical context dated and explain which outcomes are simulated.

**Smallest useful version:** two replayable challenges with distinct goals and a short results screen. **Effort: M.**

## Teaching ideas (from Person A)

Ideas 7–13 aim at the 2025 Global Award categories that fit us best: Best Use of Storytelling, Art & Technology (won by a NASA-data farming project), Local Impact and Most Inspirational. Each one should leave a kid with something they can *say out loud* after playing. The full plan and an A/B/C split are in [WINNING_PLAN.md](WINNING_PLAN.md); the wider backlog is in [FEATURES.md](FEATURES.md).

## 7. One lesson per sol: See it, Try it, Say it

Give every sol a single learning goal taught in three beats. **See it:** a short sourced card in the morning panel. **Try it:** the in-game action that uses the idea. **Say it:** one tap-to-answer question in the night report. A wrong answer kindly shows the right one; nobody fails.

Example goals: plants need light, water and warmth ([NASA Veggie](https://www.nasa.gov/missions/station/iss-research/veggie/)); a sol is longer than a day; solar storms come from the Sun (DONKI); Mars is very cold ([InSight](https://mars.nasa.gov/insight/)); messages take minutes; water from ice; making oxygen ([MOXIE](https://mars.nasa.gov/mars2020/spacecraft/instruments/moxie/)); robots explore first; a balanced diet; planning as a team. Lessons live in `public/data/lessons.json` with a source and a real/game label on each.

**Smallest useful version:** three sols with a See/Try/Say lesson. **Effort: M.**

## 8. Training badges and a Junior Astronaut certificate

Each correct Say-it answer earns a badge (Botanist, Storm Watcher, Water Finder, and so on). The debrief turns the badges into a printable certificate with the player's customised astronaut and name. This gives kids something to take home and gives the demo a clear ending.

**Smallest useful version:** badge row in the debrief and a print-friendly certificate page. **Effort: M.**

## 9. Pre/post quiz to show learning

An optional five-question quiz at the title screen, repeated in the debrief, ends with "You learned 4 new things!". It gives judges a measured learning gain. A short test with a few kids or one class gives us a real number and a quote for the submission.

**Smallest useful version:** five questions reused from the Say-it checks, with a score before and after. **Effort: S–M.**

## 10. Mission journal (storytelling)

At the end of each sol, write one journal line from the player's own choices: "Sol 3: The storm came from the Sun. I gave the shelter 3 cells. Everyone was safe." Crew members each own a topic (Sun and storms, plants and food, power and machines, robots and maps) and ask that sol's question. The debrief shows the whole journal as the player's mission story. Real storms keep their dated anchor ("This storm really happened on 10 May 2024").

**Smallest useful version:** one auto-written line per sol, shown in the night report and the debrief. **Effort: M.**

## 11. Your sky vs Mars sky (local relevance)

The player picks their city from a list (no location access). A card compares a typical temperature there with an archived Mars temperature from InSight, and asks whether the May 2024 storm made auroras near them. The debrief suggests growing lettuce or radish at home or in class, linking NASA classroom growing resources (check the exact link before shipping).

**Smallest useful version:** ten preset cities and one comparison card. **Effort: S–M.**

## 12. Kitchen and balanced meals (done on `a/farm`)

Harvests now go to a pantry. Recipes such as Space Salad, Radish Wraps and Mars Chile Tacos feed the crew more than eating crops raw, and the zinnia recipe returns seeds rather than inventing air. This gives each seed type a purpose and supports a "why plant different crops?" lesson. Food values are game rules and are labelled that way.

**Next step:** tie it to the sol 9 lesson and show "meals cooked" in the journal. **Effort: S.**

## 13. Small science mechanics that teach one fact each

- **Dusty solar panels:** dust slowly lowers power until the player brushes the panels. This teaches why dust matters for solar power on Mars. The dust rate is simulated.
- **MOXIE-style oxygen maker:** a machine that turns carbon dioxide into a little air, sourced to [MOXIE](https://mars.nasa.gov/mars2020/spacecraft/instruments/moxie/). Output is simulated.
- **Rover photo of the sol:** each rover trip brings back one real rover image with its date and mission, building on the existing photo collection. Fits idea 3.

Each mechanic must stay inside the three meters (Power, Air, Food). **Effort: S each.**

## Suggested starting point

Driving is a strong first prototype for hands-on variety because the Mars map and rover systems already exist. The Moon is the biggest new setting. Meaningful exploration sites offer the smallest first win. After the control and HUD fixes recorded in [BUGS.md](BUGS.md), regression-check keyboard, touch, rover, and HUD behavior as new features are prototyped.

With the deadline on Sunday night, Person A suggests building ideas 7, 8 and 10 first: they reuse screens we already have (morning panel, night report, debrief) and are what the Storytelling and Inspirational judges will see in the demo. Ideas 1, 2 and 6 are large; keep them for after the hackathon unless the teaching spine is finished early.
