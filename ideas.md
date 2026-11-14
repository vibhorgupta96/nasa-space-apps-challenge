# Sol Sprouts: Six Feature Ideas

This shortlist contains proposals, not implementation commitments. Effort tags are relative: **M** medium, **L** large.

## 1. Choose the Moon

At mission start, choose Mars or Moon. Give the Moon its own small map, habitat, goals, and sourced environment information, so it feels like a different destination rather than a Mars reskin.

Lunar play could make sunlight and deep shadow change power and heating choices. NASA explains that the Moon lacks the significant atmosphere that causes Earth-style wind and rain; surface conditions depend strongly on sunlight and shadow. Use destination-specific sources, and label modeled hazards and effects as simulations. [NASA: Weather on the Moon](https://science.nasa.gov/moon/weather-on-the-moon/).

**Smallest useful version:** one lunar site, two light/shadow zones, one rover trip, and a debrief that separates sourced facts from simulated outcomes. **Effort: L.**

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

## Suggested starting point

Driving is a strong first prototype for hands-on variety because the Mars map and rover systems already exist. The Moon is the biggest new setting. Meaningful exploration sites offer the smallest first win. After the control and HUD fixes recorded in [BUGS.md](BUGS.md), regression-check keyboard, touch, rover, and HUD behavior as new features are prototyped.
