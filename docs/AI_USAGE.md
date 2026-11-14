# AI use disclosure (working draft)

This working draft combines the existing main-branch disclosure with the later data pipeline work. Confirm the history and all affected files with the team before submission.

| What | Tool | Role | Human review |
|---|---|---|---|
| Game idea brainstorming | Claude (Anthropic), in Claude Code | The existing disclosure says Claude suggested game concepts from team prompts and the team chose and shaped the direction. | Team picked and edited; confirm submission wording |
| `PLAN.md` first draft | Claude | Drafted the plan; the existing disclosure says Vibhor rewrote large parts. | Edited by team |
| Base game code (`src/`, `scripts/`) | Claude | Wrote the initial game code, data download scripts, and pixel art grids drawn in code. | Pending team review and tests |
| Storyline and dialogue (`src/story/script.ts`) | Claude | Wrote characters, story beats and jokes to the team's requested tone. | Pending team review |
| Earlier science facts | Claude, checked against NASA records | Summarized linked records in the earlier crops and trivia data; the prior script checked NASA IDs. | Team should re-read each source |

- **Tool:** OpenAI Codex, GPT-6.1 Sol (task orchestration), GPT-6 Luna (fixtures, pipeline, tests and documentation), and GPT-6.1 Terra (integration with the existing game scaffold).
- **Role:** generated synthetic JSON fixture values, a Node NASA data-fetch script and tests, and draft data-pipeline/disclosure documentation for `scripts/fetch-nasa-data*.mjs`, `public/data/{storms,weather,crops,delay,photos}.json`, and `docs/{INITIAL_DATA,DATA_PIPELINE,AI_USAGE}.md` / `.json`.
- **Human edits/review:** not known at the time this draft was written. Update this entry to describe actual edits and review before submission.
- **Generated media:** no generated images, video, or audio.
- **Disclosure location:** this file and `docs/AI_USAGE.json`. No generated image or video is included.

The first data fixtures were synthetic and marked `mock: true`; AI did not generate the NASA observations. The fetched snapshots contain NASA source records. Crop facts are short AI-curated summaries checked against the linked NASA pages. Update this disclosure as the project uses more tools or creates more assets.
