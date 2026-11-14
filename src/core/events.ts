import Phaser from 'phaser';

// One shared event bus. Payloads describe changes the store has already committed.
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  SOL_START: 'sol:start', // { sol }
  SOL_END: 'sol:end', // { sol }
  POWER_SPLIT_SET: 'power:split', // { split }
  STORM_WARNING: 'storm:warning', // { stormId, strength, gameHitAtMs, scenarioLabel }
  STORM_HIT: 'storm:hit', // { stormId, strength }
  ROVER_DEPART: 'rover:depart', // { expeditionId, batteryCells }
  ROVER_ITEM_FOUND: 'rover:item', // { expeditionId, findId, item, amount }
  ROVER_RETURN: 'rover:return', // { expeditionId, deliveredItems }
  ROVER_DAMAGED: 'rover:damaged', // { expeditionId, availableSol }
  RADIO_MESSAGE: 'radio:message', // { messageId, text, arrivesAtMs, delayMinutes }
  SCIENCE_CARD: 'science:card', // { text, source }
} as const;

// Extra notifications used by this build (not part of the frozen contract above).
export const UI_EV = {
  STATE_CHANGED: 'ui:state', // {}
  TOAST: 'ui:toast', // { text }
  NIGHT_REPORT: 'ui:night', // NightReport
  PHASE_CHANGED: 'ui:phase', // { phase }
} as const;
