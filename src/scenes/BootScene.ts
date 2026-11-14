import Phaser from 'phaser';
import { collectData, queueDataFiles } from '../data/loaders';
import { makeBolt, makeCharacter, makeCrops, makeFX, makeMachines, makePets, makeTiles, LOOKS } from '../farm/art';
import { loadAstronaut } from '../farm/look';
import { makeRoverArt } from '../rover/art';
import { makeIcons } from '../ui/icons';
import { store } from '../core/store';
import { queueAudio, startAudio } from '../core/audio';
import { FONT, H, W, text } from '../ui/theme';

// Loads the NASA data files, the Mars Trek map tiles, sounds and the font, then draws all pixel art.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const bar = this.add.rectangle(W / 2 - 200, H / 2, 0, 12, 0xffd166).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 404, 16).setStrokeStyle(2, 0x3fa7a0);
    this.load.on('progress', (v: number) => (bar.width = 400 * v));
    queueDataFiles(this);
    queueAudio(this);
  }

  create() {
    const data = collectData(this);
    for (const tile of data.terrain.tiles) this.load.image(`trek:${tile.file}`, tile.file);
    this.load.once('complete', async () => {
      try {
        await Promise.race([document.fonts.load(`24px ${FONT}`), new Promise((r) => setTimeout(r, 2500))]);
      } catch {
        /* fall back to system font */
      }
      for (const [name, look] of Object.entries(LOOKS)) makeCharacter(this, name, name === 'player' ? loadAstronaut() : look);
      makePets(this);
      makeBolt(this);
      makeCrops(this, data.crops.crops);
      makeTiles(this);
      makeMachines(this);
      makeFX(this);
      makeRoverArt(this);
      makeIcons(this, data.crops.crops);
      store.loadMetaOnly();
      startAudio(this.game);
      text(this, W / 2, H / 2 + 40, 'Ready!', 20, '#ffd166').setOrigin(0.5);
      this.scene.start('Title');
    });
    this.load.start();
  }
}
