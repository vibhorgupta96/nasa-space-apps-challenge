import { store } from '../core/store';
import { getData } from '../data/loaders';
import { fillScienceTokens } from '../data/science';
import type { ItemId } from '../core/types';
import { introForWorld, tutorialForWorld, dayBeatsForWorld, radioLettersForWorld, adaptWorldLines, REACT, RESCUE, VICTORY, EGGS, type Line } from './script';

// Decides which story lines play when. Remembers what was already shown (store.meta.storySeen)
// so reloading a save never replays a scene.

const ITEM_NAMES: Record<ItemId, string> = {
  water: 'water', ice: 'ice', regolith: 'regolith', seed: 'seeds', parts: 'mystery part(s)', sample: 'rock samples',
};

export class Director {
  constructor(private say: (lines: Line[]) => void) {}

  private once(id: string) {
    const seen = store.meta.storySeen;
    if (seen.includes(id)) return false;
    seen.push(id);
    return true;
  }

  fill(t: string, items = '') {
    const data = getData(store.worldId);
    const d = data.delay;
    return fillScienceTokens(t, data)
      .replace(/\{delay\}/g, String(Math.round(d.oneWayMinutes)))
      .replace(/\{mkm\}/g, String(Math.round(d.distanceKm / 1e6)))
      .replace(/\{items\}/g, items);
  }

  morning(sol: number) {
    const world = store.worldId;
    const dayBeats = dayBeatsForWorld(world);
    const letters = radioLettersForWorld(world);
    if (sol === 1 && this.once('intro')) this.say([...introForWorld(world), ...tutorialForWorld(world)]);
    if (dayBeats[sol] && this.once(`beat-${sol}`)) this.say(dayBeats[sol]);
    if (letters[sol] && this.once(`radio-${sol}`)) store.queueRadioMessage(this.fill(letters[sol]));
    store.save();
  }

  stormWarning(stormId: string) {
    const st = store.storms().find((s) => s.event.id === stormId);
    if (!st) return;
    const e = st.event;
    const date = new Date(e.realTime).toUTCString().slice(5, 16);
    const world = store.worldId;
    store.queueRadioMessage(world === 'moon'
      ? `Radiation alert! This is a simulated lunar hazard scenario, not a recorded Moon weather event. In the game it reaches you on day ${e.scenario.gameSol} with strength ${e.scenario.strength}. Plan shelter and shielding.`
      : `Space weather alert! This scenario is based on a real solar event NASA recorded on ${date}. In the game it reaches you on sol ${e.scenario.gameSol} with strength ${e.scenario.strength}. Put enough cells in the SHELTER that morning.`);
    if (this.once('first-warning')) this.say([REACT.stormWarningBolt]);
  }

  stormHit(safe: boolean) {
    this.say(adaptWorldLines([safe ? REACT.stormSafe : REACT.stormUnsafe], store.worldId));
  }

  roverDamaged(reason: string) {
    this.say(adaptWorldLines([reason === 'storm' ? REACT.roverStorm : REACT.roverBattery], store.worldId));
  }

  roverHome(items: Record<ItemId, number>) {
    const parts = (Object.keys(items) as ItemId[]).filter((k) => items[k] > 0).map((k) => `${items[k]} ${ITEM_NAMES[k]}`);
    if (!parts.length) this.say([REACT.roverEmpty]);
    else this.say([{ ...REACT.roverHome, text: this.fill(REACT.roverHome.text, parts.join(', ')) }]);
  }

  propeller() {
    const t = getData(store.worldId).trivia.trivia.find((x) => x.id === 'wright');
    this.say([EGGS.propeller, ...(t ? [{ who: 'bolt' as const, text: `REAL FACT: ${t.fact}` }] : [])]);
  }

  ending(win: boolean, then: () => void) {
    this.say(adaptWorldLines(win ? VICTORY : RESCUE, store.worldId));
    then();
  }
}
