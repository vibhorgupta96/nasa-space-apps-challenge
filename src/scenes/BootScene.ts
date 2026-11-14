import Phaser from 'phaser';
import { collectData, getAllWorldData, queueDataFiles } from '../data/loaders';
import { makeBolt, makeCharacter, makeCrops, makeFX, makeMachines, makePets, makeTiles, LOOKS } from '../farm/art';
import { loadAstronaut } from '../farm/look';
import { makeRoverArt } from '../rover/art';
import { makeIcons } from '../ui/icons';
import { store } from '../core/store';
import { queueAudio, startAudio } from '../core/audio';
import { FONT, H, W, text } from '../ui/theme';

// Loads both world data sets, the Mars Trek map tiles and the font, then draws all pixel art.
export class BootScene extends Phaser.Scene {
  private failedAssets: string[] = [];
  constructor() {
    super('Boot');
  }

  preload() {
    this.failedAssets = [];
    const bar = this.add.rectangle(W / 2 - 200, H / 2, 0, 12, 0xffd166).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 404, 16).setStrokeStyle(2, 0x3fa7a0);
    this.load.on('progress', (v: number) => (bar.width = 400 * v));
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failedAssets.push(String(file.key || file.url));
    });
    queueDataFiles(this);
    queueAudio(this);
  }

  create() {
    let worlds;
    try {
      collectData(this);
      worlds = getAllWorldData();
    } catch (error) {
      this.showLoadError(error instanceof Error ? error.message : 'World data could not be loaded.');
      return;
    }
    for (const data of worlds) for (const tile of data.terrain.tiles) this.load.image(`trek:${tile.file}`, tile.file);
    this.load.once('complete', async () => {
      if (this.failedAssets.length) {
        this.showLoadError(`Some required world art could not be loaded: ${this.failedAssets.slice(0, 3).join(', ')}`);
        return;
      }
      try {
        await Promise.race([document.fonts.load(`24px ${FONT}`), new Promise((r) => setTimeout(r, 2500))]);
      } catch {
        /* fall back to system font */
      }
      try {
        for (const [name, look] of Object.entries(LOOKS)) makeCharacter(this, name, name === 'player' ? loadAstronaut() : look);
        makePets(this);
        makeBolt(this);
        const allCrops = worlds.flatMap((data) => data.crops.crops);
        makeCrops(this, allCrops);
        makeTiles(this);
        makeMachines(this);
        makeFX(this);
        makeRoverArt(this);
        makeIcons(this, allCrops);
      } catch (error) {
        this.showLoadError(error instanceof Error ? error.message : 'The world artwork could not be prepared.');
        return;
      }
      store.loadMetaOnly();
      startAudio(this.game);
      text(this, W / 2, H / 2 + 40, 'Ready!', 20, '#ffd166').setOrigin(0.5);
      this.scene.start('Title');
    });
    this.load.start();
  }

  private showLoadError(reason: string) {
    this.cameras.main.setBackgroundColor('#0b1026');
    this.add.rectangle(W / 2, H / 2, W - 160, 210, 0x2a1a1a).setStrokeStyle(2, 0xe05050);
    text(this, W / 2, H / 2 - 54, 'World data could not be loaded', 30, '#ffd166', { fontStyle: 'bold' }).setOrigin(0.5);
    text(this, W / 2, H / 2 + 4, reason, 18, '#f4efe6', { wordWrap: { width: W - 220 }, align: 'center' }).setOrigin(0.5);
    text(this, W / 2, H / 2 + 62, 'Check the Moon and Mars data files, then reload the game.', 16, '#b8c4cc').setOrigin(0.5);
  }
}
