import Phaser from 'phaser';
import { store } from '../core/store';
import { RULES } from '../core/rules';
import { getData } from '../data/loaders';
import { EGGS } from '../story/script';
import { C, H, W, button, panel, text } from '../ui/theme';
import { showCredits } from '../ui/credits';
import { startMission } from './TitleScene';

// End of a mission: what happened, which real NASA events inspired the storms, and replay.
export class DebriefScene extends Phaser.Scene {
  constructor() {
    super('Debrief');
  }

  create() {
    const s = store.state;
    const m = store.meta;
    const win = s.phase === 'debrief';
    this.cameras.main.setBackgroundColor(win ? '#132a2a' : '#2a1a1a');
    panel(this, 60, 30, W - 120, H - 60);
    text(this, W / 2, 50, win ? '🚀 Mission complete!' : '🛟 Rescue mission', 40, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    text(this, W / 2, 104,
      win ? `Everyone made it through ${RULES.missionSols} sols. The supply ship has landed.` : `The crew was rescued on sol ${s.sol}. Nobody failed: every mission teaches something.`,
      22, C.text).setOrigin(0.5, 0);

    const harvests = Object.values(m.harvests).reduce((a, b) => a + b, 0);
    const stats = [
      `🥕 Harvests: ${harvests}`,
      `☀️ Storms: ${m.stormsSurvived} safe, ${m.stormsTaken} rough`,
      `🚙 Rover trips: ${m.trips}`,
      `📷 Photos earned: ${m.photosEarned.length}`,
      `🫁 Final air ${Math.round(s.air)} · food ${Math.round(s.food)}`,
      `⭐ Secrets: ${m.eggs.length}/${EGGS.total}`,
    ];
    stats.forEach((t, i) => text(this, 110 + (i % 3) * 360, 156 + Math.floor(i / 3) * 36, t, 20, C.text));

    text(this, 110, 250, 'The real NASA events behind your storms', 24, C.teal, { fontStyle: 'bold' });
    const week = store.week();
    let y = 290;
    for (const e of week.events) {
      const date = new Date(e.realTime).toUTCString().replace(' GMT', ' UTC').slice(5);
      const kind = e.type === 'CME' ? 'Coronal mass ejection' : e.type === 'SEP' ? 'Solar energetic particle event' : e.type === 'GST' ? 'Geomagnetic storm at Earth' : e.type;
      const line = text(this, 110, y, `• ${kind}, recorded ${date} -> game sol ${e.scenario.gameSol}, simulated strength ${e.scenario.strength}   »`, 18, C.text).setInteractive({ useHandCursor: true });
      line.on('pointerdown', () => window.open(e.link, '_blank', 'noopener'));
      y += 34;
    }
    if (week.earthContext.length) {
      const kp = Math.max(...week.earthContext.map((g) => g.maxKp));
      text(this, 110, y + 4, `On Earth, the same week brought geomagnetic storms up to Kp ${kp} (NASA DONKI GST records).`, 16, C.dim);
      y += 30;
    }
    text(this, 110, y + 10,
      'Real: the dates, event types and records. Simulated: their strength, when they reached our outpost, and what they did to it.',
      16, C.sim, { wordWrap: { width: W - 220 } });

    this.add.existing(button(this, W / 2 - 230, H - 90, 'Play again', () => startMission(this, true), 260, 56, 0xffd166));
    this.add.existing(button(this, W / 2 + 60, H - 90, 'NASA data we used', () => showCredits(this), 280, 56, C.frame));
    this.add.existing(button(this, W / 2 + 300, H - 90, 'Title', () => this.scene.start('Title'), 160, 56, 0x9aa3b0));
    store.clearSave();
    void getData;
  }
}
