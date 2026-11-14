import type { ItemId, WorldId } from './types';

// The "Junior Astronaut" training layer: one lesson per sol (See it, Try it, Say it), skill
// badges, the astronaut schedule and small crew requests. The store keeps the progress; this
// file is only data. Planet-specific lessons point at sourced entries in that world's data bundle;
// weather, delay and storm lessons use the selected mission's simulated/live presentation.

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

const MOON_BADGES: Record<BadgeId, { name: string; icon: string; how: string }> = {
  ...BADGES,
  'life-support': { ...BADGES['life-support'], how: 'End 3 days with air at 70 or more.' },
  'power-planner': { ...BADGES['power-planner'], how: 'Use every power cell on 3 days.' },
  'oxygen-maker': { ...BADGES['oxygen-maker'], how: 'Run the water recycler to make breathable oxygen.' },
  'panel-cleaner': { ...BADGES['panel-cleaner'], how: 'Clean lunar dust out of the airlock; its filters stop using power next morning.' },
  'fit-astronaut': { ...BADGES['fit-astronaut'], how: 'Exercise on the treadmill on 3 days.' },
  scholar: { ...BADGES.scholar, how: 'Answer 7 day lessons correctly.' },
};

export const BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export function badgeInfoForWorld(id: BadgeId, worldId: WorldId = 'mars') {
  return (worldId === 'moon' ? MOON_BADGES : BADGES)[id];
}

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

const MOON_LESSONS: Lesson[] = [
  { sol: 1, who: 'theo', goal: 'Moon crops grow inside a protected greenhouse with light, water and steady warmth.', see: 'science:veg-water',
    tryIt: 'Plant a Moon seed, water it and power the grow lights.', question: 'Where do our Moon crops grow?',
    choices: ['In a protected, controlled greenhouse', 'Outdoors in lunar soil without help', 'In a river valley'], answer: 0 },
  { sol: 2, who: 'bolt', goal: 'The Moon’s day and night cycle is about 29.5 Earth days; this game compresses time. Moon gravity is about one-sixth of Earth’s.', see: 'science:moon-cycle',
    tryIt: 'Watch the game clock: its lunar day is shortened for play.', question: 'About how long is one lunar day-and-night cycle on the Moon?',
    choices: ['One Earth day', 'About 29.5 Earth days', 'About one Mars sol'], answer: 1 },
  { sol: 3, who: 'rosa', goal: 'The Sun can send harmful space radiation; shelter helps protect astronauts. The game’s hazard schedule is simulated.', see: 'science:moon-radiation',
    tryIt: 'Check the shelter board and move cells into shelter when the simulated alert appears.', question: 'What helps protect a Moon crew during a solar radiation event?',
    choices: ['A deeper shelter with shielding', 'A faster rover', 'An open greenhouse roof'], answer: 0 },
  { sol: 4, who: 'theo', goal: 'Sunlit lunar ground can be hot and dark ground very cold, so the greenhouse controls its temperature.', see: 'science:moon-temperature',
    tryIt: 'Thermal control: use 1 cell in daylight for cooling and 2 during the dark stretch for heating.', question: 'Why does the Moon greenhouse need thermal controls?',
    choices: ['The Moon’s surface has large temperature extremes', 'Moon plants need freezing roots', 'Rain cools the lunar soil'], answer: 0 },
  { sol: 5, who: 'bolt', goal: 'A Moon radio signal takes about 1.3 seconds one way; Mars signals take minutes depending on the planets’ positions. Game timing is compressed.', see: 'science:moon-radio',
    tryIt: 'Watch the game’s radio messages; their timing is shortened for play.', question: 'Why can a real Moon message reach Earth sooner than a Mars message?',
    choices: ['Radio travels faster near the Moon', 'The Moon is much closer to Earth', 'The Moon uses a different kind of light'], answer: 1 },
  { sol: 6, who: 'priya', goal: 'Water ice exists in some permanently shadowed lunar polar craters, not everywhere on the Moon.', see: 'science:moon-polar-ice',
    tryIt: 'Send Bolt to search a marked ice site, then use the ice melter.', question: 'Where has water ice been found on the Moon?',
    choices: ['In some permanently shadowed polar areas', 'In rivers across the whole surface', 'Floating in lunar rain clouds'], answer: 0 },
  { sol: 7, who: 'priya', goal: 'The game’s Moon habitat makes oxygen from water, inspired by ISS water electrolysis; this is not MOXIE or a deployed lunar machine.', see: 'science:moon-water-oxygen',
    tryIt: 'Leave water and a spare cell, then run the habitat water oxygen maker.', question: 'What does the Moon habitat’s water oxygen maker use?',
    choices: ['Water and power in a simulated habitat system', 'Carbon dioxide from lunar air with MOXIE', 'Moon rocks without power'], answer: 0 },
  { sol: 8, who: 'priya', goal: 'The Moon has no wind or rain, so its sticky dust only moves when boots, wheels or rockets kick it up. It clings to suits and comes inside. In this game, airlock dust costs power until you clean it.', see: 'trivia:lunar-dust',
    tryIt: 'After a moonwalk or rover trip, clean the dust at the airlock door and check your power next morning.', question: 'How does dust get inside a Moon base?',
    choices: ['It sticks to boots, suits and wheels', 'The wind blows it in', 'It rains down from clouds'], answer: 0 },
  { sol: 9, who: 'theo', goal: 'A range of crops can make a healthier food mix; Moon crops in this game grow only inside a controlled habitat.', see: 'science:moon-crop-variety',
    tryIt: 'Grow two Moon crop types and prepare a kitchen recipe.', question: 'Why does the Moon greenhouse grow more than one crop?',
    choices: ['Different foods make a varied diet', 'Lunar soil grows every food outdoors', 'All crops have identical nutrients'], answer: 0 },
  { sol: 10, who: 'rosa', goal: 'Exercise, sleep and routines support astronaut health in spaceflight; this is general spaceflight research.', see: 'science:iss-exercise',
    tryIt: 'Follow today’s schedule: farm, exercise, science, then sleep in your bed.', question: 'Why do astronauts exercise during spaceflight?',
    choices: ['To help maintain muscles and bones', 'To make the spacecraft travel faster', 'To charge solar panels'], answer: 0 },
];

export function lessonsForWorld(worldId: WorldId = 'mars'): Lesson[] {
  return worldId === 'moon' ? MOON_LESSONS : LESSONS;
}

export const lessonFor = (sol: number, worldId: WorldId = 'mars') => lessonsForWorld(worldId).find((l) => l.sol === sol) ?? null;

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

const MOON_SCHEDULE = [
  { id: 'farm', icon: '🌱', label: 'Farm', how: 'plant, water or harvest' },
  { id: 'exercise', icon: '🏃', label: 'Exercise', how: 'use the treadmill' },
  { id: 'science', icon: '🔬', label: 'Science', how: 'send the rover, run the water oxygen maker or go on a moonwalk' },
  { id: 'sleep', icon: '😴', label: 'Sleep', how: 'end the day in your bed' },
] as const;

export function scheduleForWorld(worldId: WorldId = 'mars') {
  return worldId === 'moon' ? MOON_SCHEDULE : SCHEDULE;
}

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

const MOON_REQUESTS: Record<number, CrewRequest> = {
  2: { who: 'priya', need: { item: 'water' }, amount: 3, ask: 'Could you spare 3 water for the Moon habitat recycler? We reuse every drop.', thanks: 'Recycler test complete. The beeps sound pleased.' },
  3: { who: 'theo', need: { item: 'regolith' }, amount: 1, ask: 'Could you bring 1 lunar regolith sample? I want to inspect its grains under the microscope.', thanks: 'Fine grains! I have labeled this sample for our Moon study.' },
  4: { who: 'rosa', need: { item: 'ice' }, amount: 1, ask: 'Please bring 1 ice from the marked lunar polar site for a purity check.', thanks: 'Sample logged. Polar ice is precious, so every test counts.' },
  5: { who: 'theo', need: { crop: 'moon-pea' }, amount: 1, ask: 'May I have 1 pea from our greenhouse? I want to taste-test our game-grown Moon crop.', thanks: 'Sweet! Our habitat harvest passed the taste test.' },
  6: { who: 'priya', need: { item: 'regolith' }, amount: 1, ask: 'Can you get me 1 more lunar regolith sample for an engineering test?', thanks: 'The equipment test is complete. Lunar dust is tricky stuff.' },
  7: { who: 'rosa', need: { item: 'seed' }, amount: 2, ask: 'Could you spare 2 seeds for the Moon habitat emergency kit?', thanks: 'Emergency kit ready. I feel 4% calmer.' },
  8: { who: 'theo', need: { crop: 'moon-potato' }, amount: 1, ask: 'Could I have 1 potato from our greenhouse to weigh this game-grown Moon harvest?', thanks: 'A fine habitat-grown potato. I have recorded its weight.' },
  9: { who: 'priya', need: { item: 'water' }, amount: 2, ask: 'Last test: 2 water for the Moon habitat cooling loop.', thanks: 'Cooling loop ready. The greenhouse is comfortable.' },
};

export function requestsForWorld(worldId: WorldId = 'mars'): Record<number, CrewRequest> {
  return worldId === 'moon' ? MOON_REQUESTS : REQUESTS;
}

/** Sols on which dust settles on a solar panel overnight (a game rule inspired by real Mars missions). */
export const DUST_SOLS = [3, 6, 8];

/** The title printed on the training certificate, earned from badges, lessons and finishing the mission. */
export function astronautTitle(badges: number, lessonsRight: number, completed: boolean, worldId: WorldId = 'mars'): { title: string; points: number } {
  const points = badges + lessonsRight + (completed ? 3 : 0);
  const commander = worldId === 'moon' ? 'Moon Mission Commander' : 'Mars Mission Commander';
  const title = points >= 22 ? commander
    : points >= 16 ? 'Mission Specialist'
      : points >= 10 ? 'Flight Engineer'
        : 'Astronaut Cadet';
  return { title, points };
}
