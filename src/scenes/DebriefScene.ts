import Phaser from 'phaser';
import { store } from '../core/store';
import { RULES } from '../core/rules';
import { getData } from '../data/loaders';
import { EGGS } from '../story/script';
import { C, H, W, button, panel, text } from '../ui/theme';
import { showCredits } from '../ui/credits';
import { startMission } from './TitleScene';
import { astronautTitle, BADGE_IDS, BADGES, LESSONS, QUIZ_SOLS } from '../core/training';
import { loadAstronaut } from '../farm/look';

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
      `🍲 Meals cooked: ${m.mealsCooked}`,
      `📷 Photos earned: ${m.photosEarned.length}`,
      `🫁 Final air ${Math.round(s.air)} · food ${Math.round(s.food)}`,
      `⭐ Secrets: ${m.eggs.length}/${EGGS.total}`,
      `🏅 Badges: ${m.badges.length}/${BADGE_IDS.length}`,
      `📘 Lessons right: ${store.lessonsCorrect()}/${LESSONS.length}`,
      `🃏 Wiz Cards: ${m.wizCards.length}/${LESSONS.length}`,
    ];
    if (m.quiz.pre !== null && m.quiz.post !== null) {
      const gain = m.quiz.post - m.quiz.pre;
      stats.push(gain > 0 ? `🧠 Quiz ${m.quiz.pre} -> ${m.quiz.post}: +${gain} learned!` : `🧠 Quiz: ${m.quiz.post}/${QUIZ_SOLS.length}`);
    }
    stats.forEach((t, i) => text(this, 110 + (i % 3) * 360, 150 + Math.floor(i / 3) * 34, t, 20, C.text));
    const earned = BADGE_IDS.filter((id) => m.badges.includes(id)).map((id) => `${BADGES[id].icon} ${BADGES[id].name}`);
    const badgeLine = text(this, 110, 150 + Math.ceil(stats.length / 3) * 34 + 2, earned.length ? earned.join('   ') : 'No badges yet: every mission is practice!', 16, C.goldText, { wordWrap: { width: W - 220 }, lineSpacing: 4 });

    const top = badgeLine.y + badgeLine.height + 14;
    text(this, 110, top, 'The real NASA events behind your storms', 24, C.teal, { fontStyle: 'bold' });
    const week = store.week();
    let y = top + 36;
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

    const buttons: [string, () => void, number, number][] = [
      ['Play again', () => startMission(this, true), 190, 0xffd166],
      ['🎓 Certificate', () => this.showCertificate(), 220, 0xffd166],
      ['My journal', () => this.showJournal(), 190, C.frame],
      ['NASA data we used', () => showCredits(this), 250, C.frame],
      ['Title', () => this.scene.start('Title'), 130, 0x9aa3b0],
    ];
    let bx = W / 2 - (buttons.reduce((n, b) => n + b[2], 0) + 14 * (buttons.length - 1)) / 2;
    for (const [label, fn, bw, colour] of buttons) {
      this.add.existing(button(this, bx + bw / 2, H - 90, label, fn, bw, 56, colour));
      bx += bw + 14;
    }
    store.clearSave();
    void getData;
    this.time.delayedCall(400, () => this.showCertificate());
  }

  /** The Junior Astronaut training certificate: name, earned title, badges and a real NASA date. */
  private showCertificate() {
    const s = store.state;
    const m = store.meta;
    const astro = loadAstronaut();
    const name = astro.name || 'Junior Astronaut';
    const { title } = astronautTitle(m.badges.length, store.lessonsCorrect(), s.phase === 'debrief');
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());
    const x = 150, y = 30, w = W - 300, h = H - 60;
    const g = this.add.graphics();
    g.fillStyle(0xfff8e7).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(10, 0xe0b44f).strokeRoundedRect(x + 12, y + 12, w - 24, h - 24, 14);
    g.lineStyle(2, 0x3fa7a0).strokeRoundedRect(x + 26, y + 26, w - 52, h - 52, 10);
    c.add(g);
    const ink = '#2a2440';
    c.add(text(this, W / 2, y + 48, 'SOL SPROUTS MARS BASE', 18, '#3fa7a0', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 74, 'Certificate of Astronaut Training', 38, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 132, 'This certifies that', 20, '#6b6480').setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 160, name, 48, '#b0442c', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 222, `has earned the title of ${title}`, 26, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const done = s.phase === 'debrief' ? `kept the crew safe for all ${RULES.missionSols} sols` : `trained for ${s.sol} sols before the rescue ship came`;
    c.add(text(this, W / 2, y + 262, `and ${done} on Mars.`, 20, ink).setOrigin(0.5, 0));

    // The astronaut and pet, as the player made them.
    if (this.textures.exists('player-down-0')) c.add(this.add.image(x + 120, y + 380, 'player-down-0').setScale(4));
    if (astro.pet !== 'none' && this.textures.exists(`pet-${astro.pet}-0`)) c.add(this.add.image(x + 190, y + 420, `pet-${astro.pet}-0`).setScale(2.2));

    const lines = [
      `🏅 Badges: ${m.badges.length} of ${BADGE_IDS.length}`,
      `📘 Lessons answered right: ${store.lessonsCorrect()} of ${LESSONS.length}`,
      `🃏 Wiz Cards collected: ${m.wizCards.length}`,
      `☀️ Solar storms faced: ${m.stormsSurvived + m.stormsTaken} (${m.stormsSurvived} with the shelter holding)`,
    ];
    c.add(text(this, x + 260, y + 310, lines.join('\n'), 20, ink, { lineSpacing: 10 }));
    const earned = BADGE_IDS.filter((id) => m.badges.includes(id)).map((id) => BADGES[id].icon).join(' ');
    c.add(text(this, x + 260, y + 450, earned || 'Badges are waiting for your next mission!', 26, ink, { wordWrap: { width: w - 320 } }));
    const storm = store.week().events[0];
    const real = storm ? `Your storms were based on real NASA DONKI records, starting ${new Date(storm.realTime).toUTCString().slice(5, 16)}.` : '';
    c.add(text(this, W / 2, y + h - 104, `${real}  Awarded ${new Date().toLocaleDateString()}.`, 15, '#6b6480').setOrigin(0.5, 0));

    const close = () => c.destroy();
    c.add(button(this, W / 2 - 130, y + h - 54, 'Save picture', () => this.saveCertificate(), 220, 46, 0xffd166));
    c.add(button(this, W / 2 + 130, y + h - 54, 'Close', close, 220, 46, 0x9aa3b0));
    this.input.keyboard?.once('keydown-ESC', close);
  }

  /** Download the screen (the certificate) as a PNG the player can print or share. */
  private saveCertificate() {
    this.game.renderer.snapshot((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      const a = document.createElement('a');
      a.href = img.src;
      a.download = 'sol-sprouts-certificate.png';
      a.click();
    });
  }

  /** The mission journal: one line per sol, written from the player's own choices. */
  private showJournal() {
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive().on('pointerdown', () => c.destroy()));
    c.add(panel(this, 140, 50, W - 280, H - 100));
    c.add(text(this, 172, 72, '📓 My mission journal', 30, C.goldText, { fontStyle: 'bold' }));
    const lines = store.meta.journal.length ? store.meta.journal : ['(No entries yet.)'];
    c.add(text(this, 172, 130, lines.join('\n'), 18, C.text, { lineSpacing: 10, wordWrap: { width: W - 344 } }));
    c.add(text(this, W - 172, H - 84, 'Click anywhere to close', 16, C.dim).setOrigin(1, 0));
  }
}
