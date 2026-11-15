# Validation status

## Mobile readability and keyboard navigation — 2026-11-15

- TypeScript and Vite production build passed. All 78 automated tests passed, including five reader regressions for hidden descendants, action labels/callbacks, full dialogue text, source links versus passive text, and selected appearance choices. `git diff --check` passed.
- Added an HTML reading view with wrapping text and native controls, mobile-open by default; configurable canvas enlargement with native pan buttons; canvas-only gameplay keys with blur resets; and B in place of Tab for the environment board.
- Independent diff review found touch panning, missing power allocation counts, hidden modal notifications, and missing selected-state semantics. All four were repaired and independently rechecked with no remaining blocking findings.
- Browser preview startup was observed on desktop. Browser tooling became unavailable before narrow-screen, zoom, keyboard-flow, or native touch checks could finish. No claim of full screen-reader compatibility or accessibility across all devices is made. Farm/map gameplay remains spatial and canvas-based.
- Changes have not been published or deployed.

## Latest main and Moon training integration — 2026-11-14

- Regression suite passed (56/56), including 19 Mars nested self-checks. TypeScript type check, Vite production build, and `git diff --check` passed.
- Browser checks verified Moon day 1 and day 2 quizzes, sourced Moon Wiz Cards (2/10 remained visible after reload, including the NASA 29.5-day lunar-cycle fact), and duplicate pet use without an extra reward. Moon pet rewards use habitat-supply wording without Mars or Phoenix claims.
- The power planner's unused-cell and start-confirmation messages fit without overlapping the Start button. Rover `C` still toggles the map without opening Wiz Cards. Sleeping advanced Moon day 1 to day 2 and updated the journal. The water oxygen maker increased air from 90 to 96, consumed one water and one spare cell, and awarded its badge.
- The astronaut name editor was browser-tested with Save, Cancel, Enter, and Esc. The saved name appeared correctly, and using the DOM editor no longer changed the selected suit through Phaser click-through.
- The rendered terminal certificate and archived first-world tabs were not manually reached. Core/training tests cover the underlying archive and content behavior; they do not constitute a visual check of those screens.

Checked for the two-world campaign change on 2026-11-14:

- Regression tests passed (43 tests): `node --experimental-strip-types --test scripts/*.test.mjs src/ui/*.test.mjs src/story/*.test.mjs`. This includes thirteen core test groups, 16 Mars self-checks, world-specific cooking, pantry and retired-storm save migration, and travel/retry with unavailable storage, rover route-cost parity on both worlds, screen-space controls, movement and cooldown/pause checks, help content, and world-aware story checks.
- Production type check and Vite build passed using installed x64 Node.
- `git diff --check` passed.
- Browser check on the pre-integration working tree after the rover panel fix: on both Mars and Moon, Return completed the four-tile route, Send Bolt launched it, and Inside returned to the farm. The trips returned home successfully; Moon gained its dust level. No browser-console warnings or errors were observed.
- Pre-integration browser spot checks also verified Moon selection, planting and crop water/tooltips, Hop, help pausing, day 1 to day 2, save/continue, and cancellation of the new-campaign confirmation. Full campaign travel/finale and a complete ten-day browser playthrough were not manually tested; campaign simulation tests cover both world orders.
- On the integrated branch, Moon selection survived the astronaut customiser; the selected appearance and dog appeared on the lunar farm. The Moon kitchen showed five lunar crops and four lunar recipes. Walking and sleeping advanced day 1 to day 2. After the final camera change, lunar terrain rendered gray, Return planned a four-step, 0.4-cell, 20-second rover round trip, Send Bolt launched, and Inside returned to the farm while Bolt was driving. No browser-console warnings or errors were observed. Full campaign travel and finale were not manually tested on the integrated branch.
- The integrated branch has not been deployed; earlier browser checks do not by themselves verify integration with newer main-branch features.

The earlier release deployment, demonstration artifacts, and CI evidence are recorded for revision `fee644e4c44a440c4f80ab27e9fd55511a17e9c8`, including [GitHub Actions run 43575325635](https://github.com/vibhorgupta96/nasa-space-apps-challenge/actions/runs/43575325635). Team review of project eligibility, AI disclosure, references, and submission answers remains unverified.
