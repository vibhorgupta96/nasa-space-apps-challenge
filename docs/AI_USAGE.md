# AI (SI) usage disclosure

The contest asks us to say where and how AI tools were used. This file records what actually happened. Teammates: add your own entries as you work.

| What | Tool | Role | Human review |
|---|---|---|---|
| Game idea brainstorming | Claude (Anthropic), in Claude Code | Suggested game concepts from the team's prompts. The team chose and shaped the direction (farming game, rover, Stardew-like cozy feel). | Team picked and edited |
| `PLAN.md` first draft | Claude | Drafted the plan. Teammate Vibhor rewrote large parts (contracts, rules, submission). | Edited by team |
| Base game code (`src/`, `scripts/`) | Claude | Wrote the first version of all game code, the data download scripts, and the pixel art grids drawn in code. | To be reviewed and tested by team |
| Storyline and dialogue (`src/story/script.ts`) | Claude | Wrote the characters, story beats and jokes in a dry, absurd comic tone the team asked for. | To be reviewed by team |
| Science facts | Claude, checked against NASA records | Short summaries of the NASA records linked in `public/data/crops.json` and `trivia.json`. The download script checks that every NASA ID exists. | Team should re-read each source |

No AI-generated images, video or audio are in the game. All sprites are drawn from text grids in code. If any are added later, images and video need a visible watermark, and audio needs a note in its metadata.
