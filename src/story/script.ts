// Sol Sprouts storyline and dialogue. Original writing.
//
// Tone rule: jokes are welcome, but any SCIENCE claim in a line must also be backed by a file in
// public/data (crops.json, trivia.json, delay.json...). Game rules can be described as game rules.
// Tokens: {delay} = one-way radio minutes, {mkm} = Earth–Mars distance in millions of km, {items} = cargo.

export type Speaker = 'bolt' | 'rosa' | 'theo' | 'priya' | 'radio' | 'you';
export interface Line {
  who: Speaker;
  text: string;
  mood?: 'happy' | 'worried';
}

export const SPEAKERS: Record<Speaker, { name: string; portrait: string; color: string }> = {
  bolt: { name: 'Bolt', portrait: 'portrait-bolt', color: '#5ee7ff' },
  rosa: { name: 'Commander Rosa Vey', portrait: 'portrait-rosa', color: '#f0a070' },
  theo: { name: 'Dr. Theo Marsh', portrait: 'portrait-theo', color: '#9ad27e' },
  priya: { name: 'Priya Rao, Engineer', portrait: 'portrait-priya', color: '#b9a0e0' },
  radio: { name: 'Mission Control (Earth)', portrait: 'portrait-radio', color: '#ffd166' },
  you: { name: 'You', portrait: 'portrait-player', color: '#7fd6cf' },
};

export const INTRO: Line[] = [
  { who: 'radio', text: 'Hello, new Greenhouse Keeper. This message left Earth about {delay} minutes ago, so by now we have probably had a sandwich.' },
  { who: 'radio', text: 'Your job is simple: keep the crew breathing and fed for 10 sols, until the supply ship arrives. Simple jobs on Mars are never simple.' },
  { who: 'bolt', text: 'Hello! I am Bolt. I was built to be helpful, which I am, and cheerful, which I am still working on.' },
  { who: 'bolt', text: 'A "sol" is one day on Mars. {fact:mars-sol} Nobody knows what to do with the extra minutes. Theo naps.' },
  { who: 'rosa', text: 'Commander Rosa Vey. I have made you a list. Item one: read the list. Item two: water the plants. Item three: do not lick the regolith.' },
  { who: 'theo', text: 'Dr. Theo Marsh, botanist. {fact:plant-oxygen} I thank the plants every morning so they feel appreciated. They have not said anything back. Yet.' },
  { who: 'priya', text: 'Priya Rao, engineer. Every morning you get 6 power cells. Split them wisely. Electricity, unlike my patience, does not grow back.' },
  { who: 'bolt', text: 'Grow lights make plants grow. The heater keeps them warm. The shelter protects us from solar storms. My rover battery lets me go outside and get lost efficiently.' },
  { who: 'bolt', text: 'You will never have enough power for everything. This is called a trade-off. Engineers love them. Nobody knows why.', mood: 'happy' },
];

/** Short, sourced-mechanics-aware opening for the lunar mission variant. */
export const MOON_INTRO: Line[] = [
  { who: 'radio', text: 'Hello, Greenhouse Keeper! This Moon base has a very short radio delay in our game. We did not make you wait for a real message.' },
  { who: 'radio', text: 'Keep the crew breathing and fed through 10 lunar days. This is a compressed greenhouse mission, with a long simulated dark stretch.' },
  { who: 'bolt', text: 'Hello! I am Bolt. My Moon rover has a dust brush. I have already named it Brushy. Brushy is a professional.' },
  { who: 'bolt', text: 'The Moon has about one-sixth of Earth’s gravity, so astronauts can hop more easily. Try my Moon-hop with SHIFT!' },
  { who: 'rosa', text: 'Commander Rosa Vey. Solar radiation can be a hazard beyond Earth’s protective atmosphere. Keep the shelter ready, and please do not lick the lunar regolith.' },
  { who: 'theo', text: 'Dr. Theo Marsh, botanist. We grow these crops in our protected greenhouse. A few plant experiments have used lunar regolith, but that does not mean these crops are ready to grow outside.' },
  { who: 'priya', text: 'Daylight brings 8 power cells. The dark stretch brings 6. Dust on the rover costs us power tomorrow, so clean it at the airlock.' },
  { who: 'bolt', text: 'Thermal control cools the dome in the bright stretch and warms it in the dark one. My rover takes longer over lunar terrain. My wheels are very careful.' },
  { who: 'bolt', text: 'This mission compresses the Moon’s very long day-night cycle into ten short game days. The temperature and power rules are game simulations.', mood: 'happy' },
];

export const TUTORIAL: Line[] = [
  { who: 'bolt', text: 'Quick tour! Walk with the ARROW keys or WASD. Choose a seed with keys 1–5, stand by an empty plot and press SPACE to plant. Key 6 waters a plant; key 7 harvests a ripe crop or clears a wilted one.' },
  { who: 'bolt', text: 'Press SPACE beside a machine to use it. Try the ice melter, shield bench, radio and airlock. The top airlock leads to my rover.' },
  { who: 'bolt', text: 'Press TAB for the storm board. Press H for these tips. If you get stuck, talk to the crew. That is what people are for.', mood: 'happy' },
];

export const MOON_TUTORIAL: Line[] = [
  { who: 'bolt', text: 'Walk with the ARROW keys or WASD. Hold SHIFT for a short Moon-hop. Pick seeds with keys 1–5, SPACE to plant, 6 to water, and 7 to harvest or clear.' },
  { who: 'bolt', text: 'Press SPACE beside a machine to use it. At the airlock, clean rover dust before planning tomorrow’s power. TAB opens the lunar hazard board; H opens these tips.' },
  { who: 'bolt', text: 'The light and dark stretches are compressed for the game. Thermal control helps the greenhouse in both. Outside the dome, lunar wind and rain are not on the forecast.' },
];

/** Story beats played on the morning of each sol, before power planning. */
export const SOL_BEATS: Record<number, Line[]> = {
  2: [
    { who: 'bolt', text: 'Good morning! I counted the rocks outside. There are more than yesterday. I suspect they are breeding.' },
    { who: 'priya', text: 'Put a cell in the rover battery and Bolt can drive out to find ice. Ice melts into water. Water keeps plants alive. It is a whole thing.' },
  ],
  3: [{ who: 'theo', text: 'The lettuce looks happier today. Or it might be the lighting. Lettuce is very hard to read.' }],
  4: [
    { who: 'rosa', text: 'Item 47 on my list: survive the week. Item 48: make a list of the things we survived.' },
    { who: 'bolt', text: 'I would like to be on that list.', mood: 'happy' },
  ],
  5: [
    { who: 'theo', text: 'I found a seed packet labelled "DO NOT PLANT." I put it in the seed crate, where it can think about what it has done.' },
    { who: 'bolt', text: 'I am sure that will be fine. I am almost sure. I am a medium amount of sure.', mood: 'worried' },
  ],
  6: [{ who: 'bolt', text: 'Halfway! Statistically, the second half of the mission is the same length as the first half. I checked twice.' }],
  7: [{ who: 'rosa', text: 'Scientists on Earth would love rock samples. Every sample Bolt brings home unlocks a real NASA photo for our mission album.' }],
  8: [
    { who: 'priya', text: 'I have named every bolt in this dome. There are 412. Only one of them answers back.' },
    { who: 'bolt', text: 'Hello.', mood: 'happy' },
  ],
  9: [{ who: 'rosa', text: 'The supply ship arrives after tomorrow. I have prepared a list of things to say. It says "Hello," "Thank you," and "Did you bring snacks."' }],
  10: [{ who: 'bolt', text: 'Final sol! If I had a heart, it would be doing something complicated right now.' }],
};

/** Story variants for the compressed Moon days; use lunar language without rewriting Mars. */
export const MOON_DAY_BEATS: Record<number, Line[]> = {
  2: [
    { who: 'bolt', text: 'Good morning! I counted the craters outside. There are many. I suspect they are not breeding.' },
    { who: 'priya', text: 'Put a cell in the rover battery and Bolt can look for icy patches. The illustrated map is a game simulation, so our finds are pretend.' },
  ],
  3: [{ who: 'theo', text: 'The greenhouse leaves look happier today. Or it might be the lighting. Leaves are very hard to read.' }],
  4: [{ who: 'priya', text: 'The compressed dark stretch begins. Thermal control needs two cells tonight if we want the plants to keep growing.' }],
  6: [{ who: 'bolt', text: 'Halfway! Statistically, the second half of the mission is the same length as the first half. I checked twice.' }],
  7: [{ who: 'rosa', text: 'Every rock sample gives our science team another clue about the Moon. Bolt says the crater rocks all look alike. Bolt is still learning.' }],
  9: [{ who: 'rosa', text: 'The next mission team is almost here. I have prepared a list of things to say. It says “Hello,” “Thank you,” and “Did you bring snacks.”' }],
  10: [{ who: 'bolt', text: 'Final lunar day! If I had a heart, it would be doing something complicated right now.' }],
};

/** Radio letters queued each morning. They arrive after the real one-way light delay (compressed). */
export const RADIO_LETTERS: Record<number, string> = {
  1: 'Welcome aboard! Our replies take {delay} minutes to reach you, so ask your questions early.',
  3: 'Your families say hello. Theo\'s mum says to wear a sweater. On Mars. Indoors. Mums are like that.',
  6: 'This message travelled about {mkm} million km to reach you. It did not stop for snacks.',
  8: 'Supply ship on schedule. They packed extra seeds and one rubber duck. Nobody will say why.',
};

export const MOON_RADIO_LETTERS: Record<number, string> = {
  1: 'Welcome to the Moon greenhouse! Our short radio delay is simulated in this game, so ask your questions early.',
  3: 'Your families say hello. Theo’s mum says to stay cozy through the simulated dark stretch. Mums are like that.',
  6: 'Your message travelled a short simulated distance in this game. It did not stop for snacks.',
  8: 'The next team is on schedule. They packed extra seeds and one rubber duck. Nobody will say why.',
};

/** Things crew say when you talk to them. Cycles through in order. */
export const CHAT: Record<'rosa' | 'theo' | 'priya' | 'bolt', Line[]> = {
  rosa: [
    { who: 'rosa', text: 'Mars has no pizza places. It does have an excellent selection of rocks.' },
    { who: 'rosa', text: 'A good commander has a plan. A great commander has a plan for when the plan eats itself.' },
    { who: 'rosa', text: 'This dome is mostly glass and partly optimism. Please do not throw anything at either.' },
    { who: 'rosa', text: 'I do not worry about solar storms. I worry about Theo\'s singing. The storms, at least, stop.' },
  ],
  theo: [
    { who: 'theo', text: '{fact:plant-oxygen} We use the oxygen; plants use the carbon dioxide. It is a nice exchange.' },
    { who: 'theo', text: '{fact:veggie-lettuce} Sensible name. Much better than my suggestion, "Leafy McOrbitface."' },
    { who: 'theo', text: '{fact:veggie-zinnia} Some sols, flowers make the whole station feel more like home.' },
    { who: 'theo', text: 'I sang to the radishes and they grew. Science says that is probably a coincidence. I say science is being rude.' },
  ],
  priya: [
    { who: 'priya', text: 'Every machine here is held together by careful design, clever engineering and, in one place, a sticker that says "Do Not Remove."' },
    { who: 'priya', text: 'Regolith is Mars dirt. Pack 3 loads on the dome at the workbench and our shield gets thicker. It is the least glamorous blanket in the universe.' },
    { who: 'priya', text: 'Power is like pizza. Everyone wants more, there is never enough, and the heater always takes a slice.' },
    { who: 'priya', text: 'The rover moves slowly on purpose. On Mars, if you break something, the nearest repair shop is very, very far away.' },
  ],
  bolt: [
    { who: 'bolt', text: 'I have calculated the odds of a perfect harvest. They are good! I will not say how good. Hope works better when you don\'t measure it.' },
    { who: 'bolt', text: 'Radio messages from Earth take {delay} minutes to get here. I always say "thank you" early, so it is waiting for them.' },
    { who: 'bolt', text: 'I once drove in a perfect circle for an hour. I was not lost. I was being thorough.' },
    { who: 'bolt', text: 'I wave at Earth every evening. It is very far away, so I wave extra hard.', mood: 'happy' },
  ],
};

/** Adjust the few Mars-specific crew lines used in shared farm interactions. */
export function adaptWorldLines(lines: Line[], worldId: 'mars' | 'moon'): Line[] {
  if (worldId === 'mars') return lines;
  return lines.map((line) => ({
    ...line,
    text: line.text
      .replace(/Mars/g, 'the Moon')
      .replace(/mars/gi, 'the Moon')
      .replace(/storm shelter/gi, 'radiation shelter')
      .replace(/sols/gi, 'days')
      .replace(/\bsol\b/gi, 'day')
      .replace(/solar storms?/gi, 'radiation alerts')
      .replace(/storms?/gi, 'radiation events')
      .replace(/regolith is the Moon dirt/gi, 'lunar regolith is Moon surface material')
      .replace(/the supply ship arrives after tomorrow/gi, 'the next team arrives after tomorrow')
      .replace(/the only tree on the Moon/gi, 'a tiny greenhouse tree on the Moon'),
  }));
}

export function introForWorld(worldId: 'mars' | 'moon') {
  return worldId === 'moon' ? MOON_INTRO : INTRO;
}

export function tutorialForWorld(worldId: 'mars' | 'moon') {
  return worldId === 'moon' ? MOON_TUTORIAL : TUTORIAL;
}

export function dayBeatsForWorld(worldId: 'mars' | 'moon') {
  return worldId === 'moon' ? MOON_DAY_BEATS : SOL_BEATS;
}

export function radioLettersForWorld(worldId: 'mars' | 'moon') {
  return worldId === 'moon' ? MOON_RADIO_LETTERS : RADIO_LETTERS;
}

export const REACT = {
  stormWarningBolt: { who: 'bolt', text: 'Do not worry. Or rather: worry exactly the right amount, then do something useful. Like putting cells in the shelter.', mood: 'worried' } as Line,
  stormSafe: { who: 'bolt', text: 'The storm passed and the shelter held! I would like to celebrate by doing absolutely nothing for four seconds.', mood: 'happy' } as Line,
  stormUnsafe: { who: 'bolt', text: 'That storm was stronger than our shelter. We hid, the grow lights went off, and a plant wilted. Next time: more shelter cells or a thicker shield.', mood: 'worried' } as Line,
  roverStorm: { who: 'bolt', text: 'The storm caught me outside! I am fine, but the rover needs repairs and I lost the cargo. I have decided not to talk about it.', mood: 'worried' } as Line,
  roverBattery: { who: 'bolt', text: 'My battery ran flat. I am now a very expensive garden ornament. The crew will tow me home tonight.', mood: 'worried' } as Line,
  roverHome: { who: 'bolt', text: 'Home! I brought presents: {items}.', mood: 'happy' } as Line,
  roverEmpty: { who: 'bolt', text: 'Home! I brought back nothing but stories. And a little dust. Mostly dust.' } as Line,
  firstHarvest: { who: 'theo', text: 'Our first harvest! I would like to thank the plant, the water, the light, and you. In that order. It\'s in the kitchen now: mix two crops into a recipe and it feeds us more!' } as Line,
  zinnia: { who: 'rosa', text: 'A flower. On Mars. Put it on the table, please. That is an order. Later, the kitchen can save its seeds.' } as Line,
  noRoverPower: { who: 'priya', text: 'The rover battery is empty today. Put a cell in the ROVER slot tomorrow morning if you want Bolt to drive.' } as Line,
};

export const RESCUE: Line[] = [
  { who: 'radio', text: 'We\'re reading low supplies. A rescue ship is on its way. Nobody is in trouble. Missions like this are how everyone learns.' },
  { who: 'bolt', text: 'Let\'s try a new plan! I have already forgotten the old one, on purpose. It was very sad.', mood: 'happy' },
];

export const VICTORY: Line[] = [
  { who: 'rosa', text: 'Ten sols. Everyone is here, everyone is breathing, and we have salad. Mission accomplished.' },
  { who: 'theo', text: 'The plants say thank you. Well. They are mostly silent. But it is a grateful sort of silence.' },
  { who: 'bolt', text: 'The supply ship has landed. I am going to wave at it. Extra hard.', mood: 'happy' },
];

// ---------- easter eggs ----------
export const EGGS = {
  total: 6,
  bed: { who: 'you', text: 'You lie down. The crew is still waiting for the morning power plan, so you get up again, a bit more rested and a lot more dusty. (Once the day starts, a bed lets you sleep until night.)' } as Line,
  earth: [
    { who: 'you', text: 'That little blue dot is Earth, painted on the wall.' },
    { who: 'bolt', text: 'I check on the Earth picture every hour. It has never moved. I find that suspicious.' },
  ] as Line[],
  gerald: [
    { who: 'priya', text: 'That is Gerald, the dome\'s houseplant. Gerald is not part of the experiment.' },
    { who: 'priya', text: 'Gerald is simply here. Gerald has always been here. Nobody remembers packing Gerald.' },
  ] as Line[],
  bolt42: { who: 'bolt', text: 'You have talked to me 42 times. That number feels important, but I have forgotten why. Something about a very big question.', mood: 'happy' } as Line,
  mysterySeed: { who: 'you', text: 'You plant the "DO NOT PLANT" seed in Gerald\'s spare pot. It feels like the right thing to do. It is definitely the wrong thing to do.' } as Line,
  mysteryTree: [
    { who: 'theo', text: 'It is... a tree. A tiny tree. Overnight.' },
    { who: 'bolt', text: 'Congratulations. You have grown the only tree on Mars. Please do not tell the tree. It will get ideas.', mood: 'happy' },
  ] as Line[],
  propeller: { who: 'bolt', text: 'I found a tiny propeller in the sand! In our story it is just a mystery. But the real fact that inspired it is on the card below.', mood: 'happy' } as Line,
};
