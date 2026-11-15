import type { Terrain } from '../data/loaders';
import type { WorldId } from '../core/types';

/** Compressed illustration units: the source map's kilometres are not driving metres. */
export const METRES_PER_CELL = 8;
export const CHECKPOINT_RADIUS = 0.4;
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
const hash = (x: number, y: number) => ((x * 73856093 ^ y * 19349663) >>> 0) / 4294967295;

export function terrainHeight(world: WorldId, t: Terrain, x: number, y: number): number {
  let height = world === 'mars'
    ? Math.sin(x * 1.1) * 0.65 + Math.sin(y * 1.35 + x * 0.4) * 0.6 + Math.cos(y * 0.6 - x * 0.7) * 0.45
    : Math.sin(x * 0.65 + y * 0.4) * 0.25;
  if (world === 'moon') {
    const gx = Math.floor(x / 4), gy = Math.floor(y / 4);
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      const cx = i * 4 + 1 + hash(i, j) * 2, cy = j * 4 + 1 + hash(j + 37, i) * 2;
      const radius = 0.8 + hash(i + 91, j) * 0.6;
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d < 1.5) height += -0.95 * Math.exp(-d * d * 2.5) + 0.48 * Math.exp(-(((d - 1) / 0.23) ** 2));
    }
  }
  // Smooth, level approaches to the habitat and all resource locations.
  let flatten = smooth(Math.hypot(x - t.dome[0], y - t.dome[1]) / 1.4);
  for (const f of t.finds) flatten = Math.min(flatten, smooth(Math.hypot(x - f.x, y - f.y) / 0.65));
  return height * flatten;
}

export interface TerrainRock { x: number; y: number; radius: number }
const rockCache = new WeakMap<Terrain, TerrainRock[]>();
export function terrainRocks(t: Terrain): TerrainRock[] {
  const cached = rockCache.get(t);
  if (cached) return cached;
  const rocks: TerrainRock[] = [];
  for (let y = 1; y < t.height - 1; y++) for (let x = 1; x < t.width - 1; x++) {
    const seed = hash(x, y);
    if (seed > (t.cost[y][x] === 3 ? 0.48 : 0.09)) continue;
    const rx = x + 0.25 + hash(y, x + 97) * 0.2, ry = y + 0.25;
    if (Math.hypot(rx - t.dome[0], ry - t.dome[1]) < 1.6 || t.finds.some(f => Math.hypot(rx - f.x, ry - f.y) < 0.8)) continue;
    rocks.push({ x: rx, y: ry, radius: 0.45 + seed * 0.6 });
  }
  rockCache.set(t, rocks);
  return rocks;
}
