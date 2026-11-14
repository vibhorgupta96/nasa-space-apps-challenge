import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHopClock, beginHop, moveSwept } from '../src/core/movement.ts';

test('swept movement stops at a wall without crossing it', () => {
  const wallX = 10;
  const result = moveSwept({ x: 0, y: 5 }, { x: 30, y: 0 }, (x) => x >= wallX, 2);
  assert.ok(result.x < wallX);
  assert.ok(result.x > 0);
});

test('swept movement allows sliding along a wall', () => {
  const result = moveSwept({ x: 9, y: 0 }, { x: 5, y: 12 }, (x) => x >= 10, 2);
  assert.ok(result.x < 10);
  assert.ok(result.y > 0);
});

test('hop cannot start before cooldown finishes and completes after 250 active milliseconds', () => {
  const initial = { elapsedMs: null, cooldownMs: 0 };
  const started = beginHop(initial, true);
  assert.deepEqual(started, { elapsedMs: 0, cooldownMs: 1000 });
  assert.equal(beginHop(started, true), null);

  const half = advanceHopClock(started, 125, true);
  assert.equal(half.clock.elapsedMs, 125);
  assert.equal(half.clock.cooldownMs, 875);
  assert.equal(half.complete, false);

  const done = advanceHopClock(half.clock, 125, true);
  assert.equal(done.clock.elapsedMs, null);
  assert.equal(done.clock.cooldownMs, 750);
  assert.equal(done.movedMs, 125);
  assert.equal(done.complete, true);
  assert.equal(beginHop(done.clock, true), null);
});

test('hop progress and cooldown freeze while planning or paused', () => {
  const clock = { elapsedMs: 90, cooldownMs: 600 };
  const result = advanceHopClock(clock, 1000, false);
  assert.deepEqual(result, { clock, movedMs: 0, complete: false });
  assert.equal(beginHop(clock, false), null);
});
