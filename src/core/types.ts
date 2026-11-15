// Shared contract (PLAN.md section 5). Changes need agreement from A, B and C.
export type ItemId = 'water' | 'ice' | 'regolith' | 'seed' | 'parts' | 'sample';
export type PowerSlot = 'growLights' | 'heater' | 'shelter' | 'rover';
export type Phase = 'planning' | 'day' | 'rescue' | 'debrief';
export type PlotCondition = 'healthy' | 'wilted';
export type WorldId = 'mars' | 'moon';

export interface TrainingSnapshot {
  badges: string[];
  lessons: Record<number, boolean>;
  wizCards: number[];
  quiz: { pre: number | null; post: number | null };
  journal: string[];
}

export interface MissionResult {
  worldId: WorldId;
  /** The scenario used on that world, for its archived lesson cards. */
  stormWeekId?: string;
  harvests: Record<string, number>;
  stormsSurvived: number;
  stormsTaken: number;
  trips: number;
  mealsCooked: number;
  air: number;
  food: number;
  /** Training earned on that world, retained after travelling to the next mission. */
  training?: TrainingSnapshot;
}

export interface Campaign {
  order: [WorldId, WorldId];
  currentIndex: 0 | 1;
  completed: MissionResult[];
}

export interface GameState {
  worldId: WorldId;
  dustLevel: number;
  dustCleanedSol: number | null;
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

export interface ManualExpedition {
  vehicle: import('../rover/vehicle').VehiclePose;
  checkpoints: [number, number][];
  nextCheckpoint: number;
  bonusEligible: boolean;
  departed: boolean;
  nextPhysicsAtMs: number;
}

export interface RoverState {
  manual?: ManualExpedition;
  driveMode?: 'plan' | 'manual'; // older saves default to planned trips
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
