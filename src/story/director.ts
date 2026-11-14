import { store } from '../core/store';
import { getData } from '../data/loaders';
import type { ItemId } from '../core/types';
import { INTRO, TUTORIAL, SOL_BEATS, RADIO_LETTERS, REACT, RESCUE, VICTORY, EGGS, type Line } from './script';

// Decides which story lines play when. Remembers what was already shown (store.meta.storySeen)
// so reloading a save never replays a scene.

const ITEM_NAMES: Record<ItemId, string> = {
  water: 'water', ice: 'ice', regolith: 'regolith', seed: 'seeds', parts: 'a mystery part', sample: 'rock samples',
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
    const d = getData().delay;
    return t
      .replace(/\{delay\}/g, String(Math.round(d.oneWayMinutes)))
      .replace(/\{mkm\}/g, String(Math.round(d.distanceKm / 1e6)))
      .replace(/\{items\}/g, items);
  }

  morning(sol: number) {
    if (sol === 1 && this.once('intro')) this.say([...INTRO, ...TUTORIAL]);
    if (SOL_BEATS[sol] && this.once(`beat-${sol}`)) this.say(SOL_BEATS[sol]);
    if (RADIO_LETTERS[sol] && this.once(`radio-${sol}`)) store.queueRadioMessage(this.fill(RADIO_LETTERS[sol]));
    store.save();
  }

  stormWarning(stormId: string) {
    const st = store.storms().find((s) => s.event.id === stormId);
    if (!st) return;
    const e = st.event;
    const date = new Date(e.realTime).toUTCString().slice(5, 16);
    store.queueRadioMessage(
      `Space weather alert! This scenario is based on a real solar event NASA recorded on ${date}. In the game it reaches you on sol ${e.scenario.gameSol} with strength ${e.scenario.strength}. Put enough cells in the SHELTER that morning.`,
    );
    if (this.once('first-warning')) this.say([REACT.stormWarningBolt]);
  }

  stormHit(safe: boolean) {
    this.say([safe ? REACT.stormSafe : REACT.stormUnsafe]);
  }

  roverDamaged(reason: string) {
    this.say([reason === 'storm' ? REACT.roverStorm : REACT.roverBattery]);
  }

  roverHome(items: Record<ItemId, number>) {
    const parts = (Object.keys(items) as ItemId[]).filter((k) => items[k] > 0).map((k) => `${items[k]} ${ITEM_NAMES[k]}`);
    if (!parts.length) this.say([REACT.roverEmpty]);
    else this.say([{ ...REACT.roverHome, text: this.fill(REACT.roverHome.text, parts.join(', ')) }]);
  }

  propeller() {
    const t = getData().trivia.trivia.find((x) => x.id === 'wright');
    this.say([EGGS.propeller, ...(t ? [{ who: 'bolt' as const, text: `REAL FACT: ${t.fact}` }] : [])]);
  }

  ending(win: boolean, then: () => void) {
    this.say(win ? VICTORY : RESCUE);
    then();
  }
}
