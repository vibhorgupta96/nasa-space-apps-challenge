import Phaser from 'phaser';
import { bus, EV, UI_EV } from './events';
import { onSettingsChange, settings } from './settings';
import { store } from './store';
import type { WorldId } from './types';

// Background music and sound effects. The music is "Mars Morning" on Mars and the lunar theme on
// the Moon (see docs/AI_USAGE.md); the effects are CC0 clips from Kenney's Interface, Sci-Fi and RPG audio packs (docs/ASSETS.md).
// Everything listens to the bus, so gameplay code only calls sfx() for actions with no event.

const MUSIC: Record<WorldId, string> = { mars: 'music-mars-morning', moon: 'music-moon-theme' };
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
  scene.load.audio(MUSIC.mars, 'audio/mars-morning.mp3');
  scene.load.audio(MUSIC.moon, 'audio/moon-theme.mp3');
  for (const name of SFX) scene.load.audio(`sfx-${name}`, `audio/${name}.ogg`);
}

/** Play an effect if it loaded. Safe to call before startAudio() or with sound muted. */
export function sfx(name: Sfx, detune = 0) {
  const sound = game?.sound;
  if (!sound || !game!.cache.audio.exists(`sfx-${name}`)) return;
  if (settings.sfxVolume <= 0) return;
  const s = sound.add(`sfx-${name}`, { volume: (VOL[name] ?? 0.6) * settings.sfxVolume, detune });
  s.once('complete', () => s.destroy());
  s.play();
  const cut = CUT_MS[name];
  if (cut) {
    setTimeout(() => {
      if (!s.isPlaying) return;
      // Fade a plain value, not the sound: the clip may end (and be destroyed) mid-fade.
      const alive = () => !!(s as unknown as { manager: unknown }).manager;
      const fade = { v: s.volume };
      const tween = game?.scene.getScenes(true)[0]?.tweens;
      if (tween) {
        tween.add({
          targets: fade, v: 0, duration: 300,
          onUpdate: () => alive() && s.setVolume(fade.v),
          onComplete: () => alive() && s.destroy(),
        });
      } else s.destroy();
    }, cut);
  }
}

/**
 * A short pet noise made on the fly with Web Audio (no sound file): a bark for the dog, a meow for
 * the cat and a warble for the alien. Follows mute and the sound-effects volume.
 */
export function petSound(kind: 'cat' | 'dog' | 'alien') {
  const ctx = (game?.sound as Partial<Phaser.Sound.WebAudioSoundManager> | undefined)?.context;
  if (!ctx || muted || settings.sfxVolume <= 0) return;
  const t = ctx.currentTime;
  const vol = 0.22 * settings.sfxVolume;
  const voice = (type: OscillatorType, start: number, len: number, freqs: [number, number][], cutoff = 2000) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = type;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.frequency.setValueAtTime(freqs[0][1], t + start);
    for (const [at, hz] of freqs.slice(1)) o.frequency.linearRampToValueAtTime(hz, t + start + at);
    g.gain.setValueAtTime(0.0001, t + start);
    g.gain.exponentialRampToValueAtTime(vol, t + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + len);
    o.connect(f).connect(g).connect(ctx.destination);
    o.start(t + start);
    o.stop(t + start + len + 0.05);
    return o;
  };
  // A burst of noise through a band-pass filter: the breathy part of a bark.
  const breath = (start: number, len: number, hz: number) => {
    const n = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = 1.2;
    g.gain.setValueAtTime(vol * 1.6, t + start);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + len);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t + start);
  };
  if (kind === 'dog') {
    // "Woof woof": a rough, falling voice plus a puff of breath, twice.
    for (const at of [0, 0.24]) {
      voice('sawtooth', at, 0.16, [[0, 420], [0.04, 520], [0.15, 170]], 1100);
      breath(at, 0.12, 900);
    }
  } else if (kind === 'cat') {
    // "Mee-ow": the pitch rises then falls while a vowel-like filter opens and closes.
    const o = voice('sawtooth', 0, 0.7, [[0, 560], [0.18, 880], [0.45, 760], [0.68, 480]], 2600);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 3;
    formant.frequency.setValueAtTime(900, t);
    formant.frequency.linearRampToValueAtTime(2200, t + 0.2);
    formant.frequency.linearRampToValueAtTime(1100, t + 0.65);
    o.disconnect();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * 2.2, t + 0.08);
    g.gain.setValueAtTime(vol * 2.2, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(formant).connect(g).connect(ctx.destination);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = 18;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 0.75);
  } else {
    const o = voice('sine', 0, 0.45, [[0, 600], [0.35, 1300]]);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 28;
    depth.gain.value = 140;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 0.5);
  }
}

/** Start the music loop and hook effects to game events. Call once, after loading. */
export function startAudio(g: Phaser.Game) {
  if (game) return;
  game = g;
  muted = readMuted();
  g.sound.mute = muted;

  // One loop per world. Every scene start checks the current world, so starting or travelling
  // to the Moon swaps the track. Browsers block audio until the first click or key press;
  // Phaser unlocks on that gesture.
  const music = () => {
    if (g.sound.locked) return;
    const want = MUSIC[store.state ? store.worldId : 'mars'];
    for (const key of Object.values(MUSIC)) if (key !== want) g.sound.get(key)?.destroy();
    if (!g.cache.audio.exists(want) || g.sound.get(want)) return;
    g.sound.add(want, { loop: true, volume: MUSIC_VOLUME * settings.musicVolume }).play();
  };
  onSettingsChange((st) => {
    for (const key of Object.values(MUSIC)) {
      (g.sound.get(key) as Phaser.Sound.WebAudioSound | null)?.setVolume(MUSIC_VOLUME * st.musicVolume);
    }
  });
  g.sound.on(Phaser.Sound.Events.UNLOCKED, music);
  music();

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
  bus.on(UI_EV.BADGE, () => sfx('found', 300));
  bus.on(UI_EV.PHASE_CHANGED, ({ phase }: { phase: string }) => phase === 'day' && sfx('confirm'));

  // A soft click for every button and draggable in the menus. Scenes drop their input
  // listeners on shutdown, so re-adding on each start doesn't double up.
  for (const scene of g.scene.scenes) {
    scene.sys.events.on(Phaser.Scenes.Events.START, () => {
      music();
      scene.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, () => sfx('click'));
    });
  }

  // M toggles all sound, remembered between visits.
  window.addEventListener('keydown', (e) => {
    // Not while typing a name on the astronaut screen.
    if ((e.key === 'm' || e.key === 'M') && !e.repeat && !(e.target instanceof HTMLInputElement) && !g.scene.isActive('Customize')) {
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
