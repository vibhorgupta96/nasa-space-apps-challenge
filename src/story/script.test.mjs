import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptWorldLines, dayBeatsForWorld, introForWorld, radioLettersForWorld, tutorialForWorld, CHAT, EGGS } from './script.ts';

test('Moon story avoids Mars-only names and uses lunar day terminology', () => {
  const lunarLines = [
    ...introForWorld('moon'), ...tutorialForWorld('moon'),
    ...Object.values(dayBeatsForWorld('moon')).flat(),
    ...Object.values(radioLettersForWorld('moon')).map((text) => ({ who: 'radio', text })),
    ...adaptWorldLines(CHAT.rosa, 'moon'), ...adaptWorldLines([EGGS.bed, ...EGGS.mysteryTree], 'moon'),
  ].map((line) => line.text).join(' ');
  assert.doesNotMatch(lunarLines, /\bMars\b|\bsols?\b/i);
  assert.match(lunarLines, /Moon-hop/);
  assert.match(lunarLines, /greenhouse/);
});

test('Mars story content remains unchanged by the world adapter', () => {
  assert.deepEqual(adaptWorldLines(CHAT.rosa, 'mars'), CHAT.rosa);
  assert.match(introForWorld('mars').map((line) => line.text).join(' '), /Mars/);
});
