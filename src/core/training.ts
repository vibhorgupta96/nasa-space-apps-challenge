import type { ItemId } from './types';

// The "Junior Astronaut" training layer: one lesson per sol (See it, Try it, Say it), skill
// badges, the astronaut schedule and small crew requests. The store keeps the progress; this
// file is only data. Lesson facts point at sourced entries in public/data (science.json,
// trivia.json) or at live mission data (InSight weather, JPL delay, DONKI storms).

export type BadgeId =
  | 'life-support' | 'power-planner' | 'radiation-safe' | 'comms-officer' | 'rover-pilot' | 'botanist'
  | 'team-player' | 'chef' | 'fit-astronaut' | 'crew-helper' | 'oxygen-maker' | 'panel-cleaner' | 'scholar';

export const BADGES: Record<BadgeId, { name: string; icon: string; how: string }> = {
  'life-support': { name: 'Life Support', icon: '🫁', how: 'End 3 sols with air at 70 or more.' },
  'power-planner': { name: 'Power Planner', icon: '⚡', how: 'Use every power cell on 3 sols.' },
  'radiation-safe': { name: 'Radiation Safe', icon: '☀️', how: 'Keep the crew sheltered through a solar storm.' },
  'comms-officer': { name: 'Comms Officer', icon: '📡', how: 'Receive a radio message that crossed space at light speed.' },
  'rover-pilot': { name: 'Rover Pilot', icon: '🚙', how: 'Bring Bolt home safely from a drive.' },
  botanist: { name: 'Botanist', icon: '🌱', how: 'Harvest 3 crops.' },
  'team-player': { name: 'Team Player', icon: '🤝', how: 'Talk to Rosa, Theo, Priya and Bolt.' },
  chef: { name: 'Space Chef', icon: '🍲', how: 'Cook a recipe in the kitchen.' },
  'fit-astronaut': { name: 'Fit Astronaut', icon: '🏃', how: 'Exercise on the treadmill on 3 sols.' },
  'crew-helper': { name: 'Crew Helper', icon: '📋', how: 'Finish 3 crew requests.' },
  'oxygen-maker': { name: 'Oxygen Maker', icon: '💨', how: 'Run MOXIE to make air from carbon dioxide.' },
  'panel-cleaner': { name: 'Panel Cleaner', icon: '🧹', how: 'Clean dust off a solar panel.' },
  scholar: { name: 'Science Star', icon: '🌟', how: 'Answer 7 sol lessons correctly.' },
};

export const BADGE_IDS = Object.keys(BADGES) as BadgeId[];

/**
 * Where a lesson's "See it" fact comes from:
 * `science:<id>` / `trivia:<id>` are sourced facts in public/data; `weather`, `delay` and `storm`
 * are filled from the live mission data.
 */
export type LessonSee = `science:${string}` | `trivia:${string}` | 'weather' | 'delay' | 'storm';

export interface Lesson {
  sol: number;
  /** The crew member who asks the question (their topic). */
  who: 'rosa' | 'theo' | 'priya' | 'bolt';
  goal: string;
  see: LessonSee;
  /** What to do in the game to try the idea. */
  tryIt: string;
  question: string;
  choices: [string, string, string];
  answer: 0 | 1 | 2;
}

export const LESSONS: Lesson[] = [
  {
    sol: 1, who: 'theo', goal: 'Plants need light, water and warmth to grow.', see: 'science:plant-oxygen',
    tryIt: 'Plant seeds, water them and give the grow lights some power.',
    question: 'What do our plants need to grow?',
    choices: ['Light, water and warmth', 'Just soil', 'Darkness and cold'], answer: 0,
  },
  {
    sol: 2, who: 'bolt', goal: 'A day on Mars is called a sol, and it is a bit longer than an Earth day.', see: 'science:mars-sol',
    tryIt: 'Watch the clock in the top corner: one sol passes in two minutes of play.',
    question: 'Is a sol longer or shorter than a day on Earth?',
    choices: ['A little shorter', 'A little longer', 'Exactly the same'], answer: 1,
  },
  {
    sol: 3, who: 'rosa', goal: 'Solar storms come from the Sun, and shelter keeps astronauts safe.', see: 'storm',
    tryIt: 'Check the storm board (TAB) and put cells in the shelter on storm days.',
    question: 'Where do solar storms come from?',
    choices: ['The Moon', 'Volcanoes on Mars', 'The Sun'], answer: 2,
  },
  {
    sol: 4, who: 'theo', goal: 'Mars is very cold, so plants need a heater at night.', see: 'weather',
    tryIt: 'On a cold sol, put 1 cell in the heater or the plants stop growing.',
    question: 'Why do plants on Mars need a heater?',
    choices: ['Mars nights are much colder than a freezer', 'Plants like hot baths', 'To dry the water'], answer: 0,
  },
  {
    sol: 5, who: 'bolt', goal: 'Messages between Earth and Mars take minutes, because radio waves travel at light speed.', see: 'delay',
    tryIt: 'Watch for radio messages from Earth: they arrive after a delay.',
    question: 'Why can\'t Mars call Earth instantly?',
    choices: ['Mars has no phones', 'Radio waves need minutes to cross the huge distance', 'Earth is asleep'], answer: 1,
  },
  {
    sol: 6, who: 'priya', goal: 'There is ice on Mars, and astronauts can melt it into water.', see: 'science:phoenix-ice',
    tryIt: 'Send Bolt to find ice, then melt it in the ice melter.',
    question: 'Where can astronauts find water on Mars?',
    choices: ['Frozen as ice in the ground', 'In rivers full of fish', 'In clouds of lemonade'], answer: 0,
  },
  {
    sol: 7, who: 'priya', goal: 'Machines like MOXIE can make oxygen from Mars air.', see: 'science:moxie-oxygen',
    tryIt: 'Leave a spare power cell in the morning and run MOXIE during the day.',
    question: 'What did MOXIE make oxygen from?',
    choices: ['Melted rocks', 'Carbon dioxide in Mars\' air', 'The rover\'s tyres'], answer: 1,
  },
  {
    sol: 8, who: 'priya', goal: 'Dust blocks sunlight, so solar panels on Mars make less power when they are dusty.', see: 'trivia:insight-dust',
    tryIt: 'When dust covers a panel, clean it at the solar panel station (or ask your pet).',
    question: 'Why do solar panels on Mars need cleaning?',
    choices: ['Dust blocks the sunlight', 'Rain makes them rusty', 'Birds sit on them'], answer: 0,
  },
  {
    sol: 9, who: 'theo', goal: 'Different crops make a healthier mix of food.', see: 'science:veggie-lettuce',
    tryIt: 'Grow two kinds of crops and cook a recipe in the kitchen.',
    question: 'Why do astronauts grow different crops?',
    choices: ['All seeds are the same', 'Different foods give a healthier mix', 'Mars only grows one plant'], answer: 1,
  },
  {
    sol: 10, who: 'rosa', goal: 'Astronauts keep healthy with exercise, sleep and a daily plan.', see: 'science:iss-exercise',
    tryIt: 'Follow today\'s schedule: farm, exercise, science, then sleep in your bed.',
    question: 'Why do astronauts exercise every day in space?',
    choices: ['To keep muscles and bones strong', 'To fly faster', 'To charge the batteries'], answer: 0,
  },
];

export const lessonFor = (sol: number) => LESSONS.find((l) => l.sol === sol) ?? null;

/** Sols whose questions make the optional 5-question quiz before and after a mission. */
export const QUIZ_SOLS = [1, 3, 5, 6, 7];

/** The astronaut's daily schedule. Each step is ticked by something the player does. */
export const SCHEDULE = [
  { id: 'farm', icon: '🌱', label: 'Farm', how: 'plant, water or harvest' },
  { id: 'exercise', icon: '🏃', label: 'Exercise', how: 'use the treadmill' },
  { id: 'science', icon: '🔬', label: 'Science', how: 'send the rover or run MOXIE' },
  { id: 'sleep', icon: '😴', label: 'Sleep', how: 'end the sol in your bed' },
] as const;
export type ScheduleId = (typeof SCHEDULE)[number]['id'];

export interface CrewRequest {
  who: 'rosa' | 'theo' | 'priya';
  /** A pantry crop id or a home inventory item. */
  need: { crop: string } | { item: ItemId };
  amount: number;
  ask: string;
  thanks: string;
}

/** One small request on sols 2–9. Rewards are game rules (2 seeds and a Crew Helper point). */
export const REQUESTS: Record<number, CrewRequest> = {
  2: { who: 'priya', need: { item: 'water' }, amount: 3, ask: 'Could you spare 3 water? I want to test the recycler. On Mars, every drop gets used again.', thanks: 'Perfect. The recycler says thank you in beeps.' },
  3: { who: 'theo', need: { crop: 'red-romaine' }, amount: 1, ask: 'Could you bring me 1 Red Romaine from the pantry? I am running a taste test, for science.', thanks: 'Crunchy! Ten out of ten. The other judge was also me.' },
  4: { who: 'rosa', need: { item: 'ice' }, amount: 1, ask: 'Bring me 1 ice, please. I want to check how pure our Mars ice is.', thanks: 'Very clean ice. Item 61 on my list: done.' },
  5: { who: 'theo', need: { crop: 'mizuna' }, amount: 1, ask: 'May I have 1 Mizuna? I am comparing it with the mizuna astronauts grew on the space station.', thanks: 'Peppery! Just like the reports said.' },
  6: { who: 'priya', need: { item: 'regolith' }, amount: 1, ask: 'Can you get me 1 regolith? I want to see how fine Mars dust is under the microscope.', thanks: 'Tiny, sharp grains. No wonder it sticks to the solar panels.' },
  7: { who: 'rosa', need: { item: 'seed' }, amount: 2, ask: 'Spare 2 seeds for the emergency kit? Good commanders plan for bad days.', thanks: 'Emergency kit complete. I feel 4% calmer.' },
  8: { who: 'theo', need: { crop: 'radish' }, amount: 1, ask: 'A radish, please! I want to weigh it against the ones grown on the space station.', thanks: 'A fine radish. I will name it. Then eat it.' },
  9: { who: 'priya', need: { item: 'water' }, amount: 2, ask: 'Last test: 2 water for the cooling loop. Then everything is ready for the supply ship.', thanks: 'Cooling loop full. We are ready!' },
};

/** Sols on which dust settles on a solar panel overnight (a game rule inspired by real Mars missions). */
export const DUST_SOLS = [3, 6, 8];

/** The title printed on the training certificate, earned from badges, lessons and finishing the mission. */
export function astronautTitle(badges: number, lessonsRight: number, completed: boolean): { title: string; points: number } {
  const points = badges + lessonsRight + (completed ? 3 : 0);
  const title = points >= 22 ? 'Mars Mission Commander'
    : points >= 16 ? 'Mission Specialist'
      : points >= 10 ? 'Flight Engineer'
        : 'Astronaut Cadet';
  return { title, points };
}
