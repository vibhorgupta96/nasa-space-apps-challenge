import Phaser from 'phaser';
import { hash } from '../art/pixel';

// Earth phases seen from the Moon (Moon missions only). Real fact: Earth's phases are opposite to
// the Moon's: when people on Earth see a new Moon, the Moon sees a full Earth
// (https://science.nasa.gov/moon/moon-phases/). The game squeezes one month into the 10-day
// mission and lines it up with our sunlit and dark stretches: on the near side, Earth is full in
// the middle of the lunar night and thin around lunar noon.

export interface EarthPhase {
  /** Lit fraction of Earth's disc, 0–1. */
  lit: number;
  waxing: boolean;
  name: string;
  /** The Moon's phase as people on Earth see it on the same day (the opposite one). */
  moonName: string;
  /** Angle between the Sun and the viewer, seen from Earth (0 = full). */
  angle: number;
}

const NAMES: [number, string, string][] = [
  [0.06, 'New Earth', 'full'],
  [0.35, 'Crescent Earth', 'gibbous'],
  [0.65, 'Half Earth', 'half'],
  [0.94, 'Gibbous Earth', 'crescent'],
  [1.01, 'Full Earth', 'new'],
];

export function earthPhase(day: number, missionDays = 10): EarthPhase {
  const angle = (2 * Math.PI * (day - (missionDays + 1) / 2)) / missionDays;
  const lit = (1 + Math.cos(angle)) / 2;
  const waxing = day < (missionDays + 1) / 2;
  const [, name, moon] = NAMES.find(([max]) => lit < max)!;
  // While Earth waxes (grows) as seen from the Moon, the Moon wanes as seen from Earth.
  const middle = lit >= 0.06 && lit < 0.94;
  return {
    lit, waxing, angle,
    name: middle ? `${name} (${waxing ? 'waxing' : 'waning'})` : name,
    moonName: middle ? `${waxing ? 'waning' : 'waxing'} ${moon}` : moon,
  };
}

/** Draw the habitat window with Earth in today's phase (same frame as the Mars poster). */
export function drawEarthWindow(scene: Phaser.Scene, key: string, phase: EarthPhase) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, 32, 32);
  if (!tex) return;
  const c = tex.getContext();
  c.fillStyle = '#4b5361';
  c.fillRect(0, 0, 32, 32);
  c.fillStyle = '#0b1026';
  c.fillRect(4, 4, 24, 24);
  for (let i = 0; i < 12; i++) {
    c.fillStyle = '#ffffff';
    c.fillRect(4 + Math.floor(hash(i, 1, 9) * 24), 4 + Math.floor(hash(i, 2, 9) * 24), 1, 1);
  }
  // Light each pixel of a small sphere from the Sun's direction.
  const r = 8;
  const sx = (phase.waxing ? 1 : -1) * Math.abs(Math.sin(phase.angle));
  const sz = Math.cos(phase.angle);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d2 = (x * x + y * y) / (r * r);
      if (d2 > 1) continue;
      const nx = x / r, nz = Math.sqrt(1 - d2);
      const day = nx * sx + nz * sz > 0;
      const land = (x > -5 && x < -1 && y > -4 && y < 1) || (x > 1 && x < 5 && y > 1 && y < 5);
      const cloud = y === -5 && x > -2 && x < 3;
      c.fillStyle = day ? (cloud ? '#ffffff' : land ? '#6aa84f' : '#3d7bd9') : '#16233f';
      c.fillRect(16 + x, 16 + y, 1, 1);
    }
  }
  tex.refresh();
}
