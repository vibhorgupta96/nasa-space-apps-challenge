import { RULES } from '../core/rules';
import type { Terrain } from '../data/loaders';
export type GridCoord = [number, number];
export function drivingTileCost(terrainCost: number, baseCost = RULES.roverCostPerTile, rockExtra = RULES.roverRockCostExtra) {
  return Math.round((terrainCost * baseCost + (terrainCost === 3 ? rockExtra : 0)) * 10) / 10;
}
export function evaluateRoute(route: GridCoord[], terrain: Terrain, battery: number, roverCostPerTile = RULES.roverCostPerTile, rockExtra = RULES.roverRockCostExtra) {
  const totalBatteryCost = Math.round(route.slice(1).reduce((sum, [x, y]) => sum + drivingTileCost(terrain.cost[y]?.[x] ?? Infinity, roverCostPerTile, rockExtra), 0) * 10) / 10;
  const last = route[route.length - 1];
  const returnsHome = route.length > 1 && last[0] === terrain.dome[0] && last[1] === terrain.dome[1];
  return { totalBatteryCost, returnsHome, canAfford: route.length > 1 && totalBatteryCost <= battery + 1e-9 };
}
