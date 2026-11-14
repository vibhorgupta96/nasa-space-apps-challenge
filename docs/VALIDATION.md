# Validation status

Checked for the current source revision on 2026-11-14:

- Regression suite passed: `node --experimental-strip-types --test scripts/science.test.mjs scripts/fetch-nasa-data.test.mjs src/ui/source-list.test.mjs src/ui/help-pages.test.mjs` (21 tests).
- Production build passed: `npm run build`.
- The core self-check suite passed (13/13 checks) with the Node EventEmitter compatibility shim used for that environment; the final worker bundle was independently executed.
- Independent code review passed after its accepted source/UI corrections.
- Data snapshot check: all eight files loaded from `public/data/` have `mock: false`. This describes the checked-in snapshots, not live or continuously refreshed data.
- Documentation JSON parses and `git diff --check` passes.
- The illustrated deck exists as `public/demo.pdf` and `public/demo.pptx`. The PDF's seven-page structure and three links were checked, and a fresh render was visually inspected. Event eligibility and public URL checks remain pending.

Not verified:

- Interactive browser behavior and gameplay recording. Local browser debugging was blocked by managed Chrome policy; no workaround was used. The slide deck is not gameplay footage.
- Public GitHub Pages URL. The workflow is configured, but publication must be confirmed from a successful Actions run before sharing a live URL.
- Official submission form state beyond the public team record checked on 2026-11-14. That record showed an unsubmitted project; submission, acceptance, and confirmation are not claimed.
- Team review of the game, roster/eligibility, AI disclosure, references, and submission answers.
