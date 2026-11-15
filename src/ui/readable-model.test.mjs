import test from 'node:test';
import assert from 'node:assert/strict';
import { readableEntries } from './readable-model.ts';

const node = (properties = {}, data = {}) => ({ ...properties, getData: key => data[key] });

test('hidden ancestors suppress text and controls, including descendants', () => {
  const control = node({}, { readableAction: { label: 'Hidden button', activate() {} } });
  assert.deepEqual(readableEntries([
    node({ visible: false, list: [control, { text: 'Hidden copy' }] }),
    node({ alpha: 0, list: [control] }),
    node({ text: 'Visible copy' }),
  ]), [{ text: 'Visible copy' }]);
});

test('explicit controls expose one named action without decorative labels or duplicates', () => {
  let calls = 0;
  const entries = readableEntries([node({ list: [{ text: '+' }] }, {
    readableAction: { label: 'Add power to shelter', activate: () => calls++ },
  })]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, 'Add power to shelter');
  entries[0].activate();
  assert.equal(calls, 1);
});

test('dialogue exposes its complete text before the canvas typewriter finishes', () => {
  assert.deepEqual(readableEntries([node({ text: 'Hel' }, { readableText: 'Hello, astronaut!\nA complete instruction.' })]), [
    { text: 'Hello, astronaut!\nA complete instruction.' },
  ]);
});

test('source link actions remain actionable but passive text and blockers do not', () => {
  const events = [];
  const entries = readableEntries([
    node({ input: { enabled: true }, listenerCount: () => 1 }),
    node({ text: 'NASA source', input: { enabled: true }, listenerCount: () => 1, emit: e => events.push(e) }),
    node({ text: 'Status only', input: { enabled: true }, listenerCount: () => 0 }),
  ]);
  assert.equal(entries.length, 2);
  entries[0].activate();
  assert.deepEqual(events, ['pointerdown']);
  assert.equal(entries[1].activate, undefined);
});

test('choice controls expose both selected and unselected state without using colour', () => {
  const entries = readableEntries([true, false].map(pressed => node({}, {
    readableAction: { label: 'Pet: Cat', pressed, activate() {} },
  })));
  assert.deepEqual(entries.map(entry => entry.pressed), [true, false]);
});
