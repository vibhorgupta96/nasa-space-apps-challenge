import test from 'node:test';
import assert from 'node:assert/strict';
import { setScrollFactorTree } from '../src/ui/screen-space.ts';

class DisplayNode {
  constructor(children = []) {
    this.list = children;
    this.scrollFactorX = 1;
    this.scrollFactorY = 1;
  }

  setScrollFactor(x, y = x) {
    this.scrollFactorX = x;
    this.scrollFactorY = y;
    return this;
  }
}

test('fixed rover panels pin nested interactive zones to screen coordinates', () => {
  const returnZone = new DisplayNode();
  const sendZone = new DisplayNode();
  const insideZone = new DisplayNode();
  const planButtons = new DisplayNode([
    new DisplayNode([new DisplayNode([returnZone])]),
    new DisplayNode([sendZone]),
  ]);
  const screenPanel = new DisplayNode([
    new DisplayNode([planButtons]),
    new DisplayNode([insideZone]),
  ]);

  // Phaser Containers do not pass their scroll factor to children by default.
  setScrollFactorTree(screenPanel, 0);

  for (const zone of [returnZone, sendZone, insideZone]) {
    assert.equal(zone.scrollFactorX, 0);
    assert.equal(zone.scrollFactorY, 0);
  }
  assert.equal(planButtons.scrollFactorX, 0);
  assert.equal(screenPanel.scrollFactorX, 0);
});
