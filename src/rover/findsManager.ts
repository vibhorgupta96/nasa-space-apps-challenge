import type { Find, Terrain } from '../data/loaders';

/** Stable game placements; generate the complete set before filtering collected IDs. */
export function getActiveFindsForSol(terrain: Terrain, week: string, sol: number, collected: string[] = []): Find[] {
  let seed = 2166136261;
  for (const c of `${week}:sol-${sol}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const taken = new Set([terrain.dome.join(','), ...terrain.finds.map(f => `${f.x},${f.y}`)]);
  const items = ['ice', 'regolith', 'parts', 'sample'] as const;
  const finds: Find[] = [];
  for (let attempts = 0; finds.length < 8 && attempts < 500; attempts++) {
    const radius = finds.length < 4 ? 7 : 15;
    const x = terrain.dome[0] + Math.floor(random() * (radius * 2 + 1)) - radius;
    const y = terrain.dome[1] + Math.floor(random() * (radius * 2 + 1)) - radius;
    const key = `${x},${y}`;
    if (x < 0 || y < 0 || x >= terrain.width || y >= terrain.height || taken.has(key) ||
        Math.abs(x - terrain.dome[0]) + Math.abs(y - terrain.dome[1]) < 2 ||
        (finds.length < 4 && terrain.cost[y][x] > 2)) continue;
    taken.add(key);
    const item = items[finds.length % items.length];
    finds.push({ id: `find:${week}:s${sol}:${finds.length}`, item, amount: item === 'regolith' ? 2 : 1, x, y });
  }
  const seen = new Set(collected);
  return finds.filter(f => !seen.has(f.id));
}
