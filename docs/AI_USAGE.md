# AI use disclosure (working draft)

This draft records AI assistance actually used for the initial mock data handoff and the Node data-fetch pipeline. It does not claim that AI originated the Sol Sprouts solution idea; that history is unknown and must be confirmed by the team before submission.

- **Tool:** OpenAI Codex, GPT-6.1 Sol (task orchestration) and GPT-6 Luna (fixture and documentation generation).
- **Role:** generated synthetic JSON fixture values, a Node NASA data-fetch script and tests, and draft data-pipeline/disclosure documentation for `scripts/fetch-nasa-data*.mjs`, `public/data/{storms,weather,crops,delay,photos}.json`, and `docs/{INITIAL_DATA,DATA_PIPELINE,AI_USAGE}.md` / `.json`.
- **Human edits/review:** not known at the time this draft was written. Update this entry to describe actual edits and review before submission.
- **Generated media:** no generated images, video, or audio.
- **Disclosure location:** this file and `docs/AI_USAGE.json`. No generated image or video is included.

The first data fixtures were synthetic and marked `mock: true`; AI did not generate the NASA observations. The fetched snapshots contain NASA source records. Crop facts are short AI-curated summaries checked against the linked NASA pages. Update this disclosure as the project uses more tools or creates more assets.
