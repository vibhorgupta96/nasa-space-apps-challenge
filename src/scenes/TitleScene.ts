import Phaser from 'phaser';
import { store } from '../core/store';
import { hash } from '../art/pixel';
import { C, H, W, button, text } from '../ui/theme';
import { showCredits } from '../ui/credits';

export function startMission(scene: Phaser.Scene, fresh: boolean) {
  if (fresh || !store.load()) store.newGame();
  scene.scene.start('Farm');
  scene.scene.launch('UI');
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1026');
    const g = this.add.graphics();
    for (let i = 0; i < 160; i++) {
      g.fillStyle(0xffffff, 0.3 + hash(i, 4) * 0.7);
      g.fillRect(Math.floor(hash(i, 1) * W), Math.floor(hash(i, 2) * H), 2, 2);
    }
    // A big pixel Mars rising at the bottom.
    g.fillStyle(0xb5532f).fillCircle(W / 2, H + 360, 560);
    g.fillStyle(0xa24826).fillCircle(W / 2 - 220, H + 40, 60).fillCircle(W / 2 + 260, H + 10, 40);
    g.fillStyle(0xc9663c).fillCircle(W / 2 + 120, H - 120, 26);
    this.add.image(W / 2, H - 230, 'dome-top').setScale(4);
    const bolt = this.add.image(W / 2 + 120, H - 200, 'bolt').setScale(3);
    this.tweens.add({ targets: bolt, y: bolt.y - 8, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.inOut' });

    text(this, W / 2, 90, 'SOL SPROUTS', 96, C.goldText, { fontStyle: 'bold', stroke: '#2b1d2a', strokeThickness: 10 }).setOrigin(0.5);
    text(this, W / 2, 168, 'A tiny farm on Mars, powered by real NASA data', 26, C.text).setOrigin(0.5);

    let y = 250;
    if (store.hasSave()) {
      this.add.existing(button(this, W / 2, y, 'Continue mission', () => startMission(this, false), 320, 56, 0xffd166));
      y += 72;
    }
    this.add.existing(button(this, W / 2, y, store.hasSave() ? 'New mission' : 'Start mission', () => startMission(this, true), 320, 56, C.frame));
    y += 72;
    this.add.existing(button(this, W / 2, y, 'NASA data we used', () => showCredits(this), 320, 56, 0x9aa3b0));

    text(this, 16, H - 16, 'NASA Space Apps 2026 · Junior Astronaut Mission Trainer · Fan-made, not affiliated with NASA', 15, C.dim).setOrigin(0, 1);
    const eggs = store.meta.eggs.length;
    if (eggs) text(this, W - 16, H - 16, `★ Secrets found: ${eggs}`, 16, C.goldText).setOrigin(1, 1);
  }
}
