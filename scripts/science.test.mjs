import test from 'node:test';
import assert from 'node:assert/strict';
import { fillScienceTokens, selectScienceCard } from '../src/data/science.ts';

const source = 'https://science.nasa.gov/example';
const data = {
  science: { facts: [
    { id: 'mars-sol', activity: 'sol', text: 'One sourced sol fact.', source },
    { id: 'mars-clouds', activity: 'sol', text: 'A sourced cloud fact.', source },
    { id: 'veg-garden', activity: 'plant', text: 'A sourced planting fact.', source },
    { id: 'veg-water', activity: 'water', text: 'A sourced watering fact.', source },
    { id: 'plant-oxygen', activity: 'dialogue', text: 'A sourced oxygen fact.', source },
  ] },
  crops: { crops: [] },
  trivia: { trivia: [{ id: 'morse', fact: 'A sourced rover fact.', source }] },
};

function activity(overrides = {}) {
  return { planted: false, watered: false, harvested: null, roverTrip: false, storm: null, sol: 1, ...overrides };
}

test('CME, SEP and GST science cards keep the sourced event type distinct', () => {
  for (const [type, term] of [['CME', 'coronal mass ejection'], ['SEP', 'solar energetic particle'], ['GST', 'Earth geomagnetic storm']]) {
    const card = selectScienceCard(data, activity({ storm: { type, realTime: '2024-05-08T05:36:00Z', link: source } }));
    assert.match(card.text, new RegExp(term, 'i'));
    assert.match(card.text, /simulated/i);
    assert.equal(card.source, source);
  }
  const gst = selectScienceCard(data, activity({ storm: { type: 'GST', realTime: '2024-05-08T05:36:00Z', link: source } }));
  assert.doesNotMatch(gst.text, /particle/i);
});

test('science cards match planting, watering, harvesting and rover actions', () => {
  assert.equal(selectScienceCard(data, activity({ planted: true })).text, 'A sourced planting fact.');
  assert.equal(selectScienceCard(data, activity({ watered: true })).text, 'A sourced watering fact.');
  assert.deepEqual(
    selectScienceCard({ ...data, crops: { crops: [{ id: 'mizuna', fact: 'A sourced harvest fact.', factSource: source }] } }, activity({ harvested: { id: 'mizuna', fact: 'A sourced harvest fact.', factSource: source } })),
    { text: 'A sourced harvest fact.', source },
  );
  assert.equal(selectScienceCard(data, activity({ roverTrip: true })).text, 'A sourced rover fact.');
});

test('quiet sols still have a sourced science fact', () => {
  const card = selectScienceCard(data, activity());
  assert.match(card.text, /sourced sol fact|sourced cloud fact/i);
  assert.equal(card.source, source);
});

test('dialogue fact tokens resolve to loaded sourced science text', () => {
  assert.equal(fillScienceTokens('Plants: {fact:plant-oxygen}', data), 'Plants: A sourced oxygen fact.');
});
