import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { FarmScene } from './scenes/FarmScene';
import { RoverScene } from './scenes/RoverScene';
import { DebriefScene } from './scenes/DebriefScene';
import { UIScene } from './ui/UIScene';
import { H, W } from './ui/theme';
import { store } from './core/store';

// 1280×720 canvas; the world cameras zoom 2× so the farm shows the same 640×360 view of
// 32×32 tiles that PLAN.md describes, while UI text renders crisply at full resolution.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0b1026',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, FarmScene, RoverScene, DebriefScene, UIScene],
});

// Handy for debugging in the browser console during development. `await selftest()` runs the
// PLAN.md section 6 play checks against a throwaway store.
if (import.meta.env.DEV) {
  const selftest = () => import('./core/selftest').then((m) => m.runSelfTest());
  Object.assign(window, { game, store, selftest });
}
