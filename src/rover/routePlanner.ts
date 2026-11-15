import { RULES } from '../core/rules';
import type { Terrain } from '../data/loaders';
export type GridCoord = [number, number];
/** Shared cardinal pathfinding for route planning and autopilot handoff. */
export function findRoute(from: GridCoord, to: GridCoord, terrain: Terrain, cost: (x: number, y: number) => number): GridCoord[] {
  const key = (x: number, y: number) => y * terrain.width + x;
  const start = key(...from), end = key(...to);
  const dist = new Map<number, number>([[start, 0]]), prev = new Map<number, number>();
  const open: [number, number, number][] = [[0, ...from]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = open.shift()!;
    if (key(x, y) === end) break;
    if (d > (dist.get(key(x, y)) ?? Infinity)) continue;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= terrain.width || ny >= terrain.height) continue;
      const nd = d + cost(nx, ny), nk = key(nx, ny);
      if (nd < (dist.get(nk) ?? Infinity)) { dist.set(nk, nd); prev.set(nk, key(x, y)); open.push([nd, nx, ny]); }
    }
  }
  const result: GridCoord[] = [];
  for (let k = end; k !== start;) {
    result.unshift([k % terrain.width, Math.floor(k / terrain.width)]);
    const parent = prev.get(k);
    if (parent === undefined) return [];
    k = parent;
  }
  return result;
}
export function drivingTileCost(terrainCost: number, baseCost = RULES.roverCostPerTile, rockExtra = RULES.roverRockCostExtra) {
  return Math.round((terrainCost * baseCost + (terrainCost === 3 ? rockExtra : 0)) * 10) / 10;
}
export function evaluateRoute(route: GridCoord[], terrain: Terrain, battery: number, roverCostPerTile = RULES.roverCostPerTile, rockExtra = RULES.roverRockCostExtra) {
  const totalBatteryCost = Math.round(route.slice(1).reduce((sum, [x, y]) => sum + drivingTileCost(terrain.cost[y]?.[x] ?? Infinity, roverCostPerTile, rockExtra), 0) * 10) / 10;
  const last = route[route.length - 1];
  const returnsHome = route.length > 1 && last[0] === terrain.dome[0] && last[1] === terrain.dome[1];
  return { totalBatteryCost, returnsHome, canAfford: route.length > 1 && totalBatteryCost <= battery + 1e-9 };
}
