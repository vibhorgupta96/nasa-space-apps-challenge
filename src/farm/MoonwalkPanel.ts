import Phaser from 'phaser';
import { store } from '../core/store';
import { RULES } from '../core/rules';
import { sfx } from '../core/audio';
import { settings } from '../core/settings';
import { pixelTexture } from '../art/pixel';
import { loadAstronaut } from './look';
import { MOONWALK_TASKS, type MoonwalkInfo } from './moonwalk';

// The astronaut in an EVA suit: white suit and helmet, a gold visor with your face behind it,
// and a chest stripe in your chosen suit colour.
const EVA_SUIT = [
  '.....KKKKKK.....',
  '....KWWWWWWK....',
  '...KWGGGGGGWK...',
  '...KWGSSSSGWK...',
  '...KWGSOSSGWK...',
  '...KWGGGGGGWK...',
  '....KWWWWWWK....',
  '..KKWWAAAAWWKK..',
  '.KWWWWWWWWWWWWK.',
  '.KWKWWWBRWWWKWK.',
  '.KWKWWWWWWWWKWK.',
  '.KMKWWWWWWWWKMK.',
  '...KWWWKKWWWK...',
  '...KWWWK.KWWWK..',
  '...KMMMK.KMMMK..',
  '...KKKKK.KKKKK..',
];

function makeEvaSuit(scene: Phaser.Scene) {
  const look = loadAstronaut();
  pixelTexture(scene, 'eva-suit', EVA_SUIT, {
    K: '#2b1d2a', W: '#f2f0e8', G: '#e0b44f', O: '#fff3b0', S: look.skin, A: look.suit, B: '#4a8fd6', R: '#e05050', M: '#8b94a3',
  });
}
import { C, button, panel, text } from '../ui/theme';

/**
 * The Moonwalk: a window onto the lunar surface (black sky, Earth, grey dust) and three tasks.
 * Picking one walks the astronaut out in low-gravity hops, leaves boot prints, then shows the
 * task's real NASA fact. Keys 1–3 pick a task. `onFinished` runs once the walk is over so the
 * caller can let Enter close the panel.
 */
export function addMoonwalk(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  close: () => void,
  onFinished: () => void,
  onError: (reason: string) => void,
) {
  c.add(panel(scene, x, y, w, h));
  c.add(text(scene, x + 32, y + 20, '🧑‍🚀 Moonwalk', 32, C.goldText, { fontStyle: 'bold' }));
  c.add(text(scene, x + 32, y + 64,
    `Suit up and step outside. One moonwalk a day · the suit uses ${RULES.moonwalkAirCost} air (game rule).`, 17, C.dim));

  // The view outside: black sky with stars, Earth, and grey dust with a few craters.
  const vx = x + 32, vy = y + 100, vw = w - 64, vh = 230;
  const groundY = vy + vh - 70;
  c.add(scene.add.rectangle(vx, vy, vw, vh, 0x05060c).setOrigin(0).setStrokeStyle(3, C.frameDark));
  const rnd = new Phaser.Math.RandomDataGenerator(['sol-sprouts-moonwalk']);
  for (let i = 0; i < 46; i++) {
    c.add(scene.add.rectangle(vx + rnd.between(6, vw - 6), vy + rnd.between(6, groundY - vy - 10), 2, 2, 0xffffff, rnd.realInRange(0.35, 1)));
  }
  const earth = scene.add.container(vx + vw - 110, vy + 62);
  earth.add(scene.add.circle(0, 0, 30, 0x4a8fd6));
  earth.add(scene.add.ellipse(-8, -6, 22, 14, 0x6aa84f));
  earth.add(scene.add.ellipse(10, 10, 16, 10, 0x6aa84f));
  earth.add(scene.add.ellipse(4, -18, 18, 6, 0xffffff, 0.85));
  earth.add(scene.add.circle(12, 0, 30, 0x05060c, 0.35)); // night side
  c.add(earth);
  c.add(scene.add.rectangle(vx, groundY, vw, vh - (groundY - vy), 0x8b8f96).setOrigin(0));
  for (const [cx, cy, r] of [[160, 26, 26], [430, 44, 18], [640, 20, 14], [760, 50, 22]] as const) {
    c.add(scene.add.ellipse(vx + cx, groundY + cy, r * 2, r * 0.7, 0x6b6f76));
  }
  const habitat = scene.add.rectangle(vx + 18, groundY - 46, 70, 46, 0xcfd3da).setOrigin(0).setStrokeStyle(3, 0x2b1d2a);
  c.add(habitat);
  c.add(scene.add.rectangle(vx + 66, groundY - 30, 14, 30, 0x3b3a4f).setOrigin(0)); // airlock door
  const prints = scene.add.container(0, 0);
  c.add(prints);
  const startX = vx + 110;
  makeEvaSuit(scene);
  const walker = scene.add.image(startX, groundY + 2, 'eva-suit').setOrigin(0.5, 1).setScale(3);
  c.add(walker);

  const choices = scene.add.container(0, 0);
  c.add(choices);
  let picked = false;

  const finish = (info: MoonwalkInfo) => {
    const ry = vy + vh + 18;
    choices.add(text(scene, x + 32, ry, `${info.icon} ${info.did}`, 20, C.text, { fontStyle: 'bold', wordWrap: { width: w - 64 } }));
    choices.add(text(scene, x + 32, ry + 40, `Real NASA fact: ${info.fact}`, 17, C.teal, { wordWrap: { width: w - 64 }, lineSpacing: 4 }));
    const src = text(scene, x + 32, ry + 112, 'Source »', 15, C.teal).setInteractive({ useHandCursor: true });
    src.on('pointerdown', () => window.open(info.source, '_blank', 'noopener'));
    choices.add(src);
    choices.add(text(scene, x + 32, ry + 142,
      `Brought back +${info.regolith} regolith · suit used ${RULES.moonwalkAirCost} air (game rules). Science ticked on today's schedule.`, 16, C.ok, { wordWrap: { width: w - 300 } }));
    choices.add(button(scene, x + w - 140, y + h - 46, 'Back inside »', close, 230, 52, 0xffd166));
    onFinished();
  };

  // Low-gravity hops to the right, a boot print after each landing.
  const walk = (info: MoonwalkInfo) => {
    const stopX = info.id === 'earth' ? vx + vw * 0.55 : vx + vw * 0.72;
    const hops = 6;
    const step = (stopX - startX) / hops;
    // A pair of boot prints (left and right foot) pressed into the grey dust.
    const print = (px: number) => {
      for (const dx of [-7, 7]) prints.add(scene.add.ellipse(px + dx, groundY + 14 + (dx > 0 ? 4 : 0), 9, 16, 0x3e4148));
    };
    if (settings.reducedMotion) {
      for (let i = 1; i <= hops; i++) print(startX + i * step);
      walker.setX(stopX);
      if (info.id === 'samples') c.add(scene.add.rectangle(stopX + 22, groundY - 4, 12, 10, 0xe0b44f).setStrokeStyle(2, 0x2b1d2a));
      finish(info);
      return;
    }
    let i = 0;
    const hop = () => {
      if (!walker.scene) return; // the panel was closed mid-walk
      if (i >= hops) {
        if (info.id === 'earth') {
          scene.tweens.add({ targets: earth, scale: 1.25, yoyo: true, duration: 500, ease: 'Sine.easeInOut' });
        } else if (info.id === 'samples') {
          const bag = scene.add.rectangle(stopX + 22, groundY - 4, 12, 10, 0xe0b44f).setStrokeStyle(2, 0x2b1d2a).setScale(0);
          c.add(bag);
          scene.tweens.add({ targets: bag, scale: 1, duration: 300, ease: 'Back.easeOut' });
        }
        sfx('found');
        finish(info);
        return;
      }
      i += 1;
      const toX = startX + i * step;
      scene.tweens.add({ targets: walker, x: toX, duration: 520, ease: 'Linear' });
      // Up slowly, down slowly: one sixth gravity.
      scene.tweens.add({
        targets: walker, y: groundY - 26, duration: 260, yoyo: true, ease: 'Sine.easeOut',
        onComplete: () => {
          print(toX);
          sfx('step-1', -400);
          hop();
        },
      });
    };
    hop();
  };

  const pick = (i: number) => {
    if (picked) return;
    const task = MOONWALK_TASKS[i];
    if (!task) return;
    const r = store.moonwalk(task.id);
    if (!r.ok) {
      sfx('error');
      onError(r.reason);
      return;
    }
    picked = true;
    sfx('confirm');
    choices.removeAll(true);
    walk(r.info!);
  };

  MOONWALK_TASKS.forEach((t, i) => {
    // Pick on the next frame so the button isn't destroyed inside its own click.
    choices.add(button(scene, x + w / 2, vy + vh + 46 + i * 66, `${i + 1}. ${t.icon} ${t.label}`, () => scene.time.delayedCall(0, () => pick(i)), w - 160, 54, C.frame));
  });
  choices.add(text(scene, x + 32, y + h - 34, `Habitat air now: ${store.state.air} · keys 1–3 pick a task · Esc stays inside`, 15, C.dim));

  return (k: string) => {
    const i = Number(k) - 1;
    if (picked || !(i >= 0 && i < MOONWALK_TASKS.length)) return false;
    pick(i);
    return true;
  };
}
