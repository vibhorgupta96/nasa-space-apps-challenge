import Phaser from 'phaser';
import { store } from '../core/store';
import type { WorldId } from '../core/types';
import { hash } from '../art/pixel';
import { C, H, W, button, panel, text } from '../ui/theme';
import { showCredits } from '../ui/credits';

/** Start/resume the correct screen, including saved terminal screens. */
export function startMission(scene: Phaser.Scene, fresh: boolean, worldId: WorldId = 'mars') {
  if (fresh) store.startCampaign(worldId);
  else if (!store.load()) store.startCampaign(worldId);
  launchInitializedMission(scene);
}

/** Launch an already-created mission without re-reading optional browser storage. */
export function launchInitializedMission(scene: Phaser.Scene) {
  scene.scene.stop('UI');
  scene.scene.stop('Rover');
  if (store.state.phase === 'rescue' || store.state.phase === 'debrief') {
    scene.scene.start('Debrief');
    return;
  }
  scene.scene.start('Farm');
  scene.scene.launch('UI');
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.setBackgroundColor('#0b1026');
    const g = this.add.graphics();
    for (let i = 0; i < 160; i++) {
      g.fillStyle(0xffffff, 0.3 + hash(i, 4) * 0.7);
      g.fillRect(Math.floor(hash(i, 1) * W), Math.floor(hash(i, 2) * H), 2, 2);
    }
    // The title art previews both destinations.
    g.fillStyle(0xb5532f).fillCircle(W / 2 - 220, H + 290, 380);
    g.fillStyle(0xa24826).fillCircle(W / 2 - 345, H + 25, 40).fillCircle(W / 2 - 120, H + 10, 30);
    g.fillStyle(0xb9c2cc).fillCircle(W / 2 + 240, H + 320, 360);
    g.fillStyle(0x89919b).fillCircle(W / 2 + 110, H + 40, 34).fillCircle(W / 2 + 370, H + 8, 45);
    this.add.image(W / 2 - 150, H - 235, 'dome-top').setScale(3);
    this.add.image(W / 2 + 210, H - 235, 'dome-top').setScale(3);
    const bolt = this.add.image(W / 2 + 290, H - 190, 'bolt').setScale(2.5);
    this.tweens.add({ targets: bolt, y: bolt.y - 8, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.inOut' });

    text(this, W / 2, 64, 'FARAWAY GARDEN', 64, C.goldText, { fontStyle: 'bold', stroke: '#2b1d2a', strokeThickness: 9 }).setOrigin(0.5);
    text(this, W / 2, 132, 'A two-world greenhouse campaign', 25, C.text).setOrigin(0.5);
    text(this, W / 2, 172, 'Choose Mars or the Moon. Finish one mission, then travel to the other world.', 18, C.dim).setOrigin(0.5);

    let y = 230;
    if (store.hasSave()) {
      this.add.existing(button(this, W / 2, y, 'Continue campaign', () => startMission(this, false), 310, 50, 0xffd166));
      y += 64;
    }
    this.add.existing(button(this, W / 2, y, 'New campaign', () => this.showCampaignChooser(), 310, 50, C.frame));
    y += 62;
    if (store.hasSave()) {
      this.add.existing(button(this, W / 2, y, 'Change your look', () => this.scene.start('Customize', { fresh: false }), 310, 50, 0x8e6bbf));
      y += 62;
    }
    this.add.existing(button(this, W / 2, y, 'NASA data we used', () => showCredits(this), 310, 44, 0x9aa3b0));
    text(this, 16, H - 16, 'NASA Space Apps 2026 · Junior Astronaut Mission Trainer · Fan-made, not affiliated with NASA', 15, C.dim).setOrigin(0, 1);
    const eggs = store.meta.eggs.length;
    if (eggs) text(this, W - 16, H - 16, `⭐ Secrets found: ${eggs}`, 16, C.goldText).setOrigin(1, 1);
  }

  private showCampaignChooser() {
    const overlay = this.add.container(0, 0).setDepth(1000).setData('readableModal', true);
    overlay.add(this.add.rectangle(0, 0, W, H, 0x080b16, 0.84).setOrigin(0).setInteractive());
    overlay.add(panel(this, 210, 115, W - 420, H - 230));
    overlay.add(text(this, W / 2, 138, store.hasSave() ? 'Start a new campaign?' : 'Choose your first world', 29, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const hasSave = store.hasSave();
    overlay.add(text(this, W / 2, 180, hasSave
      ? 'Your current campaign will be replaced when you choose a world.'
      : 'Each world has a 10-day mission. You will travel to the other after your first success.', 17, C.dim).setOrigin(0.5, 0));

    const choose = (world: WorldId) => {
      overlay.destroy(true);
      this.scene.start('Customize', { fresh: true, worldId: world });
    };
    const cardY = 330;
    const marsX = W / 2 - 215;
    const moonX = W / 2 + 215;
    overlay.add(panel(this, marsX - 160, cardY - 70, 320, 210));
    overlay.add(panel(this, moonX - 160, cardY - 70, 320, 210));
    overlay.add(text(this, marsX, cardY - 48, 'MARS', 27, '#ff9b72', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    overlay.add(text(this, marsX, cardY - 8, 'Dusty terrain · solar storms\nWarmth, shelter, crops and rover power', 16, C.text, { align: 'center' }).setOrigin(0.5, 0));
    overlay.add(button(this, marsX, cardY + 90, 'Start on Mars', () => choose('mars'), 230, 48, 0xa64e31));
    overlay.add(text(this, moonX, cardY - 48, 'MOON', 27, '#d9e0e8', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    overlay.add(text(this, moonX, cardY - 8, 'Bright and dark stretches · lunar dust\nThermal control, Moon-hop and new crops', 16, C.text, { align: 'center' }).setOrigin(0.5, 0));
    overlay.add(button(this, moonX, cardY + 90, 'Start on the Moon', () => choose('moon'), 230, 48, 0x737f8d));
    overlay.add(button(this, W / 2, H - 155, 'Cancel', () => overlay.destroy(true), 150, 40, 0x555c69));
  }
}
