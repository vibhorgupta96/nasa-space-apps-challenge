import { RULES } from '../core/rules';
import type { Terrain } from '../data/loaders';
export type GridCoord = [number, number];
export function evaluateRoute(route: GridCoord[], terrain: Terrain, battery: number) {
  const totalBatteryCost = Math.round(route.slice(1).reduce((sum, [x, y]) => sum + (terrain.cost[y]?.[x] ?? Infinity) * RULES.roverCostPerTile, 0) * 10) / 10;
  const last = route[route.length - 1];
  const returnsHome = route.length > 1 && last[0] === terrain.dome[0] && last[1] === terrain.dome[1];
  return { totalBatteryCost, returnsHome, canAfford: route.length > 1 && totalBatteryCost <= battery + 1e-9 };
}
