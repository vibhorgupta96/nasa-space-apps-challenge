import { RULES } from './rules';
import { bus, EV, UI_EV } from './events';
import type { GameState, ItemId, Plot, PowerSlot } from './types';
import { cropById, getData, type StormEvent, type WeatherSol } from '../data/loaders';
import { selectScienceCard } from '../data/science';
import { getActiveFindsForSol } from '../rover/findsManager';
import { recipeById } from '../farm/recipes';
import {
  BADGES, DUST_SOLS, lessonFor, REQUESTS, type BadgeId, type CrewRequest, type Lesson, type ScheduleId,
} from './training';

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
  /** Today's mission-journal line, written from what the player did. */
  journal: string;
  schedule: Record<ScheduleId, boolean>;
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
  // Junior Astronaut training (src/core/training.ts).
  badges: string[];
  /** Sol → whether that sol's lesson question was answered correctly (first answer only). */
  lessons: Record<number, boolean>;
  journal: string[];
  /** Optional 5-question quiz before (title) and after (debrief) the mission: correct answers. */
  quiz: { pre: number | null; post: number | null };
  dusty: boolean;
  exercisedSols: number[];
  crewTalked: string[];
  requestsDone: number[];
  airGoodSols: number;
  fullPowerSols: number;
  moxieRuns: number;
  /** Sols whose Wiz Card (the lesson's fact card) the pet quiz has won. */
  wizCards: number[];
}

interface Today {
  harvested: string[];
  planted: boolean;
  watered: boolean;
  roverTrip: boolean;
  storm: StormEvent | null;
  stormSafe: boolean;
  sample: boolean;
  cooked: string[];
  moxie: number;
  cleaned: boolean;
  exercised: boolean;
  slept: boolean;
  request: boolean;
  roverHome: boolean;
}

const emptyToday = (): Today => ({
  harvested: [], planted: false, watered: false, roverTrip: false, storm: null, stormSafe: true, sample: false,
  cooked: [], moxie: 0, cleaned: false, exercised: false, slept: false, request: false, roverHome: false,
});

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
    badges: [], lessons: {}, journal: [], quiz: { pre: null, post: null }, dusty: false, exercisedSols: [],
    crewTalked: [], requestsDone: [], airGoodSols: 0, fullPowerSols: 0, moxieRuns: 0, wizCards: [],
  };
}

export class Store {
  state!: GameState;
  meta: Meta = freshMeta();
  /** Dialogs, help and other modal UI pause the whole simulation. */
  pausedBy = new Set<string>();
  hidden = false;
  lastNight: NightReport | null = null;
  private today: Today = emptyToday();
  /** A quiz taken on the title screen before the mission starts; newGame() adopts it. */
  private preQuiz: number | null = null;

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

  newGame() {
    const weeks = getData().storms.weeks;
    const keepEggs = this.meta.eggs;
    const cursor = this.meta.weekCursor;
    this.meta = { ...freshMeta(), weekCursor: cursor + 1, eggs: keepEggs };
    this.meta.quiz.pre = this.preQuiz;
    this.preQuiz = null;
    const week = weeks[cursor % weeks.length];
    const inventory = zeroItems();
    inventory.seed = RULES.initialSeeds;
    inventory.water = RULES.initialWater;
    const plots: Plot[] = Array.from({ length: RULES.plotCount }, (_, id) => ({
      id, cropId: null, growthSols: 0, condition: 'healthy', wateredToday: false,
    }));
    this.state = {
      sol: 1,
      phase: 'planning',
      missionElapsedMs: 0,
      cellsToday: RULES.cellsPerSol,
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
    this.resetToday();
    this.save();
    bus.emit(EV.SOL_START, { sol: 1 });
  }

  /** True only for a mission that can still be continued (finished missions don't count). */
  hasSave(): boolean {
    try {
      const raw = safeStorage()?.getItem(SAVE_KEY);
      const phase = raw ? JSON.parse(raw)?.state?.phase : null;
      return phase === 'planning' || phase === 'day';
    } catch {
      return false;
    }
  }

  load(): boolean {
    const raw = safeStorage()?.getItem(SAVE_KEY);
    if (!raw) return false;
    if (this.restore(raw)) return true;
    this.clearSave(); // unreadable or already-finished mission
    return false;
  }

  serialize(): string {
    const scienceContext: SavedScienceContext = {
      sol: this.state.sol,
      phase: this.state.phase === 'day' ? 'day' : 'planning',
      harvested: [...this.today.harvested],
      planted: this.today.planted,
      watered: this.today.watered,
      roverTrip: this.today.roverTrip,
      stormId: this.today.storm?.id ?? null,
    };
    return JSON.stringify({ v: 1, state: this.state, meta: this.meta, scienceContext });
  }

  /** Adopt a serialized mission; refuses finished (rescue/debrief) ones. */
  restore(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.state?.plots) return false;
      if (parsed.state.phase !== 'planning' && parsed.state.phase !== 'day') return false;
      this.state = parsed.state;
      this.state.pantry ??= {}; // saves from before the kitchen
      this.lastAutosaveMs = parsed.state.missionElapsedMs;
      this.meta = { ...freshMeta(), ...(parsed.meta || {}) };
      this.meta.quiz = { ...freshMeta().quiz, ...(parsed.meta?.quiz || {}) };
      this.resetToday();
      this.restoreScienceContext(parsed.scienceContext, parsed.state);
      return true;
    } catch {
      return false;
    }
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
    const weeks = getData().storms.weeks;
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
    const sols = getData().weather.sols;
    return sols[(sol - 1) % sols.length];
  }

  needsHeater(sol = this.state.sol) {
    return this.weather(sol).minC < RULES.heaterNeededBelowC;
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
    const dome = getData().terrain.dome;
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
    const legStart = r.routeStartedAtMs + (i - 1) * RULES.roverMsPerTile;
    const t = Math.max(0, Math.min(1, (this.state.missionElapsedMs - legStart) / RULES.roverMsPerTile));
    return { x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t, moving: true };
  }

  tileCost(x: number, y: number) {
    return getData().terrain.cost[y][x] * RULES.roverCostPerTile;
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
    this.log(`Sol ${s.sol} begins.`);
    const req = REQUESTS[s.sol];
    if (req && !this.meta.requestsDone.includes(s.sol)) this.log(`📋 ${req.who[0].toUpperCase()}${req.who.slice(1)} has a request today. Go and talk to them!`);
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
    this.today.slept = true;
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
    const crop = cropById(cropId);
    if (!p || !crop) return fail('Nothing to plant there.');
    if (p.cropId) return fail('Something is already growing here.');
    if (s.inventory.seed < 1) return fail('Out of seeds! A supply drop might have some.');
    if (s.inventory.water < RULES.waterPerPlant) return fail('Out of water! Melt some ice.');
    s.inventory.seed -= 1;
    s.inventory.water -= RULES.waterPerPlant;
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
    if (s.inventory.water < RULES.waterPerPlotPerSol) return fail('Out of water! Melt some ice.');
    s.inventory.water -= RULES.waterPerPlotPerSol;
    p.wateredToday = true;
    this.today.watered = true;
    return OK;
  }

  harvest(plotId: number): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const p = s.plots[plotId];
    const crop = cropById(p?.cropId ?? null);
    if (!p || !crop) return fail('Nothing to harvest.');
    if (p.condition === 'wilted') return fail('This plant wilted. Clear the plot instead.');
    if (p.growthSols < crop.growSols) return fail(`Not ready yet (${p.growthSols}/${crop.growSols} sols of growth).`);
    s.pantry[crop.id] = (s.pantry[crop.id] || 0) + 1;
    Object.assign(p, { cropId: null, growthSols: 0, condition: 'healthy', wateredToday: false });
    this.today.harvested.push(crop.id);
    this.meta.harvests[crop.id] = (this.meta.harvests[crop.id] || 0) + 1;
    this.log(`Harvested ${crop.name}. It's in the kitchen pantry.`);
    if (Object.values(this.meta.harvests).reduce((a, b) => a + b, 0) >= 3) this.award('botanist');
    return OK;
  }

  /** Cook a recipe from pantry crops. */
  cook(recipeId: string): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const r = recipeById(recipeId);
    if (!r) return fail('Unknown recipe.');
    const missing = Object.entries(r.needs).find(([id, n]) => (s.pantry[id] || 0) < n);
    if (missing) return fail(`You need ${cropById(missing[0])?.name ?? missing[0]} for ${r.name}.`);
    for (const [id, n] of Object.entries(r.needs)) s.pantry[id] -= n;
    s.food = clamp(s.food + r.food);
    s.inventory.seed += r.seeds;
    this.meta.mealsCooked = (this.meta.mealsCooked || 0) + 1;
    this.today.cooked.push(r.name);
    this.log(r.food > 0 ? `Cooked ${r.name}: +${r.food} food!` : `${r.name}: +${r.seeds} seeds.`);
    if (r.food > 0) this.award('chef');
    this.save();
    return OK;
  }

  /** Eat one pantry crop as it is. */
  eatRaw(cropId: string): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const crop = cropById(cropId);
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
        .filter((id) => s.pantry[id] > 0 && (cropById(id)?.food ?? 0) > 0)
        .sort((a, b) => (cropById(b)!.food - cropById(a)!.food))[0];
      if (!best) break;
      s.pantry[best] -= 1;
      s.food = clamp(s.food + cropById(best)!.food);
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
    const t = getData().terrain;
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
    // Use the finds of the sol Bolt launched on, so a trip that runs past midnight keeps its map.
    for (const f of [...getData().terrain.finds, ...getActiveFindsForSol(getData().terrain, this.state.stormWeekId, r.lastLaunchSol)]) {
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
    const [dx, dy] = getData().terrain.dome;
    const last = r.route[r.nextRouteIndex - 1];
    if (r.status !== 'out' || !r.expeditionId || !last || last[0] !== dx || last[1] !== dy) return fail('Bolt is not at the dome.');
    const delivered = { ...r.cargo };
    for (const k of ITEMS) this.state.inventory[k] += r.cargo[k];
    const expeditionId = r.expeditionId;
    Object.assign(r, { status: 'home', expeditionId: null, route: [], nextRouteIndex: 0, routeStartedAtMs: null, cargo: zeroItems() });
    if (delivered.sample > 0) this.awardPhotos(delivered.sample);
    this.today.roverHome = true;
    this.log('Bolt is home and unloads the cargo.');
    this.award('rover-pilot');
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
    const photos = getData().photos.photos;
    for (let i = 0; i < n; i++) {
      const next = photos.find((p) => !this.meta.photosEarned.includes(p.nasaId));
      if (next) this.meta.photosEarned.push(next.nasaId);
    }
  }

  queueRadioMessage(text: string) {
    const s = this.state;
    const delayMinutes = getData().delay.oneWayMinutes;
    this.meta.radioCounter += 1;
    s.radioQueue.push({
      messageId: `radio-${this.meta.radioCounter}`,
      text,
      arrivesAtMs: s.missionElapsedMs + delayMinutes * RULES.radioMsPerMinute,
      delayMinutes,
    });
  }

  // ---------- Junior Astronaut training ----------

  /** Spare cells (left out of the morning plan, or freed by cleaning a panel) can run MOXIE for air. */
  spareCells() {
    return this.state.cellsToday - this.splitTotal();
  }

  /** MOXIE cells used today (they no longer count in cellsToday). */
  get moxieToday() {
    return this.today.moxie;
  }

  runMoxie(): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    if (this.spareCells() < 1) return fail('MOXIE needs a spare power cell. Leave one out of the morning plan, or clean a dusty panel.');
    if (s.air >= RULES.resourceMax) return fail('The air tanks are full. Save the cell for later!');
    s.cellsToday -= 1;
    s.air = clamp(s.air + RULES.moxieAirPerCell);
    this.today.moxie += 1;
    this.meta.moxieRuns += 1;
    this.log(`MOXIE turned carbon dioxide into oxygen: +${RULES.moxieAirPerCell} air.`);
    this.award('oxygen-maker');
    this.save();
    return OK;
  }

  private dustSettles() {
    this.meta.dusty = true;
    this.log('Dust settled on a solar panel overnight: 1 fewer power cell until someone cleans it.');
    if (!this.meta.storySeen.includes('dust-intro')) {
      this.meta.storySeen.push('dust-intro');
      const fact = getData().trivia.trivia.find((t) => t.id === 'insight-dust');
      bus.emit('ui:say', [
        { who: 'priya', text: 'Bad news: Mars dust covered one of our solar panels, so we get one fewer power cell. Brush it off at the solar panel station by the east wall. Your pet can help too!' },
        ...(fact ? [{ who: 'bolt', text: `REAL FACT: ${fact.fact}`, mood: 'worried' }] : []),
      ]);
    }
  }

  /** Brush the dust off. The freed cell is a spare for today (MOXIE can use it). */
  cleanPanels(byPet = false): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    if (!this.meta.dusty) return fail('The solar panels are clean and shiny.');
    this.meta.dusty = false;
    this.state.cellsToday += RULES.dustCellsLost;
    this.today.cleaned = true;
    this.log(byPet ? 'Your pet swept the dust off the panel! +1 spare power cell today.' : 'You brushed the dust off the solar panel. +1 spare power cell today.');
    this.award('panel-cleaner');
    this.save();
    return OK;
  }

  /** True once the pet has had its turn (quiz or trick) today. */
  petUsedToday() {
    return this.meta.storySeen.includes(`pet-trick@${this.state.sol}`);
  }

  /**
   * The pet brings today's lesson question once a sol. A right answer wins the sol's Wiz Card and
   * the pet's reward (it sweeps a dusty panel first, otherwise it brings its usual gift).
   */
  petQuiz(choice: number, gift: { item: ItemId; amount: number }): { ok: boolean; correct: boolean; reason?: string; cleaned?: boolean } {
    const s = this.state;
    if (s.phase !== 'day') return { ok: false, correct: false, reason: 'Start the day first!' };
    if (this.petUsedToday()) return { ok: false, correct: false, reason: 'already' };
    const lesson = lessonFor(s.sol);
    if (!lesson) return { ok: false, correct: false, reason: 'No question today.' };
    this.meta.storySeen.push(`pet-trick@${s.sol}`);
    const { correct } = this.answerLesson(s.sol, choice);
    let cleaned = false;
    if (correct) {
      if (!this.meta.wizCards.includes(s.sol)) this.meta.wizCards.push(s.sol);
      if (this.meta.dusty) cleaned = this.cleanPanels(true).ok;
      else s.inventory[gift.item] += gift.amount;
    }
    this.save();
    return { ok: true, correct, cleaned };
  }

  /** The pet's once-a-sol help is spent on the panel when it is dusty. */
  petCleanPanels(): Result {
    const s = this.state;
    if (s.phase !== 'day') return fail('Start the day first!');
    const tag = `pet-trick@${s.sol}`;
    if (this.meta.storySeen.includes(tag)) return fail('already');
    const r = this.cleanPanels(true);
    if (r.ok) this.meta.storySeen.push(tag);
    return r;
  }

  exercise(): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const sol = this.state.sol;
    if (this.meta.exercisedSols.includes(sol)) return fail('You already exercised today. Astronauts plan it once a day.');
    this.meta.exercisedSols.push(sol);
    this.today.exercised = true;
    if (this.meta.exercisedSols.length >= RULES.badgeSols) this.award('fit-astronaut');
    this.save();
    return OK;
  }

  /** Record a chat with a crew member (for the Team Player badge). */
  talkedTo(who: string) {
    if (!this.meta.crewTalked.includes(who)) this.meta.crewTalked.push(who);
    if (['rosa', 'theo', 'priya', 'bolt'].every((n) => this.meta.crewTalked.includes(n))) this.award('team-player');
  }

  /** Today's crew request, if there is one and it isn't done yet. */
  openRequest(): CrewRequest | null {
    const s = this.state;
    const req = REQUESTS[s.sol];
    return req && s.phase === 'day' && !this.meta.requestsDone.includes(s.sol) ? req : null;
  }

  requestHave(req: CrewRequest) {
    const s = this.state;
    return 'crop' in req.need ? s.pantry[req.need.crop] || 0 : s.inventory[req.need.item];
  }

  fulfilRequest(): Result {
    const g = this.dayCommand();
    if (!g.ok) return g;
    const s = this.state;
    const req = this.openRequest();
    if (!req) return fail('No request today.');
    if (this.requestHave(req) < req.amount) return fail('not-enough');
    if ('crop' in req.need) s.pantry[req.need.crop] -= req.amount;
    else s.inventory[req.need.item] -= req.amount;
    s.inventory.seed += RULES.requestRewardSeeds;
    this.meta.requestsDone.push(s.sol);
    this.today.request = true;
    this.log(`Request done! +${RULES.requestRewardSeeds} seeds.`);
    if (this.meta.requestsDone.length >= RULES.badgeSols) this.award('crew-helper');
    this.save();
    return OK;
  }

  lesson(sol = this.state.sol): Lesson | null {
    return lessonFor(sol);
  }

  /** The "See it" card for a sol's lesson: a sourced fact or live mission data. */
  lessonCard(sol = this.state.sol): { text: string; source: string } | null {
    const l = lessonFor(sol);
    if (!l) return null;
    const d = getData();
    if (l.see === 'weather') {
      const w = this.weather(sol);
      return {
        text: `NASA's InSight lander measured a low of ${Math.round(w.minC)}°C at its landing site on Mars sol ${w.marsSol}. A home freezer is about -18°C.`,
        source: [d.weather.source].flat().find((u) => !u.includes('api.')) ?? 'https://mars.nasa.gov/insight/weather/',
      };
    }
    if (l.see === 'delay') {
      return {
        text: `Today Mars is about ${Math.round(d.delay.distanceKm / 1e6)} million km from Earth, so a radio message takes about ${Math.round(d.delay.oneWayMinutes)} minutes to arrive (NASA JPL Horizons).`,
        source: 'https://ssd.jpl.nasa.gov/horizons/',
      };
    }
    if (l.see === 'storm') {
      const e = this.week().events[0];
      if (!e) return null;
      return {
        text: `NASA's DONKI database records solar storms. This mission's first storm is based on a real one recorded on ${new Date(e.realTime).toUTCString().slice(5, 16)}.`,
        source: e.link,
      };
    }
    const [kind, id] = l.see.split(':');
    if (kind === 'trivia') {
      const t = d.trivia.trivia.find((x) => x.id === id);
      return t ? { text: t.fact, source: t.source } : null;
    }
    const f = d.science.facts.find((x) => x.id === id);
    return f ? { text: f.text, source: f.source } : null;
  }

  /** Answer a sol's "Say it" question. Only the first answer counts towards the score. */
  answerLesson(sol: number, choice: number): { ok: boolean; correct: boolean } {
    const l = lessonFor(sol);
    if (!l) return { ok: false, correct: false };
    const correct = choice === l.answer;
    if (!(sol in this.meta.lessons)) {
      this.meta.lessons[sol] = correct;
      if (Object.values(this.meta.lessons).filter(Boolean).length >= RULES.scholarLessons) this.award('scholar');
      this.save();
    }
    return { ok: true, correct };
  }

  lessonsCorrect() {
    return Object.values(this.meta.lessons).filter(Boolean).length;
  }

  /** Record the optional quiz score. A pre-mission quiz is kept for the next newGame(). */
  recordQuiz(kind: 'pre' | 'post', correct: number) {
    if (kind === 'pre') {
      this.preQuiz = correct;
      if (this.state?.sol === 1 && this.state.phase === 'planning') this.meta.quiz.pre = correct;
    } else this.meta.quiz.post = correct;
    this.save();
  }

  /** Shelter strength against the next storm, for a radiation meter: protection vs. what it needs. */
  shelterProtection(): { protection: number; needed: number | null } {
    const s = this.state;
    const next = this.pendingStorms()[0];
    return { protection: s.split.shelter + s.shield, needed: next ? next.event.scenario.strength : null };
  }

  scheduleToday(): Record<ScheduleId, boolean> {
    const t = this.today;
    return {
      farm: t.planted || t.watered || t.harvested.length > 0,
      exercise: t.exercised,
      science: t.roverTrip || t.moxie > 0,
      sleep: t.slept,
    };
  }

  /** One kid-readable journal line built from today's choices. */
  private journalLine(sol: number): string {
    const t = this.today;
    const bits: string[] = [];
    if (t.storm) bits.push(t.stormSafe ? 'A solar storm came from the Sun, but our shelter held and everyone was safe.' : 'A solar storm got through our shelter, so we hid and a plant wilted.');
    if (t.harvested.length) bits.push(`I harvested ${t.harvested.length} crop${t.harvested.length > 1 ? 's' : ''}.`);
    if (t.cooked.length) bits.push(`I cooked ${t.cooked[0]}.`);
    else if (t.planted) bits.push('I planted seeds.');
    else if (t.watered) bits.push('I watered the plants.');
    if (t.roverHome) bits.push('Bolt drove out and came home safely.');
    else if (t.roverTrip) bits.push('Bolt went exploring.');
    if (t.moxie) bits.push('MOXIE made us some oxygen.');
    if (t.cleaned) bits.push('We cleaned dust off a solar panel.');
    if (t.exercised) bits.push('I exercised to keep strong.');
    if (t.request) bits.push(`I helped ${REQUESTS[sol] ? REQUESTS[sol].who[0].toUpperCase() + REQUESTS[sol].who.slice(1) : 'the crew'}.`);
    if (!bits.length) bits.push('A quiet sol in the dome.');
    return `Sol ${sol}: ${bits.slice(0, 3).join(' ')}`;
  }

  private award(id: BadgeId) {
    if (this.meta.badges.includes(id)) return;
    this.meta.badges.push(id);
    const b = BADGES[id];
    this.log(`🏅 Badge earned: ${b.icon} ${b.name}!`);
    bus.emit(UI_EV.BADGE, { id });
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
      const at = r.routeStartedAtMs + r.nextRouteIndex * RULES.roverMsPerTile;
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
      this.award('radiation-safe');
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
    this.award('comms-officer');
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

    const warm = !this.needsHeater(sol) || s.split.heater >= 1;
    const blackout = s.stormBlackoutSol === sol;
    let lit = 0;
    let grown = 0;
    if (!blackout && warm) {
      const capacity = s.split.growLights * RULES.growLightsPlotsPerCell;
      for (const p of s.plots) {
        if (!p.cropId || p.condition !== 'healthy' || !p.wateredToday) continue;
        if (lit >= capacity) break;
        lit += 1;
        const crop = cropById(p.cropId);
        if (crop && p.growthSols < crop.growSols) {
          p.growthSols += 1;
          grown += 1;
        }
        s.air = clamp(s.air + RULES.airPerHealthyLitCrop);
      }
    }
    bus.emit(EV.SOL_END, { sol });

    // Training: badges that are judged at night, today's schedule and the journal line.
    if (s.air >= RULES.lifeSupportAir && ++this.meta.airGoodSols >= RULES.badgeSols) this.award('life-support');
    if (s.cellsToday - this.splitTotal() === 0 && ++this.meta.fullPowerSols >= RULES.badgeSols) this.award('power-planner');
    const schedule = this.scheduleToday();
    const journal = this.journalLine(sol);
    this.meta.journal.push(journal);

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
      blackout, roverRecovered, roverCalledHome, snacked, journal, schedule, outcome, card,
    };

    if (outcome === 'next') {
      s.sol += 1;
      s.phase = 'planning';
      if (DUST_SOLS.includes(s.sol) && !this.meta.dusty) this.dustSettles();
      s.cellsToday = RULES.cellsPerSol - (this.meta.dusty ? RULES.dustCellsLost : 0);
      s.split = { growLights: 0, heater: 0, shelter: 0, rover: 0 };
      s.stormBlackoutSol = null;
      for (const p of s.plots) p.wateredToday = false;
      if (r.status === 'repairing' && s.sol >= r.availableSol) r.status = 'home';
      if (r.status === 'home') r.batteryCells = 0;
    } else {
      s.phase = outcome;
    }
    this.resetToday();
    this.save();
    bus.emit(UI_EV.NIGHT_REPORT, this.lastNight);
    if (card) bus.emit(EV.SCIENCE_CARD, card);
    bus.emit(UI_EV.PHASE_CHANGED, { phase: s.phase });
    if (outcome === 'next') bus.emit(EV.SOL_START, { sol: s.sol });
  }

  private pickScienceCard(): { text: string; source: string } | null {
    const d = getData();
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
    this.today = emptyToday();
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
      data = getData();
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
      ...emptyToday(),
      harvested: [...context.harvested],
      planted: context.planted,
      watered: context.watered,
      roverTrip: context.roverTrip,
      storm,
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
