import type { Crop, GameData, ScienceFact, StormEvent } from './loaders.js';

export type DailyActivity = {
  planted: boolean;
  watered: boolean;
  harvested: Crop | null;
  roverTrip: boolean;
  storm: StormEvent | null;
  sol: number;
};

export type ScienceCard = { text: string; source: string };

/** Replace dialogue fact tokens with text and sources from the loaded NASA data. */
export function fillScienceTokens(text: string, data: GameData): string {
  return text.replace(/\{fact:([a-z0-9-]+)\}/g, (_token, id: string) => {
    const fact = data.science.facts.find((item) => item.id === id);
    return fact?.text ?? `NASA science fact unavailable (${id}).`;
  });
}

/** Pick a source-backed fact connected to the most meaningful thing the player did today. */
export function selectScienceCard(data: GameData, activity: DailyActivity): ScienceCard {
  if (activity.storm) {
    const event = activity.storm;
    const labels: Record<string, string> = {
      CME: 'a coronal mass ejection (CME)',
      SEP: 'a solar energetic particle (SEP) event',
      GST: 'an Earth geomagnetic storm (GST)',
    };
    const kind = labels[event.type] ?? `a ${event.type} event`;
    const when = new Date(event.realTime).toUTCString().slice(5, 16);
    const context = event.type === 'GST'
      ? ' This record describes geomagnetic activity at Earth.'
      : '';
    return {
      text: `NASA recorded ${kind} on ${when}.${context} The strength and effect at our outpost are simulated in this game.`,
      source: event.link,
    };
  }

  if (activity.harvested) {
    return { text: activity.harvested.fact, source: activity.harvested.factSource };
  }

  const fact = activity.planted
    ? data.science.facts.find((item) => item.id === 'veg-garden')
    : activity.watered
      ? data.science.facts.find((item) => item.id === 'veg-water')
      : null;
  if (fact) return fromFact(fact);

  if (activity.roverTrip) {
    const roverFact = data.trivia.trivia.find((item) => item.id === 'morse') ?? data.trivia.trivia[0];
    if (roverFact) return { text: roverFact.fact, source: roverFact.source };
  }

  const dailyFactId = activity.sol % 2 === 0 ? 'mars-clouds' : 'mars-sol';
  const fallback = data.science.facts.find((item) => item.id === dailyFactId) ?? data.science.facts[0];
  if (!fallback) throw new Error('No sourced science facts are loaded.');
  return fromFact(fallback);
}

function fromFact(fact: ScienceFact): ScienceCard {
  return { text: fact.text, source: fact.source };
}
