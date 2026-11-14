import Phaser from 'phaser';
import { pixelTexture, type Palette } from '../art/pixel';
import type { Crop } from '../data/loaders';

// 8×8 icons drawn at 2× (16×16). Original art.
const K = '#2b1d2a';

const ICONS: Record<string, { rows: string[]; pal: Palette }> = {
  power: { rows: ['..KKKK..', '.KYYYYK.', '.KYYWYK.', '.KYWWYK.', '.KWWYYK.', '.KYWYYK.', '.KYYYYK.', '..KKKK..'], pal: { K, Y: '#ffd166', W: '#fff7d6' } },
  air: { rows: ['..KKKK..', '.KBBBBK.', 'KBWBBBBK', 'KBWBBBBK', 'KBBBBBBK', 'KBBBBBBK', '.KBBBBK.', '..KKKK..'], pal: { K, B: '#8fd3ff', W: '#ffffff' } },
  food: { rows: ['.....LL.', '....LL..', '...KOK..', '..KOOK..', '.KOOK...', 'KOOK....', 'KOK.....', '.K......'], pal: { K, L: '#6aa84f', O: '#f08a3a' } },
  water: { rows: ['...K....', '..KBK...', '..KBK...', '.KBBBK..', 'KBBWBBK.', 'KBWBBBK.', '.KBBBK..', '..KKK...'], pal: { K, B: '#5aa9e6', W: '#cfe9f5' } },
  ice: { rows: ['........', '.KKKKKK.', '.KIIWIK.', '.KIWIIK.', '.KIIIIK.', '.KIIIIK.', '.KKKKKK.', '........'], pal: { K, I: '#bfe8ff', W: '#ffffff' } },
  regolith: { rows: ['........', '...KKK..', '..KRRRK.', '.KRRDRRK', 'KRDRRRRK', 'KRRRRDRK', '.KKKKKK.', '........'], pal: { K, R: '#b5532f', D: '#7d3a20' } },
  seed: { rows: ['..KKKK..', '...KK...', '..KSSK..', '.KSSSSK.', '.KSLSSK.', '.KSSSSK.', '.KKKKKK.', '........'], pal: { K, S: '#d8b98a', L: '#6aa84f' } },
  sample: { rows: ['..KKKK..', '..KWWK..', '..KWWK..', '..KRRK..', '..KRRK..', '..KRRK..', '...KK...', '........'], pal: { K, W: '#e8f4ff', R: '#c0603a' } },
  shield: { rows: ['.KKKKKK.', 'KMMMMMMK', 'KMWMMMMK', 'KMMMMMMK', '.KMMMMK.', '.KMMMMK.', '..KMMK..', '...KK...'], pal: { K, M: '#9aa3b0', W: '#ffffff' } },
  parts: { rows: ['...KK...', '.KKMMKK.', '.KMMMMK.', 'KMMKKMMK', 'KMMKKMMK', '.KMMMMK.', '.KKMMKK.', '...KK...'], pal: { K, M: '#b8c4cc' } },
  sun: { rows: ['...Y....', '.Y.Y.Y..', '..OOO...', 'YOOOOOY.', '..OOO...', '.Y.Y.Y..', '...Y....', '........'], pal: { Y: '#ffd166', O: '#f08a3a' } },
  can: { rows: ['........', 'KKKK....', 'KBBK.KK.', 'KBBKKBK.', 'KBBBBK..', 'KBBBBK..', 'KKKKKK..', '........'], pal: { K, B: '#5aa9e6' } },
  hand: { rows: ['..K.K...', '.KSKSK..', '.KSKSKK.', '.KSSSSK.', 'KSSSSSK.', '.KSSSSK.', '..KSSK..', '..KKKK..'], pal: { K, S: '#e8b48f' } },
  radio: { rows: ['.....K..', '....K...', '.KKKKKK.', '.KMMMMK.', '.KMDDMK.', '.KMMMMK.', '.KKKKKK.', '........'], pal: { K, M: '#8b94a3', D: '#7ee081' } },
  heater: { rows: ['..O.O...', '.O.O.O..', '..O.O...', 'KKKKKKK.', 'KRRRRRK.', 'KRKRKRK.', 'KKKKKKK.', '........'], pal: { K, O: '#f08a3a', R: '#e05050' } },
  light: { rows: ['..KKKK..', '.KYYYYK.', '.KYWWYK.', '.KYYYYK.', '..KYYK..', '..KMMK..', '..KKKK..', '.Y.Y.Y..'], pal: { K, Y: '#fff1a8', W: '#ffffff', M: '#8b94a3' } },
  rover: { rows: ['........', '.....KK.', '.KKKKKK.', 'KMMMMMMK', 'KMSSMMMK', 'KKKKKKKK', '.KK..KK.', '........'], pal: { K, M: '#b8c4cc', S: '#3d6fb5' } },
};

export const ITEM_ICON: Record<string, string> = {
  water: 'icon-water', ice: 'icon-ice', regolith: 'icon-regolith', seed: 'icon-seed', parts: 'icon-parts', sample: 'icon-sample',
};

export function makeIcons(scene: Phaser.Scene, crops: Crop[]) {
  for (const [name, icon] of Object.entries(ICONS)) pixelTexture(scene, `icon-${name}`, icon.rows, icon.pal);
  // Seed packets coloured per crop for the hotbar.
  for (const crop of crops) pixelTexture(scene, `icon-seed-${crop.id}`, ICONS.seed.rows, { ...ICONS.seed.pal, L: crop.color });
  for (const [name, icon] of Object.entries(ICONS)) pixelTexture(scene, `big-${name}`, icon.rows, icon.pal, 4);
}
