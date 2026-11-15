import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CustomizeScene } from './scenes/CustomizeScene';
import { FarmScene } from './scenes/FarmScene';
import { RoverScene } from './scenes/RoverScene';
import { DebriefScene } from './scenes/DebriefScene';
import { UIScene } from './ui/UIScene';
import { H, W } from './ui/theme';
import { store } from './core/store';
import { initializeViewport } from './ui/viewport';
import { initializeReadableView } from './ui/readable';

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
  scene: [BootScene, TitleScene, CustomizeScene, FarmScene, RoverScene, DebriefScene, UIScene],
});

// `pixelArt` scales the canvas with nearest-neighbour. That keeps pixels crisp when the window is
// bigger than 1280×720, but when it is smaller it drops whole pixel columns and thin letter
// strokes vanish ("Continue" reads "OOntinue"). Smooth the canvas whenever it is shrunk.
const fitCanvas = () => {
  const shownPx = game.canvas.getBoundingClientRect().width * window.devicePixelRatio;
  game.canvas.style.imageRendering = shownPx < game.canvas.width ? 'auto' : 'pixelated';
};
game.events.once(Phaser.Core.Events.READY, () => {
  initializeViewport(game);
  initializeReadableView(game);
  fitCanvas();
  game.scale.on(Phaser.Scale.Events.RESIZE, fitCanvas);
  window.addEventListener('resize', fitCanvas);
});

// Handy for debugging in the browser console during development. `await selftest()` runs the
// PLAN.md section 6 play checks against a throwaway store.
if (import.meta.env.DEV) {
  const selftest = () => import('./core/selftest').then((m) => m.runSelfTest());
  // `await playtest()` plays 15 whole missions with different strategies (src/core/playtest.ts).
  const playtest = (only?: string[]) => import('./core/playtest').then((m) => m.runPlaytests(only));
  Object.assign(window, { game, store, selftest, playtest });
}
