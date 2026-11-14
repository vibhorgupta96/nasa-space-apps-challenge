import Phaser from 'phaser';
import { bus, EV, UI_EV } from './events';

// Background music and sound effects. The music is "Mars Morning" (see docs/AI_USAGE.md); the
// effects are CC0 clips from Kenney's Interface, Sci-Fi and RPG audio packs (docs/ASSETS.md).
// Everything listens to the bus, so gameplay code only calls sfx() for actions with no event.

const MUSIC = 'music-mars-morning';
const MUSIC_VOLUME = 0.35;
const SFX = [
  'click', 'confirm', 'found', 'error', 'harvest', 'storm-warning', 'new-sol', 'water', 'melter', 'craft',
  'rover-depart', 'rover-return', 'rover-damaged', 'storm-hit', 'radio', 'plant', 'clear', 'step-1', 'step-2',
] as const;
export type Sfx = (typeof SFX)[number];

// Per-clip volume, and a cut-off for the long (5 s) engine and radio loops.
const VOL: Partial<Record<Sfx, number>> = { click: 0.4, 'step-1': 0.18, 'step-2': 0.18, water: 0.5, radio: 0.35, 'rover-depart': 0.4 };
const CUT_MS: Partial<Record<Sfx, number>> = { radio: 1200, 'rover-depart': 1800 };
const MUTE_KEY = 'sol-sprouts:muted';

let game: Phaser.Game | null = null;
// Phaser's `sound.mute` getter lags a frame behind its setter, so keep our own copy.
let muted = false;

/** Queue the music and effects. A missing or unsupported file is skipped, not fatal. */
export function queueAudio(scene: Phaser.Scene) {
  scene.load.audio(MUSIC, 'audio/mars-morning.mp3');
  for (const name of SFX) scene.load.audio(`sfx-${name}`, `audio/${name}.ogg`);
}

/** Play an effect if it loaded. Safe to call before startAudio() or with sound muted. */
export function sfx(name: Sfx, detune = 0) {
  const sound = game?.sound;
  if (!sound || !game!.cache.audio.exists(`sfx-${name}`)) return;
  const s = sound.add(`sfx-${name}`, { volume: VOL[name] ?? 0.6, detune });
  s.once('complete', () => s.destroy());
  s.play();
  const cut = CUT_MS[name];
  if (cut) {
    setTimeout(() => {
      if (!s.isPlaying) return;
      const tween = game?.scene.getScenes(true)[0]?.tweens;
      if (tween) tween.add({ targets: s, volume: 0, duration: 300, onComplete: () => s.destroy() });
      else s.destroy();
    }, cut);
  }
}

/** Start the music loop and hook effects to game events. Call once, after loading. */
export function startAudio(g: Phaser.Game) {
  if (game) return;
  game = g;
  muted = readMuted();
  g.sound.mute = muted;

  // Browsers block audio until the first click or key press; Phaser unlocks on that gesture.
  const music = () => {
    if (!g.cache.audio.exists(MUSIC) || g.sound.get(MUSIC)) return;
    g.sound.add(MUSIC, { loop: true, volume: MUSIC_VOLUME }).play();
  };
  if (g.sound.locked) g.sound.once(Phaser.Sound.Events.UNLOCKED, music);
  else music();

  bus.on(EV.STORM_WARNING, () => {
    sfx('storm-warning');
    setTimeout(() => sfx('storm-warning'), 380);
  });
  bus.on(EV.STORM_HIT, () => sfx('storm-hit'));
  bus.on(EV.ROVER_DEPART, () => sfx('rover-depart'));
  bus.on(EV.ROVER_ITEM_FOUND, () => sfx('found'));
  bus.on(EV.ROVER_RETURN, () => sfx('rover-return'));
  bus.on(EV.ROVER_DAMAGED, () => sfx('rover-damaged'));
  bus.on(EV.RADIO_MESSAGE, () => sfx('radio'));
  bus.on(EV.SOL_START, () => sfx('new-sol'));
  bus.on(UI_EV.PHASE_CHANGED, ({ phase }: { phase: string }) => phase === 'day' && sfx('confirm'));

  // A soft click for every button and draggable in the menus. Scenes drop their input
  // listeners on shutdown, so re-adding on each start doesn't double up.
  for (const scene of g.scene.scenes) {
    scene.sys.events.on(Phaser.Scenes.Events.START, () => {
      scene.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, () => sfx('click'));
    });
  }

  // M toggles all sound, remembered between visits.
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'm' || e.key === 'M') && !e.repeat && !(e.target instanceof HTMLInputElement)) {
      muted = !muted;
      g.sound.mute = muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        /* private mode: mute just won't be remembered */
      }
    }
  });
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
