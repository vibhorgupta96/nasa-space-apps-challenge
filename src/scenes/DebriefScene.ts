import Phaser from 'phaser';
import { store } from '../core/store';
import { EGGS } from '../story/script';
import { C, H, W, button, panel, text } from '../ui/theme';
import { showCredits } from '../ui/credits';
import { launchInitializedMission } from './TitleScene';

/** A terminal mission screen remains resumable until the player chooses what comes next. */
export class DebriefScene extends Phaser.Scene {
  constructor() { super('Debrief'); }

  create() {
    const s = store.state;
    const m = store.meta;
    const win = s.phase === 'debrief';
    const world = store.world;
    const worldName = world.name;
    const completedCampaign = store.campaignComplete;
    this.cameras.main.setBackgroundColor(win ? '#132a2a' : '#2a1a1a');
    panel(this, 60, 30, W - 120, H - 60);
    text(this, W / 2, 50, completedCampaign ? '🌟 Campaign complete!' : win ? `🚀 ${worldName} mission complete!` : '🛟 Rescue mission', 38, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    const summary = completedCampaign
      ? 'You kept both greenhouses alive. What a journey!'
      : win
        ? `Everyone made it through 10 ${world.dayLabel.toLowerCase()}s. Your next world is ready.`
        : `The crew was rescued on ${world.dayLabel.toLowerCase()} ${s.sol}. Nobody failed: every mission teaches something.`;
    text(this, W / 2, 100, summary, 20, C.text).setOrigin(0.5, 0);

    const harvests = Object.values(m.harvests).reduce((a, b) => a + b, 0);
    const stats = [
      `🥕 Harvests: ${harvests}`,
      `☀ Hazards: ${m.stormsSurvived} safe, ${m.stormsTaken} rough`,
      `🚙 Rover trips: ${m.trips}`,
      `🍲 Meals cooked: ${m.mealsCooked}`,
      `📷 Photos earned: ${m.photosEarned.length}`,
      `🫁 Final air ${Math.round(s.air)} · food ${Math.round(s.food)}`,
      `⭐ Secrets: ${m.eggs.length}/${EGGS.total}`,
    ];
    stats.forEach((item, i) => text(this, 110 + (i % 3) * 360, 148 + Math.floor(i / 3) * 34, item, 19, C.text));

    const heading = s.worldId === 'moon' ? 'The lunar environment in this simulation' : 'The real NASA events behind the Mars scenario';
    text(this, 110, 268, heading, 21, C.teal, { fontStyle: 'bold' });
    let y = 306;
    if (s.worldId === 'moon') {
      text(this, 110, y, 'Moon surface has no wind or rain. Light and dark stretches, radiation timing, temperature effects, dust and map finds are game simulations.', 16, C.text, { wordWrap: { width: W - 220 } });
      y += 54;
      text(this, 110, y, 'The lunar day-night rhythm is compressed for play; greenhouse conditions are not surface temperatures.', 15, C.dim, { wordWrap: { width: W - 220 } });
      y += 36;
    } else {
      const week = store.week();
      for (const event of week.events.slice(0, 4)) {
        const date = new Date(event.realTime).toUTCString().replace(' GMT', ' UTC').slice(5);
        const kind = event.type === 'CME' ? 'Coronal mass ejection' : event.type === 'SEP' ? 'Solar energetic particle event' : event.type === 'GST' ? 'Geomagnetic storm at Earth' : event.type;
        const row = text(this, 110, y, `• ${kind}, recorded ${date} → game sol ${event.scenario.gameSol}, simulated strength ${event.scenario.strength}  ↗`, 16, C.text).setInteractive({ useHandCursor: true });
        row.on('pointerdown', () => window.open(event.link, '_blank', 'noopener'));
        y += 28;
      }
      if (week.earthContext.length) {
        const kp = Math.max(...week.earthContext.map((event) => event.maxKp));
        text(this, 110, y, `On Earth, the same week brought geomagnetic storms up to Kp ${kp} (NASA DONKI records).`, 15, C.dim, { wordWrap: { width: W - 220 } });
        y += 32;
      }
      text(this, 110, y, 'Real: Mars event records and dates. Simulated: outpost timing, strength and effects.', 15, C.sim);
      y += 25;
    }

    const primaryY = H - 94;
    if (!win) {
      this.add.existing(button(this, W / 2 - 150, primaryY, `Retry ${worldName}`, () => {
        const result = store.retryMission();
        if (result.ok) launchInitializedMission(this);
      }, 260, 50, 0xffd166));
    } else if (store.canTravel) {
      const destination = store.campaign.order[store.campaign.currentIndex + 1];
      const label = destination === 'moon' ? 'Travel to the Moon' : 'Travel to Mars';
      this.add.existing(button(this, W / 2 - 150, primaryY, label, () => {
        const result = store.travel();
        if (result.ok) launchInitializedMission(this);
      }, 300, 50, 0xffd166));
    } else {
      this.add.existing(button(this, W / 2 - 150, primaryY, 'New campaign', () => this.scene.start('Title'), 240, 50, 0xffd166));
    }
    this.add.existing(button(this, W / 2 + 170, primaryY, 'NASA data we used', () => showCredits(this), 260, 50, C.frame));
    this.add.existing(button(this, W / 2 + 410, primaryY, 'Title', () => this.scene.start('Title'), 130, 50, 0x9aa3b0));
  }
}
