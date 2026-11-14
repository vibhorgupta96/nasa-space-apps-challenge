// Accessibility settings (FEATURES.md #14). Person C's settings screen calls setSetting();
// the game reads `settings` wherever it shakes, flashes or plays sound.

export interface Settings {
  /** No camera shake or screen flash. Defaults to the system "reduce motion" setting. */
  reducedMotion: boolean;
  musicVolume: number; // 0–1
  sfxVolume: number; // 0–1
}

const KEY = 'sol-sprouts:settings';
const listeners: ((s: Settings) => void)[] = [];

function systemReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function load(): Settings {
  const base: Settings = { reducedMotion: systemReducedMotion(), musicVolume: 1, sfxVolume: 1 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch {
    /* private mode or bad data */
  }
  return base;
}

export const settings: Settings = load();

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage is optional */
  }
  for (const fn of listeners) fn(settings);
}

export function onSettingsChange(fn: (s: Settings) => void) {
  listeners.push(fn);
}
