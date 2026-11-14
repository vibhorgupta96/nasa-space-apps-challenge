import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BADGES, BADGE_IDS, LESSONS, QUIZ_SOLS, REQUESTS, SCHEDULE,
  astronautTitle, badgeInfoForWorld, lessonFor, lessonsForWorld,
  requestsForWorld, scheduleForWorld,
} from '../src/core/training.ts';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const data = {
  marsScience: await readJson('../public/data/science.json'),
  marsTrivia: await readJson('../public/data/trivia.json'),
  moonScience: await readJson('../public/data/moon/science.json'),
  moonTrivia: await readJson('../public/data/moon/trivia.json'),
  marsCrops: await readJson('../public/data/crops.json'),
  moonCrops: await readJson('../public/data/moon/crops.json'),
};

const factsFor = (worldId) => ({
  science: new Set(data[worldId === 'moon' ? 'moonScience' : 'marsScience'].facts.map((fact) => fact.id)),
  trivia: new Set(data[worldId === 'moon' ? 'moonTrivia' : 'marsTrivia'].trivia.map((fact) => fact.id)),
});

test('each world has ten complete, source-resolvable daily lessons', () => {
  for (const worldId of ['mars', 'moon']) {
    const lessons = lessonsForWorld(worldId);
    const ids = factsFor(worldId);
    assert.equal(lessons.length, 10, `${worldId} lesson count`);
    assert.deepEqual(lessons.map((lesson) => lesson.sol), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const lesson of lessons) {
      assert.equal(new Set(lesson.choices).size, 3, `${worldId} day ${lesson.sol} choices`);
      assert.ok(lesson.answer >= 0 && lesson.answer < lesson.choices.length);
      if (lesson.see.startsWith('science:')) assert.ok(ids.science.has(lesson.see.slice(8)), `${worldId} missing ${lesson.see}`);
      if (lesson.see.startsWith('trivia:')) assert.ok(ids.trivia.has(lesson.see.slice(7)), `${worldId} missing ${lesson.see}`);
    }
  }
  assert.notDeepEqual(lessonsForWorld('moon').map(({ question, choices }) => [question, choices]), lessonsForWorld('mars').map(({ question, choices }) => [question, choices]));
  assert.deepEqual(LESSONS, lessonsForWorld());
  assert.equal(lessonFor(6, 'moon')?.see, 'science:moon-polar-ice');
  assert.equal(lessonFor(6)?.see, 'science:phoenix-ice');
});

test('Moon lessons use lunar facts and correctly label simulated systems', () => {
  const lessons = lessonsForWorld('moon');
  const lessonText = lessons.map((lesson) => `${lesson.goal} ${lesson.tryIt} ${lesson.question} ${lesson.choices.join(' ')}`).join(' ').toLowerCase();
  const moonIds = new Set([...data.moonScience.facts, ...data.moonTrivia.trivia].map((fact) => fact.id));
  for (const marsOnly of ['mars-sol', 'phoenix-ice', 'moxie-oxygen', 'insight-dust']) assert.ok(!moonIds.has(marsOnly));
  assert.match(lessonText, /29\.5/);
  assert.match(lessonText, /1\.3 seconds/);
  assert.match(lessonText, /permanently shadowed/);
  assert.match(lessonText, /next morning/);
  assert.match(lessonText, /game|simulated|shortens|compressed/);
  assert.match(lessons[6].goal, /not MOXIE/i);
});

test('Moon day 2 points to the sourced lunar cycle fact and day 4 explains thermal control', () => {
  const day2 = lessonsForWorld('moon').find((lesson) => lesson.sol === 2);
  assert.equal(day2.see, 'science:moon-cycle');
  const cycleFact = data.moonScience.facts.find((fact) => fact.id === day2.see.slice('science:'.length));
  assert.match(cycleFact.text, /mean solar day.*29\.5 Earth days/i);
  assert.equal(cycleFact.source, 'https://svs.gsfc.nasa.gov/12739/');

  const day4 = lessonsForWorld('moon').find((lesson) => lesson.sol === 4);
  assert.match(day4.tryIt, /thermal control/i);
  assert.match(day4.tryIt, /1 cell in daylight for cooling/i);
  assert.match(day4.tryIt, /2 during the dark stretch for heating/i);
});

test('Moon crew requests use available items and crops that can be harvested in time', () => {
  const requests = requestsForWorld('moon');
  const crops = new Map(data.moonCrops.crops.map((crop) => [crop.id, crop]));
  const inventory = new Set(['water', 'ice', 'regolith', 'seed', 'parts', 'sample']);
  assert.deepEqual(Object.keys(requests).map(Number), [2, 3, 4, 5, 6, 7, 8, 9]);
  for (const [dayText, request] of Object.entries(requests)) {
    const day = Number(dayText);
    if ('item' in request.need) assert.ok(inventory.has(request.need.item), `invalid Moon item ${request.need.item}`);
    else {
      const crop = crops.get(request.need.crop);
      assert.ok(crop, `invalid Moon crop ${request.need.crop}`);
      assert.ok(crop.growSols < day, `${crop.id} cannot be ready by day ${day}`);
    }
    assert.match(request.ask, /Moon|lunar|greenhouse|habitat/i);
  }
  assert.deepEqual(REQUESTS, requestsForWorld());
});

test('world-aware badge, schedule and certificate copy preserves Mars defaults', () => {
  assert.deepEqual(BADGE_IDS, Object.keys(BADGES));
  assert.match(badgeInfoForWorld('oxygen-maker').how, /MOXIE/);
  assert.match(badgeInfoForWorld('oxygen-maker', 'moon').how, /water recycler/);
  assert.match(badgeInfoForWorld('panel-cleaner', 'moon').how, /next morning/);
  assert.equal(scheduleForWorld('moon').map((step) => step.id).join(','), 'farm,exercise,science,sleep');
  assert.match(scheduleForWorld('moon')[2].how, /water oxygen maker/);
  assert.deepEqual(scheduleForWorld(), SCHEDULE);
  assert.deepEqual(QUIZ_SOLS, [1, 3, 5, 6, 7]);
  assert.equal(astronautTitle(22, 0, false).title, 'Mars Mission Commander');
  assert.equal(astronautTitle(22, 0, false, 'moon').title, 'Moon Mission Commander');
});
