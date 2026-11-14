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
    const plan = evaluateRoute(route, terrain, 1, s.rules.roverCostPerTile);
    assert.equal(plan.returnsHome, true);
    assert.equal(plan.canAfford, true);

    const firstTile = evaluateRoute(route.slice(0, 2), terrain, 1, s.rules.roverCostPerTile).totalBatteryCost;
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

function winMission(initial, withDust = false) {
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
    if (world === 'moon' && [2,5].includes(day)) check(s.cleanDust());
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
