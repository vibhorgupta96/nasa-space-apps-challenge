import Phaser from 'phaser';
import { store } from '../core/store';
import { RULES } from '../core/rules';
import { EGGS } from '../story/script';
import { C, H, W, button, panel, text } from '../ui/theme';
import { showCredits } from '../ui/credits';
import { launchInitializedMission } from './TitleScene';
import { astronautTitle, BADGE_IDS, BADGES, QUIZ_SOLS, badgeInfoForWorld, lessonsForWorld } from '../core/training';
import { loadAstronaut } from '../farm/look';

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
    const lessons = lessonsForWorld(s.worldId);
    const stats = [
      `🥕 Harvests: ${harvests}`,
      `☀ Hazards: ${m.stormsSurvived} safe, ${m.stormsTaken} rough`,
      `🚙 Rover trips: ${m.trips}`,
      `🍲 Meals cooked: ${m.mealsCooked}`,
      `📷 Photos earned: ${m.photosEarned.length}`,
      `🫁 Final air ${Math.round(s.air)} · food ${Math.round(s.food)}`,
      `⭐ Secrets: ${m.eggs.length}/${EGGS.total}`,
      `🏅 Badges: ${m.badges.length}/${BADGE_IDS.length}`,
      `📘 Lessons right: ${store.lessonsCorrect()}/${lessons.length}`,
      `🃏 Wiz Cards: ${m.wizCards.length}/${lessons.length}`,
    ];
    const previous = store.campaign?.completed.find((result) => result.worldId !== s.worldId);
    if (previous?.training) {
      const priorBadges = previous.training.badges.map((id) => badgeInfoForWorld(id as keyof typeof BADGES, previous.worldId).icon).join(' ') || 'none yet';
      stats.push(`Previous ${previous.worldId === 'moon' ? 'Moon' : 'Mars'} mission: ${previous.training.badges.length} badges · ${Object.values(previous.training.lessons).filter(Boolean).length} lessons · ${previous.training.wizCards.length} cards`);
      stats.push(`Earlier badges: ${priorBadges}`);
    }
    if (m.quiz.pre !== null && m.quiz.post !== null) {
      const gain = m.quiz.post - m.quiz.pre;
      stats.push(gain > 0 ? `🧠 Quiz ${m.quiz.pre} → ${m.quiz.post}: +${gain} learned!` : `🧠 Quiz: ${m.quiz.post}/${QUIZ_SOLS.length}`);
    }
    stats.forEach((item, i) => text(this, 110 + (i % 3) * 360, 148 + Math.floor(i / 3) * 34, item, 19, C.text));

    const earned = BADGE_IDS.filter((id) => m.badges.includes(id)).map((id) => {
      const badge = badgeInfoForWorld(id, s.worldId);
      return `${badge.icon} ${badge.name}`;
    });
    const badgeLine = text(this, 110, 148 + Math.ceil(stats.length / 3) * 34 + 2, earned.length ? earned.join('   ') : 'No badges yet: every mission is practice!', 15, C.goldText, { wordWrap: { width: W - 220 }, lineSpacing: 4 });
    const heading = s.worldId === 'moon' ? 'The lunar environment in this simulation' : 'The real NASA events behind the Mars scenario';
    text(this, 110, badgeLine.y + badgeLine.height + 12, heading, 21, C.teal, { fontStyle: 'bold' });
    let y = badgeLine.y + badgeLine.height + 50;
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
    this.add.existing(button(this, W / 2 - 120, H - 155, '🎓 Certificate', () => this.showCertificate(), 220, 46, 0xffd166));
    this.add.existing(button(this, W / 2 + 120, H - 155, 'My journal', () => this.showJournal(), 190, 46, C.frame));
    this.time.delayedCall(400, () => this.showCertificate());
  }

  /** The Junior Astronaut training certificate, with world-specific title and provenance. */
  private showCertificate() {
    const s = store.state;
    const m = store.meta;
    const astro = loadAstronaut();
    const name = astro.name || 'Junior Astronaut';
    const { title } = astronautTitle(m.badges.length, store.lessonsCorrect(), s.phase === 'debrief', s.worldId);
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());
    const x = 150, y = 30, w = W - 300, h = H - 60;
    const g = this.add.graphics();
    g.fillStyle(0xfff8e7).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(10, 0xe0b44f).strokeRoundedRect(x + 12, y + 12, w - 24, h - 24, 14);
    g.lineStyle(2, 0x3fa7a0).strokeRoundedRect(x + 26, y + 26, w - 52, h - 52, 10);
    c.add(g);
    const ink = '#2a2440';
    const worldName = s.worldId === 'moon' ? 'MOON BASE' : 'MARS BASE';
    c.add(text(this, W / 2, y + 48, `FARAWAY GARDEN ${worldName}`, 18, '#3fa7a0', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 74, 'Certificate of Astronaut Training', 38, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 132, 'This certifies that', 20, '#6b6480').setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 160, name, 48, '#b0442c', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, y + 222, `has earned the title of ${title}`, 26, ink, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const done = s.phase === 'debrief' ? `kept the crew safe for all ${RULES.missionSols} sols` : `trained for ${s.sol} sols before the rescue ship came`;
    c.add(text(this, W / 2, y + 262, `and ${done} on ${s.worldId === 'moon' ? 'the Moon' : 'Mars'}.`, 20, ink).setOrigin(0.5, 0));

    // The astronaut and pet, as the player made them.
    if (this.textures.exists('player-down-0')) c.add(this.add.image(x + 120, y + 380, 'player-down-0').setScale(4));
    if (astro.pet !== 'none' && this.textures.exists(`pet-${astro.pet}-0`)) c.add(this.add.image(x + 190, y + 420, `pet-${astro.pet}-0`).setScale(2.2));

    const lines = [
      `🏅 Badges: ${m.badges.length} of ${BADGE_IDS.length}`,
      `📘 Lessons answered right: ${store.lessonsCorrect()} of ${lessonsForWorld(s.worldId).length}`,
      `🃏 Wiz Cards collected: ${m.wizCards.length} of ${lessonsForWorld(s.worldId).length}`,
      s.worldId === 'moon'
        ? `☢️ Simulated radiation alerts: ${m.stormsSurvived + m.stormsTaken} (${m.stormsSurvived} sheltered)`
        : `☀️ Solar storms faced: ${m.stormsSurvived + m.stormsTaken} (${m.stormsSurvived} with the shelter holding)`,
    ];
    c.add(text(this, x + 260, y + 310, lines.join('\n'), 20, ink, { lineSpacing: 10 }));
    const earned = BADGE_IDS.filter((id) => m.badges.includes(id)).map((id) => badgeInfoForWorld(id, s.worldId).icon).join(' ');
    c.add(text(this, x + 260, y + 450, earned || 'Badges are waiting for your next mission!', 26, ink, { wordWrap: { width: w - 320 } }));
    const provenance = s.worldId === 'moon'
      ? 'Lunar radiation timing and effects shown here are simulated game scenarios, not observed Moon events.'
      : (() => {
          const storm = store.week().events[0];
          return storm ? `Mars hazards were based on NASA DONKI records beginning ${new Date(storm.realTime).toUTCString().slice(5, 16)}.` : 'Mars hazards are simulated game scenarios.';
        })();
    c.add(text(this, W / 2, y + h - 104, `${provenance}  Awarded ${new Date().toLocaleDateString()}.`, 15, '#6b6480', { wordWrap: { width: w - 100 }, align: 'center' }).setOrigin(0.5, 0));

    const close = () => {
      this.input.keyboard?.off('keydown-ESC', close);
      c.destroy();
    };
    c.add(button(this, W / 2 - 130, y + h - 54, 'Save picture', () => this.saveCertificate(), 220, 46, 0xffd166));
    c.add(button(this, W / 2 + 130, y + h - 54, 'Close', close, 220, 46, 0x9aa3b0));
    this.input.keyboard?.on('keydown-ESC', close);
    c.once(Phaser.GameObjects.Events.DESTROY, () => this.input.keyboard?.off('keydown-ESC', close));
  }

  /** Download the screen (the certificate) as a PNG the player can print or share. */
  private saveCertificate() {
    this.game.renderer.snapshot((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      const a = document.createElement('a');
      a.href = img.src;
      a.download = 'faraway-garden-certificate.png';
      a.click();
    });
  }

  /** The mission journal: one line per sol, written from the player's own choices. */
  private showJournal() {
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive().on('pointerdown', () => c.destroy()));
    c.add(panel(this, 140, 50, W - 280, H - 100));
    c.add(text(this, 172, 66, '📓 Mission journals', 30, C.goldText, { fontStyle: 'bold' }));
    const worlds = (store.campaign?.completed ?? []).map((result) => ({ worldId: result.worldId, journal: result.training?.journal ?? [] }));
    if (!worlds.some((entry) => entry.worldId === store.worldId)) worlds.push({ worldId: store.worldId, journal: store.meta.journal });
    const body = this.add.container(0, 0);
    c.add(body);
    worlds.forEach((entry, i) => c.add(button(this, 250 + i * 280, 112, `${entry.worldId === 'moon' ? 'Moon' : 'Mars'} journal`, () => {
      body.removeAll(true);
      const lines = entry.journal.length ? entry.journal : ['(No entries yet.)'];
      body.add(text(this, 172, 160, lines.join('\n'), 16, C.text, { lineSpacing: 5, wordWrap: { width: W - 344 } }));
    }, 240, 42, C.frame)));
    const initial = worlds.length - 1;
    const lines = worlds[initial].journal.length ? worlds[initial].journal : ['(No entries yet.)'];
    body.add(text(this, 172, 160, lines.join('\n'), 16, C.text, { lineSpacing: 5, wordWrap: { width: W - 344 } }));
    c.add(text(this, W - 172, H - 84, 'Click anywhere to close', 16, C.dim).setOrigin(1, 0));
  }
}
