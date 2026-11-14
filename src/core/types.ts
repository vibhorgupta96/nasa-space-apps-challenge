// Shared contract (PLAN.md section 5). Changes need agreement from A, B and C.
export type ItemId = 'water' | 'ice' | 'regolith' | 'seed' | 'parts' | 'sample';
export type PowerSlot = 'growLights' | 'heater' | 'shelter' | 'rover';
export type Phase = 'planning' | 'day' | 'rescue' | 'debrief';
export type PlotCondition = 'healthy' | 'wilted';

export interface GameState {
  sol: number; // starts at 1; a successful mission ends after sol 10
  phase: Phase; // new mission: planning, sol 1
  missionElapsedMs: number; // new mission: 0; active simulation time only
  cellsToday: number;
  split: Record<PowerSlot, number>; // integers; sum <= cellsToday
  air: number; // 0–100
  food: number; // 0–100
  shield: number; // starts at 0; 0–3 permanent layers
  inventory: Record<ItemId, number>; // home inventory only
  pantry: Record<string, number>; // harvested crops (crop id → count) waiting in the kitchen
  plots: Plot[]; // exactly 12, ordered by id
  stormWeekId: string;
  stormBlackoutSol: number | null;
  processedWarnings: string[];
  processedStormHits: string[];
  radioQueue: { messageId: string; text: string; arrivesAtMs: number; delayMinutes: number }[];
  rover: RoverState;
  log: string[]; // kid-readable, newest last
}

export interface Plot {
  id: number;
  cropId: string | null;
  growthSols: number; // completed eligible growth steps, not elapsed time
  condition: PlotCondition;
  wateredToday: boolean;
}

export interface RoverState {
  status: 'home' | 'out' | 'stranded' | 'repairing';
  batteryCells: number; // fractional cells, rounded to one decimal after a tile
  expeditionId: string | null;
  lastLaunchSol: number;
  route: [number, number][];
  nextRouteIndex: number;
  routeStartedAtMs: number | null; // remaining tile time derives from this and missionElapsedMs
  cargo: Record<ItemId, number>;
  collectedFindIds: string[]; // prevents repeat collection after save/reload
  availableSol: number; // next sol when a disabled rover may launch
}
