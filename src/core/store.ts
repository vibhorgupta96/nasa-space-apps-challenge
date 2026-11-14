import { RULES } from './rules';
import { bus, EV, UI_EV } from './events';
import type { GameState, ItemId, Plot, PowerSlot } from './types';
import { cropById, getData, type StormEvent, type WeatherSol } from '../data/loaders';

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
}

interface Today {
  harvested: string[];
  roverTrip: boolean;
  storm: StormEvent | null;
  stormSafe: boolean;
  sample: boolean;
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
    harvests: {}, stormsSurvived: 0, stormsTaken: 0, trips: 0,
  };
}

export class Store {
  state!: GameState;
  meta: Meta = freshMeta();
  /** Dialogs, help and other modal UI pause the whole simulation. */
  pausedBy = new Set<string>();
  hidden = false;
  lastNight: NightReport | null = null;
  private today: Today = { harvested: [], roverTrip: false, storm: null, stormSafe: true, sample: false };

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
    return JSON.stringify({ v: 1, state: this.state, meta: this.meta });
  }

  /** Adopt a serialized mission; refuses finished (rescue/debrief) ones. */
  restore(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.state?.plots) return false;
      if (parsed.state.phase !== 'planning' && parsed.state.phase !== 'day') return false;
      this.state = parsed.state;
      this.lastAutosaveMs = parsed.state.missionElapsedMs;
      this.meta = { ...freshMeta(), ...(parsed.meta || {}) };
      this.resetToday();
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
    this.save();
    bus.emit(UI_EV.PHASE_CHANGED, { phase: s.phase });
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
    s.food = clamp(s.food + crop.food);
    Object.assign(p, { cropId: null, growthSols: 0, condition: 'healthy', wateredToday: false });
    this.today.harvested.push(crop.id);
    this.meta.harvests[crop.id] = (this.meta.harvests[crop.id] || 0) + 1;
    this.log(crop.food > 0 ? `Harvested ${crop.name}: +${crop.food} food.` : `Picked a ${crop.name}. The crew smiles.`);
    return OK;
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
    for (const f of getData().terrain.finds) {
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

    let outcome: NightReport['outcome'] = 'next';
    if (s.air <= RULES.rescueAt || s.food <= RULES.rescueAt) outcome = 'rescue';
    else if (sol >= RULES.missionSols) outcome = 'debrief';

    const card = this.pickScienceCard();
    this.lastNight = {
      sol, air: [air0, s.air], food: [food0, s.food], warm, minC: this.weather(sol).minC, litPlots: lit, grownPlots: grown,
      blackout, roverRecovered, outcome, card,
    };

    if (outcome === 'next') {
      s.sol += 1;
      s.phase = 'planning';
      s.cellsToday = RULES.cellsPerSol;
      s.split = { growLights: 0, heater: 0, shelter: 0, rover: 0 };
      s.stormBlackoutSol = null;
      for (const p of s.plots) p.wateredToday = false;
      if (r.status === 'repairing' && s.sol >= r.availableSol) r.status = 'home';
      if (r.status === 'home') r.batteryCells = 0;
    } else {
      s.phase = outcome;
    }
    this.save();
    bus.emit(UI_EV.NIGHT_REPORT, this.lastNight);
    if (card) bus.emit(EV.SCIENCE_CARD, card);
    bus.emit(UI_EV.PHASE_CHANGED, { phase: s.phase });
    this.resetToday();
    if (outcome === 'next') bus.emit(EV.SOL_START, { sol: s.sol });
  }

  private pickScienceCard(): { text: string; source: string } | null {
    const d = getData();
    const t = this.today;
    if (t.storm) {
      const e = t.storm;
      const when = new Date(e.realTime).toUTCString().slice(5, 16);
      const kind = e.type === 'CME' ? 'a burst of gas and magnetic field from the Sun (a "CME")' : 'a rush of fast solar particles (an "SEP")';
      return {
        text: `Today's storm was a game scenario based on ${kind} recorded by NASA's space weather team on ${when}. Real astronauts hide in the best-shielded part of their ship during solar storms.`,
        source: e.link,
      };
    }
    if (t.harvested.length) {
      const crop = d.crops.crops.find((c) => c.id === t.harvested[t.harvested.length - 1]);
      if (crop) return { text: crop.fact, source: crop.factSource };
    }
    const pool = d.trivia.trivia;
    if (!pool.length) return null;
    const pick = t.roverTrip ? pool.find((x) => x.id === 'morse') || pool[0] : pool[(this.state.sol - 1) % pool.length];
    return { text: pick.fact, source: pick.source };
  }

  private resetToday() {
    this.today = { harvested: [], roverTrip: false, storm: null, stormSafe: true, sample: false };
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
