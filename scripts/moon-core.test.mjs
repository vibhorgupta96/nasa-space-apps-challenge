import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Bundle the real store with only Phaser's event emitter replaced by Node's equivalent.
// Nothing in this harness accesses the browser's localStorage or the player's save.
const result = await build({
  stdin: { contents: `export { Store, store } from './src/core/store.ts'; export { launchInitializedMission } from './src/scenes/TitleScene.ts'; export { collectData, getData } from './src/data/loaders.ts'; export { runSelfTest } from './src/core/selftest.ts'; export { bus, EV } from './src/core/events.ts'; export { evaluateRoute } from './src/rover/routePlanner.ts';`, resolveDir: process.cwd(), sourcefile: 'test-entry.ts', loader: 'ts' },
  plugins: [{ name: 'phaser-event-shim', setup(b) {
    b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: `import { EventEmitter } from 'node:events'; export default { Events: { EventEmitter }, Scene: class {} };`, loader: 'js' }));
  }}], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
});
const { Store, store, launchInitializedMission, collectData, getData, runSelfTest, bus, EV, evaluateRoute } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
const files = ['storms','weather','crops','delay','photos','trivia','terrain','science'];
const values = new Map();
for (const world of ['mars','moon']) for (const name of files) {
  const dir = world === 'mars' ? 'public/data/' : 'public/data/moon/';
  values.set(world === 'mars' ? `data:${name}` : `data:moon:${name}`, JSON.parse(await readFile(dir + name + '.json', 'utf8')));
}
collectData({ cache: { json: { get: key => values.get(key) } } });
function fresh(world = 'mars') { const s = new Store(false); s.save = () => {}; s.startCampaign(world); return s; }
function split(s, overrides = {}) { assert.equal(s.setPowerSplit({ growLights: 0, heater: 0, shelter: 0, rover: 0, ...overrides }).ok, true); assert.equal(s.startDay().ok, true); }
function tickTo(s, ms) { while (s.state.phase === 'day' && s.state.missionElapsedMs < ms) s.tick(Math.min(1000, ms - s.state.missionElapsedMs)); }
function finish(s) { tickTo(s, Infinity); }
function reload(s) { const t = new Store(false); t.save = () => {}; assert.equal(t.restore(s.serialize()), true); return t; }
function check(r) { assert.equal(r.ok, true, r.reason); }

test('existing Mars selftests', async () => {
  const results = await runSelfTest();
  assert.deepEqual(results.results.filter(r => !r.ok), []);
});

test('Moon crops, thermal control, water and world restrictions', () => {
  let s = fresh('moon');
  assert.equal(s.state.cellsToday, 8);
  split(s, {growLights: 1});
  assert.equal(s.plant(0, 'red-romaine').ok, false);
  check(s.plant(0, 'moon-tomato')); assert.equal(s.state.inventory.water, 46);
  finish(s); assert.equal(s.state.plots[0].growthSols, 0); assert.equal(s.state.air, 90);
  split(s, {growLights: 1, heater: 1}); check(s.water(0)); assert.equal(s.state.inventory.water, 44); finish(s);
  assert.equal(s.state.plots[0].growthSols, 1);
  s = fresh('moon'); split(s, {growLights: 1, heater: 1}); check(s.plant(0, 'moon-pea')); finish(s); assert.equal(s.state.air, 94);
});

test('route planner battery and ETA match rover steps on Mars and Moon', () => {
  for (const world of ['mars', 'moon']) {
    const s = fresh(world);
    const terrain = getData(world).terrain;
    const [x, y] = terrain.dome;
    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    const next = neighbors.find(([nx, ny]) => terrain.cost[ny]?.[nx] !== undefined && terrain.cost[ny][nx] !== terrain.cost[y][x])
      ?? neighbors.find(([nx, ny]) => terrain.cost[ny]?.[nx] !== undefined);
    assert.ok(next, `${world} terrain needs a traversable neighbor`);
    const route = [terrain.dome, next, terrain.dome];
    const plan = evaluateRoute(route, terrain, 1, s.rules.roverCostPerTile, s.rules.roverRockCostExtra);
    assert.equal(plan.returnsHome, true);
    assert.equal(plan.canAfford, true);

    const firstTile = evaluateRoute(route.slice(0, 2), terrain, 1, s.rules.roverCostPerTile, s.rules.roverRockCostExtra).totalBatteryCost;
    const etaMs = (route.length - 1) * s.rules.roverMsPerTile;
    const shelter = s.storms().filter(st => st.event.scenario.gameSol === 1)
      .reduce((max, st) => Math.max(max, st.event.scenario.strength), 0);
    split(s, {rover: 1, shelter});
    check(s.launchRover(route));
    assert.equal(s.state.rover.batteryCells, 1);
    tickTo(s, etaMs - 1);
    assert.equal(s.state.rover.status, 'out');
    assert.equal(s.state.rover.nextRouteIndex, 2);
    assert.equal(s.state.rover.batteryCells, Math.round((1 - firstTile) * 10) / 10);
    tickTo(s, etaMs);
    assert.equal(s.state.rover.status, 'home');
    assert.equal(s.state.dustLevel, world === 'moon' ? 1 : 0);
  }
});

test('dust changes next dawn only, can be cleaned once and survives reload', () => {
  let s = fresh('moon'); split(s, {rover: 1});
  check(s.launchRover([[19,14],[20,14],[19,14]])); tickTo(s, 10000);
  assert.equal(s.state.dustLevel, 1); assert.equal(s.state.cellsToday, 8); assert.equal(s.nextDayCells(), 7);
  s = reload(s); assert.equal(s.state.dustLevel, 1); finish(s); assert.equal(s.state.cellsToday, 7);
  split(s); check(s.cleanDust()); assert.equal(s.state.cellsToday, 7); assert.equal(s.cleanDust().ok, false); assert.equal(s.nextDayCells(), 8);
  s = reload(s); assert.equal(s.cleanDust().ok, false); finish(s); assert.equal(s.state.cellsToday, 8);
});

test('Moon dark boundaries, radiation warning and hit are exactly once over reload', () => {
  let s = fresh('moon'); const fired = [];
  const onWarn = e => fired.push('warn:' + e.stormId), onHit = e => fired.push('hit:' + e.stormId);
  bus.on(EV.STORM_WARNING, onWarn); bus.on(EV.STORM_HIT, onHit);
  try {
    for (let day = 1; day <= 7; day++) {
      assert.equal(s.state.cellsToday, day <= 3 ? 8 : 6);
      split(s, {heater: s.thermalRequired(), shelter: day === 3 ? 1 : day === 7 ? 2 : 0});
      if (day === 3 || day === 7) { tickTo(s, s.dayStartMs() + 60000); const n=fired.length; s=reload(s); tickTo(s, s.dayStartMs() + 61000); assert.equal(fired.length,n); }
      finish(s);
    }
    assert.equal(fired.filter(x => x.startsWith('warn:')).length, 2);
    assert.equal(fired.filter(x => x.startsWith('hit:')).length, 2);
    assert.equal(s.meta.stormsSurvived, 2);
  } finally { bus.off(EV.STORM_WARNING,onWarn); bus.off(EV.STORM_HIT,onHit); }
});

function winMission(initial, withDust = false, onDay = () => {}) {
  let s = initial;
  const world = s.worldId;
  const crop = world === 'moon' ? 'moon-pea' : 'red-romaine';
  const plots = world === 'moon' ? 3 : 4;
  for (let day = 1; day <= 10; day++) {
    assert.equal(s.state.sol, day);
    const events = s.storms().filter(x => x.event.scenario.gameSol === day);
    const shelter = events.reduce((m, e) => Math.max(m, e.event.scenario.strength), 0);
    const rover = withDust && (day === 1 || day === 4) ? 1 : 0;
    split(s, {growLights:1, heater:s.thermalRequired(), shelter, rover});
    onDay(s, day);
    if (withDust && world === 'moon' && [2,5].includes(day)) check(s.cleanDust());
    for (let i = 0; i < plots; i++) {
      const p = s.state.plots[i];
      if (p.cropId && p.growthSols >= getData(world).crops.crops.find(c => c.id === p.cropId).growSols) check(s.harvest(i));
      if (!s.state.plots[i].cropId) check(s.plant(i,crop)); else check(s.water(i));
    }
    if (rover) { check(s.launchRover([[19,14],[20,14],[19,14]])); tickTo(s,s.dayStartMs()+10000); assert.equal(s.state.dustLevel,1); }
    s = reload(s); finish(s);
    if (day < 10) assert.equal(s.state.phase, 'planning');
  }
  assert.equal(s.state.phase, 'debrief');
  assert.ok(s.state.air > 0 && s.state.food > 0);
  return s;
}

test('both full ten-day campaigns in either world order survive saves and finish once', () => {
  for (const first of ['mars','moon']) {
    let s = fresh(first);
    s.meta.eggs.push('test-discovery'); s.meta.photosEarned.push('test-photo');
    s = winMission(s, first === 'moon');
    assert.equal(s.campaign.completed.length,1); assert.equal(s.canTravel,true);
    assert.ok(Object.values(s.state.pantry).some(n => n > 0), 'first outpost retained a harvested crop');
    s = reload(s); check(s.travel()); assert.equal(s.travel().ok,false);
    assert.deepEqual(s.state.pantry, {}, 'travel starts with a fresh pantry');
    assert.equal(s.state.sol,1); assert.equal(s.state.air,100); assert.equal(s.state.inventory.water,48);
    assert.ok(s.meta.eggs.includes('test-discovery')); assert.ok(s.meta.photosEarned.includes('test-photo'));
    s = winMission(s, s.worldId === 'moon'); s = reload(s);
    assert.equal(s.campaignComplete,true); assert.deepEqual(s.campaign.completed.map(x=>x.worldId), [first,first==='mars'?'moon':'mars']);
    assert.equal(s.travel().ok,false);
  }
});

test('legacy migration, unknown versions and worlds, and malformed campaign leave state untouched', () => {
  const original = fresh(); const before = original.serialize();
  const legacy = JSON.parse(before); legacy.v = 1; delete legacy.campaign; delete legacy.state.worldId; delete legacy.state.dustLevel; delete legacy.state.dustCleanedSol;
  const migrated = new Store(false); migrated.save=()=>{}; assert.equal(migrated.restore(JSON.stringify(legacy)),true); assert.deepEqual(migrated.campaign.order,['mars','moon']);
  for (const change of [x=>x.v=3, x=>x.state.worldId='venus', x=>x.campaign.order=['moon','moon'], x=>x.state.rover.route=[[999,999]], x=>x.state.plots.pop()]) {
    const bad=JSON.parse(before); change(bad); assert.equal(original.restore(JSON.stringify(bad)),false); assert.equal(original.serialize(),before);
  }
});

test('rescue retries only the current world and preserves prior completion', () => {
  let s = winMission(fresh('mars')); check(s.travel());
  for (let day=1; day<=10 && s.state.phase==='planning'; day++) { split(s); finish(s); }
  assert.equal(s.state.phase,'rescue'); s=reload(s); assert.equal(s.canTravel,false); check(s.retryMission());
  assert.equal(s.worldId,'moon'); assert.equal(s.state.phase,'planning'); assert.equal(s.campaign.completed.length,1);
  assert.equal(s.retryMission().ok,false);
});


test('terminal legacy mission migrates and localStorage rejection is non-destructive', () => {
  const completed = winMission(fresh('mars'));
  const legacy = JSON.parse(completed.serialize()); legacy.v = 1; delete legacy.campaign;
  delete legacy.state.worldId; delete legacy.state.dustLevel; delete legacy.state.dustCleanedSol;
  const rawLegacy = JSON.stringify(legacy), entries = new Map([['sol-sprouts-save-v1', rawLegacy]]);
  globalThis.window = {localStorage: {getItem:k => entries.get(k) ?? null, setItem:(k,v) => entries.set(k,v), removeItem:k => entries.delete(k)}};
  try {
    const live = new Store(false); assert.equal(live.hasSave(),true); assert.equal(live.load(),true);
    assert.equal(live.state.phase,'debrief'); assert.equal(live.canTravel,true); assert.equal(live.campaign.completed.length,1);
    live.save(); assert.equal(JSON.parse(entries.get('sol-sprouts-save-v1')).v,2);
    const corrupt = '{"v":99,"secret":"keep"}'; entries.set('sol-sprouts-save-v1', corrupt);
    const snapshot = live.serialize(); assert.equal(live.hasSave(),false); assert.equal(live.load(),false);
    assert.equal(entries.get('sol-sprouts-save-v1'),corrupt); assert.equal(live.serialize(),snapshot);
  } finally { delete globalThis.window; }
});


test('both kitchens use their own crops and reject recipes from the other world', () => {
  for (const [world, ids, recipe, wrong] of [
    ['mars', ['red-romaine', 'mizuna'], 'space-salad', 'moon-pea-soup'],
    ['moon', ['moon-potato', 'moon-pea'], 'moon-pea-soup', 'space-salad'],
  ]) {
    const s = fresh(world);
    let cooked = false;
    for (let day = 1; day <= 6 && !cooked; day++) {
      const shelter = s.storms().filter(x => x.event.scenario.gameSol === day)
        .reduce((max, x) => Math.max(max, x.event.scenario.strength), 0);
      split(s, {growLights: 1, heater: s.thermalRequired(), shelter});
      if (day === 1) {
        ids.forEach((id, i) => check(s.plant(i, id)));
        assert.equal(s.cook(wrong).ok, false);
      } else {
        const ready = ids.every((id, i) => s.state.plots[i].growthSols >= getData(world).crops.crops.find(c => c.id === id).growSols);
        if (ready) {
          ids.forEach((_, i) => check(s.harvest(i)));
          const food = s.state.food;
          check(s.cook(recipe));
          assert.equal(s.state.food, Math.min(100, food + 45));
          ids.forEach(id => assert.equal(s.state.pantry[id], 0));
          assert.equal(s.meta.mealsCooked, 1);
          cooked = true;
        } else ids.forEach((_, i) => check(s.water(i)));
      }
      if (!cooked) finish(s);
    }
    assert.equal(cooked, true, `${world} could not grow ingredients and cook`);
  }
});

test('save migration preserves kitchen pantry and rejects invalid crop counts', () => {
  const current = fresh('mars');
  const saved = JSON.parse(current.serialize());
  saved.state.pantry = {'red-romaine': 2};
  saved.v = 1; delete saved.campaign; delete saved.state.worldId;
  delete saved.state.dustLevel; delete saved.state.dustCleanedSol;
  assert.equal(current.restore(JSON.stringify(saved)), true);
  assert.deepEqual(current.state.pantry, {'red-romaine': 2});
  const v2 = JSON.parse(current.serialize()); delete v2.state.pantry;
  assert.equal(current.restore(JSON.stringify(v2)), true);
  assert.deepEqual(current.state.pantry, {});
  const before = current.serialize();
  for (const pantry of [{'moon-pea': 1}, {'red-romaine': -1}, {'red-romaine': 1.5}, null, []]) {
    const invalid = JSON.parse(before); invalid.state.pantry = pantry;
    assert.equal(current.restore(JSON.stringify(invalid)), false);
    assert.equal(current.serialize(), before);
  }
});


test('older Mars saves migrate the retired Earth GST without losing active storm or science state', () => {
  const retired = '2024-05-10T15:00:00-GST-001';
  for (const version of [1, 2]) {
    const s = fresh('mars'); split(s, {growLights: 1, heater: s.thermalRequired()});
    check(s.plant(0, 'red-romaine'));
    const saved = JSON.parse(s.serialize());
    const active = getData('mars').storms.weeks.find(w => w.id === saved.state.stormWeekId).events[0].id;
    saved.state.processedWarnings = [retired, active];
    saved.state.processedStormHits = [retired, active];
    saved.scienceContext.stormId = retired;
    if (version === 1) {
      saved.v = 1; delete saved.campaign; delete saved.state.worldId;
      delete saved.state.dustLevel; delete saved.state.dustCleanedSol;
    }
    const restored = fresh('moon');
    assert.equal(restored.restore(JSON.stringify(saved)), true);
    assert.deepEqual(restored.state.processedWarnings, [active]);
    assert.deepEqual(restored.state.processedStormHits, [active]);
    const context = JSON.parse(restored.serialize()).scienceContext;
    assert.equal(context.planted, true);
    assert.equal(context.stormId, null);
    const invalid = JSON.parse(restored.serialize());
    invalid.state.processedWarnings.push('unknown-storm-id');
    const before = restored.serialize();
    assert.equal(restored.restore(JSON.stringify(invalid)), false);
    assert.equal(restored.serialize(), before);
  }
});


test('travel and retry launch their in-memory mission when storage is blocked or stale', () => {
  for (const storageMode of ['blocked', 'stale']) {
    const won = winMission(fresh('mars'));
    const stale = won.serialize();
    globalThis.window = {localStorage: {
      getItem: () => { if (storageMode === 'blocked') throw new Error('blocked'); return stale; },
      setItem: () => { throw new Error('write unavailable'); },
      removeItem: () => { throw new Error('blocked'); },
    }};
    try {
      Object.assign(store, {state: won.state, campaign: won.campaign, meta: won.meta});
      check(store.travel());
      const calls = [];
      const scene = {scene: {stop: x => calls.push(['stop', x]), start: x => calls.push(['start', x]), launch: x => calls.push(['launch', x])}};
      launchInitializedMission(scene);
      assert.equal(store.worldId, 'moon');
      assert.equal(store.campaign.currentIndex, 1);
      assert.equal(store.campaign.completed.length, 1);
      assert.deepEqual(calls.slice(-2), [['start', 'Farm'], ['launch', 'UI']]);
      for (let day = 1; day <= 10 && store.state.phase === 'planning'; day++) { split(store); finish(store); }
      assert.equal(store.state.phase, 'rescue');
      check(store.retryMission());
      launchInitializedMission(scene);
      assert.equal(store.worldId, 'moon');
      assert.equal(store.state.phase, 'planning');
      assert.equal(store.campaign.completed.length, 1);
    } finally { delete globalThis.window; }
  }
});


test('Moon oxygen uses water and power atomically and preserves daily use over reload', () => {
  let s = fresh('moon'); split(s, { heater: 1 });
  s.state.air = 88; s.state.inventory.water = 0;
  const before = [s.state.air, s.state.cellsToday, s.state.inventory.water];
  assert.equal(s.runOxygenMaker().ok, false);
  assert.deepEqual([s.state.air, s.state.cellsToday, s.state.inventory.water], before);
  s.state.inventory.water = 2;
  s.pause('modal'); assert.equal(s.runOxygenMaker().ok, false); s.resume('modal');
  check(s.runOxygenMaker()); assert.equal(s.state.air, 94); assert.equal(s.state.inventory.water, 1);
  check(s.runMoxie()); assert.equal(s.state.air, 100); assert.equal(s.state.inventory.water, 0);
  const full = [s.state.air, s.state.cellsToday, s.state.inventory.water];
  assert.equal(s.runOxygenMaker().ok, false);
  assert.deepEqual([s.state.air, s.state.cellsToday, s.state.inventory.water], full);
  s = reload(s); assert.equal(s.moxieToday, 2); assert.equal(s.scheduleToday().science, true);
  const noPower = fresh('moon'); split(noPower, { heater: 1, growLights: 7 }); noPower.state.air = 80;
  const noPowerBefore = [noPower.state.air, noPower.state.inventory.water, noPower.state.cellsToday];
  assert.equal(noPower.runOxygenMaker().ok, false);
  assert.deepEqual([noPower.state.air, noPower.state.inventory.water, noPower.state.cellsToday], noPowerBefore);
  const mars = fresh('mars'); split(mars, { heater: 1 }); mars.state.air = 90;
  const water = mars.state.inventory.water; check(mars.runMoxie());
  assert.equal(mars.state.air, 96); assert.equal(mars.state.inventory.water, water);
  assert.match(mars.state.log.at(-1), /carbon dioxide|oxygen maker/i);
});

test('pet quiz cleans lunar dust for tomorrow and cannot repeat after reload', () => {
  let s = fresh('moon'); split(s, { rover: 1 });
  check(s.launchRover([[19,14],[20,14],[19,14]])); tickTo(s, 10000);
  assert.equal(s.panelsNeedCleaning(), true); const cells = s.state.cellsToday;
  const answer = s.lesson().answer; const ice = s.state.inventory.ice;
  s.pause('modal');
  const result = s.petQuiz(answer, { item: 'ice', amount: 1 }, 'moon', 1);
  assert.equal(result.ok, true); assert.equal(result.correct, true); assert.equal(result.cleaned, true);
  assert.equal(s.state.cellsToday, cells); assert.equal(s.nextDayCells(), 8);
  assert.equal(s.state.inventory.ice, ice); assert.equal(s.state.dustLevel, 0);
  assert.ok(s.meta.badges.includes('panel-cleaner')); assert.deepEqual(s.meta.wizCards, [1]);
  s = reload(s); assert.equal(s.petQuiz(answer, { item: 'ice', amount: 1 }, 'moon', 1).ok, false);
  assert.equal(s.state.inventory.ice, ice); assert.deepEqual(s.meta.wizCards, [1]);
  assert.equal(s.petQuiz(answer, { item: 'ice', amount: 1 }, 'mars', 1).ok, false);
  finish(s); assert.equal(s.state.cellsToday, 8);
});

test('Mars dust cleaning restores a spare cell immediately while Moon cleaning restores tomorrow', () => {
  let mars = fresh('mars');
  for (let day = 1; day <= 2; day++) { split(mars); finish(mars); }
  assert.equal(mars.state.sol, 3); assert.equal(mars.panelsNeedCleaning(), true);
  assert.equal(mars.state.cellsToday, 5); split(mars, {growLights: 1});
  mars.pause('modal');
  const result = mars.petQuiz(mars.lesson().answer, { item: 'water', amount: 1 });
  assert.equal(result.ok, true); assert.equal(result.cleaned, true); assert.equal(mars.state.cellsToday, 6);
  assert.equal(mars.panelsNeedCleaning(), false);
  mars = reload(mars); assert.equal(mars.petQuiz(0, { item: 'water', amount: 1 }).ok, false);
  let moon = fresh('moon'); split(moon, { rover: 1 });
  check(moon.launchRover([[19,14],[20,14],[19,14]])); tickTo(moon, 10000); finish(moon);
  assert.equal(moon.state.cellsToday, 7); split(moon);
  check(moon.cleanPanels()); assert.equal(moon.state.cellsToday, 7); assert.equal(moon.nextDayCells(), 8);
  assert.equal(moon.cleanPanels().ok, false); moon = reload(moon); assert.equal(moon.cleanPanels().ok, false);
});

test('training progress and terminal quiz are archived separately across worlds and retry', () => {
  const s0 = fresh('mars'); s0.recordQuiz('pre', 4, 'moon'); s0.startCampaign('moon');
  assert.equal(s0.meta.quiz.pre, 4);
  let s = winMission(s0, false, (run, day) => {
    if (day <= 6) assert.equal(run.answerLesson(day, run.lesson(day).answer, 'moon').ok, true);
  });
  assert.equal(s.campaign.completed[0].training.quiz.pre, 4);
  assert.equal(s.campaign.completed[0].training.badges.includes('scholar'), false);
  const lastAnswer = s.lesson(10).answer;
  assert.equal(s.answerLesson(10, lastAnswer, 'mars').ok, false);
  assert.equal(s.answerLesson(10, lastAnswer, 'moon').ok, true);
  assert.equal(s.answerLesson(10, lastAnswer, 'moon').ok, false);
  assert.equal(s.campaign.completed[0].training.lessons[10], true);
  assert.equal(s.campaign.completed[0].training.badges.includes('scholar'), true);
  s.recordQuiz('post', 5, 'moon'); assert.equal(s.campaign.completed[0].training.quiz.post, 5);
  s = reload(s); check(s.travel());
  assert.equal(s.worldId, 'mars'); assert.equal(Object.keys(s.meta.lessons).length, 0);
  assert.equal(s.campaign.completed[0].training.quiz.post, 5);
  assert.equal(s.campaign.completed[0].training.lessons[10], true);
  for (let day = 1; day <= 10 && s.state.phase === 'planning'; day++) { split(s); finish(s); }
  assert.equal(s.state.phase, 'rescue'); s = reload(s); check(s.retryMission());
  assert.equal(s.campaign.completed[0].training.quiz.post, 5);
  assert.equal(s.campaign.completed[0].training.badges.includes('scholar'), true);
  assert.equal(s.state.worldId, 'mars');
});

test('older saves default missing training and malformed training never replaces live state', () => {
  const s = fresh('moon'); const old = JSON.parse(s.serialize());
  for (const key of ['badges','lessons','wizCards','quiz','journal','dusty','exercisedSols','crewTalked','requestsDone','airGoodSols','fullPowerSols','moxieRuns']) delete old.meta[key];
  assert.equal(s.restore(JSON.stringify(old)), true);
  assert.deepEqual(s.meta.quiz, {pre:null, post:null}); assert.deepEqual(s.meta.wizCards, []);
  const before = s.serialize();
  for (const change of [
    x => x.meta.lessons = { 1: 'yes' }, x => x.meta.badges = ['unknown'],
    x => x.meta.wizCards = [11], x => x.meta.quiz = { pre: 100, post: null },
    x => x.meta.journal = [null], x => x.meta.exercisedSols = [0],
  ]) {
    const invalid = JSON.parse(before); change(invalid);
    assert.equal(s.restore(JSON.stringify(invalid)), false); assert.equal(s.serialize(), before);
  }
});


test('each world resolves ten sourced lesson cards without borrowing the other world’s scenario', () => {
  for (const world of ['mars', 'moon']) {
    const s = fresh(world);
    for (let day = 1; day <= 10; day++) {
      const lesson = s.lesson(day); const card = s.lessonCard(day);
      assert.ok(lesson && card?.text && /^https:\/\//.test(card.source), `${world} lesson ${day} missing sourced card`);
      assert.ok(lesson.answer >= 0 && lesson.answer <= 2);
      if (world === 'moon') assert.doesNotMatch(card.text, /InSight lander|Mars sol|MOXIE made oxygen from Mars/i);
    }
    if (world === 'moon') assert.match(s.lesson(7).choices[s.lesson(7).answer], /water/i);
  }
  let mars = winMission(fresh('mars'));
  const weekId = mars.campaign.completed[0].stormWeekId;
  const marsCard = mars.lessonCard(3, 'mars', weekId);
  assert.match(marsCard.text, /DONKI|solar/i);
  check(mars.travel());
  assert.deepEqual(mars.lessonCard(3, 'mars', weekId), marsCard);
  assert.match(mars.lessonCard(3, 'moon').text, /moon|lunar|radiation/i);
  mars = reload(mars);
  assert.equal(mars.campaign.completed[0].stormWeekId, weekId);
  assert.deepEqual(mars.lessonCard(3, 'mars', weekId), marsCard);
});

test('Moon crew request accepts Moon pantry crops and awards its seeds only once', () => {
  let s = fresh('moon');
  for (let day = 1; day <= 4; day++) {
    const shelter = s.storms().filter(x => x.event.scenario.gameSol === day)
      .reduce((max, event) => Math.max(max, event.event.scenario.strength), 0);
    split(s, {growLights: 1, heater: s.thermalRequired(), shelter});
    if (day === 1) check(s.plant(0, 'moon-pea'));
    else if (s.state.plots[0].growthSols >= 3) check(s.harvest(0));
    else check(s.water(0));
    finish(s);
  }
  assert.equal(s.state.sol, 5); split(s, { heater: s.thermalRequired() });
  const request = s.openRequest(); assert.equal(request.need.crop, 'moon-pea');
  assert.equal(s.requestHave(request), 1); const seeds = s.state.inventory.seed;
  check(s.fulfilRequest()); assert.equal(s.state.pantry['moon-pea'], 0);
  assert.equal(s.state.inventory.seed, seeds + 2); assert.equal(s.openRequest(), null);
  s = reload(s); assert.equal(s.openRequest(), null); assert.equal(s.state.inventory.seed, seeds + 2);
});

test('a pending pre-quiz is only adopted by the selected world', () => {
  const s = fresh('mars'); s.recordQuiz('pre', 4, 'moon'); s.startCampaign('mars');
  assert.equal(s.meta.quiz.pre, null);
  s.recordQuiz('pre', 3, 'moon'); s.startCampaign('moon'); assert.equal(s.meta.quiz.pre, 3);
  s.recordQuiz('post', 5, 'mars'); assert.equal(s.meta.quiz.post, null);
});

// Use an isolated data fixture to force travel onto rock and check the real shared clock.
test('lunar rock traction costs match the preview, survive reload and freeze while paused', () => {
  const s = fresh('moon');
  const terrain = s.data.terrain;
  const [x, y] = terrain.dome;
  const old = terrain.cost[y][x + 1];
  terrain.cost[y][x + 1] = 3;
  try {
    const route = [[x, y], [x + 1, y], [x, y]];
    const plan = evaluateRoute(route, terrain, 1, s.rules.roverCostPerTile, s.rules.roverRockCostExtra);
    assert.equal(s.tileCost(x + 1, y), 0.4);
    assert.equal(plan.totalBatteryCost, Math.round((0.4 + s.tileCost(x, y)) * 10) / 10);
    const shelter = s.storms().filter(st => st.event.scenario.gameSol === 1)
      .reduce((max, st) => Math.max(max, st.event.scenario.strength), 0);
    split(s, {rover: 1, shelter});
    check(s.launchRover(route));
    tickTo(s, 2500);
    const t = reload(s);
    t.pause('test');
    t.tick(1000);
    assert.equal(t.state.missionElapsedMs, 2500);
    t.resume('test');
    tickTo(t, 5000);
    assert.equal(t.state.rover.batteryCells, 0.6);
    tickTo(t, 10000);
    assert.equal(t.state.rover.status, 'home');
  } finally { terrain.cost[y][x + 1] = old; }
});

test('manual driving on both worlds idles, resumes after reload, collects and docks once', () => {
  for (const world of ['mars', 'moon']) {
    let s = fresh(world);
    const [x, y] = s.data.terrain.dome;
    const finds = s.data.terrain.finds;
    const testFind = {id: 'manual-test-find', item: 'ice', amount: 2, x: x + 1, y};
    finds.push(testFind);
    try {
      const shelter = s.storms().filter(st => st.event.scenario.gameSol === 1)
        .reduce((max, st) => Math.max(max, st.event.scenario.strength), 0);
      split(s, {rover: 1, shelter});
      assert.equal(s.driveRover(1, 1).ok, false);
      const iceBefore = s.state.inventory.ice;
      check(s.driveRover(1, 0));
      assert.equal(s.driveRover(0, 1).ok, false); // no queued turns while moving
      const duration = s.rules.roverMsPerTile;
      tickTo(s, duration / 2);
      s = reload(s);
      s.pause('test'); s.tick(1000);
      assert.equal(s.state.missionElapsedMs, duration / 2);
      assert.equal(s.driveRover(0, 1).ok, false);
      s.resume('test');
      tickTo(s, duration);
      assert.equal(s.state.rover.status, 'out');
      assert.ok(s.state.rover.collectedFindIds.includes(testFind.id));
      const battery = s.state.rover.batteryCells;
      s = reload(s); // idle manual trips are valid saves
      tickTo(s, duration * 3);
      assert.equal(s.state.rover.batteryCells, battery);
      assert.equal(s.roverPosition().x, x + 1);
      check(s.driveRover(-1, 0));
      tickTo(s, duration * 4 - 1);
      assert.equal(s.state.rover.status, 'out');
      tickTo(s, duration * 4);
      assert.equal(s.state.rover.status, 'home');
      assert.ok(s.state.inventory.ice >= iceBefore + 2);
      assert.equal(s.driveRover(1, 0).ok, false); // once per day
    } finally { finds.splice(finds.indexOf(testFind), 1); }
  }
});

test('manual driving blocks map edges, strands on empty battery and takes storm damage', () => {
  let s = fresh('moon'); split(s, {rover: 1});
  check(s.driveRover(1, 0)); tickTo(s, s.rules.roverMsPerTile);
  s.state.rover.route = [[0, 0]]; s.state.rover.nextRouteIndex = 1;
  assert.equal(s.driveRover(-1, 0).ok, false);
  s.state.rover.batteryCells = 0;
  check(s.driveRover(1, 0)); tickTo(s, s.state.missionElapsedMs + s.rules.roverMsPerTile);
  assert.equal(s.state.rover.status, 'stranded');
  s = fresh('moon');
  const hit = s.storms()[0];
  assert.ok(hit);
  s.state.sol = hit.event.scenario.gameSol;
  s.state.missionElapsedMs = hit.hitAtMs - 10000;
  split(s, {rover: 1}); check(s.driveRover(1, 0));
  tickTo(s, hit.hitAtMs);
  assert.equal(s.state.rover.status, 'stranded');
});
