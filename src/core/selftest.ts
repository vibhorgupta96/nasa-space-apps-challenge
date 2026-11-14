import { bus, EV } from './events';
import { RULES } from './rules';
import { Store } from './store';
import type { PowerSlot } from './types';
import { getData, type Find } from '../data/loaders';

// Dev-only checks for PLAN.md section 6 "Minimum play checks", plus a full 10-sol win and a
// rescue. Run in the browser console after the game has loaded: `await selftest()`.
// Each check uses its own Store that never touches the real save, and bus events are captured
// instead of reaching the live UI.

type Split = Partial<Record<PowerSlot, number>>;
type Emitted = { name: string; payload: unknown };

const TEST_FIND: Find = { id: 'selftest-find', x: 20, y: 14, item: 'ice', amount: 2 } as Find;

function fresh(): Store {
  const t = new Store(false);
  t.save = () => {};
  t.newGame();
  return t;
}

function start(t: Store, split: Split) {
  const r = t.setPowerSplit({ growLights: 0, heater: 0, shelter: 0, rover: 0, ...split });
  if (!r.ok) throw new Error(`split refused: ${r.reason}`);
  t.startDay();
}

/** Tick in 1 s frames until `ms` (clamped to the end of the day) or the day ends. */
function runTo(t: Store, ms: number) {
  while (t.state.phase === 'day' && t.state.missionElapsedMs < ms) t.tick(Math.min(1000, ms - t.state.missionElapsedMs));
}

function finishDay(t: Store) {
  runTo(t, Infinity);
}

/** A boring sol: just heater + whatever else, so time passes. */
function skipSol(t: Store, split: Split = { heater: 1 }) {
  start(t, split);
  finishDay(t);
}

const dome = (): [number, number] => getData().terrain.dome as [number, number];

export async function runSelfTest() {
  const events: Emitted[] = [];
  const realEmit = bus.emit;
  bus.emit = ((name: string, payload: unknown) => {
    events.push({ name, payload });
    return true;
  }) as typeof bus.emit;
  const finds = getData().terrain.finds;
  finds.push(TEST_FIND);

  const results: { check: string; ok: boolean; detail: string }[] = [];
  const check = (name: string, fn: () => string | void) => {
    events.length = 0;
    try {
      results.push({ check: name, ok: true, detail: fn() || '' });
    } catch (e) {
      results.push({ check: name, ok: false, detail: (e as Error).message });
    }
  };
  const expect = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };
  const count = (name: string) => events.filter((e) => e.name === name).length;

  try {
    check('1. Cold sol without heater pauses growth and air', () => {
      const coldSol = Array.from({ length: RULES.missionSols }, (_, i) => i + 1).find((sol) => fresh().needsHeater(sol));
      expect(coldSol !== undefined, 'no cold sol in this data; check needs one');
      const shelterFor = (t: Store, sol: number) => t.storms().find((x) => x.event.scenario.gameSol === sol)?.event.scenario.strength ?? 0;
      const playColdSol = (heater: number) => {
        const t = fresh();
        while (t.state.sol < coldSol!) skipSol(t, { heater: 1, shelter: shelterFor(t, t.state.sol) });
        const shelter = shelterFor(t, coldSol!);
        start(t, { heater, shelter, growLights: t.state.cellsToday - shelter - heater }); // a dusty panel can cost a cell
        expect(t.plant(0, 'red-romaine').ok, 'plant failed');
        finishDay(t);
        return t;
      };
      const cold = playColdSol(0);
      expect(cold.state.plots[0].growthSols === 0, `grew to ${cold.state.plots[0].growthSols} without a heater`);
      const [airBefore, airAfter] = cold.lastNight!.air;
      expect(airAfter === Math.max(0, airBefore - RULES.airLossPerSol), `air ${airBefore} → ${airAfter}, expected no crop air`);
      const warm = playColdSol(1);
      expect(warm.state.plots[0].growthSols === 1, 'did not grow even with a heater');
      return `cold sol ${coldSol}: no heater → growth 0, air ${airAfter}; heater → growth 1`;
    });

    check('2. Safe shielded storm costs regolith only when crafted', () => {
      const t = fresh();
      const storm = t.storms()[0];
      t.state.inventory.regolith = RULES.regolithPerShieldLayer * 2;
      start(t, { heater: 1 });
      expect(t.craftShield().ok, 'craft failed');
      const afterCraft = t.state.inventory.regolith;
      expect(afterCraft === RULES.regolithPerShieldLayer, `craft left ${afterCraft} regolith`);
      finishDay(t);
      while (t.state.sol < storm.event.scenario.gameSol) skipSol(t);
      const need = Math.max(0, storm.event.scenario.strength - t.state.shield);
      start(t, { heater: 1, shelter: need });
      runTo(t, storm.hitAtMs + 1);
      expect(t.state.processedStormHits.includes(storm.event.id), 'storm did not hit');
      expect(t.state.air === RULES.initialAir - RULES.airLossPerSol * (t.state.sol - 1), `unsafe storm hurt air: ${t.state.air}`);
      expect(t.state.inventory.regolith === afterCraft, `storm took regolith: ${t.state.inventory.regolith}`);
      expect(t.state.shield === 1, `shield changed to ${t.state.shield}`);
      return `strength ${storm.event.scenario.strength} vs ${need} shelter + 1 layer; regolith stayed ${afterCraft}`;
    });

    check('3. Warning before departure keeps its deadline; hit processed once', () => {
      const t = fresh();
      const storm = t.storms()[0];
      start(t, { heater: 1, rover: 1 });
      runTo(t, storm.warnAtMs + 1);
      expect(count(EV.STORM_WARNING) === 1, 'no warning event');
      const [dx, dy] = dome();
      expect(t.launchRover([[dx, dy], [dx + 1, dy], [dx, dy]]).ok, 'launch failed');
      const pending = t.pendingStorms().find((p) => p.event.id === storm.event.id);
      expect(!!pending && pending.hitAtMs === storm.hitAtMs, 'warned storm lost its deadline after departure');
      finishDay(t);
      while (t.state.sol < storm.event.scenario.gameSol) skipSol(t);
      start(t, { heater: 1, shelter: storm.event.scenario.strength });
      runTo(t, storm.hitAtMs + 5000);
      t.water(0); // any command re-runs advanceTo at "now"
      finishDay(t);
      const hits = t.state.processedStormHits.filter((id) => id === storm.event.id).length;
      expect(hits === 1 && t.meta.stormsSurvived + t.meta.stormsTaken === 1, `hit counted ${hits} times`);
      const warnings = events.filter((e) => e.name === EV.STORM_WARNING && (e.payload as { stormId: string }).stormId === storm.event.id).length;
      expect(warnings === 1, `warning emitted ${warnings} times`);
      return `deadline ${storm.hitAtMs} ms kept; hit once`;
    });

    check('4. Shared hit/return timestamp: hit resolves first', () => {
      const t = fresh();
      const storm = t.storms()[0];
      while (t.state.sol < storm.event.scenario.gameSol) skipSol(t);
      start(t, { heater: 1, rover: 1, shelter: storm.event.scenario.strength });
      const [dx, dy] = dome();
      const route: [number, number][] = [[dx, dy], [dx + 1, dy], [dx, dy]];
      runTo(t, storm.hitAtMs - (route.length - 1) * RULES.roverMsPerTile);
      expect(t.launchRover(route).ok, 'launch failed');
      runTo(t, storm.hitAtMs);
      expect(t.state.rover.status === 'stranded', `rover is ${t.state.rover.status}; return beat the hit`);
      expect(count(EV.ROVER_RETURN) === 0, 'rover returned at the hit timestamp');
      return 'rover damaged by the hit instead of returning';
    });

    check('5. Cargo reaches home exactly once after return', () => {
      const t = fresh();
      const [dx, dy] = dome();
      start(t, { heater: 1, rover: 2 });
      const ice0 = t.state.inventory.ice;
      expect(t.launchRover([[dx, dy], [TEST_FIND.x, TEST_FIND.y], [dx + 1, dy + 1], [dx, dy + 1], [dx, dy]]).ok, 'launch failed');
      runTo(t, 3 * RULES.roverMsPerTile);
      expect(t.state.rover.cargo.ice === TEST_FIND.amount, 'find not picked up');
      expect(t.state.inventory.ice === ice0, 'cargo arrived before Bolt got home');
      runTo(t, 10 * RULES.roverMsPerTile);
      expect(t.state.rover.status === 'home', `rover is ${t.state.rover.status}`);
      expect(t.state.inventory.ice === ice0 + TEST_FIND.amount, `ice ${t.state.inventory.ice}`);
      finishDay(t);
      skipSol(t);
      expect(t.state.inventory.ice === ice0 + TEST_FIND.amount, `ice changed later to ${t.state.inventory.ice}`);
      expect(count(EV.ROVER_RETURN) === 1, `${count(EV.ROVER_RETURN)} returns`);
      return `+${TEST_FIND.amount} ice once`;
    });

    check('6. Failed trip loses cargo; rover out for one full sol', () => {
      const t = fresh();
      const [dx, dy] = dome();
      start(t, { heater: 1, rover: 1 });
      const ice0 = t.state.inventory.ice;
      const out: [number, number][] = [];
      for (let x = dx; x <= dx + 12; x++) out.push([x, dy]);
      const route = [...out, ...out.slice(0, -1).reverse()];
      expect(t.launchRover(route).ok, 'launch failed');
      finishDay(t);
      expect(t.state.sol === 2 && t.state.rover.status === 'repairing', `sol ${t.state.sol}, rover ${t.state.rover.status}`);
      expect(t.state.inventory.ice === ice0, 'stranded cargo still arrived');
      start(t, { heater: 1, rover: 1 });
      expect(!t.roverCanLaunch().ok, 'rover can launch on the repair sol');
      finishDay(t);
      start(t, { heater: 1, rover: 1 });
      expect(t.roverCanLaunch().ok, `still unavailable on sol ${t.state.sol}`);
      return 'stranded sol 1, repairing sol 2, available sol 3';
    });

    check('7. Save + reload never replays warning, hit, pickup or route step', () => {
      const t = fresh();
      const storm = t.storms()[0];
      const [dx, dy] = dome();
      start(t, { heater: 1, rover: 2 });
      runTo(t, storm.warnAtMs - 8000);
      t.launchRover([[dx, dy], [TEST_FIND.x, TEST_FIND.y], [dx + 1, dy + 1], [dx, dy + 1], [dx, dy]]);
      runTo(t, storm.warnAtMs + 1);
      const step = t.state.rover.nextRouteIndex;
      const t2 = new Store(false);
      t2.save = () => {};
      expect(t2.restore(t.serialize()), 'restore failed');
      events.length = 0;
      runTo(t2, storm.warnAtMs + 6 * RULES.roverMsPerTile);
      expect(count(EV.STORM_WARNING) === 0, 'warning replayed');
      expect(count(EV.ROVER_ITEM_FOUND) === 0, 'pickup replayed');
      expect(count(EV.ROVER_RETURN) === 1 && t2.state.inventory.ice === TEST_FIND.amount, `ice ${t2.state.inventory.ice}`);
      finishDay(t2);
      while (t2.state.sol < storm.event.scenario.gameSol) skipSol(t2);
      start(t2, { heater: 1, shelter: storm.event.scenario.strength });
      runTo(t2, storm.hitAtMs + 1);
      const t3 = new Store(false);
      t3.save = () => {};
      expect(t3.restore(t2.serialize()), 'restore 2 failed');
      events.length = 0;
      finishDay(t3);
      expect(count(EV.STORM_HIT) === 0, 'hit replayed');
      const t4 = new Store(false);
      t3.state.phase = 'debrief';
      expect(!t4.restore(t3.serialize()), 'inconsistent debrief without a completion record was accepted');
      return `resumed at route step ${step}; nothing replayed`;
    });

    check('Win: 10 sols of farming reach the debrief', () => {
      const t = fresh();
      for (let sol = 1; sol <= RULES.missionSols; sol++) {
        const storm = t.storms().find((x) => x.event.scenario.gameSol === sol);
        start(t, { heater: 1, growLights: 1, shelter: storm ? storm.event.scenario.strength : 0 });
        for (let i = 0; i < 4; i++) {
          const p = t.state.plots[i];
          if (p.cropId && p.growthSols >= 3) t.harvest(i);
          const r = t.state.plots[i].cropId ? t.water(i) : t.plant(i, 'red-romaine');
          if (!r.ok) throw new Error(`sol ${sol} plot ${i}: ${r.reason}`);
        }
        finishDay(t);
        if (sol < RULES.missionSols) expect(t.state.phase === 'planning', `sol ${sol} ended in ${t.state.phase}`);
      }
      expect(t.state.phase === 'debrief', `ended in ${t.state.phase}`);
      return `air ${t.state.air}, food ${t.state.food}, water left ${t.state.inventory.water}`;
    });

    check('Farm: sleeping ends the sol after resolving the rest of the day', () => {
      const t = fresh();
      expect(!t.sleepNow().ok, 'slept before the day started');
      start(t, { heater: 1, growLights: 1 });
      expect(t.sleepNow().ok, 'could not sleep during the day');
      expect(t.state.sol === 2 && t.state.phase === 'planning', `sol ${t.state.sol}, ${t.state.phase}`);
      expect(t.lastNight?.sol === 1, 'no night report for sol 1');
      return 'sol 1 → night report → sol 2 morning';
    });

    check('Farm: the pet helps once per sol', () => {
      const t = fresh();
      start(t, { heater: 1, growLights: 1 });
      const ice = t.state.inventory.ice;
      expect(t.petTrick('ice', 1).ok, 'first trick refused');
      expect(!t.petTrick('ice', 1).ok, 'second trick allowed on the same sol');
      expect(t.state.inventory.ice === ice + 1, `ice ${ice} → ${t.state.inventory.ice}`);
      t.sleepNow();
      start(t, { heater: 1, growLights: 1 });
      expect(t.petTrick('ice', 1).ok, 'trick refused on the next sol');
      return '+1 ice on sol 1, again on sol 2';
    });

    check('Kitchen: harvests go to the pantry; recipes beat eating raw; hungry crews snack', () => {
      const t = fresh();
      start(t, { heater: 1, growLights: 1 });
      t.state.pantry = { 'red-romaine': 2, mizuna: 1, zinnia: 1 };
      t.state.food = 20;
      expect(!t.cook('chile-tacos').ok, 'cooked tacos without the crops');
      expect(t.cook('space-salad').ok, 'could not cook a salad');
      expect(t.state.food === 65 && t.state.pantry['red-romaine'] === 1 && t.state.pantry.mizuna === 0, `food ${t.state.food}, pantry ${JSON.stringify(t.state.pantry)}`);
      expect(!t.eatRaw('zinnia').ok, 'ate a flower');
      const seeds = t.state.inventory.seed;
      expect(t.cook('zinnia-seeds').ok && t.state.inventory.seed === seeds + 3, 'zinnia seeds not saved');
      expect(t.eatRaw('red-romaine').ok && t.state.food === 83, `raw romaine left food ${t.state.food}`);
      // A ripe plot harvests into the pantry, not straight into food.
      Object.assign(t.state.plots[0], { cropId: 'radish', growthSols: 4, condition: 'healthy' });
      const food = t.state.food;
      expect(t.harvest(0).ok && t.state.pantry.radish === 1 && t.state.food === food, 'harvest skipped the pantry');
      // Night: food drops below the snack line, so the crew eats the radish.
      t.state.food = 30;
      finishDay(t);
      expect(t.lastNight?.snacked === 1 && t.state.pantry.radish === 0, `snacked ${t.lastNight?.snacked}`);
      return `salad +45, raw romaine +18, 3 zinnia seeds, night snack ${t.lastNight?.snacked}`;
    });

    check('Training: MOXIE uses spare cells; dust costs a cell until cleaned', () => {
      const t = fresh();
      start(t, { heater: 1, growLights: 4 });
      t.state.air = 50;
      expect(t.runMoxie().ok && t.state.air === 50 + RULES.moxieAirPerCell, `MOXIE air ${t.state.air}`);
      expect(t.state.cellsToday === RULES.cellsPerSol - 1 && t.moxieToday === 1, `cells ${t.state.cellsToday}`);
      expect(!t.runMoxie().ok, 'MOXIE ran without a spare cell');
      expect(t.meta.badges.includes('oxygen-maker'), 'no Oxygen Maker badge');
      finishDay(t);
      skipSol(t); // sol 2
      expect(t.state.sol === 3 && t.meta.dusty && t.state.cellsToday === RULES.cellsPerSol - RULES.dustCellsLost, `sol ${t.state.sol} dusty ${t.meta.dusty} cells ${t.state.cellsToday}`);
      start(t, { heater: 1, growLights: 4 });
      expect(t.spareCells() === 0 && t.cleanPanels().ok && t.spareCells() === 1, 'cleaning did not free a spare cell');
      expect(!t.meta.dusty && !t.cleanPanels().ok && !t.petCleanPanels().ok, 'cleaned a clean panel');
      return `+${RULES.moxieAirPerCell} air per spare cell; sol 3 dust → ${RULES.cellsPerSol - 1} cells → cleaned`;
    });

    check('Pet quiz: once a sol; right answers win a Wiz Card and the reward', () => {
      const t = fresh();
      expect(!t.petQuiz(0, { item: 'ice', amount: 1 }).ok, 'quiz before the day started');
      start(t, { heater: 1, growLights: 1 });
      const ice = t.state.inventory.ice;
      const right = t.petQuiz(0, { item: 'ice', amount: 1 }); // sol 1: answer 0 is right
      expect(right.ok && right.correct && t.state.inventory.ice === ice + 1 && t.meta.wizCards.includes(1), 'right answer gave no card or reward');
      expect(t.petQuiz(0, { item: 'ice', amount: 1 }).reason === 'already', 'second quiz on the same sol');
      expect(t.meta.lessons[1] === true, 'pet quiz did not count as the sol lesson');
      t.sleepNow();
      start(t, { heater: 1 });
      const wrong = t.petQuiz(0, { item: 'ice', amount: 1 }); // sol 2: answer 1 is right
      expect(wrong.ok && !wrong.correct && t.state.inventory.ice === ice + 1 && t.meta.wizCards.length === 1, 'wrong answer was rewarded');
      return 'sol 1 right → Wiz Card + 1 ice; sol 2 wrong → no reward';
    });

    check('Moonwalk: once a day on the Moon; costs suit air, brings regolith, ticks science', () => {
      const mars = fresh();
      start(mars, { heater: 1 });
      expect(!mars.moonwalk('samples').ok, 'moonwalk allowed on Mars');
      const t = new Store(false);
      t.save = () => {};
      t.newGame('moon');
      expect(!t.moonwalk('samples').ok, 'moonwalk before the day started');
      start(t, { heater: 2 });
      const air = t.state.air, rock = t.state.inventory.regolith, dust = t.state.dustLevel;
      const r = t.moonwalk('samples');
      expect(r.ok && t.state.air === air - RULES.moonwalkAirCost && t.state.inventory.regolith === rock + 2, 'samples walk did not cost air or give regolith');
      expect(t.state.dustLevel === dust + 1 && t.nextDayCells() === RULES.moonDayCells - 1, 'moonwalk dust did not cost a cell tomorrow');
      expect(!t.moonwalk('earth').ok, 'second moonwalk on the same day');
      t.sleepNow();
      const n = t.lastNight!;
      expect(n.schedule.science && /moonwalk/.test(n.journal), `schedule ${JSON.stringify(n.schedule)}, journal "${n.journal}"`);
      start(t, { heater: 2 });
      t.state.air = RULES.moonwalkMinAir - 1;
      expect(!t.moonwalk('earth').ok, 'moonwalk with too little air');
      return `-${RULES.moonwalkAirCost} air, +2 regolith, +1 dust; journal "${n.journal}"`;
    });

    check('Training: lessons, schedule, journal, requests and badges', () => {
      const t = fresh();
      expect(t.lessonCard(1)?.source.startsWith('http') === true, 'sol 1 lesson has no source');
      for (let sol = 1; sol <= RULES.missionSols; sol++) expect(!!t.lessonCard(sol)?.text, `no See-it card for sol ${sol}`);
      start(t, { heater: 1, growLights: 1 });
      expect(t.plant(0, 'mizuna').ok && t.exercise().ok && !t.exercise().ok, 'exercise once per sol failed');
      t.talkedTo('rosa'); t.talkedTo('theo'); t.talkedTo('priya'); t.talkedTo('bolt');
      expect(t.meta.badges.includes('team-player'), 'no Team Player badge');
      t.sleepNow();
      const n = t.lastNight!;
      expect(n.schedule.farm && n.schedule.exercise && !n.schedule.science && n.schedule.sleep, `schedule ${JSON.stringify(n.schedule)}`);
      expect(n.journal.startsWith('Sol 1:') && /planted/.test(n.journal) && /exercised/.test(n.journal), `journal "${n.journal}"`);
      expect(t.answerLesson(1, 0).correct && !t.answerLesson(1, 1).correct && t.meta.lessons[1] === true, 'first answer did not stick');
      expect(!t.answerLesson(2, 0).correct && t.lessonsCorrect() === 1, 'wrong answer counted');
      // Sol 2: Priya asks for 3 water.
      start(t, { heater: 1 });
      const req = t.openRequest();
      expect(req?.who === 'priya', `request ${req?.who}`);
      const seeds = t.state.inventory.seed;
      expect(t.fulfilRequest().ok && t.state.inventory.seed === seeds + RULES.requestRewardSeeds && !t.openRequest(), 'request not finished');
      return `journal "${n.journal}", request done, ${t.meta.badges.length} badges`;
    });

    check('Farm: unsafe storm wilts a plot, which can be cleared and replanted', () => {
      const t = fresh();
      const storm = t.storms()[0];
      start(t, { heater: 1, growLights: 1 });
      t.plant(0, 'red-romaine');
      expect(!t.water(0).ok, 'watered twice on one sol');
      finishDay(t);
      while (t.state.sol < storm.event.scenario.gameSol) {
        start(t, { heater: 1, growLights: 1 });
        t.water(0);
        finishDay(t);
      }
      start(t, { heater: 1, growLights: 1 });
      t.water(0);
      runTo(t, storm.hitAtMs + 1);
      expect(t.state.plots[0].condition === 'wilted', 'unsafe storm did not wilt plot 0');
      expect(!t.water(0).ok && !t.harvest(0).ok, 'wilted plot accepted water or harvest');
      const seeds = t.state.inventory.seed;
      expect(t.clearPlot(0).ok && t.state.plots[0].cropId === null, 'clear failed');
      expect(t.plant(0, 'mizuna').ok && t.state.inventory.seed === seeds - 1, 'replant failed');
      return `wilted on sol ${t.state.sol}, cleared and replanted`;
    });

    check('Rescue: no farming runs out of food/air and triggers rescue', () => {
      const t = fresh();
      let sols = 0;
      while (t.state.phase === 'planning' && sols < 20) {
        const storm = t.storms().find((x) => x.event.scenario.gameSol === t.state.sol);
        skipSol(t, { heater: 1, shelter: storm ? storm.event.scenario.strength : 0 });
        sols++;
      }
      expect(t.state.phase === 'rescue', `ended in ${t.state.phase}`);
      return `rescue after sol ${t.lastNight?.sol} (air ${t.state.air}, food ${t.state.food})`;
    });

    check('Science: planting, watering and harvest context survive reload', () => {
      const planting = fresh();
      start(planting, { heater: 1, growLights: 1 });
      expect(planting.plant(0, 'red-romaine').ok, 'plant failed');
      const planted = new Store(false);
      planted.save = () => {};
      expect(planted.restore(planting.serialize()), 'plant save did not restore');
      finishDay(planted);
      const plantFact = getData().science.facts.find((fact) => fact.id === 'veg-garden');
      expect(planted.lastNight?.card?.text === plantFact?.text, 'plant fact was lost after reload');

      const watering = fresh();
      Object.assign(watering.state.plots[0], { cropId: 'red-romaine', growthSols: 0, condition: 'healthy', wateredToday: false });
      start(watering, { heater: 1, growLights: 1 });
      expect(watering.water(0).ok, 'water failed');
      const watered = new Store(false);
      watered.save = () => {};
      expect(watered.restore(watering.serialize()), 'water save did not restore');
      finishDay(watered);
      const waterFact = getData().science.facts.find((fact) => fact.id === 'veg-water');
      expect(watered.lastNight?.card?.text === waterFact?.text, 'water fact was lost after reload');

      const harvest = fresh();
      Object.assign(harvest.state.plots[0], { cropId: 'red-romaine', growthSols: 3, condition: 'healthy', wateredToday: false });
      start(harvest, { heater: 1, growLights: 1 });
      expect(harvest.harvest(0).ok, 'harvest failed');
      const harvested = new Store(false);
      harvested.save = () => {};
      expect(harvested.restore(harvest.serialize()), 'harvest save did not restore');
      finishDay(harvested);
      const harvestFact = getData().crops.crops.find((crop) => crop.id === 'red-romaine');
      expect(harvested.lastNight?.card?.text === harvestFact?.fact, 'harvest fact was lost after reload');
      return 'plant, water and harvest cards restored';
    });

    check('Science: valid storms restore; invalid and legacy context is ignored', () => {
      const source = fresh();
      start(source, { heater: 1 });
      const event = source.storms()[0].event;
      const parsed = JSON.parse(source.serialize());
      parsed.scienceContext.stormId = event.id;
      const restored = new Store(false);
      restored.save = () => {};
      expect(restored.restore(JSON.stringify(parsed)), 'storm save did not restore');
      finishDay(restored);
      expect(restored.lastNight?.card?.source === event.link, 'storm event was not restored by ID');

      const invalidContext = JSON.parse(source.serialize());
      invalidContext.scienceContext.harvested = ['not-a-crop'];
      const invalid = new Store(false);
      invalid.save = () => {};
      expect(invalid.restore(JSON.stringify(invalidContext)), 'invalid science context rejected the save');
      invalid.tick(1);

      const legacy = JSON.parse(source.serialize());
      delete legacy.scienceContext;
      const oldSave = new Store(false);
      oldSave.save = () => {};
      expect(oldSave.restore(JSON.stringify(legacy)), 'legacy save did not restore');
      finishDay(oldSave);
      expect(!!oldSave.lastNight?.card?.source, 'legacy save did not produce a sourced fallback card');
      return 'storm ID checked; malformed and pre-context saves remain loadable';
    });

    check('Science: night transition stores an empty context for the next sol', () => {
      const t = fresh();
      start(t, { heater: 1, growLights: 1 });
      expect(t.plant(0, 'red-romaine').ok, 'plant failed');
      finishDay(t);
      const parsed = JSON.parse(t.serialize());
      expect(parsed.state.phase === 'planning' && parsed.scienceContext.sol === parsed.state.sol, 'next-sol context guard mismatch');
      expect(parsed.scienceContext.phase === parsed.state.phase, 'next-sol phase context mismatch');
      expect(!parsed.scienceContext.planted && !parsed.scienceContext.watered && parsed.scienceContext.harvested.length === 0, 'prior-sol activity carried forward');
      return `clean context for sol ${parsed.state.sol}`;
    });
  } finally {
    bus.emit = realEmit;
    finds.splice(finds.indexOf(TEST_FIND), 1);
  }

  console.table(results);
  return { passed: results.filter((r) => r.ok).length, total: results.length, results };
}
