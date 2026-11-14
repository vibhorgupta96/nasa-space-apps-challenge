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

test('Moon radio letters only use fact tokens that exist in the sourced Moon data', async () => {
  const { readFile } = await import('node:fs/promises');
  const science = JSON.parse(await readFile(new URL('../../public/data/moon/science.json', import.meta.url), 'utf8'));
  const ids = new Set(science.facts.map((fact) => fact.id));
  const tokens = Object.values(radioLettersForWorld('moon')).flatMap((text) => [...text.matchAll(/\{fact:([a-z0-9-]+)\}/g)].map((m) => m[1]));
  assert.ok(tokens.includes('artemis-ii'), 'Artemis II letter uses the sourced fact');
  for (const id of tokens) {
    assert.ok(ids.has(id), `missing Moon fact ${id}`);
    assert.match(science.facts.find((fact) => fact.id === id).source, /^https:\/\/www\.nasa\.gov\//);
  }
});
