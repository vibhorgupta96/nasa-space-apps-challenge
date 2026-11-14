import { RULES } from './rules';
import type { WorldId } from './types';

export interface WorldProfile {
  id: WorldId;
  name: string;
  dayLabel: string;
  gravityMs2: number;
  hopEnabled: boolean;
}

const WORLDS: Record<WorldId, WorldProfile> = {
  mars: { id: 'mars', name: 'Mars', dayLabel: 'Sol', gravityMs2: 3.71, hopEnabled: false },
  moon: { id: 'moon', name: 'Moon', dayLabel: 'Day', gravityMs2: 1.62, hopEnabled: true },
};
const MOON_RULES = { ...RULES, roverMsPerTile: 5_000, roverDriveMsPerTile: 1_500, roverRockCostExtra: 0.1 };
export function worldProfile(id: WorldId): WorldProfile { return WORLDS[id]; }
export function worldRules(id: WorldId): typeof RULES { return id === 'moon' ? MOON_RULES : RULES; }
