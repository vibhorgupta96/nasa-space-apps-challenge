import { RULES } from '../core/rules';
import type { GameState } from '../core/types';
import type { StormWeek } from '../data/loaders';
export function getActiveStormWarnings(state: GameState, weeks: StormWeek[]) {
  const week = weeks.find(w => w.id === state.stormWeekId) ?? weeks[0];
  if (!week) return [];
  return week.events.flatMap(event => {
    const hitAtMs = (event.scenario.gameSol - 1) * RULES.solDurationMs + event.scenario.hitOffsetMs;
    const warningAtMs = Math.max(0, hitAtMs - event.scenario.warningSols * RULES.solDurationMs);
    if (state.processedStormHits.includes(event.id) || state.missionElapsedMs >= hitAtMs ||
        (state.missionElapsedMs < warningAtMs && !state.processedWarnings.includes(event.id))) return [];
    return [{ event, hitAtMs, remainingMs: hitAtMs - state.missionElapsedMs }];
  }).sort((a, b) => a.hitAtMs - b.hitAtMs);
}
