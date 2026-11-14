import type { ItemId } from '../core/types';
import type { HairStyle, Look } from './art';

// The player's astronaut and pet, picked on the "Make your astronaut" screen. Saved on its own
// so it survives new missions.

export type PetKind = 'cat' | 'dog' | 'alien' | 'none';

export interface Astronaut extends Look {
  kid: 'girl' | 'boy';
  hairStyle: HairStyle;
  pants: string;
  pet: PetKind;
}

export const SKINS = ['#f6d5b8', '#e8b48f', '#c98e66', '#a8714f', '#7d4f35', '#5a3726'];
export const HAIRS = ['#1f1a24', '#5b3a29', '#8a5a35', '#e0b44f', '#b0442c', '#d8d8e0', '#4a7bd0', '#e07ab0'];
export const SUITS = ['#3fa7a0', '#5aa9e6', '#e05050', '#ffd166', '#f08fc0', '#6aa84f', '#8e6bbf', '#f4efe6'];
export const PANTS = ['#3b3a4f', '#5a6b8a', '#6e5236', '#2f4f3f', '#8a3a4a'];

export const DEFAULT_ASTRONAUT: Astronaut = {
  kid: 'boy', hairStyle: 'short', hair: '#5b3a29', skin: '#e8b48f', suit: '#3fa7a0', pants: '#3b3a4f', pet: 'none',
};

/** The pet's job: once a sol, play with it and it brings back something useful. */
export const PET_TRICKS: Record<Exclude<PetKind, 'none'>, { name: string; item: ItemId; amount: number; line: string; already: string }> = {
  dog: {
    name: 'dog', item: 'ice', amount: 1,
    line: 'Your dog digs by the airlock and drags in a chunk of ice! +1 ice. (Mars really has ice under its dust: NASA\'s Phoenix lander dug some up in 2008.)',
    already: 'Your dog wags its tail. It already dug today. Try again tomorrow!',
  },
  cat: {
    name: 'cat', item: 'seed', amount: 1,
    line: 'Your cat knocks a box off the shelf... and a seed packet falls out! +1 seed.',
    already: 'Your cat purrs and ignores you. Cats help once a sol, at most.',
  },
  alien: {
    name: 'Mars alien', item: 'water', amount: 2,
    line: 'Your Mars alien hums at the air and dew drips into a cup. +2 water. (Real missions study pulling water out of Mars air and soil.)',
    already: 'Your alien blinks all of its eyes at you. It needs a sol to recharge.',
  },
};

const KEY = 'sol-sprouts:astronaut';

export function loadAstronaut(): Astronaut {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const a: Astronaut = { ...DEFAULT_ASTRONAUT, ...JSON.parse(raw) };
      if (a.kid === 'boy' && a.hairStyle === 'puffs') a.hairStyle = 'short'; // puffs are a girl's style
      return a;
    }
  } catch {
    /* private mode or bad data: use the default */
  }
  return { ...DEFAULT_ASTRONAUT };
}

export function saveAstronaut(a: Astronaut) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* storage is optional */
  }
}
