# Bugs and plan gaps

## Fix status — 14 Nov 2026 (branch `a/farm`)

Fixed on `a/farm` after merging `main` at 807b460. **Verified** = checked in the local dev build (in-app browser, real clicks/keys where it says so) or by the self-test; *code* = fixed but only typecheck/build-checked.

| Bug | Fix | Files (owner) | Verified |
|---|---|---|---|
| B1 crew traps player | Crew avoid every tile the player's body/feet touch. | `FarmScene.ts` (A) | Player at (14,6) lower half: (14,7) now off-limits to crew |
| B2 morning panel needs a mouse | ↑↓ (or W/S) pick a row, ←→ (A/D, −/+) remove/add, Enter/Space/E start the day; on-panel key hint. | `UIScene.ts` (C) | Keys alone set the split and started sol 1 |
| B3 no touch/tablet play | Tap anywhere to walk there; tap a plot, machine or crew member to walk up and use it. Help screen 1 mentions tapping. | `FarmScene.ts` (A), `help-pages.mjs` (C) | Real click walked the player to tile (16,7) |
| B4 photos repeat | Only newly earned photos are shown; when the album is full, a toast says so. Per-sol finds now hold 1 sample, not 2. | `UIScene.ts` (C), `findsManager.ts` (B) | *code* (find mix checked) |
| B5 board says 1:00 pm | Board uses the same clock as the HUD (2:00 pm). | `UIScene.ts` (C) | *code* |
| B6 useless "parts" | Per-sol finds no longer drop parts (only the propeller egg does); text reads "1 mystery part(s)". | `findsManager.ts` (B), `director.ts` (C) | Find mix: ice, regolith, seed, ice, regolith, sample, ice, regolith |
| B7 no seed drops | Each sol has a 2-seed supply drop near the dome. | `findsManager.ts` (B) | Same as B6 |
| B8 stale route after return | Route clears when Bolt gets home. | `RoverScene.ts` (B) | Route back to 1 square after return |
| B9 finds vanish overnight | A trip uses, and the map shows, the finds of the sol Bolt launched on. | `store.ts` (A), `RoverScene.ts` (B) | *code* |
| B10 rover lost at mission end | The crew calls Bolt home with the cargo; the night report says so. | `store.ts` (A), `UIScene.ts` (C) | Launched on sol 10 at dusk → debrief with Bolt home, `roverCalledHome` true |
| B11 wasted cells | Starting with unused cells needs a second press ("N cells unused! Start again…"); rover cells are refused when Bolt can't drive. | `UIScene.ts` (C), `PowerPanel.ts` (A), `store.ts` (A) | First Enter warned, second started |
| B12 only first storm shown | HUD and rover map list every pending storm. | `UIScene.ts` (C), `RoverScene.ts` (B) | *code* |
| B13 wake listeners pile up | Listeners removed on shutdown. | `FarmScene.ts` (A), `RoverScene.ts` (B) | *code* |
| B14 HUD click-through | Invisible blockers over the HUD panels and hotbar (hotbar blocker and slots switch off on the rover map). | `UIScene.ts` (C) | Real click on HUD hit the blocker; farm got nothing |
| B15 credit line adds stops | Map clicks ignored below y 570. | `RoverScene.ts` (B) | *code* |
| B16 science context lost on reload | Already fixed by Vibhor on `main` (`scienceContext` in the save). | — | Vibhor's self-test checks |
| B17 heater never optional | `heaterNeededBelowC` −70 → −97 °C (PLAN.md section 6 updated): now only sols 3, 4 and 10 need it. Self-test check 1 finds a cold sol instead of assuming sol 1. | `rules.ts` (A), PLAN.md | Self-test 13/13 |
| B20 GST shown as raw "GST" | Board and debrief say "Geomagnetic storm at Earth (GST)". | `UIScene.ts`, `DebriefScene.ts` (C) | *code* |
| B21 rover buttons dead | Root cause: the panel container had scroll factor 0 but its buttons didn't, so their hit areas moved with the scrolled map. Every panel object is now pinned to the screen. | `RoverScene.ts` (B) | Real clicks: Undo, Return and Send all work |
| B22 radio overflow | Delay rounded to 0.1 minute; long dialogue lines shrink (down to 16 px) to fit the box. | `UIScene.ts` (C) | Long storm radio line fits at 18 px |
| B23 HUD hides the room | The farm camera can scroll 96 px above and 64 px below the map, so the top machines and bottom beds move out from under the HUD and hotbar. | `FarmScene.ts` (A) | Camera view top at y −36 near the top wall |

**Still open (need data or a decision, not code):**

- **B18:** only 7 InSight sols for 10 game sols. Needs more weather sols in `weather.json` (C, `npm run fetch-data`).
- **B19:** `storms.json` has one storm week, so every replay has the same storms. Needs more weeks from the fetch script (C).
- **B20 (data part):** the sol-9 storm is an Earth GST record. Swap it for a CME/SEP record in the fetch script (C); the label fix above only makes it honest.
- **Part 2 plan gaps** (G1–G19) are unchanged except G3 (done) and G9 (heater, done via B17).

Cross-folder edits in this fix (PLAN.md section 13 asks owners to review): `UIScene.ts`, `DebriefScene.ts`, `director.ts`, `help-pages.mjs` (C); `RoverScene.ts`, `findsManager.ts` (B).

---

## Current browser playtest — 14 Nov 2026

Tested the deployed game at <https://vibhorgupta96.github.io/nasa-space-apps-challenge/> in the in-app browser (747 × 987 viewport). This verifies current deployed behavior; the tested deployment revision was not identified, so it is not claimed to match local `e97aec46657223a75e63d88f7697081d51e96805`.

**Reproduced:**

- **B2 (high):** On the Sol 1 morning panel, keyboard Return, Space, Tab, and an arrow key did not allocate cells or start the day. The mouse `+` controls and “Start the day” button worked. This confirms the keyboard blocker described below.
- **B14 (low):** Clicking the top-left weather/HUD panel during the day also triggered the farm action beneath it; the game logged “Walk closer to use that.”
- **B11 (medium, clarify):** With 2 grow-light cells, 1 heater cell, and 1 rover cell allocated, the panel allowed the day to start with 2 cells unused. The panel does disclose that unused cells are wasted, so the issue is that starting with unused cells is permitted, not that the waste is undisclosed.
- **B21 (high): Rover planning buttons do not respond.** Start a day with rover power, enter the rover map through the airlock, then click a map tile two squares from the dome. The route updates (2 squares, 0.2 cells, 0:08), but **Return** leaves it unchanged instead of routing back to the dome. Manually clicking the dome grows it to 4 squares; **Send Bolt** still leaves Bolt “ready · 1 cell”, and **Undo** does not remove the route. The buttons were tested at their visible centers, with no modal or other overlay; the result repeated after leaving and reopening the map. Expected: Return ends the route at the dome, Send launches, and Undo removes the last leg. **Where:** `src/scenes/RoverScene.ts` (`buildPanel`, `planUi`). Root cause not established.
- **B22 (low): Radio dialogue overflows with an unrounded delay.** During the first storm warning/radio delivery, the dialogue included `11.018003348094977` light-minutes. The footer wrapped below the dialogue panel into the hotbar area. Expected: a readable rounded delay that fits inside the dialogue. **Where:** `src/ui/UIScene.ts` (`RADIO_MESSAGE` handler, raw `delayMinutes`).

**User-reported follow-up:**

- **B23 (medium): The status HUDs obscure the room while moving.** Walk around the upper part of the farm beneath the top-left and top-right HUDs. The user reports that the room area beneath those panels cannot be seen while moving. Expected: the room remains visible and usable around the HUDs, for example by adjusting HUD placement or the camera's visible area. **Where:** `src/ui/UIScene.ts` (`buildHud`, fixed top-corner panels); `src/scenes/FarmScene.ts` (zoomed camera follows the player). This is a visual occlusion report, separate from B14's click-through behavior. The HUD and camera layout in source support the report; it was not separately reproduced in this browser session.

**Also exercised successfully:** mission start and dialogue dismissal, WASD movement, planting (seed 24→23 and water 48→47), keyboard Return advancing the help pages, and reload/Continue restoring the planted crop, inventory, and mission day.

**Coverage limits:** This was not a full 10-sol playthrough. Harvesting, storm impact, mobile/touch controls, mission ending, and a successful rover delivery were not verified. The automated build and regression suite passed locally: `npm run build` and `node --experimental-strip-types --test scripts/science.test.mjs scripts/fetch-nasa-data.test.mjs src/ui/source-list.test.mjs src/ui/help-pages.test.mjs` (21 tests).

---

## Historical review and plan gaps

The entries below come from a review of `a/farm` at e50f55c (base game + Person A work + Shresth's rover commit from `main`), 14 Nov 2026. They are historical findings, not a claim that every listed item was revalidated in the current browser playtest.
Updated after merging `main` with Vibhor's real NASA data (PR #1): see B4, B19, B20 and G3.

**Owner** = workstream that owns the file (PLAN.md section 4). **Checked** = how it was confirmed:
*ran* (reproduced in the browser), *math* (worked out from the code's own numbers), *read* (code reading only, not yet reproduced).

Already fixed on `a/farm` and not listed below: pressing Escape on a dialogue line that was still typing crashed the game loop (`src/ui/UIScene.ts`).

---

## Part 1: Bugs

### High: a kid will hit these

| # | Bug | Where | Owner | Checked |
|---|---|---|---|---|
| B1 | **A crew member can trap the player.** `wander` only avoids the player's centre tile. The player's collision box (feet) reaches into the tile below, so a crew member can step there. Then every move is blocked until that crew member wanders off, which may take several seconds or longer. | `src/scenes/FarmScene.ts:179` (`wander`), `blocked()` at :253 | A | ran: player at (14,6) lower half + solid at (14,7) → blocked left, right and up |
| B2 | **The morning panel can't be finished with the keyboard.** `buildMorning` never sets `this.advance`, so Enter/Space do nothing. The +/– buttons, drag cells and "Start the day" button are mouse-only. A keyboard-only player is stuck on sol 1 morning. | `src/ui/UIScene.ts:376–440` | C (A's PowerPanel adds to it) | read |
| B3 | **The game can't be played on a tablet or phone.** Walking and acting only work with the keyboard (arrows/WASD + Space). There are no on-screen controls, and tap-to-move doesn't exist. A lot of 7–12-year-olds will open the link on a tablet. | `src/scenes/FarmScene.ts:225` (`movePlayer`) | A | read |
| B4 | **Photos repeat as "New photo!" once the 12 are used up.** Shresth's per-sol finds add 2 rock samples every sol (20 over a mission), plus 3 fixed ones, but the real `photos.json` now on `main` has only 6 photos (the mock had 12). After that, `awardPhotos` adds nothing, and `queuePhotos` shows the last earned photo again as new. | `src/rover/findsManager.ts:9`, `src/core/store.ts:482`, `src/ui/UIScene.ts:563` | B + C | ran: every sol's finds are `ice, regolith, parts, sample` ×2; 6 photos on `main` |

### Medium: wrong or confusing, but playable

| # | Bug | Where | Owner | Checked |
|---|---|---|---|---|
| B5 | **The storm board says storms hit at "1:00 pm", but the HUD clock shows 2:00 pm at that moment.** A storm hits halfway through the day; `hourLabel(0.5)` is "2:00 pm". | `src/ui/UIScene.ts:507` | C | ran: `hourLabel(0.5)` → "2:00 pm" |
| B6 | **"Parts" pickups do nothing and are invisible.** The new per-sol finds include 2 `parts` every sol. Parts have no use anywhere, the HUD inventory doesn't show them, and the messages read "Bolt found 1 parts." and "…1 a mystery part…". | `src/rover/findsManager.ts:9`, `src/ui/UIScene.ts:86, 200`, `src/story/director.ts:10` | B + C | read |
| B7 | **Per-sol finds never include seeds.** Only the 2 fixed supply drops refill seeds. The new random finds cycle ice/regolith/parts/sample, so the supply-drop find in the plan barely exists. | `src/rover/findsManager.ts:9` | B | ran (same output as B4) |
| B8 | **After Bolt gets home, the old route is still drawn as the new plan.** `send()` keeps `this.route`, so the map shows yesterday's path in yellow and "Send" would reuse it. It's only cleared when you leave and re-enter the map. | `src/scenes/RoverScene.ts:188` | B | read |
| B9 | **Random finds vanish at midnight.** The per-sol finds are regenerated each sol, so a find that Bolt is driving toward overnight disappears, and the rover can pick up the next sol's finds on the same trip. | `src/rover/findsManager.ts`, `src/core/store.ts` (`collectRoverFind`) | B | read |
| B10 | **A rover still out when the mission ends loses its cargo with no message.** If the last night (or a rescue) comes while Bolt is out, the cargo and the trip just disappear. | `src/core/store.ts:652` (`endDay`) | A | read |
| B11 | **You can start the day with 0 cells placed, or put cells in the rover slot when Bolt can't drive.** The morning panel says unused cells are wasted, but still allows the day to start with unused cells; assigning rover power while Bolt cannot drive can also waste power. | `src/ui/UIScene.ts:392, 436` | C | ran: started day with 2 of 6 cells unallocated; panel disclosed waste |
| B12 | **The HUD storm alert and rover screen only show the first pending storm.** The plan asks for a countdown for every pending warning. | `src/ui/UIScene.ts` (`update`), `src/scenes/RoverScene.ts:282` | C + B | read |

### Low: small or cosmetic

| # | Bug | Where | Owner | Checked |
|---|---|---|---|---|
| B13 | **`wake` listeners pile up.** Each Play again adds another `wake` handler to Farm and Rover (scene events survive a restart). Harmless today: fades and route resets just run more than once. | `src/scenes/FarmScene.ts:89`, `src/scenes/RoverScene.ts:82` | A + B | read |
| B14 | **Clicking on the HUD panels in the farm acts on the world underneath** (usually "Walk closer to use that."), because the HUD isn't interactive and the click falls through. | `src/scenes/FarmScene.ts:77` | A | read |
| B15 | **Clicking just above the rover panel (the credit line) adds a route stop**, because the cut-off is `p.y > 600` and the credit text sits at about y 585–600. | `src/scenes/RoverScene.ts:70` | B | read |
| B16 | **Reloading mid-day forgets today's science-card context** (harvests, storm, rover trip), so that night's card can differ from what you'd have seen. | `src/core/store.ts` (`restore` → `resetToday`) | A | read |
| B17 | **The heater is never optional with the current data.** All 7 InSight sols have a minimum near −96 °C, below the −70 °C threshold, so the "is it cold tonight?" decision never comes up. See also G9. | `public/data/weather.json`, `src/core/rules.ts` | A + C | math |
| B18 | **The 7 weather sols repeat over 10 game sols**, so sols 8–10 replay sols 1–3. Still true with the real data on `main`. | `src/core/store.ts` (`weather`) | C | math |

### Found after merging the real data from `main`

| # | Bug | Where | Owner | Checked |
|---|---|---|---|---|
| B19 | **"Play again" always gives the same storms.** The real `storms.json` has only 1 week (2024-05); the mock had 2. `newGame` rotates through weeks, so every replay is identical, which breaks design rule 5 ("replay with a different storm week"). | `public/data/storms.json`, `scripts/fetch-nasa-data.mjs` | C | ran: 1 week in the file |
| B20 | **An Earth geomagnetic storm (GST) is used as a Mars storm.** The 2024-05 week's sol-9 storm is `…-GST-001`. The plan says GST is Earth context only (shown in the debrief), not an outpost storm. The board and debrief also print the raw word "GST" because they only have labels for CME and SEP. | `public/data/storms.json`, `src/ui/UIScene.ts` (`buildBoard`), `src/scenes/DebriefScene.ts` | C | ran |

---

## Part 2: Gaps in the original plan (PLAN.md)

### Things the plan asks for that aren't built yet

| # | Gap | Plan section | Owner |
|---|---|---|---|
| G1 | **No audio at all.** There's no music, storm loop or sound effects (asset rows 31–33). | 9 | C |
| G2 | **No public deploy.** There's no GitHub Pages workflow, so there's no game URL for the submission yet. | 3, 8, 10 | A/B (playtest + deploy slot) |
| G3 | ~~Real storm and weather data are still mock.~~ **Done on `main`** (PR #1): no data file is mock now. What's left is in B19 and B20. | 4C, 7 | C |
| G4 | **How-to-play is a single panel**, not the "3 short screens" in the plan. | 4C | C |
| G5 | **Free drive (arrow keys) is not built.** It's optional and on the cut list. | 4B, 8 | B |
| G6 | **No dust-storm overlay; the solar storm effect is just a flash.** Asset rows 28–29. | 9 | B + C |
| G7 | **OSDR is not used.** The plan lists OSDR for seed-packet facts; crops come from the Image Library only. Either use it or drop it from the plan and credits. | 3, 4C | C |
| G8 | **None of the submission work is done:** demo video, project page, every section 10 box, and the asset table (Owner/Source/AI/Status columns are empty). Section 8 event details are still UNCONFIRMED. | 8, 9, 10 | C + Team Owner |

### Holes and contradictions in the plan itself

| # | Gap | Plan section |
|---|---|---|
| G9 | **The heater threshold (−70 °C) doesn't fit the data.** Every archived InSight minimum is about −96 °C, so the heater is always required and never a choice. Pick a threshold between the sols' actual minimums, or choose sols with a spread. | 6 |
| G10 | **`parts` is an item with no purpose.** It's in `ItemId`, the icon list and the finds, but no rule uses it. Give it a job (e.g., repair the rover faster, or build something) or remove it. | 5, 6 |
| G11 | **The plan doesn't say how many photos a mission can earn.** The new random finds make samples far more common than the 12 photos. | 4B, 4C, 7 |
| G12 | **No rule for a rover still out at the last night or a rescue** (cargo, trip count, story line). | 6 |
| G13 | **No rule for a rover out overnight.** Per-sol finds change and the planned target can disappear (B9). Should the route keep going, or should Bolt come home at dusk? | 6 |
| G14 | **Kid accessibility isn't in the plan:** no keyboard-only path (B2), no touch controls (B3), no text-size or colour-blind notes. The judging rubric scores usability. | 2, 11 |
| G15 | **The plan says "640×360 game canvas"; the build uses 1280×720 with a 2× world zoom** (same view, sharper text). Update the plan so agents don't "fix" it back. | 3 |
| G16 | **Plan examples don't match the data.** E.g., the crops schema example has romaine at 4 sols / 20 food; the data has 3 / 18. Mark examples as examples, or sync them. | 7 |
| G17 | **Folder ownership was crossed both ways.** Shresth's rover commit (5dbfab5) edits `src/core/store.ts` (A's folder), and A's branch edits `src/ui/UIScene.ts` (C's) for the drag-cell hook-up and the Escape crash fix. The plan says to ask the owner first, so the owners should review these. | 4, 13 |
| G18 | **AI-usage disclosure vs the guide's idea rule.** `docs/AI_USAGE.md` truthfully says an AI suggested game concepts the team picked from. The plan quotes the guide as saying AI shouldn't originate the solution idea. The Team Owner should read that page of the guide and confirm how to answer, without changing the history. Vibhor's PR #1 also records OpenAI Codex use, which must be merged into the disclosure. | 9, 10 |
| G19 | **The plan says "verify each fact and link the source" for crops but has no step for re-checking links before submission** beyond "test every link". Add the data `source` URLs and the in-game links (DONKI records, photo pages) to that check. | 4C, 8 |
