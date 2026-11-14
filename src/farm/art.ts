import Phaser from 'phaser';
import { pixelTexture, swap, hash, noiseTile, type Palette } from '../art/pixel';
import type { Crop } from '../data/loaders';

// Original pixel art for the dome: characters, crops, floor, plots and machines.
// Sprites are authored at 16×16 and drawn at 2× so each tile is 32×32.

const K = '#2b1d2a';

// ---------- characters ----------

const DOWN_SHORT = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '...KHSSSSSSHK...',
  '...KSSESSESSK...',
  '...KSSSSSSSSK...',
  '....KSSMMSSK....',
  '.....KKSSKK.....',
  '....KCCCCCCK....',
  '...KCCWCCWCCK...',
  '..KSKCCCCCCKSK..',
  '...KKCCCCCCKK...',
  '....KPPPPPPK....',
  '....KPPKKPPK....',
  '....KBBKKBBK....',
];
const UP_SHORT = DOWN_SHORT.map((r, i) => (i >= 4 && i <= 7 ? ['...KHHHHHHHHK...', '...KHHHHHHHHK...', '...KHHHHHHHHK...', '....KHHHHHHK....'][i - 4] : r));
const SIDE_SHORT = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHSK...',
  '...KHHHHSSSSK...',
  '...KHHHSSSESK...',
  '...KHHSSSSSSK...',
  '....KHSSSSMK....',
  '.....KKSSKK.....',
  '.....KCCCCK.....',
  '....KCCCCCCK....',
  '....KCCSSCCK....',
  '....KCCCCCCK....',
  '.....KPPPPK.....',
  '.....KPPPPK.....',
  '.....KBBKBBK....',
];
const stepLegs = (rows: string[], a: string, b: string) => [...rows.slice(0, 14), a, b];

// Hairstyles: replacement rows (by row number) on top of the short-hair grids above.
export type HairStyle = 'short' | 'long' | 'puffs';
const HAIR: Record<HairStyle, { down: Record<number, string>; up: Record<number, string>; side: Record<number, string> }> = {
  short: { down: {}, up: {}, side: {} },
  long: {
    down: {
      5: '..KHSSESSESSHK..',
      6: '..KHSSSSSSSSHK..',
      7: '..KHKSSMMSSKHK..',
      8: '..KHHKKSSKKHHK..',
      9: '..KHKCCCCCCKHK..',
    },
    up: { 8: '...KHHHHHHHHK...', 9: '...KHHHHHHHHK...' },
    side: { 8: '...KHHKSSKK.....', 9: '...KHHCCCCK.....' },
  },
  puffs: {
    down: { 1: '..KK.KKKKKK.KK..', 2: '.KHHKHHHHHHKHHK.', 3: '..KKHHHHHHHHKK..' },
    up: { 1: '..KK.KKKKKK.KK..', 2: '.KHHKHHHHHHKHHK.', 3: '..KKHHHHHHHHKK..' },
    side: { 1: '..KK.KKKKKK.....', 2: '.KHHKHHHHHHK....', 3: '..KKHHHHHHHSK...' },
  },
};
const withHair = (rows: string[], edits: Record<number, string>) => rows.map((r, i) => edits[i] ?? r);

export interface Look {
  hair: string;
  skin: string;
  suit: string;
  pants?: string;
  hairStyle?: HairStyle;
}

export const LOOKS: Record<string, Look> = {
  player: { hair: '#5b3a29', skin: '#e8b48f', suit: '#3fa7a0' },
  rosa: { hair: '#1f1a24', skin: '#a8714f', suit: '#e07a3a' }, // Commander Rosa Vey
  theo: { hair: '#d9a441', skin: '#f0c9a6', suit: '#6aa84f' }, // Dr. Theo Marsh, botanist
  priya: { hair: '#2a1712', skin: '#c48a62', suit: '#8e6bbf' }, // Engineer Priya Rao
};

function lookPalette(l: Look): Palette {
  const darker = Phaser.Display.Color.HexStringToColor(l.skin).darken(18).rgba;
  return { K, H: l.hair, S: l.skin, E: K, M: darker, C: l.suit, W: '#f4efe6', P: l.pants ?? '#3b3a4f', B: '#5a3b2e' };
}

export function makeCharacter(scene: Phaser.Scene, name: string, look: Look) {
  const pal = lookPalette(look);
  const hair = HAIR[look.hairStyle ?? 'short'];
  const DOWN = withHair(DOWN_SHORT, hair.down);
  const UP = withHair(UP_SHORT, hair.up);
  const SIDE = withHair(SIDE_SHORT, hair.side);
  const walkDown = stepLegs(DOWN, '...KPPK..KPPK...', '...KBBK..KBBK...');
  const walkUp = stepLegs(UP, '...KPPK..KPPK...', '...KBBK..KBBK...');
  const walkSide = stepLegs(SIDE, '....KPPKKPPK....', '...KBBK..KBBK...');
  pixelTexture(scene, `${name}-down-0`, DOWN, pal);
  pixelTexture(scene, `${name}-down-1`, walkDown, pal);
  pixelTexture(scene, `${name}-up-0`, UP, pal);
  pixelTexture(scene, `${name}-up-1`, walkUp, pal);
  pixelTexture(scene, `${name}-right-0`, SIDE, pal);
  pixelTexture(scene, `${name}-right-1`, walkSide, pal);
  pixelTexture(scene, `${name}-left-0`, SIDE, pal, 2, true);
  pixelTexture(scene, `${name}-left-1`, walkSide, pal, 2, true);
  pixelTexture(scene, `portrait-${name}`, DOWN.slice(0, 13), pal, 4);
  // Rebuild the walk animations every time: they hold the frames of the textures drawn above,
  // and redrawing a look (the customiser) deletes the old ones. Stale frames left the player
  // texture-less and stuck on the spot.
  for (const dir of ['down', 'up', 'left', 'right']) {
    scene.anims.remove(`${name}-walk-${dir}`);
    scene.anims.create({
      key: `${name}-walk-${dir}`,
      frames: [{ key: `${name}-${dir}-1` }, { key: `${name}-${dir}-0` }],
      frameRate: 6,
      repeat: -1,
    });
  }
}

const BOLT = [
  '.......KK.......',
  '.......YK.......',
  '......KKKK......',
  '....KKKKKKKK....',
  '...KGGGGGGGGK...',
  '...KGDDDDDDGK...',
  '...KGDCDDCDGK...',
  '...KGDDDDDDGK...',
  '...KGGGGGGGGK...',
  '....KKKKKKKK....',
  '...KGOGGGGOGK...',
  '..KGKGGGGGGKGK..',
  '..KK.KGGGGK.KK..',
  '.....KKKKKK.....',
  '....KTTKKTTK....',
  '....KKK..KKK....',
];
const BOLT_PAL: Palette = { K, Y: '#ffd166', G: '#b8c4cc', D: '#23313f', C: '#5ee7ff', O: '#e07a3a', T: '#4a4a5a' };

export function makeBolt(scene: Phaser.Scene) {
  pixelTexture(scene, 'bolt', BOLT, BOLT_PAL);
  const happy = BOLT.map((r, i) => (i === 6 ? '...KGDDDDDDGK...' : i === 5 ? '...KGDCDDCDGK...' : r));
  const worried = BOLT.map((r, i) => (i === 6 ? '...KGDCDDCDGK...' : i === 7 ? '...KGDDCCDDGK...' : r));
  pixelTexture(scene, 'bolt-happy', happy, BOLT_PAL);
  pixelTexture(scene, 'bolt-worried', worried, BOLT_PAL);
  pixelTexture(scene, 'portrait-bolt', BOLT, BOLT_PAL, 4);
  pixelTexture(scene, 'portrait-bolt-happy', happy, BOLT_PAL, 4);
  pixelTexture(scene, 'portrait-bolt-worried', worried, BOLT_PAL, 4);
  // Mission Control is a radio, not a person: a speaker grille portrait.
  pixelTexture(
    scene,
    'portrait-radio',
    [
      '................',
      '..........K.....',
      '.........KYK....',
      '..KKKKKKKKKKKK..',
      '..KMMMMMMMMMMK..',
      '..KMDDDDDDDOMK..',
      '..KMDGGDGGDMMK..',
      '..KMDDDDDDDOMK..',
      '..KMMMMMMMMMMK..',
      '..KMDMDMDMDMMK..',
      '..KMMMMMMMMMMK..',
      '..KKKKKKKKKKKK..',
    ],
    { K, Y: '#ffd166', M: '#8b94a3', D: '#23313f', G: '#7ee081', O: '#e07a3a' },
    4,
  );
}

// ---------- crops ----------

const STAGES: Record<string, string[][]> = {
  common: [
    ['', '', '', '', '', '', '', '', '', '', '', '......s..s......', '.......ss.......'],
    ['', '', '', '', '', '', '', '', '', '......L..L......', '.....LLLLLL.....', '.......LL.......', '.......LL.......'],
    ['', '', '', '', '', '', '......L..L......', '....L.LL.LL.L...', '....LLLDLLLL....', '.....LLDDLL.....', '......LLLL......', '.......LL.......', '.......LL.......'],
  ],
  'red-romaine': [['', '', '', '......F..F......', '....F.FFFF.F....', '...FFFFLLFFFF...', '..FFFLLLLLLFFF..', '..FFLLLDDLLLFF..', '...FFLLDDLLFF...', '....FFLLLLFF....', '.....FFFFFF.....', '......FFFF......', '.......LL.......']],
  mizuna: [['', '', '', '...L..L..L..L...', '..LL.LL.LL.LL...', '..LLLLDLLDLLL...', '...LLDDLLDDLL...', '..LLLLDDDDLLLL..', '...LLLLDDLLLL...', '....LLLDDLLL....', '......LDDL......', '.......LL.......', '.......LL.......']],
  radish: [['', '', '', '.....L....L.....', '....LLL..LLL....', '....LDLL.LDL....', '.....LDLLDL.....', '......LDDL......', '.......LL.......', '......FFFF......', '.....FFFFFF.....', '.....FFWFFF.....', '......FFFF......', '.......FF.......']],
  chile: [['', '', '.......LL.......', '.....LLLLLL.....', '....LLDLLDLL....', '...LLFLLLLFLL...', '...LLFLDDLFLL...', '....LFLLLLLFL...', '....LLLFLLLF....', '.....LLFLLLL....', '......LLLLL.....', '.......DD.......', '.......DD.......']],
  zinnia: [['', '......FFFF......', '.....FFFFFF.....', '....FFFCCFFF....', '....FFCCCCFF....', '....FFFCCFFF....', '.....FFFFFF.....', '......FFFF......', '.......L........', '.....LLL........', '....LLLL.LL.....', '.......LLLL.....', '.......L........', '.......L........']],
};

export function makeCrops(scene: Phaser.Scene, crops: Crop[]) {
  for (const crop of crops) {
    const leaf = crop.id === 'red-romaine' ? '#6aa84f' : '#5fae4a';
    const pal: Palette = { L: leaf, D: '#3d7a35', F: crop.color, W: '#ffe3ea', C: '#8a4b1f', s: '#c9a46a' };
    const wilt: Palette = { L: '#8a7a5a', D: '#6b5a40', F: '#7d6248', W: '#a08a70', C: '#5a4630', s: '#8a7a5a' };
    const stages = [...STAGES.common, ...(STAGES[crop.id] || STAGES.common.slice(2))];
    stages.forEach((rows, i) => {
      const padded = Array.from({ length: 16 }, (_, y) => rows[y] || '');
      pixelTexture(scene, `crop-${crop.id}-${i}`, padded, pal);
      pixelTexture(scene, `crop-${crop.id}-${i}-wilt`, padded, wilt);
    });
  }
}

/** Which of the 4 crop pictures to show for a plot's growth. */
export function cropStage(growthSols: number, growSols: number) {
  if (growthSols >= growSols) return 3;
  if (growthSols === 0) return 0;
  return growthSols / growSols < 0.5 ? 1 : 2;
}

// ---------- tiles ----------

function canvasTile(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

export function makeTiles(scene: Phaser.Scene) {
  // Dome floor: light metal panels with seams and rivets.
  canvasTile(scene, 'floor', 32, 32, (c) => {
    c.fillStyle = '#d8cfc0';
    c.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 2) for (let x = 0; x < 32; x += 2) if (hash(x, y, 3) < 0.08) { c.fillStyle = '#cfc5b4'; c.fillRect(x, y, 2, 2); }
    c.fillStyle = '#b3a895';
    c.fillRect(0, 0, 32, 2);
    c.fillRect(0, 0, 2, 32);
    c.fillStyle = '#a0957f';
    [[4, 4], [26, 4], [4, 26], [26, 26]].forEach(([x, y]) => c.fillRect(x, y, 2, 2));
  });
  // Greenhouse floor: green-tinted mats around the plots.
  canvasTile(scene, 'mat', 32, 32, (c) => {
    c.fillStyle = '#a9c79a';
    c.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 4) { c.fillStyle = '#9dbb8e'; c.fillRect(0, y, 32, 2); }
  });
  // Planter plots: metal frame + soil.
  const plot = (key: string, soil: string, furrow: string) =>
    canvasTile(scene, key, 32, 32, (c) => {
      c.fillStyle = '#6f7480';
      c.fillRect(0, 0, 32, 32);
      c.fillStyle = soil;
      c.fillRect(2, 2, 28, 28);
      for (let y = 6; y < 30; y += 6) { c.fillStyle = furrow; c.fillRect(4, y, 24, 2); }
      for (let y = 2; y < 30; y += 2) for (let x = 2; x < 30; x += 2) if (hash(x, y, key.length) < 0.1) { c.fillStyle = furrow; c.fillRect(x, y, 2, 2); }
    });
  plot('plot-dry', '#9a6a45', '#82563a');
  plot('plot-wet', '#5c3a26', '#4a2d1d');
  // Mars ground outside the glass.
  noiseTile(scene, 'mars', 32, '#b5532f', [['#a24826', 0.18], ['#c9663c', 0.12], ['#8f3d22', 0.05]], 7);
  // Glass wall with Mars outside.
  canvasTile(scene, 'wall', 32, 32, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#e2b07a');
    g.addColorStop(0.6, '#d48a5a');
    g.addColorStop(1, '#a8492c');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#8f3d22';
    c.fillRect(0, 22, 32, 10);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(6, 2, 2, 18);
    c.fillRect(10, 2, 2, 8);
    c.fillStyle = '#4b5361';
    c.fillRect(0, 0, 32, 3);
    c.fillRect(0, 29, 32, 3);
    c.fillRect(0, 0, 3, 32);
  });
  canvasTile(scene, 'wall-side', 32, 32, (c) => {
    c.fillStyle = '#4b5361';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#5e6676';
    c.fillRect(4, 0, 4, 32);
    c.fillStyle = '#3a404c';
    for (let y = 2; y < 32; y += 8) c.fillRect(12, y, 16, 2);
  });
  // Airlock door with hazard stripes.
  canvasTile(scene, 'door', 32, 32, (c) => {
    c.fillStyle = '#4b5361';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#9aa3b0';
    c.fillRect(4, 4, 24, 28);
    c.fillStyle = '#2b1d2a';
    c.fillRect(15, 4, 2, 28);
    for (let x = 4; x < 28; x += 6) { c.fillStyle = '#ffd166'; c.fillRect(x, 4, 3, 4); c.fillStyle = '#2b1d2a'; c.fillRect(x + 3, 4, 3, 4); }
    c.fillStyle = '#7ee081';
    c.fillRect(24, 16, 2, 2);
  });
  // Earth "window" poster for an easter egg.
  canvasTile(scene, 'earth-window', 32, 32, (c) => {
    c.fillStyle = '#4b5361';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#0b1026';
    c.fillRect(4, 4, 24, 24);
    for (let i = 0; i < 12; i++) { c.fillStyle = '#ffffff'; c.fillRect(4 + Math.floor(hash(i, 1, 9) * 24), 4 + Math.floor(hash(i, 2, 9) * 24), 1, 1); }
    c.fillStyle = '#3d7bd9';
    c.beginPath();
    c.arc(16, 16, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6aa84f';
    c.fillRect(13, 13, 3, 3);
    c.fillRect(17, 17, 2, 2);
    c.fillStyle = '#ffffff';
    c.fillRect(15, 11, 3, 1);
  });
}

// ---------- machines (16×16 → 32×32) ----------

const MACHINES: Record<string, { rows: string[]; pal: Palette }> = {
  console: {
    rows: ['................', '..KKKKKKKKKKKK..', '..KMMMMMMMMMMK..', '..KMDDDDDDDDMK..', '..KMDYYDGGDDMK..', '..KMDYYDGGDBMK..', '..KMDDDDDDDDMK..', '..KMMMMMMMMMMK..', '.KKKKKKKKKKKKKK.', '.KMMRMMGMMYMMMK.', '.KMMMMMMMMMMMMK.', '.KKKKKKKKKKKKKK.', '..KMK......KMK..', '..KMK......KMK..', '..KKK......KKK..'],
    pal: { K, M: '#8b94a3', D: '#23313f', Y: '#ffd166', G: '#7ee081', B: '#5ee7ff', R: '#e05050' },
  },
  melter: {
    rows: ['................', '.....KKKKKK.....', '....KMMMMMMK....', '...KMWWWWWWMK...', '...KWBBBBBBWK...', '...KWBBIIBBWK...', '...KWBBIIBBWK...', '...KWBBBBBBWK...', '...KWBBBBBBWK...', '...KMMMMMMMMK...', '...KMRMMMMOMK...', '...KMMMMMMMMK...', '...KKKKKKKKKK...', '....KMK..KMK....', '....KKK..KKK....'],
    pal: { K, M: '#8b94a3', W: '#cfe9f5', B: '#5aa9e6', I: '#eaf8ff', R: '#e05050', O: '#7ee081' },
  },
  bench: {
    rows: ['................', '................', '................', '................', '...KK....KKK....', '..KTTK..KGGGK...', '...KK....KKK....', 'KKKKKKKKKKKKKKKK', 'KWWWWWWWWWWWWWWK', 'KDDDDDDDDDDDDDDK', 'KKKKKKKKKKKKKKKK', '.KDK........KDK.', '.KDK........KDK.', '.KDK........KDK.', '.KKK........KKK.'],
    pal: { K, T: '#e07a3a', G: '#b8c4cc', W: '#9a7b5a', D: '#6e5236' },
  },
  radio: {
    rows: ['................', '..........K.....', '..........K.....', '.........KYK....', '..KKKKKKKKKKKK..', '..KMMMMMMMMMMK..', '..KMDDDDDDDOMK..', '..KMDGGDDDDMMK..', '..KMDDDDDDDOMK..', '..KMMMMMMMMMMK..', '..KMKKMMMMKKMK..', '..KMKKMMMMKKMK..', '..KKKKKKKKKKKK..', '...KMK....KMK...', '...KKK....KKK...'],
    pal: { K, Y: '#ffd166', M: '#8b94a3', D: '#23313f', G: '#7ee081', O: '#e07a3a' },
  },
  bed: {
    rows: ['................', '................', '................', '................', 'KKKKKK..........', 'KWWWWKKKKKKKKKKK', 'KWWWWKBBBBBBBBBK', 'KWWWWKBBBBBBBBBK', 'KKKKKKBBBBBBBBBK', 'KMMMMMMMMMMMMMMK', 'KKKKKKKKKKKKKKKK', 'KK............KK'],
    pal: { K, W: '#f4efe6', B: '#3fa7a0', M: '#8b94a3' },
  },
  kitchen: {
    rows: ['......S..S......', '.....S..S.......', '.....KKKKKK.....', '....KMMMMMMK....', '...KKKKKKKKKK...', '...KPPPPPPPPK...', '...KPPPPPPPPK...', 'KKKKKKKKKKKKKKKK', 'KWWWWWWWWWWWWWWK', 'KWKKKKWWWWKKKKWK', 'KWKDDKWWWWKRRKWK', 'KWKDDKWWWWKRRKWK', 'KWKKKKWWWWKKKKWK', 'KWWWWWWWWWWWWWWK', 'KKKKKKKKKKKKKKKK', '.KK..........KK.'],
    pal: { K, S: '#cfe9f5', M: '#b8c4cc', P: '#8b94a3', W: '#e8e0d0', D: '#23313f', R: '#e07a3a' },
  },
  shelter: {
    rows: ['................', '................', '...KKKKKKKKKK...', '..KMMMMMMMMMMK..', '.KMYKYKYKYKYMK..', '.KMKYKYKYKYKMK..', '.KMMMMMMMMMMMK..', '.KMMMKKKKMMMMK..', '.KMMKDDDDKMMMK..', '.KMMKDDDDKMMMK..', '.KMMMKKKKMMMMK..', '.KMMMMMMMMMMMK..', '..KKKKKKKKKKK...'],
    pal: { K, M: '#8b94a3', Y: '#ffd166', D: '#23313f' },
  },
  crate: {
    rows: ['................', '................', '................', '..KKKKKKKKKKKK..', '..KWWWWWWWWWWK..', '..KWDWWWWWWDWK..', '..KWWDWWWWDWWK..', '..KWWWDWWDWWWK..', '..KWWWWDDWWWWK..', '..KWWWDWWDWWWK..', '..KWWDWWWWDWWK..', '..KWDWWWWWWDWK..', '..KWWWWWWWWWWK..', '..KKKKKKKKKKKK..'],
    pal: { K, W: '#c99a5e', D: '#9a7040' },
  },
  tank: {
    rows: ['................', '....KKKKKKKK....', '...KWWWWWWWWK...', '...KBBBBBBBBK...', '...KBWBBBBBBK...', '...KBWBBBBBBK...', '...KBBBBBBBBK...', '...KBBBBBBBBK...', '...KBBBBBBBBK...', '...KMMMMMMMMK...', '...KBBBBBBBBK...', '...KBBBBBBBBK...', '...KWWWWWWWWK...', '....KKKKKKKK....'],
    pal: { K, W: '#cfe9f5', B: '#5aa9e6', M: '#8b94a3' },
  },
  moxie: {
    rows: ['................', '....KKKKKKKK....', '...KYYYYYYYYK...', '...KYOYYYYOYK...', '...KYYYYYYYYK...', '...KYYKKKKYYK...', '...KYYKBBKYYK...', '...KYYKBBKYYK...', '...KYYKKKKYYK...', '...KYYYYYYYYK...', '.KKKMMMMMMMMKKK.', '.KCKMMMMMMMMKCK.', '.KCKKKKKKKKKKCK.', '.KCK........KCK.', '.KKK........KKK.'],
    pal: { K, Y: '#e0b44f', O: '#fff3b0', M: '#8b94a3', B: '#8fd3ff', C: '#cfe9f5' },
  },
  treadmill: {
    rows: ['................', '................', '.KKKK...........', '.KGRK...........', '.KKKK...........', '..KMK...........', '..KMK...........', '..KMK...........', '..KMK...........', '..KMKKKKKKKKKKK.', '.KMMDDDDDDDDDDK.', '.KMDBDDBDDBDDDK.', '.KMMDDDDDDDDDDK.', '.KKKKKKKKKKKKKK.', '..KK........KK..'],
    pal: { K, G: '#7ee081', R: '#e05050', M: '#8b94a3', D: '#3b3a4f', B: '#9aa3b0' },
  },
  panel: {
    rows: ['................', '.KKKKKKKKKKKKKK.', '.KBBLKBBLKBBBLK.', '.KBBBKBBBKBBBBK.', '.KKKKKKKKKKKKKK.', '.KBBLKBBLKBBBLK.', '.KBBBKBBBKBBBBK.', '.KKKKKKKKKKKKKK.', '.KBBLKBBLKBBBLK.', '.KBBBKBBBKBBBBK.', '.KKKKKKKKKKKKKK.', '.......KK.......', '.......KK.......', '.......KK.......', '.....KKKKKK.....', '.....KMMMMK.....'],
    pal: { K, B: '#2f5fa8', L: '#8fd3ff', M: '#8b94a3' },
  },
  plant: {
    rows: ['................', '......L.L.......', '.....LLLLL......', '....LLDLLLL.....', '.....LLLDL......', '......LDL.......', '.......L........', '.....KKKKK......', '.....KPPPK......', '.....KPPPK......', '......KKK.......'],
    pal: { K, L: '#6aa84f', D: '#3d7a35', P: '#e07a3a' },
  },
};

export function makeMachines(scene: Phaser.Scene) {
  for (const [name, m] of Object.entries(MACHINES)) {
    const padded = Array.from({ length: 16 }, (_, y) => m.rows[y] || '');
    pixelTexture(scene, `m-${name}`, padded, m.pal);
  }
  // The same solar panel with Mars dust on some of its cells.
  const dusty = MACHINES.panel.rows.map((r, y) => r.replace(/[BL]/g, (c, x: number) => ((x * 7 + y * 3) % 3 === 0 ? 'U' : c)));
  pixelTexture(scene, 'm-panel-dusty', dusty, { ...MACHINES.panel.pal, U: '#b5793f' });
  // A "suspicious" seed packet (easter egg) and a tiny tree it grows into.
  pixelTexture(scene, 'egg-tree', swap(STAGES.zinnia[0].concat(['', '']).slice(0, 16), {}), { L: '#3d7a35', F: '#6aa84f', C: '#8a4b1f' });
}

export function makeFX(scene: Phaser.Scene) {
  canvasTile(scene, 'px', 2, 2, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 2, 2);
  });
  // A little heart that floats up when you pet your pet.
  canvasTile(scene, 'heart', 7, 6, (c) => {
    const rows = ['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return;
      c.fillStyle = ch === 'W' ? '#ffd6e6' : '#f0507a';
      c.fillRect(x, y, 1, 1);
    }));
  });
  canvasTile(scene, 'sparkle', 6, 6, (c) => {
    c.fillStyle = '#fff3b0';
    c.fillRect(2, 0, 2, 6);
    c.fillRect(0, 2, 6, 2);
  });
}

// ---------- pets (16×16, facing right; two walking frames) ----------

const PETS: Record<'cat' | 'dog' | 'alien', { rows: string[]; step: [string, string]; pal: Palette }> = {
  cat: {
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '..........K...K.',
      '.........KFK.KFK',
      '.........KFFKFFK',
      '.K.......KFFFFFK',
      'KFK......KFEFFEK',
      '.KFK.....KFFNFFK',
      '..KFKKKKKKFFFFK.',
      '..KFFDFFDFFFFK..',
      '...KFFFFFFFFFK..',
      '...KFK.KFK.KFK..',
      '...KK..KK..KK...',
    ],
    step: ['..KFK..KFKKFK...', '..KK...KK.KK....'],
    pal: { K, F: '#f0a050', D: '#c07030', E: K, N: '#f08fc0' },
  },
  dog: {
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '........KKKKK...',
      '.......KDFFFFK..',
      '.......KDFEFFFKK',
      '.KK....KDFFFFFFK',
      '..KF...KKFFFFTK.',
      '..KFKKKKFFFFFK..',
      '...KFFFFFFFFFK..',
      '...KFFFFFFFFK...',
      '...KFK.KFKKFK...',
    ],
    step: ['...KFFFFFFFFK...', '..KFK..KFK.KFK..'],
    pal: { K, F: '#c99a5e', D: '#8a5a35', E: K, T: '#f08fc0' },
  },
  alien: {
    rows: [
      '................',
      '................',
      '....KYK..KYK....',
      '.....K....K.....',
      '.....K....K.....',
      '....KKKKKKKK....',
      '...KGGGGGGGGK...',
      '..KGGWWGGWWGGK..',
      '..KGGWKGGWKGGK..',
      '..KGGGGGGGGGGK..',
      '..KGGKGGGGKGGK..',
      '..KGGGKKKKGGGK..',
      '...KGGGGGGGGK...',
      '....KGGGGGGK....',
      '....KGK..KGK....',
      '....KK....KK....',
    ],
    step: ['...KGK....KGK...', '...KK......KK...'],
    pal: { K, G: '#8fe07a', W: '#f4efe6', Y: '#ffd166' },
  },
};

export function makePets(scene: Phaser.Scene) {
  for (const [kind, p] of Object.entries(PETS)) {
    pixelTexture(scene, `pet-${kind}-0`, p.rows, p.pal);
    pixelTexture(scene, `pet-${kind}-1`, [...p.rows.slice(0, 14), ...p.step], p.pal);
    scene.anims.remove(`pet-${kind}-walk`);
    scene.anims.create({ key: `pet-${kind}-walk`, frames: [{ key: `pet-${kind}-1` }, { key: `pet-${kind}-0` }], frameRate: 8, repeat: -1 });
  }
}
