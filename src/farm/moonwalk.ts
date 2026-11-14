// The Moonwalk (Moon missions only): suit up at the rack by the airlock and walk outside once a
// day. Each task teaches one sourced fact. The air cost, the regolith reward and the radiation
// rule are game rules; the facts are real and link to NASA.

export type MoonwalkTask = 'samples' | 'footprints' | 'earth';

export interface MoonwalkInfo {
  id: MoonwalkTask;
  icon: string;
  label: string;
  /** What you do outside (shown on the button's result). */
  did: string;
  /** The real fact, kid-readable. */
  fact: string;
  source: string;
  regolith: number;
  journal: string;
}

export const MOONWALK_TASKS: MoonwalkInfo[] = [
  {
    id: 'samples', icon: '🪨', label: 'Collect rock samples',
    did: 'You scooped grey moon rocks into a sample bag.',
    fact: 'Apollo astronauts brought home about 382 kg (842 lb) of Moon rocks and soil: 2,200 samples from six landing sites. Scientists still study them today.',
    source: 'https://curator.jsc.nasa.gov/lunar/index.cfm',
    regolith: 2,
    journal: 'I went on a moonwalk and collected rock samples.',
  },
  {
    id: 'footprints', icon: '👣', label: 'Leave footprints',
    did: 'You bounced across the dust and left a trail of boot prints.',
    fact: 'The Moon has no wind or rain, so astronaut footprints can stay for millions of years, unless a tiny meteorite hits them.',
    source: 'https://starchild.gsfc.nasa.gov/docs/StarChild/space_level1/apollo11.html',
    regolith: 1,
    journal: 'I went on a moonwalk and left footprints that could last millions of years.',
  },
  {
    id: 'earth', icon: '🌍', label: 'Look back at Earth',
    did: 'You stopped and looked up. Earth hung in the black sky like a blue marble.',
    fact: 'The same side of the Moon always faces Earth. So from the near side, Earth stays in about the same spot in the sky, while the Sun and stars move.',
    source: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/moon/',
    regolith: 1,
    journal: 'I went on a moonwalk and looked back at Earth.',
  },
];

export const moonwalkTask = (id: string) => MOONWALK_TASKS.find((t) => t.id === id) ?? null;
