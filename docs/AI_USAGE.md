# AI use disclosure (working draft)

This working draft combines the earlier team AI disclosure with the subsequent data pipeline and Person C completion work. The earlier disclosure reports that Claude suggested game concepts and the team chose and shaped the direction. Confirm this history and all affected files with the team before submission; the public team record's AI references are currently blank.

| What | Tool | Role | Human review |
|---|---|---|---|
| Game idea brainstorming | Claude (Anthropic), in Claude Code | The existing disclosure says Claude suggested game concepts from team prompts and the team chose and shaped the direction. | Team picked and edited; confirm submission wording |
| `PLAN.md` first draft | Claude | Drafted the plan; the existing disclosure says Vibhor rewrote large parts. | Edited by team |
| Base game code (`src/`, `scripts/`) | Claude | Wrote the initial game code, data download scripts, and pixel art grids drawn in code. | Pending team review and tests |
| Storyline and dialogue (`src/story/script.ts`) | Claude | Wrote characters, story beats and jokes to the team's requested tone. | Pending team review |
| Earlier science facts | Claude, checked against NASA records | Summarized linked records in the earlier crops and trivia data; the prior script checked NASA IDs. | Team should re-read each source |
| Current data pipeline and sourced snapshots | OpenAI Codex (GPT-6.1 Sol and GPT-6 Luna) | Orchestration; Luna wrote the Node fetch script, tests, initial fixtures, and data summaries after checking NASA pages. | Regression tests and independent code review passed; team review and SI form answers remain pending |
| Game integration | OpenAI Codex (GPT-6.1 Terra) | Adapted the Person C data pipeline and output fields to the later game scaffold. | Regression tests, production build, and independent code review passed; human team review remains pending |
| Person C science, UI, and submission fixes | OpenAI Codex (GPT-6 Luna), directed by Sol | Added sourced activity facts and revised science-card logic, help and credits UI, submission copy, deployment workflow, and disclosure documentation. | Regression tests, production build, and independent code review passed; browser verification, event eligibility and hosted-link checks, and human team review remain pending |

- **Other OpenAI Codex work:** GPT-6 Luna drafted the project-page and optional video storyboard text and created the seven-slide illustrated deck (`public/demo.pptx`, rendered as `public/demo.pdf`). The deck is AI-assisted and visibly watermarked; it is not game footage.
- **Generated media:** The deck uses NASA rover photographs with slide credits and an AI-assisted layout/illustration. No AI-generated standalone images, audio, or gameplay video are included. The game art is drawn in project code; NASA image assets keep their original credits. Team review remains pending.
- **Disclosure location:** this file, `docs/AI_USAGE.json`, and the in-game NASA credits screen.

The first data fixtures were synthetic and marked `mock: true`; AI did not generate the NASA observations. The fetched snapshots contain NASA source records. Crop and activity facts are short AI-curated summaries with linked references; the team should check each fact against its cited page. Regression tests, production build, independent code review, and local deck-render checks passed; browser verification, event eligibility and hosted-link checks, and human team review remain pending. Update this disclosure as the project uses more tools or creates more assets.
