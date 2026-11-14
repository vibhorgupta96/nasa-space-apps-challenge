export interface Point {
  x: number;
  y: number;
}

export interface HopClock {
  elapsedMs: number | null;
  cooldownMs: number;
}

export interface HopClockStep {
  clock: HopClock;
  movedMs: number;
  complete: boolean;
}

export function beginHop(clock: HopClock, eligible: boolean): HopClock | null {
  if (!eligible || clock.elapsedMs !== null || clock.cooldownMs > 0) return null;
  return { elapsedMs: 0, cooldownMs: 1000 };
}

/** Advance hop progress and recharge only while the player can act in the simulation. */
export function advanceHopClock(clock: HopClock, deltaMs: number, active: boolean): HopClockStep {
  if (!active || deltaMs <= 0) return { clock: { ...clock }, movedMs: 0, complete: false };
  const movedMs = clock.elapsedMs === null ? 0 : Math.min(deltaMs, 250 - clock.elapsedMs);
  const elapsedMs = clock.elapsedMs === null ? null : clock.elapsedMs + movedMs;
  const complete = elapsedMs !== null && elapsedMs >= 250;
  return {
    clock: {
      elapsedMs: complete ? null : elapsedMs,
      cooldownMs: Math.max(0, clock.cooldownMs - deltaMs),
    },
    movedMs,
    complete,
  };
}

/** Move in small axis-aligned steps so a hop cannot tunnel through a solid tile. */
export function moveSwept(
  start: Point,
  delta: Point,
  blocked: (x: number, y: number) => boolean,
  maxStep = 4,
): Point {
  let x = start.x;
  let y = start.y;
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / maxStep));
  const dx = delta.x / count;
  const dy = delta.y / count;
  for (let i = 0; i < count; i++) {
    if (!blocked(x + dx, y)) x += dx;
    if (!blocked(x, y + dy)) y += dy;
  }
  return { x, y };
}
