import { RULES } from './rules';
import { bus, EV, UI_EV } from './events';
import type { Campaign, GameState, ItemId, MissionResult, Plot, PowerSlot, WorldId } from './types';
import { worldProfile, worldRules } from './worlds';
import { cropById, getData, type StormEvent, type WeatherSol } from '../data/loaders';
import { selectScienceCard } from '../data/science';
import { getActiveFindsForSol } from '../rover/findsManager';
import { recipeById } from '../farm/recipes';

// The single owner of GameState. Scenes read `store.state` and call commands; only the store
// advances time, the rover route and the radio queue (PLAN.md sections 5–6).

export type Result = { ok: true } | { ok: false; reason: string };
const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

export interface ScheduledStorm {
  event: StormEvent;
  hitAtMs: number;
  warnAtMs: number;
}

export interface NightReport {
  sol: number;
  air: [number, number];
  food: [number, number];
  warm: boolean;
  minC: number;
  litPlots: number;
  grownPlots: number;
  blackout: boolean;
  roverRecovered: boolean;
  /** Bolt was still driving when the mission ended; the crew brought the rover and its cargo in. */
  roverCalledHome: boolean;
  /** Raw pantry crops the crew ate at night because food was low. */
  snacked: number;
  outcome: 'next' | 'rescue' | 'debrief';
  card: { text: string; source: string } | null;
}

/** Things this build remembers that aren't part of the shared GameState contract. */
export interface Meta {
  radioCounter: number;
  weekCursor: number;
  storySeen: string[];
  eggs: string[];
  boltTalks: number;
  photosEarned: string[];
  harvests: Record<string, number>;
  stormsSurvived: number;
  stormsTaken: number;
  trips: number;
  mealsCooked: number;
}

interface Today {
  harvested: string[];
  planted: boolean;
  watered: boolean;
  roverTrip: boolean;
  storm: StormEvent | null;
  stormSafe: boolean;
  sample: boolean;
}

interface SavedScienceContext {
  sol: number;
  phase: 'planning' | 'day';
  harvested: string[];
  planted: boolean;
  watered: boolean;
  roverTrip: boolean;
  stormId: string | null;
}

const SAVE_KEY = 'sol-sprouts-save-v1';
const META_KEY = 'sol-sprouts-meta-v1';
const ITEMS: ItemId[] = ['water', 'ice', 'regolith', 'seed', 'parts', 'sample'];
const SLOTS: PowerSlot[] = ['growLights', 'heater', 'shelter', 'rover'];

const zeroItems = (): Record<ItemId, number> => Object.fromEntries(ITEMS.map((i) => [i, 0])) as Record<ItemId, number>;
const clamp = (v: number) => Math.max(0, Math.min(RULES.resourceMax, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function freshMeta(): Meta {
  return {
    radioCounter: 0, weekCursor: 0, storySeen: [], eggs: [], boltTalks: 0, photosEarned: [],
    harvests: {}, stormsSurvived: 0, stormsTaken: 0, trips: 0, mealsCooked: 0,
  };
}

export class Store {
  state!: GameState;
  campaign!: Campaign;
  meta: Meta = freshMeta();
  /** Dialogs, help and other modal UI pause the whole simulation. */
  pausedBy = new Set<string>();
  hidden = false;
  lastNight: NightReport | null = null;
  private today: Today = { harvested: [], planted: false, watered: false, roverTrip: false, storm: null, stormSafe: true, sample: false };

  private lastAutosaveMs = 0;

  /** `watchPage` is false for throwaway instances (self-tests) that must not react to the tab. */
  constructor(watchPage = true) {
    if (watchPage && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.hidden = document.hidden;
        if (this.hidden) this.save();
      });
      window.addEventListener('pagehide', () => this.save());
    }
  }

  // ---------- lifecycle ----------

  get worldId(): WorldId { return this.state?.worldId ?? 'mars'; }
  get world() { return worldProfile(this.worldId); }
  get rules() { return worldRules(this.worldId); }
  get data() { return getData(this.worldId); }
  get canTravel() { return !!this.campaign && this.state.phase === 'debrief' && this.campaign.currentIndex === 0 && this.campaign.completed.length === 1; }
  get campaignComplete() { return !!this.campaign && this.state.phase === 'debrief' && this.campaign.currentIndex === 1 && this.campaign.completed.length === 2; }

  /** Starts an entirely new campaign. Existing progress is replaced by caller intent. */
  startCampaign(worldId: WorldId) {
    if (worldId !== 'mars' && worldId !== 'moon') throw new Error('Unknown world');
    this.campaign = { order: [worldId, worldId === 'mars' ? 'moon' : 'mars'], currentIndex: 0, completed: [] };
    this.startMission(worldId, false);
  }

  /** Kept for legacy self-tests and callers. */
  newGame(worldId: WorldId = 'mars') { this.startCampaign(worldId); }

  travel(): Result {
    if (!this.canTravel) return fail('Complete this mission before travelling.');
    this.campaign.currentIndex = 1;
    this.startMission(this.campaign.order[1], true);
    return OK;
  }

  retryMission(): Result {
    if (this.state.phase !== 'rescue') return fail('Retry is available after a rescue.');
    this.startMission(this.campaign.order[this.campaign.currentIndex], true);
    return OK;
  }

  private startMission(worldId: WorldId, preserveDiscoveries: boolean) {
    const weeks = getData(worldId).storms.weeks;
    if (!weeks.length) throw new Error(`No storm scenarios for ${worldId}`);
    const keepEggs = [...this.meta.eggs];
    const keepPhotos = preserveDiscoveries ? [...this.meta.photosEarned] : [];
    const cursor = this.meta.weekCursor;
    this.meta = { ...freshMeta(), weekCursor: cursor + 1, eggs: keepEggs, photosEarned: keepPhotos };
    const week = weeks[cursor % weeks.length];
    const inventory = zeroItems();
    inventory.seed = RULES.initialSeeds;
    inventory.water = RULES.initialWater;
    const plots: Plot[] = Array.from({ length: RULES.plotCount }, (_, id) => ({
      id, cropId: null, growthSols: 0, condition: 'healthy', wateredToday: false,
    }));
    this.state = {
      worldId, dustLevel: 0, dustCleanedSol: null,
      sol: 1, phase: 'planning', missionElapsedMs: 0,
      cellsToday: worldId === 'moon' ? 8 : RULES.cellsPerSol,
      split: { growLights: 0, heater: 0, shelter: 0, rover: 0 },
      air: RULES.initialAir,
      food: RULES.initialFood,
      shield: RULES.initialShields,
      inventory,
      pantry: {},
      plots,
      stormWeekId: week.id,
      stormBlackoutSol: null,
      processedWarnings: [],
      processedStormHits: [],
      radioQueue: [],
      rover: {
        status: 'home', batteryCells: 0, expeditionId: null, lastLaunchSol: 0, route: [], nextRouteIndex: 0,
        routeStartedAtMs: null, cargo: zeroItems(), collectedFindIds: [], availableSol: 1,
      },
      log: [],
    };
    this.lastNight = null;
    this.lastAutosaveMs = 0;
    this.pausedBy.clear();
    this.resetToday();
    this.save();
    bus.emit(EV.SOL_START, { sol: 1 });
  }

  /** A terminal state is resumable so the player can travel or retry after reload. */
  hasSave(): boolean {
    try {
      const raw = safeStorage()?.getItem(SAVE_KEY);
      if (!raw) return false;
      return this.readSave(raw) !== null;
    } catch { return false; }
  }

  load(): boolean {
    const raw = safeStorage()?.getItem(SAVE_KEY);
    return raw ? this.restore(raw) : false;
  }

  serialize(): string {
    const scienceContext: SavedScienceContext = {
      sol: this.state.sol,
      phase: this.state.phase === 'day' ? 'day' : 'planning',
      harvested: [...this.today.harvested], planted: this.today.planted,
      watered: this.today.watered, roverTrip: this.today.roverTrip,
      stormId: this.today.storm?.id ?? null,
    };
    return JSON.stringify({ v: 2, state: this.state, meta: this.meta, campaign: this.campaign, scienceContext });
  }

  private readSave(raw: string): { state: GameState; meta: Meta; campaign: Campaign; scienceContext: unknown } | null {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.v !== 1 && parsed?.v !== 2) return null;
      const state = parsed.state;
      if (!state || typeof state !== 'object') return null;
      if (parsed.v === 1) {
        if (state.worldId !== undefined && state.worldId !== 'mars') return null;
        state.worldId = 'mars'; state.dustLevel = 0; state.dustCleanedSol = null;
      }
      const world: WorldId = state.worldId;
      if (world !== 'mars' && world !== 'moon') return null;
      if (state.pantry === undefined) state.pantry = {};
      if (!state.pantry || typeof state.pantry !== 'object' || Array.isArray(state.pantry) || Object.entries(state.pantry).some(([id, count]) => !cropById(id, world) || !Number.isInteger(count) || (count as number) < 0)) return null;
      if (!['planning', 'day', 'rescue', 'debrief'].includes(state.phase)) return null;
      if (!Number.isInteger(state.sol) || state.sol < 1 || state.sol > RULES.missionSols || !Number.isFinite(state.missionElapsedMs) || state.missionElapsedMs < (state.sol - 1) * RULES.solDurationMs || state.missionElapsedMs > state.sol * RULES.solDurationMs) return null;
      if (!Number.isInteger(state.dustLevel) || state.dustLevel < 0 || state.dustLevel > 2 || !(state.dustCleanedSol === null || Number.isInteger(state.dustCleanedSol) && state.dustCleanedSol >= 1 && state.dustCleanedSol <= state.sol)) return null;
      if (!Number.isInteger(state.cellsToday) || state.cellsToday < 0 || state.cellsToday > 8 || !state.split || SLOTS.some(k => !Number.isInteger(state.split[k]) || state.split[k] < 0) || SLOTS.reduce((n,k) => n + state.split[k], 0) > state.cellsToday) return null;
      if (![state.air, state.food, state.shield].every(Number.isFinite) || state.air < 0 || state.air > 100 || state.food < 0 || state.food > 100 || state.shield < 0 || state.shield > RULES.maxShieldLayers) return null;
      if (!state.inventory || ITEMS.some(k => !Number.isFinite(state.inventory[k]) || state.inventory[k] < 0)) return null;
      if (!Array.isArray(state.plots) || state.plots.length !== RULES.plotCount || state.plots.some((p: Plot, i: number) => !p || p.id !== i || !(p.cropId === null || typeof p.cropId === 'string' && !!cropById(p.cropId, world)) || !Number.isInteger(p.growthSols) || p.growthSols < 0 || !['healthy','wilted'].includes(p.condition) || typeof p.wateredToday !== 'boolean')) return null;
      const data = getData(world);
      if (typeof state.stormWeekId !== 'string' || !data.storms.weeks.some(w => w.id === state.stormWeekId) || !Array.isArray(state.processedWarnings) || !Array.isArray(state.processedStormHits) || !Array.isArray(state.radioQueue) || !Array.isArray(state.log)) return null;
      const week = data.storms.weeks.find(w => w.id === state.stormWeekId)!;
      const eventIds = new Set(week.events.map(e => e.id));
      // Older Mars saves may contain a GST record that represented Earth weather,
      // not an outpost storm. Current data excludes it; retain all active events.
      const retiredEarthGst = '2024-05-10T15:00:00-GST-001';
      if (world === 'mars' && week.id === '2024-05' && !eventIds.has(retiredEarthGst)) {
        state.processedWarnings = state.processedWarnings.filter((id: unknown) => id !== retiredEarthGst);
        state.processedStormHits = state.processedStormHits.filter((id: unknown) => id !== retiredEarthGst);
        if (parsed.scienceContext && typeof parsed.scienceContext === 'object' && parsed.scienceContext.stormId === retiredEarthGst) {
          parsed.scienceContext.stormId = null;
        }
      }
      if (state.processedWarnings.some((id: unknown) => typeof id !== 'string' || !eventIds.has(id)) || state.processedStormHits.some((id: unknown) => typeof id !== 'string' || !eventIds.has(id)) || state.log.some((x: unknown) => typeof x !== 'string') || state.radioQueue.some((m: any) => !m || typeof m.messageId !== 'string' || typeof m.text !== 'string' || !Number.isFinite(m.arrivesAtMs) || !Number.isFinite(m.delayMinutes))) return null;
      const r = state.rover;
      if (!r || !['home','out','stranded','repairing'].includes(r.status) || !Number.isFinite(r.batteryCells) || !Array.isArray(r.route) || !Array.isArray(r.collectedFindIds) || !r.cargo || ITEMS.some(k => !Number.isFinite(r.cargo[k]) || r.cargo[k] < 0) || !Number.isInteger(r.nextRouteIndex) || r.nextRouteIndex < 0 || r.nextRouteIndex > r.route.length || r.route.some((xy: unknown) => !Array.isArray(xy) || xy.length !== 2 || !xy.every(Number.isInteger) || xy[0] < 0 || xy[0] >= data.terrain.width || xy[1] < 0 || xy[1] >= data.terrain.height) || !Number.isInteger(r.lastLaunchSol) || !Number.isInteger(r.availableSol) || !(r.routeStartedAtMs === null || Number.isFinite(r.routeStartedAtMs)) || !(r.expeditionId === null || typeof r.expeditionId === 'string') || r.collectedFindIds.some((id: unknown) => typeof id !== 'string') || (r.status === 'out' && (!r.expeditionId || r.routeStartedAtMs === null || r.nextRouteIndex < 1 || r.nextRouteIndex >= r.route.length))) return null;
      const rawMeta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
      const meta: Meta = { ...freshMeta(), ...rawMeta };
      if (!Number.isInteger(meta.weekCursor) || meta.weekCursor < 0 || !Array.isArray(meta.eggs) || !Array.isArray(meta.photosEarned) || !Array.isArray(meta.storySeen) || [meta.eggs, meta.photosEarned, meta.storySeen].some(list => list.some(item => typeof item !== 'string')) || ![meta.radioCounter,meta.boltTalks,meta.stormsSurvived,meta.stormsTaken,meta.trips,meta.mealsCooked].every(n => Number.isInteger(n) && n >= 0) || !meta.harvests || typeof meta.harvests !== 'object' || Object.values(meta.harvests).some(n => !Number.isInteger(n) || n < 0)) return null;
      let campaign: Campaign;
      if (parsed.v === 1) {
        campaign = { order: ['mars','moon'], currentIndex: 0, completed: [] };
        if (state.phase === 'debrief') campaign.completed.push(this.summarizeMission(state, meta));
      } else {
        campaign = parsed.campaign;
        if (!campaign || !Array.isArray(campaign.order) || campaign.order.length !== 2 || !['mars','moon'].includes(campaign.order[0]) || !['mars','moon'].includes(campaign.order[1]) || campaign.order[0] === campaign.order[1] || ![0,1].includes(campaign.currentIndex) || campaign.order[campaign.currentIndex] !== world || !Array.isArray(campaign.completed)) return null;
        // Version 2 campaigns created before the kitchen have no meal count.
        for (const result of campaign.completed) if (result && result.mealsCooked === undefined) result.mealsCooked = 0;
        const expected = campaign.currentIndex + (state.phase === 'debrief' ? 1 : 0);
        if (campaign.completed.length !== expected || campaign.completed.some((m: MissionResult, i: number) => !m || m.worldId !== campaign.order[i] || !m.harvests || typeof m.harvests !== 'object' || ![m.air,m.food,m.stormsSurvived,m.stormsTaken,m.trips,m.mealsCooked].every(Number.isFinite))) return null;
      }
      return {state, meta, campaign, scienceContext: parsed.scienceContext};
    } catch { return null; }
  }

  /** Adopt only a fully validated save; failed reads leave current state untouched. */
  restore(raw: string): boolean {
    const parsed = this.readSave(raw);
    if (!parsed) return false;
    this.state = parsed.state;
    this.campaign = parsed.campaign;
    this.meta = parsed.meta;
    this.lastAutosaveMs = this.state.missionElapsedMs;
    this.lastNight = null;
    this.pausedBy.clear();
    this.resetToday();
    this.restoreScienceContext(parsed.scienceContext, this.state);
    return true;
  }

  private summarizeMission(state: GameState, meta: Meta): MissionResult {
    return { worldId: state.worldId, harvests: { ...meta.harvests }, stormsSurvived: meta.stormsSurvived,
      stormsTaken: meta.stormsTaken, trips: meta.trips, mealsCooked: meta.mealsCooked, air: state.air, food: state.food };
  }

  loadMetaOnly() {
    try {
      const raw = safeStorage()?.getItem(META_KEY);
      if (raw) this.meta = { ...freshMeta(), ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
  }

  save() {
    if (!this.state) return;
    try {
      const s = safeStorage();
      s?.setItem(SAVE_KEY, this.serialize());
      s?.setItem(META_KEY, JSON.stringify({ weekCursor: this.meta.weekCursor, eggs: this.meta.eggs }));
    } catch {
      /* storage is optional */
    }
  }

  clearSave() {
    try {
      safeStorage()?.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  // ---------- derived data ----------

  get paused() {
    return this.pausedBy.size > 0 || this.hidden;
  }

  pause(reason: string) {
    this.pausedBy.add(reason);
  }

  resume(reason: string) {
    this.pausedBy.delete(reason);
  }

  dayStartMs(sol = this.state.sol) {
    return (sol - 1) * RULES.solDurationMs;
  }

  dayEndMs(sol = this.state.sol) {
    return sol * RULES.solDurationMs;
  }

  /** 0 at dawn, 1 at the end of the active day. */
  dayFraction() {
    return Math.max(0, Math.min(1, (this.state.missionElapsedMs - this.dayStartMs()) / RULES.solDurationMs));
  }

  week() {
    const weeks = this.data.storms.weeks;
    return weeks.find((w) => w.id === this.state.stormWeekId) || weeks[0];
  }

  storms(): ScheduledStorm[] {
    return this.week().events.map((event) => {
      const hitAtMs = (event.scenario.gameSol - 1) * RULES.solDurationMs + event.scenario.hitOffsetMs;
      const warnAtMs = Math.max(0, hitAtMs - event.scenario.warningSols * RULES.solDurationMs);
      return { event, hitAtMs, warnAtMs };
    });
  }

  /** Storms that have been warned about but haven't hit yet. */
  pendingStorms(): ScheduledStorm[] {
    const s = this.state;
    return this.storms().filter((x) => s.processedWarnings.includes(x.event.id) && !s.processedStormHits.includes(x.event.id));
  }

  weather(sol = this.state.sol): WeatherSol {
    const sols = this.data.weather.sols;
    return sols[(sol - 1) % sols.length];
  }

  isDaylight(sol = this.state.sol) { return sol <= 3 || sol >= 8; }

  thermalRequired(sol = this.state.sol) {
    return this.worldId === 'moon' ? (this.isDaylight(sol) ? 1 : 2) : (this.weather(sol).minC < RULES.heaterNeededBelowC ? 1 : 0);
  }

  needsHeater(sol = this.state.sol) { return this.thermalRequired(sol) > 0; }

  nextDayCells() {
    if (this.worldId === 'mars') return RULES.cellsPerSol;
    return Math.max(0, (this.isDaylight(this.state.sol + 1) ? 8 : 6) - this.state.dustLevel);
  }

  cleanDust(): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    if (this.worldId !== 'moon') return fail('There is no lunar dust to clean here.');
    if (this.state.dustCleanedSol === this.state.sol) return fail('The airlock was already cleaned today.');
    if (!this.state.dustLevel) return fail('The airlock is already clean.');
    this.state.dustLevel = 0;
    this.state.dustCleanedSol = this.state.sol;
    this.log('Cleaned lunar dust. Tomorrow’s power budget is restored.');
    this.save();
    return OK;
  }

  splitTotal(split = this.state.split) {
    return SLOTS.reduce((n, k) => n + split[k], 0);
  }

  /** Whether Bolt can drive at all today (home and not in repair); used by the morning plan. */
  roverDrivableToday() {
    const r = this.state.rover;
    return r.status === 'home' && this.state.sol >= r.availableSol;
  }

  roverCanLaunch(): Result {
    const s = this.state;
    const r = s.rover;
    if (r.status !== 'home') return fail(r.status === 'out' ? 'Bolt is already out driving.' : 'The rover is being repaired today.');
    if (s.sol < r.availableSol) return fail('The rover is being repaired today.');
    if (r.lastLaunchSol === s.sol) return fail('Only one rover trip per sol.');
    if (s.split.rover <= 0) return fail('No power cells in the rover battery today. Plan some tomorrow morning!');
    return OK;
  }

  /** Where the rover is right now, in map cells (fractional while moving). */
  roverPosition(): { x: number; y: number; moving: boolean } {
    const r = this.state.rover;
    const dome = this.data.terrain.dome;
    if (r.status !== 'out' || r.route.length === 0) {
      if (r.status === 'stranded' && r.route.length) {
        const [x, y] = r.route[Math.max(0, r.nextRouteIndex - 1)];
        return { x, y, moving: false };
      }
      return { x: dome[0], y: dome[1], moving: false };
    }
    const i = r.nextRouteIndex;
    const from = r.route[i - 1];
    const to = r.route[i];
    if (!to || r.routeStartedAtMs === null) return { x: from[0], y: from[1], moving: false };
    const legStart = r.routeStartedAtMs + (i - 1) * this.rules.roverMsPerTile;
    const t = Math.max(0, Math.min(1, (this.state.missionElapsedMs - legStart) / this.rules.roverMsPerTile));
    return { x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, moving: true };
  }

  tileCost(x: number, y: number) {
    return this.data.terrain.cost[y][x] * this.rules.roverCostPerTile;
  }

  // ---------- commands ----------

  setPowerSplit(split: Record<PowerSlot, number>): Result {
    const s = this.state;
    if (s.phase !== 'planning') return fail('Power is locked once the day starts.');
    for (const k of SLOTS) if (!Number.isInteger(split[k]) || split[k] < 0) return fail('Power cells come in whole numbers.');
    if (this.splitTotal(split) > s.cellsToday) return fail(`You only have ${s.cellsToday} power cells today.`);
    s.split = { ...split };
    bus.emit(EV.POWER_SPLIT_SET, { split: { ...split } });
    return OK;
  }

  startDay(): Result {
    const s = this.state;
    if (s.phase !== 'planning') return fail('The day has already started.');
    s.phase = 'day';
    this.log(`${this.world.dayLabel} ${s.sol} begins.`);
    this.save();
    bus.emit(UI_EV.PHASE_CHANGED, { phase: s.phase });
    return OK;
  }

  /** The pet's once-a-sol trick adds a small gift to the home inventory. */
  petTrick(item: ItemId, amount: number): Result {
    const s = this.state;
    if (s.phase !== 'day') return fail('Start the day first!');
    const tag = `pet-trick@${s.sol}`;
    if (this.meta.storySeen.includes(tag)) return fail('already');
    this.meta.storySeen.push(tag);
    s.inventory[item] += amount;
    this.save();
    return OK;
  }

  /** Sleep through the rest of the day: everything still due today happens in order, then the sol ends. */
  sleepNow(): Result {
    if (this.state.phase !== 'day') return fail('Start the day first!');
    if (this.paused) return fail('Finish what you are doing first.');
    this.advanceTo(this.dayEndMs());
    this.endDay();
    return OK;
  }

  private dayCommand(): Result {
    if (this.state.phase !== 'day') return fail('Start the day first!');
    this.advanceTo(this.state.missionElapsedMs); // resolve anything due right now (storm hits first)
    return OK;
  }

  plant(plotId: number, cropId: string): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const p = s.plots[plotId];
    const crop = cropById(cropId, this.worldId);
    if (!p || !crop) return fail('Nothing to plant there.');
    if (p.cropId) return fail('Something is already growing here.');
    if (s.inventory.seed < 1) return fail('Out of seeds! A supply drop might have some.');
    const waterNeeded = crop.waterPerDay ?? RULES.waterPerPlant;
    if (s.inventory.water < waterNeeded) return fail('Out of water! Melt some ice.');
    s.inventory.seed -= 1;
    s.inventory.water -= waterNeeded;
    Object.assign(p, { cropId, growthSols: 0, condition: 'healthy', wateredToday: true });
    this.today.planted = true;
    return OK;
  }

  water(plotId: number): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const p = s.plots[plotId];
    if (!p?.cropId) return fail('Plant a seed first.');
    if (p.condition === 'wilted') return fail('This plant wilted. Clear the plot and try again.');
    if (p.wateredToday) return fail('Already watered today.');
    const waterNeeded = cropById(p.cropId, this.worldId)?.waterPerDay ?? RULES.waterPerPlotPerSol;
    if (s.inventory.water < waterNeeded) return fail('Out of water! Melt some ice.');
    s.inventory.water -= waterNeeded;
    p.wateredToday = true;
    this.today.watered = true;
    return OK;
  }

  harvest(plotId: number): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const p = s.plots[plotId];
    const crop = cropById(p?.cropId ?? null, this.worldId);
    if (!p || !crop) return fail('Nothing to harvest.');
    if (p.condition === 'wilted') return fail('This plant wilted. Clear the plot instead.');
    if (p.growthSols < crop.growSols) return fail(`Not ready yet (${p.growthSols}/${crop.growSols} sols of growth).`);
    s.pantry[crop.id] = (s.pantry[crop.id] || 0) + 1;
    Object.assign(p, { cropId: null, growthSols: 0, condition: 'healthy', wateredToday: false });
    this.today.harvested.push(crop.id);
    this.meta.harvests[crop.id] = (this.meta.harvests[crop.id] || 0) + 1;
    this.log(`Harvested ${crop.name}. It's in the kitchen pantry.`);
    return OK;
  }

  /** Cook a recipe from pantry crops. */
  cook(recipeId: string): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const r = recipeById(recipeId, this.worldId);
    if (!r) return fail('Unknown recipe.');
    const missing = Object.entries(r.needs).find(([id, n]) => (s.pantry[id] || 0) < n);
    if (missing) return fail(`You need ${cropById(missing[0], this.worldId)?.name ?? missing[0]} for ${r.name}.`);
    for (const [id, n] of Object.entries(r.needs)) s.pantry[id] -= n;
    s.food = clamp(s.food + r.food);
    s.inventory.seed += r.seeds;
    this.meta.mealsCooked = (this.meta.mealsCooked || 0) + 1;
    this.log(r.food > 0 ? `Cooked ${r.name}: +${r.food} food!` : `${r.name}: +${r.seeds} seeds.`);
    this.save();
    return OK;
  }

  /** Eat one pantry crop as it is. */
  eatRaw(cropId: string): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const crop = cropById(cropId, this.worldId);
    if (!crop || !(s.pantry[cropId] > 0)) return fail('That crop isn\'t in the pantry.');
    if (crop.food === 0) return fail(`${crop.name} isn't food. Save its seeds instead!`);
    s.pantry[cropId] -= 1;
    s.food = clamp(s.food + crop.food);
    this.log(`Ate ${crop.name}: +${crop.food} food.`);
    this.save();
    return OK;
  }

  /** At night a hungry crew eats raw pantry crops, biggest first, until food is back up. */
  private snackFromPantry(): number {
    const s = this.state;
    let eaten = 0;
    while (s.food < RULES.snackBelowFood) {
      const best = Object.keys(s.pantry)
        .filter((id) => s.pantry[id] > 0 && (cropById(id, this.worldId)?.food ?? 0) > 0)
        .sort((a, b) => (cropById(b, this.worldId)!.food - cropById(a, this.worldId)!.food))[0];
      if (!best) break;
      s.pantry[best] -= 1;
      s.food = clamp(s.food + cropById(best, this.worldId)!.food);
      eaten += 1;
    }
    return eaten;
  }

  clearPlot(plotId: number): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const p = this.state.plots[plotId];
    if (!p?.cropId) return fail('This plot is already empty.');
    if (p.condition !== 'wilted') return fail('This plant is still healthy!');
    Object.assign(p, { cropId: null, growthSols: 0, condition: 'healthy', wateredToday: false });
    return OK;
  }

  convertIce(): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const inv = this.state.inventory;
    if (inv.ice < RULES.icePerWaterConversion) return fail('No ice. Send Bolt to find some!');
    inv.ice -= RULES.icePerWaterConversion;
    inv.water += RULES.waterPerIceConversion;
    this.log(`Melted ice into ${RULES.waterPerIceConversion} water.`);
    return OK;
  }

  craftShield(): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    if (s.shield >= RULES.maxShieldLayers) return fail('The dome shield is already as thick as it gets.');
    if (s.inventory.regolith < RULES.regolithPerShieldLayer) return fail(`A shield layer needs ${RULES.regolithPerShieldLayer} regolith.`);
    s.inventory.regolith -= RULES.regolithPerShieldLayer;
    s.shield += 1;
    this.log(`Packed regolith onto the dome. Shield layers: ${s.shield}.`);
    return OK;
  }

  launchRover(route: [number, number][]): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const can = this.roverCanLaunch();
    if (!can.ok) return can;
    const s = this.state;
    const t = this.data.terrain;
    const [dx, dy] = t.dome;
    if (route.length < 3) return fail('Plan a longer route.');
    const atDome = (p: [number, number]) => p[0] === dx && p[1] === dy;
    if (!atDome(route[0]) || !atDome(route[route.length - 1])) return fail('The route must start and end at the dome.');
    for (let i = 1; i < route.length; i++) {
      const [ax, ay] = route[i - 1];
      const [bx, by] = route[i];
      if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return fail('Routes move one square at a time.');
      if (bx < 0 || by < 0 || bx >= t.width || by >= t.height) return fail('That route leaves the map.');
    }
    const r = s.rover;
    r.status = 'out';
    r.batteryCells = s.split.rover;
    r.expeditionId = `exp-${s.sol}-${s.missionElapsedMs}`;
    r.lastLaunchSol = s.sol;
    r.route = route.map((p) => [p[0], p[1]] as [number, number]);
    r.nextRouteIndex = 1;
    r.routeStartedAtMs = s.missionElapsedMs;
    r.cargo = zeroItems();
    this.today.roverTrip = true;
    this.meta.trips += 1;
    this.log('Bolt drives out of the airlock.');
    bus.emit(EV.ROVER_DEPART, { expeditionId: r.expeditionId, batteryCells: r.batteryCells });
    return OK;
  }

  private collectRoverFind(x: number, y: number) {
    const r = this.state.rover;
    // Use the finds of the sol Bolt launched on, including a trip past midnight.
    for (const f of [...this.data.terrain.finds, ...getActiveFindsForSol(this.data.terrain, this.state.stormWeekId, r.lastLaunchSol)]) {
      if (f.x !== x || f.y !== y || r.collectedFindIds.includes(f.id)) continue;
      r.collectedFindIds.push(f.id);
      r.cargo[f.item] += f.amount;
      if (f.item === 'sample') this.today.sample = true;
      if (f.egg && !this.meta.eggs.includes(f.id)) this.meta.eggs.push(f.id);
      bus.emit(EV.ROVER_ITEM_FOUND, { expeditionId: r.expeditionId, findId: f.id, item: f.item, amount: f.amount });
    }
  }

  private returnRover(): Result {
    const r = this.state.rover;
    const [dx, dy] = this.data.terrain.dome;
    const last = r.route[r.nextRouteIndex - 1];
    if (r.status !== 'out' || !r.expeditionId || !last || last[0] !== dx || last[1] !== dy) return fail('Bolt is not at the dome.');
    const delivered = { ...r.cargo };
    for (const k of ITEMS) this.state.inventory[k] += r.cargo[k];
    const expeditionId = r.expeditionId;
    Object.assign(r, { status: 'home', expeditionId: null, route: [], nextRouteIndex: 0, routeStartedAtMs: null, cargo: zeroItems() });
    if (this.worldId === 'moon') this.state.dustLevel = Math.min(2, this.state.dustLevel + 1);
    if (delivered.sample > 0) this.awardPhotos(delivered.sample);
    this.log('Bolt is home and unloads the cargo.');
    bus.emit(EV.ROVER_RETURN, { expeditionId, deliveredItems: delivered });
    return OK;
  }

  private disableRover(reason: 'storm' | 'battery') {
    const s = this.state;
    const r = s.rover;
    const expeditionId = r.expeditionId;
    r.status = 'stranded';
    r.availableSol = s.sol + 1 + RULES.roverDisabledSols;
    this.log(reason === 'storm' ? 'The storm knocked out Bolt\'s rover!' : 'The rover battery ran flat. Bolt is stuck until tonight.');
    bus.emit(EV.ROVER_DAMAGED, { expeditionId, availableSol: r.availableSol, reason });
  }

  private awardPhotos(n: number) {
    const photos = this.data.photos.photos;
    for (let i = 0; i < n; i++) {
      const next = photos.find((p) => !this.meta.photosEarned.includes(p.nasaId));
      if (next) this.meta.photosEarned.push(next.nasaId);
    }
  }

  queueRadioMessage(text: string) {
    const s = this.state;
    const delayMinutes = this.data.delay.oneWayMinutes;
    this.meta.radioCounter += 1;
    s.radioQueue.push({
      messageId: `radio-${this.meta.radioCounter}`,
      text,
      arrivesAtMs: s.missionElapsedMs + delayMinutes * RULES.radioMsPerMinute,
      delayMinutes,
    });
  }

  // ---------- the clock ----------

  tick(deltaMs: number) {
    const s = this.state;
    if (!s || s.phase !== 'day' || this.paused) return;
    const end = this.dayEndMs();
    const target = Math.min(end, s.missionElapsedMs + Math.min(deltaMs, 1000));
    this.advanceTo(target);
    if (s.missionElapsedMs >= end) this.endDay();
    else if (s.missionElapsedMs - this.lastAutosaveMs >= 5000) {
      this.lastAutosaveMs = s.missionElapsedMs;
      this.save();
    }
  }

  /** Process every due event up to `target` exactly once, in time order (hits before rover steps). */
  private advanceTo(target: number) {
    const s = this.state;
    for (let guard = 0; guard < 500; guard++) {
      const next = this.nextDue(target);
      if (!next) break;
      s.missionElapsedMs = Math.max(s.missionElapsedMs, next.at);
      next.run();
    }
    s.missionElapsedMs = Math.max(s.missionElapsedMs, target);
  }

  private nextDue(target: number): { at: number; prio: number; run: () => void } | null {
    const s = this.state;
    const due: { at: number; prio: number; run: () => void }[] = [];
    for (const st of this.storms()) {
      if (!s.processedStormHits.includes(st.event.id) && st.hitAtMs <= target) due.push({ at: st.hitAtMs, prio: 0, run: () => this.stormHit(st) });
      if (!s.processedWarnings.includes(st.event.id) && st.warnAtMs <= target) due.push({ at: st.warnAtMs, prio: 2, run: () => this.stormWarning(st) });
    }
    const r = s.rover;
    if (r.status === 'out' && r.routeStartedAtMs !== null && r.nextRouteIndex < r.route.length) {
      const at = r.routeStartedAtMs + r.nextRouteIndex * this.rules.roverMsPerTile;
      if (at <= target) due.push({ at, prio: 1, run: () => this.roverStep() });
    }
    for (const m of s.radioQueue) {
      if (m.arrivesAtMs <= target) due.push({ at: m.arrivesAtMs, prio: 3, run: () => this.deliverRadio(m.messageId) });
    }
    if (!due.length) return null;
    due.sort((a, b) => a.at - b.at || a.prio - b.prio);
    return due[0];
  }

  private stormWarning(st: ScheduledStorm) {
    const s = this.state;
    s.processedWarnings.push(st.event.id);
    this.log(`Storm warning! A solar event is coming on sol ${st.event.scenario.gameSol}.`);
    bus.emit(EV.STORM_WARNING, {
      stormId: st.event.id,
      strength: st.event.scenario.strength,
      gameHitAtMs: st.hitAtMs,
      scenarioLabel: st.event.scenario.label,
    });
  }

  private stormHit(st: ScheduledStorm) {
    const s = this.state;
    if (!s.processedWarnings.includes(st.event.id)) s.processedWarnings.push(st.event.id);
    s.processedStormHits.push(st.event.id);
    const strength = st.event.scenario.strength;
    const safe = s.split.shelter + s.shield >= strength;
    this.today.storm = st.event;
    this.today.stormSafe = safe;
    if (safe) {
      this.meta.stormsSurvived += 1;
      this.log('The storm hit, but the shelter held. Everyone is safe!');
    } else {
      this.meta.stormsTaken += 1;
      s.air = clamp(s.air - RULES.stormAirLoss);
      const victim = s.plots.find((p) => p.cropId && p.condition === 'healthy');
      if (victim) victim.condition = 'wilted';
      s.stormBlackoutSol = s.sol;
      this.log('The shelter was too weak, so the crew hid and some plants didn\'t get light.');
    }
    if (s.rover.status === 'out') this.disableRover('storm');
    bus.emit(EV.STORM_HIT, { stormId: st.event.id, strength, safe });
  }

  private roverStep() {
    const s = this.state;
    const r = s.rover;
    const i = r.nextRouteIndex;
    const [x, y] = r.route[i];
    const need = this.tileCost(x, y);
    if (r.batteryCells + 1e-9 < need) {
      this.disableRover('battery');
      return;
    }
    r.batteryCells = round1(r.batteryCells - need);
    r.nextRouteIndex = i + 1;
    this.collectRoverFind(x, y);
    if (r.nextRouteIndex >= r.route.length) this.returnRover();
  }

  private deliverRadio(messageId: string) {
    const s = this.state;
    const idx = s.radioQueue.findIndex((m) => m.messageId === messageId);
    if (idx < 0) return;
    const [m] = s.radioQueue.splice(idx, 1);
    bus.emit(EV.RADIO_MESSAGE, { ...m });
  }

  private endDay() {
    const s = this.state;
    const sol = s.sol;
    const r = s.rover;
    let roverRecovered = false;
    if (r.status === 'stranded') {
      Object.assign(r, { status: 'repairing', expeditionId: null, route: [], nextRouteIndex: 0, routeStartedAtMs: null, cargo: zeroItems(), batteryCells: 0 });
      roverRecovered = true;
    }
    const air0 = s.air;
    const food0 = s.food;
    s.air = clamp(s.air - RULES.airLossPerSol);
    s.food = clamp(s.food - RULES.foodLossPerSol);
    const snacked = this.snackFromPantry();

    const warm = s.split.heater >= this.thermalRequired(sol);
    const blackout = s.stormBlackoutSol === sol;
    let lit = 0;
    let grown = 0;
    if (!blackout && warm) {
      const capacity = s.split.growLights * RULES.growLightsPlotsPerCell;
      for (const p of s.plots) {
        if (!p.cropId || p.condition !== 'healthy' || !p.wateredToday) continue;
        if (lit >= capacity) break;
        lit += 1;
        const crop = cropById(p.cropId, this.worldId);
        if (crop && p.growthSols < crop.growSols) {
          p.growthSols += 1;
          grown += 1;
        }
        s.air = clamp(s.air + (crop?.oxygenPerDay ?? RULES.airPerHealthyLitCrop));
      }
    }
    bus.emit(EV.SOL_END, { sol });

    let outcome: NightReport['outcome'] = 'next';
    if (s.air <= RULES.rescueAt || s.food <= RULES.rescueAt) outcome = 'rescue';
    else if (sol >= RULES.missionSols) outcome = 'debrief';

    // The mission is over: don't leave Bolt (or the cargo) out on the plain.
    let roverCalledHome = false;
    if (outcome !== 'next' && r.status === 'out') {
      for (const k of ITEMS) s.inventory[k] += r.cargo[k];
      Object.assign(r, { status: 'home', expeditionId: null, route: [], nextRouteIndex: 0, routeStartedAtMs: null, cargo: zeroItems() });
      roverCalledHome = true;
    }

    const card = this.pickScienceCard();
    this.lastNight = {
      sol, air: [air0, s.air], food: [food0, s.food], warm, minC: this.weather(sol).minC, litPlots: lit, grownPlots: grown,
      blackout, roverRecovered, roverCalledHome, snacked, outcome, card,
    };

    if (outcome === 'next') {
      s.cellsToday = this.nextDayCells();
      s.sol += 1;
      s.phase = 'planning';
      s.split = { growLights: 0, heater: 0, shelter: 0, rover: 0 };
      s.stormBlackoutSol = null;
      for (const p of s.plots) p.wateredToday = false;
      if (r.status === 'repairing' && s.sol >= r.availableSol) r.status = 'home';
      if (r.status === 'home') r.batteryCells = 0;
    } else {
      s.phase = outcome;
      if (outcome === 'debrief' && this.campaign.completed.length === this.campaign.currentIndex) {
        this.campaign.completed.push(this.summarizeMission(s, this.meta));
      }
    }
    this.resetToday();
    this.save();
    bus.emit(UI_EV.NIGHT_REPORT, this.lastNight);
    if (card) bus.emit(EV.SCIENCE_CARD, card);
    bus.emit(UI_EV.PHASE_CHANGED, { phase: s.phase });
    if (outcome === 'next') bus.emit(EV.SOL_START, { sol: s.sol });
  }

  private pickScienceCard(): { text: string; source: string } | null {
    const d = this.data;
    const t = this.today;
    const harvested = t.harvested.length
      ? d.crops.crops.find((crop) => crop.id === t.harvested[t.harvested.length - 1]) ?? null
      : null;
    return selectScienceCard(d, {
      planted: t.planted,
      watered: t.watered,
      harvested,
      roverTrip: t.roverTrip,
      storm: t.storm,
      sol: this.state.sol,
    });
  }

  private resetToday() {
    this.today = { harvested: [], planted: false, watered: false, roverTrip: false, storm: null, stormSafe: true, sample: false };
  }

  private restoreScienceContext(saved: unknown, state: GameState) {
    if (!saved || typeof saved !== 'object') return;
    const context = saved as Partial<SavedScienceContext>;
    if (context.sol !== state.sol || context.phase !== state.phase) return;
    if (!Array.isArray(context.harvested) || typeof context.planted !== 'boolean'
      || typeof context.watered !== 'boolean' || typeof context.roverTrip !== 'boolean'
      || !(context.stormId === null || typeof context.stormId === 'string')) return;

    let data;
    try {
      data = getData(state.worldId);
    } catch {
      return;
    }
    const cropIds = new Set(data.crops.crops.map((crop) => crop.id));
    if (!context.harvested.every((id): id is string => typeof id === 'string' && cropIds.has(id))) return;
    const storm = context.stormId === null
      ? null
      : data.storms.weeks.flatMap((week) => week.events).find((event) => event.id === context.stormId) ?? null;
    if (context.stormId !== null && !storm) return;

    this.today = {
      harvested: [...context.harvested],
      planted: context.planted,
      watered: context.watered,
      roverTrip: context.roverTrip,
      storm,
      stormSafe: true,
      sample: false,
    };
  }

  log(text: string) {
    const s = this.state;
    s.log.push(text);
    if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
    bus.emit(UI_EV.TOAST, { text });
  }

  findEgg(id: string) {
    if (!this.meta.eggs.includes(id)) {
      this.meta.eggs.push(id);
      this.save();
      return true;
    }
    return false;
  }
}

export const store = new Store();
export { SLOTS, ITEMS };
