import Phaser from 'phaser';
import { store } from './store';
import { getData } from '../data/loaders';
import type { PowerSlot } from './types';
import { lessonFor } from './training';

// End-to-end playthroughs for development: `await playtest()` in the browser console (dev build).
// Each strategy plays a whole mission through the real scenes like a player would: it answers
// the morning panel, presses SPACE on dialogues, uses plots, machines, the kitchen, the pet, the
// bed and the rover, and saves/reloads. After every step it checks invariants and records any
// error, stuck pause or broken sprite. It peeks at a few private scene fields, so it is a test
// harness only; nothing in the game imports it.

type Split = Record<PowerSlot, number>;
interface UIPeek extends Phaser.Scene {
  current: Phaser.GameObjects.Container | null;
  queue: unknown[];
  planningOpen: boolean;
  lessonOpen: boolean;
  lessonSol: number;
  advance: (() => void) | null;
  selectTool(i: number): void;
}
interface FarmPeek extends Phaser.Scene {
  player: Phaser.GameObjects.Sprite;
  pet: Phaser.GameObjects.Sprite | null;
  facing: string;
  plotTiles: Phaser.GameObjects.Image[];
  crew: Record<string, Phaser.GameObjects.Sprite>;
  actOn(x: number, y: number): void;
}
interface RoverPeek extends Phaser.Scene {
  route: [number, number][];
  send(): void;
  leave(): void;
}

interface Strategy {
  look?: Record<string, unknown>;
  heater?: boolean;
  shelter?: boolean;
  lights?: number;
  fill?: boolean;
  rover?: number;
  end?: 'sleep' | 'idle';
  reload?: number;
  reloadHow?: 'continue' | 'look';
  day(sol: number): Promise<void>;
}

export interface PlayResult {
  name: string;
  week: string;
  outcome: string;
  lastSol: number;
  air: number;
  food: number;
  harvests: number;
  meals: number;
  trips: number;
  badges: number;
  lessons: number;
  storms: string;
  problems: string[];
  log: string;
}

export async function runPlaytests(only?: string[]): Promise<{ ok: boolean; results: PlayResult[] }> {
  const game = (window as unknown as { game: Phaser.Game }).game;
  const scenes = game.scene;
  let run = '';
  let problems: string[] = [];
  const note = (t: string) => problems.push(`sol ${store.state?.sol}: ${t}`);
  const onError = (e: ErrorEvent) => note(`page error: ${e.message}`);
  window.addEventListener('error', onError);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const pump = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      try {
        game.loop.step(performance.now());
      } catch (e) {
        note(`frame error: ${(e as Error).message}`);
      }
      await wait(16);
    }
  };
  const key = async (k: string, code: string, keyCode: number) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, keyCode }));
    await pump(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code, keyCode }));
    await pump(1);
  };
  const ui = () => scenes.getScene('UI') as UIPeek;
  const farm = () => scenes.getScene('Farm') as FarmPeek;
  const ended = () => scenes.isActive('Debrief');

  const stormToday = (sol: number) =>
    store.storms().find((x) => x.event.scenario.gameSol === sol && !store.state.processedStormHits.includes(x.event.id));
  const planFor = (o: Strategy) => (sol: number): Split => {
    const s = store.state;
    let left = s.cellsToday;
    const sp: Split = { growLights: 0, heater: 0, shelter: 0, rover: 0 };
    const take = (k: PowerSlot, n: number) => {
      n = Math.max(0, Math.min(n, left));
      sp[k] += n;
      left -= n;
    };
    if (o.heater !== false && store.needsHeater(sol)) take('heater', 1);
    const storm = stormToday(sol);
    if (o.shelter !== false && storm) take('shelter', storm.event.scenario.strength - s.shield);
    if (o.rover && store.roverDrivableToday()) take('rover', o.rover);
    take('growLights', o.lights ?? 3);
    if (o.fill) take('growLights', left);
    return sp;
  };

  /** The lesson quiz (pet by day, crew at night): answer it right (a careful kid) or with the first choice. */
  let answerRight = true;
  const answerLesson = async () => {
    const l = lessonFor(ui().lessonSol);
    const k = String((answerRight && l ? l.answer : 0) + 1);
    await key(k, `Digit${k}`, 48 + Number(k));
  };

  /** Clear modals like a player: the morning panel gets a split, everything else gets SPACE. */
  const drain = async (plan: (sol: number) => Split) => {
    for (let i = 0; i < 300; i++) {
      await pump(2);
      if (ended()) return;
      const u = ui();
      if (!u.sys.isActive()) return;
      if (!u.current && !u.queue.length) {
        if (store.state.phase !== 'planning') return;
        await pump(3);
        if (!u.current) return note('morning panel never opened');
        continue;
      }
      if (u.planningOpen) {
        const sp = plan(store.state.sol);
        const r = store.setPowerSplit(sp);
        if (!r.ok) note(`split refused: ${r.reason} ${JSON.stringify(sp)}`);
        u.advance?.();
        await pump(2);
        if (u.planningOpen && u.current) u.advance?.(); // confirm unused cells
        continue;
      }
      if (u.lessonOpen) await answerLesson();
      await key(' ', 'Space', 32);
    }
    note('modals never cleared');
  };
  const clearDialogs = async () => {
    for (let i = 0; i < 60 && store.paused; i++) {
      const u = ui();
      if (u.lessonOpen) await answerLesson();
      if (u.current && !u.planningOpen) await key(' ', 'Space', 32);
      else await pump(1);
    }
  };
  const act = async (x: number, y: number) => {
    await clearDialogs();
    if (store.paused) return note(`still paused before acting: ${[...store.pausedBy]}`);
    farm().actOn(x, y);
    await pump(1);
  };
  const check = (label: string) => {
    const s = store.state;
    const bad: string[] = [];
    for (const k of ['air', 'food'] as const) if (!(s[k] >= 0 && s[k] <= 100)) bad.push(`${k}=${s[k]}`);
    for (const [k, v] of Object.entries(s.inventory)) if (!(v >= 0)) bad.push(`inventory.${k}=${v}`);
    for (const [k, v] of Object.entries(s.pantry)) if (!(v >= 0)) bad.push(`pantry.${k}=${v}`);
    if (store.splitTotal() > s.cellsToday) bad.push('split is more than the cells');
    if (s.rover.batteryCells < 0) bad.push('rover battery below 0');
    const f = farm();
    if (f.sys.isActive() && (!f.player.texture || !f.player.frame)) bad.push('player sprite lost its texture');
    if (bad.length) note(`${label}: ${bad.join(', ')}`);
  };
  const canWalk = async () => {
    const f = farm();
    if (!f.sys.isActive() || store.paused) return true;
    const [x0, y0] = [f.player.x, f.player.y];
    const keys: [string, number][] = [['ArrowDown', 40], ['ArrowUp', 38], ['ArrowRight', 39], ['ArrowLeft', 37]];
    for (const [k, kc] of keys) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, keyCode: kc }));
      await pump(6);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k, keyCode: kc }));
      await pump(1);
      if (Math.hypot(f.player.x - x0, f.player.y - y0) > 4) return true;
    }
    return false;
  };
  const toTitle = async () => {
    for (const k of ['UI', 'Rover', 'Debrief', 'Customize', 'Farm']) if (scenes.isActive(k) || scenes.isSleeping(k)) scenes.stop(k);
    scenes.start('Title');
    await pump(6);
  };
  const clickButton = (scene: Phaser.Scene, label: string) => {
    const c = scene.children.list.find((o) => o instanceof Phaser.GameObjects.Container
      && o.list.some((x) => x instanceof Phaser.GameObjects.Text && x.text === label)) as Phaser.GameObjects.Container | undefined;
    const zone = c?.list.find((x) => x instanceof Phaser.GameObjects.Zone);
    if (!zone) return false;
    zone.emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
    return true;
  };

  // ---------- player actions ----------
  const plotTiles = () => farm().plotTiles.map((t) => [Math.round(t.x / 32), Math.round(t.y / 32)] as [number, number]);
  const plant = async (crops: number[]) => {
    const tiles = plotTiles();
    for (let i = 0; i < tiles.length; i++) {
      const s = store.state;
      if (s.plots[i].cropId || s.inventory.seed <= 0 || s.inventory.water <= 0) continue;
      ui().selectTool(crops[(i + s.sol) % crops.length]);
      await act(...tiles[i]);
    }
  };
  const tend = async () => {
    const tiles = plotTiles();
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < tiles.length; i++) if (store.state.plots[i].cropId) await act(...tiles[i]);
  };
  const machines = async () => {
    await act(17, 2); // ice melter
    await act(19, 2); // shield bench
  };
  const cook = async (keys = ['3', '2', '1', '4', '1']) => {
    const f = farm();
    f.player.setPosition(6 * 32 + 16, 3 * 32 + 10);
    f.facing = 'up';
    await act(6, 2);
    await pump(3);
    if (!ui().current) return note('kitchen did not open');
    for (const k of keys) await key(k, `Digit${k}`, 48 + Number(k));
    await key('Escape', 'Escape', 27);
    await pump(3);
    if (ui().current && !ui().queue.length) note('kitchen did not close on Esc');
  };
  const petIt = async () => {
    const f = farm();
    if (!f.pet) return;
    await pump(3);
    await act(Math.floor(f.pet.x / 32), Math.floor(f.pet.y / 32));
  };
  const rover = async (tiles = 3) => {
    await clearDialogs();
    const f = farm();
    f.player.setPosition(12 * 32 + 16, 2 * 32 + 20);
    f.facing = 'up';
    await act(12, 1);
    await pump(30);
    if (!scenes.isActive('Rover')) return note('rover map did not open');
    const r = scenes.getScene('Rover') as RoverPeek;
    const t = getData().terrain;
    const [hx, hy] = t.dome;
    const dir = hx < t.width / 2 ? 1 : -1;
    const route: [number, number][] = [[hx, hy]];
    for (let i = 1; i <= tiles; i++) route.push([hx + dir * i, hy]);
    for (let i = tiles - 1; i >= 0; i--) route.push([hx + dir * i, hy]);
    r.route = route;
    const launchable = store.roverCanLaunch().ok;
    r.send();
    await pump(3);
    if (launchable && store.state.rover.status !== 'out' && store.state.rover.lastLaunchSol !== store.state.sol) note('rover did not launch');
    r.leave();
    await pump(30);
    if (!scenes.isActive('Farm')) note('farm did not come back after the rover map');
  };
  const sleep = async () => {
    await clearDialogs();
    const f = farm();
    const sol = store.state.sol;
    f.player.setPosition(19 * 32 + 16, 11 * 32 + 10);
    f.facing = 'down';
    await act(19, 12);
    await act(19, 12);
    for (let i = 0; i < 80 && store.state.sol === sol && store.state.phase === 'day'; i++) await pump(1);
    if (store.state.phase === 'day' && store.state.sol === sol) note(`sleeping did not end the sol (paused by ${[...store.pausedBy]})`);
  };
  const idle = async () => {
    const sol = store.state.sol;
    for (let i = 0; i < 2000 && store.state.sol === sol && store.state.phase === 'day'; i++) {
      if (store.paused) {
        const u = ui();
        if (u.lessonOpen) await answerLesson();
        if (u.current && !u.planningOpen) await key(' ', 'Space', 32);
        else await pump(1);
        continue;
      }
      store.tick(1000);
      if (i % 5 === 0) await pump(1);
    }
    if (store.state.phase === 'day' && store.state.sol === sol) note('the day never ended while idling');
  };
  const reload = async (how: 'continue' | 'look' = 'continue') => {
    store.save();
    await toTitle();
    const title = scenes.getScene('Title');
    if (how === 'look') {
      title.scene.start('Customize', { fresh: false });
      await pump(5);
      const c = scenes.getScene('Customize') as unknown as { set(a: object): void; start(): void };
      c.set({ suit: ['#e05050', '#5aa9e6', '#6aa84f'][store.state.sol % 3] });
      c.start();
    } else if (!clickButton(title, 'Continue campaign')) note('no Continue campaign button on the title');
    await pump(10);
  };
  // Junior Astronaut training: MOXIE, the dusty panel, the treadmill and crew requests.
  const train = async () => {
    await act(21, 7); // solar panel (cleans it when dusty)
    await act(21, 2); // MOXIE
    await act(14, 12); // treadmill
    for (let i = 0; i < 260 && farm().sys.isActive() && store.pausedBy.has('exercise'); i++) await pump(1);
    for (const c of Object.values(farm().crew)) await act(Math.floor(c.x / 32), Math.floor(c.y / 32));
    await act(4, 3); // Bolt
  };
  const monkey = async () => {
    const tiles = plotTiles();
    for (let i = 0; i < 25; i++) {
      const pick = Math.floor(Math.random() * 6);
      if (pick === 0) ui().selectTool(Math.floor(Math.random() * 7));
      else if (pick === 1) await act(...tiles[Math.floor(Math.random() * tiles.length)]);
      else if (pick === 2) await act(2 + Math.floor(Math.random() * 20), 2 + Math.floor(Math.random() * 11));
      else if (pick === 3) await key(String(1 + Math.floor(Math.random() * 7)), 'Digit1', 49);
      else if (pick === 4) await key(['Tab', 'h', 'p', 'm', 'Escape'][Math.floor(Math.random() * 5)], 'KeyX', 0);
      else await canWalk();
      await clearDialogs();
      for (let k = 0; k < 10 && ui().current; k++) await key('Escape', 'Escape', 27);
    }
  };

  const STRATEGIES: Record<string, Strategy> = {
    'diligent farmer, mixed crops, cooks': { look: { kid: 'girl', hairStyle: 'long', pet: 'dog' }, fill: true,
      day: async () => { await tend(); await plant([0, 1, 2, 3]); await tend(); await petIt(); await machines(); await cook(); } },
    'never plants anything': { lights: 0, day: async () => {} },
    'never uses the heater': { heater: false, fill: true, day: async () => { await tend(); await plant([0, 1]); await tend(); await cook(); } },
    'ignores storm shelter': { shelter: false, fill: true, day: async () => { await tend(); await plant([2]); await tend(); await cook(['2']); } },
    'rover explorer': { rover: 2, fill: true, look: { pet: 'cat' },
      day: async () => { await tend(); await plant([0, 1, 2]); await tend(); await rover(3); await machines(); await cook(); } },
    'long rover trips (strands Bolt)': { rover: 1, fill: true, day: async () => { await tend(); await plant([1]); await rover(12); } },
    'only flowers (zinnia)': { fill: true, day: async () => { await tend(); await plant([4]); await tend(); await cook(['4', '4', '4']); } },
    'never cooks (crew snacks at night)': { fill: true, day: async () => { await tend(); await plant([0, 1, 2, 3]); await tend(); } },
    'saves and continues every sol': { fill: true, reload: 1, reloadHow: 'continue', look: { pet: 'alien' },
      day: async () => { await tend(); await plant([0, 2]); await tend(); await petIt(); await cook(); } },
    'changes look every 2 sols': { fill: true, reload: 2, reloadHow: 'look', look: { kid: 'boy', pet: 'dog' },
      day: async () => { await tend(); await plant([1, 3]); await tend(); await petIt(); await cook(); } },
    'real-time days (no sleeping)': { fill: true, end: 'idle', day: async () => { await tend(); await plant([0, 1]); await tend(); await cook(); } },
    'spams wrong actions': { fill: true,
      day: async () => { await cook(['1', '2', '3', '4']); await machines(); await machines(); await tend(); await plant([3]); await tend(); await tend(); await petIt(); await petIt(); } },
    'random monkey': { fill: true, look: { pet: 'cat' }, day: async () => { await monkey(); await tend(); } },
    'minimal power (heater + shelter only)': { lights: 0, day: async () => { await tend(); await plant([0, 1, 2, 3]); await tend(); await cook(); } },
    'junior astronaut (lessons, MOXIE, treadmill, requests)': { rover: 1, lights: 3, look: { pet: 'dog' },
      day: async () => { await tend(); await plant([0, 1, 2, 3]); await tend(); await train(); await petIt(); await rover(2); await machines(); await cook(); } },
    'guesses every lesson question': { fill: true, look: { pet: 'cat' },
      day: async () => { await tend(); await plant([0, 1]); await tend(); await train(); await cook(); } },
    'everything at once': { rover: 1, fill: true, reload: 3, look: { kid: 'girl', hairStyle: 'puffs', pet: 'alien' },
      day: async () => { await tend(); await plant([0, 1, 2, 3, 4]); await tend(); await petIt(); await machines(); await rover(2); await cook(); await monkey(); } },
  };

  const results: PlayResult[] = [];
  for (const [name, o] of Object.entries(STRATEGIES)) {
    if (only && !only.some((n) => name.includes(n))) continue;
    run = name;
    problems = [];
    answerRight = !name.startsWith('guesses');
    const plan = planFor(o);
    await toTitle();
    scenes.getScene('Title').scene.start('Customize', { fresh: true });
    await pump(5);
    const c = scenes.getScene('Customize') as unknown as { set(a: object): void; start(): void };
    c.set({ name: 'Tester', ...(o.look ?? { pet: 'none' }) });
    c.start();
    await pump(10);
    const week = store.state.stormWeekId;
    const log: string[] = [];
    for (let sols = 0; !ended() && sols < 13; sols++) {
      await drain(plan);
      if (ended()) break;
      if (store.state.phase !== 'day') {
        note(`not in the day after the morning panel (${store.state.phase})`);
        break;
      }
      check('morning');
      if (sols % 3 === 0 && !(await canWalk())) note('player cannot walk');
      try {
        await o.day(store.state.sol);
      } catch (e) {
        note(`strategy threw: ${(e as Error).message}`);
      }
      await drain(plan);
      if (ended()) break;
      if (o.reload && store.state.sol % o.reload === 0) {
        await reload(o.reloadHow);
        await drain(plan);
        if (ended()) break;
      }
      check('evening');
      log.push(`${store.state.sol}:a${Math.round(store.state.air)}/f${Math.round(store.state.food)}`);
      if ((o.end ?? 'sleep') === 'sleep') await sleep();
      else await idle();
      check('night');
    }
    for (let i = 0; i < 40 && !ended(); i++) await drain(plan);
    if (!ended()) note('the mission never reached the debrief');
    const m = store.meta;
    results.push({
      name: run, week, outcome: ended() ? store.state.phase : 'stuck', lastSol: store.state.sol,
      air: Math.round(store.state.air), food: Math.round(store.state.food),
      harvests: Object.values(m.harvests).reduce((a, b) => a + b, 0), meals: m.mealsCooked, trips: m.trips,
      badges: m.badges.length, lessons: store.lessonsCorrect(),
      storms: `${m.stormsSurvived} safe / ${m.stormsTaken} rough`, problems: [...problems], log: log.join(' '),
    });
    console.log(`[playtest] ${run}: ${results[results.length - 1].outcome}, ${problems.length} problem(s)`);
  }
  window.removeEventListener('error', onError);
  await toTitle();
  return { ok: results.every((r) => r.problems.length === 0 && r.outcome !== 'stuck'), results };
}
