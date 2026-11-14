import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  fetchJson,
  normalizeDelay,
  normalizeCrops,
  normalizePhotos,
  normalizeStorms,
  normalizeWeather,
  parseArgs,
  run,
} from './fetch-nasa-data.mjs';

const fetched = '2026-11-14';
const donki = {
  CME: [{ activityID: 'cme-1', startTime: '2024-05-08T05:36:00Z', link: 'https://api.nasa.gov/DONKI/CME/view/cme-1', instruments: [{ displayName: 'SOHO' }] }],
  SEP: [{ sepID: 'sep-1', eventTime: '2024-05-09T13:59:00Z', link: 'https://api.nasa.gov/DONKI/SEP/view/sep-1', instruments: [{ displayName: 'ACE' }] }],
  GST: [{ gstID: 'gst-1', startTime: '2024-05-10T15:00:00Z', link: 'https://api.nasa.gov/DONKI/GST/view/gst-1', allKpIndex: [{ source: 'NOAA', kpIndex: 9 }] }],
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('normalizes only sourced DONKI records in the historical window and labels scenarios separately', () => {
  const result = normalizeStorms({ '2024-05': donki }, fetched);
  const week = result.weeks[0];
  const events = week.events;
  assert.equal(result.mock, false);
  assert.deepEqual(events.map((event) => event.type), ['CME', 'SEP']);
  assert.deepEqual(events.map((event) => event.observedTarget), ['unknown', 'unknown']);
  assert(events.every((event) => /simulated/i.test(event.scenario.label)));
  assert.equal(new Set(events.map((event) => event.id)).size, 2);
  assert.deepEqual(week.realWindow, ['2024-05-08', '2024-05-14']);
  assert.deepEqual(week.earthContext, [{ id: 'gst-1', startTime: '2024-05-10T15:00:00Z', maxKp: 9, link: 'https://api.nasa.gov/DONKI/GST/view/gst-1' }]);
  assert(events.every((event) => event.marsArrival === null));
});

test('GST records never become outpost storms, and several weeks are kept', () => {
  const october = {
    CME: [
      { activityID: 'cme-oct-1', startTime: '2024-10-03T12:48:00Z', link: 'https://api.nasa.gov/DONKI/CME/view/cme-oct-1' },
      { activityID: 'cme-oct-2', startTime: '2024-10-09T01:48:00Z', link: 'https://api.nasa.gov/DONKI/CME/view/cme-oct-2' },
    ],
    SEP: [],
    GST: [{ gstID: 'gst-oct', startTime: '2024-10-10T15:00:00Z', link: 'https://api.nasa.gov/DONKI/GST/view/gst-oct', allKpIndex: [{ kpIndex: 8.67 }] }],
  };
  const result = normalizeStorms({ '2024-05': donki, '2024-10': october }, fetched);
  assert.deepEqual(result.weeks.map((week) => week.id), ['2024-05', '2024-10']);
  assert(result.weeks.every((week) => week.events.every((event) => event.type !== 'GST')));
  assert.deepEqual(result.weeks[1].events.map((event) => [event.id, event.scenario.gameSol, event.scenario.strength]), [['cme-oct-1', 3, 3], ['cme-oct-2', 6, 2]]);
  assert.equal(result.weeks[1].earthContext[0].maxKp, 8.67);
});

test('crops retain the existing game IDs, colors, and balance values', () => {
  const crops = normalizeCrops(fetched, 1).crops;
  assert.deepEqual(crops.map(({ id, color, growSols, food }) => ({ id, color, growSols, food })), [
    { id: 'red-romaine', color: '#b8344a', growSols: 3, food: 18 },
    { id: 'mizuna', color: '#5fae4a', growSols: 3, food: 15 },
    { id: 'radish', color: '#d4486a', growSols: 4, food: 24 },
    { id: 'chile', color: '#e0512b', growSols: 5, food: 32 },
    { id: 'zinnia', color: '#f0a630', growSols: 3, food: 0 },
  ]);
  const chile = crops.find((crop) => crop.id === 'chile');
  assert.equal(chile.factSource, 'https://www.nasa.gov/missions/station/nasas-second-pepper-harvest-sets-record-on-space-station/');
  assert.match(chile.fact, /harvested 26 chile peppers from four Space Station plants and sampled some/i);
});

test('rejects DONKI rows outside the sourced dates and malformed response types', () => {
  assert.throws(() => normalizeStorms({ '2024-05': { CME: [{ ...donki.CME[0], startTime: '2024-05-07T23:59:59Z' }], SEP: [], GST: [] } }, fetched), /no usable/);
  assert.throws(() => normalizeStorms({ '2024-05': { CME: {}, SEP: [], GST: [] } }, fetched), /must be an array/);
  assert.throws(() => normalizeStorms({ '2024-05': { CME: [], SEP: [], GST: donki.GST } }, fetched), /no usable/);
});

test('normalizes InSight readings with each row’s own UTC date and rejects null temperatures', () => {
  const result = normalizeWeather({
    sol_keys: ['675', '676'],
    '675': { First_UTC: '2020-10-19T18:32:20Z', AT: { mn: -96.872, mx: -15.908 }, HWS: { av: 7.233 } },
    '676': { First_UTC: '2020-10-20T18:00:00Z', AT: { mn: null, mx: 0 }, HWS: { av: null } },
  }, fetched);
  assert.equal(result.sols.length, 1);
  assert.deepEqual(result.sols[0], { marsSol: 675, earthDate: '2020-10-19', minC: -96.872, maxC: -15.908, windAvg: 7.233 });
  assert.throws(() => normalizeWeather({ sol_keys: ['1'], '1': { AT: { mn: null, mx: -2 } } }, fetched), /no sols/);
});

test('normalizes Horizons state-vector coordinates into a light-time estimate', () => {
  const source = { result: 'header\n$$SOE\n2461358.500000000, A.D. 2026-Nov-14 00:00:00.0000, -1.612029464424884E+08, 1.150120527989074E+08,6.517832011875279E+06, 0,0,0\n$$EOE\nfooter' };
  const result = normalizeDelay(source, fetched, fetched);
  assert.equal(result.mock, false);
  assert.equal(result.date, fetched);
  assert.equal(result.epoch.timeScale, 'TDB');
  assert.equal(result.referenceFrame, 'ICRF');
  assert(result.distanceKm > 190_000_000 && result.distanceKm < 200_000_000);
  assert(Math.abs(result.oneWayMinutes - result.distanceKm / 299_792.458 / 60) < 1e-12);
  assert.throws(() => normalizeDelay({ result: 'no row' }, fetched, fetched), /no ephemeris/);
});

test('only keeps NASA images that have an image URL and explicit credit metadata', () => {
  const response = { collection: { items: [
    { data: [{ media_type: 'image', nasa_id: 'no-credit', title: 'Mars' }], links: [{ href: 'https://images-assets.nasa.gov/image/a/a.jpg' }] },
    { data: [{ media_type: 'image', nasa_id: 'mars-1', title: 'Mars rock', center: 'JPL' }], links: [{ href: 'https://images-assets.nasa.gov/image/b/b~medium.jpg' }] },
  ] } };
  const result = normalizePhotos(response, fetched);
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0].credit, 'NASA/JPL');
  assert.equal(result.photos[0].nasaId, 'mars-1');
});

test('retries a temporary server error and redacts NASA credentials from errors', async () => {
  let calls = 0;
  const result = await fetchJson('https://api.nasa.gov/path?api_key=super-secret', {
    apiKey: 'super-secret', attempts: 2, sleepImpl: async () => {},
    fetchImpl: async () => (++calls === 1 ? jsonResponse({}, 503) : jsonResponse({ okay: true })),
  });
  assert.deepEqual(result, { okay: true });
  assert.equal(calls, 2);
  await assert.rejects(fetchJson('https://api.nasa.gov/path?api_key=super-secret', {
    apiKey: 'super-secret', attempts: 1,
    fetchImpl: async () => { throw new Error('failed https://api.nasa.gov/path?api_key=super-secret'); },
  }), (error) => !error.message.includes('super-secret') && error.message.includes('[redacted]'));
});

test('rejects invalid or incomplete CLI options', () => {
  assert.throws(() => parseArgs(['--date']), /requires/);
  assert.throws(() => parseArgs(['--date', '2026-02-31']), /Invalid date/);
  assert.throws(() => parseArgs(['--output-dir']), /requires/);
  assert.throws(() => parseArgs(['--only', 'terrain']), /--only/);
  assert.equal(parseArgs(['--only', 'storms,weather']).only.length, 2);
});

test('does not replace existing files when one requested data source fails', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sol-sprouts-'));
  const stormsPath = path.join(directory, 'storms.json');
  const weatherPath = path.join(directory, 'weather.json');
  await writeFile(stormsPath, '{"mock":true,"preserve":"storms"}\n');
  await writeFile(weatherPath, '{"mock":true,"preserve":"weather"}\n');
  let requests = 0;
  const fetchImpl = async (request) => {
    requests += 1;
    const url = new URL(request);
    if (url.pathname.includes('/DONKI/')) return jsonResponse(donki[url.pathname.split('/').at(-1)]);
    return jsonResponse({ message: 'not authorized' }, 403);
  };
  try {
    await assert.rejects(run({ date: fetched, outputDir: directory, only: ['storms', 'weather'] }, {
      apiKey: 'test-key', fetchImpl, now: () => new Date('2026-11-14T12:00:00Z'), logger: { log() {} },
    }), /HTTP 403/);
    assert.equal(requests, 3 * 3 + 1); // three storm weeks × CME/SEP/GST, then the failing weather call
    assert.equal(await readFile(stormsPath, 'utf8'), '{"mock":true,"preserve":"storms"}\n');
    assert.equal(await readFile(weatherPath, 'utf8'), '{"mock":true,"preserve":"weather"}\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('does not replace crop data when a NASA fact page no longer confirms its wording', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sol-sprouts-crops-'));
  const cropsPath = path.join(directory, 'crops.json');
  const original = '{"mock":true,"preserve":"crops"}\n';
  await writeFile(cropsPath, original);
  let requests = 0;
  const fetchImpl = async (request) => {
    requests += 1;
    if (String(request).includes('/osdr/data/search')) return jsonResponse({ hits: { total: 1, hits: [{}] } });
    return new Response('<html><body>NASA article content changed.</body></html>', { status: 200 });
  };
  try {
    await assert.rejects(run({ date: fetched, outputDir: directory, only: ['crops'] }, {
      apiKey: 'test-key', fetchImpl, now: () => new Date('2026-11-14T12:00:00Z'), logger: { log() {} },
    }), /no longer confirms/);
    assert.equal(requests, 2);
    assert.equal(await readFile(cropsPath, 'utf8'), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fetches crops when NASA source pages confirm the curated claims', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sol-sprouts-crops-success-'));
  const pages = new Map([
    ['/exploration-research-and-technology/growing-plants-in-space/', 'Veggie is NASA\'s space garden. Zinnia flowers grow in Veggie.'],
    ['/image-article/mizuna-mustard-greens-are-growing-aboard-international-space-station-2/', 'Mizuna mustard greens were harvested aboard the station.'],
    ['/missions/station/astronauts-harvest-radish-crop-on-international-space-station/', 'Radish plants grew in the Advanced Plant Habitat.'],
    ['/missions/station/iss-research/chile-peppers-start-spicing-up-the-space-station/', 'Hatch chile peppers grew in the Advanced Plant Habitat.'],
    ['/missions/station/nasas-second-pepper-harvest-sets-record-on-space-station/', 'The crew harvested and with other members of the crew sampled some of the 26 chile peppers from four plants.'],
    ['/gallery/plants/', 'Red romaine and radish plants.'],
  ]);
  const fetchImpl = async (request) => {
    const url = new URL(request);
    if (url.pathname === '/osdr/data/search') return jsonResponse({ hits: { total: 12, hits: [{}] } });
    const content = pages.get(url.pathname);
    return content
      ? new Response(`<html><body><article><p>${content}</p></article></body></html>`, { status: 200 })
      : new Response('Not found', { status: 404 });
  };
  try {
    const output = await run({ date: fetched, outputDir: directory, only: ['crops'] }, {
      fetchImpl, now: () => new Date('2026-11-14T12:00:00Z'), logger: { log() {} },
    });
    assert.equal(output.crops.mock, false);
    const chile = output.crops.crops.find((crop) => crop.id === 'chile');
    assert.equal(chile.fact, 'Astronauts harvested 26 chile peppers from four Space Station plants and sampled some of them.');
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'crops.json'), 'utf8')), output.crops);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('records actual fetch date separately from a historical Horizons query date', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sol-sprouts-delay-'));
  let requestedUrl;
  const fetchImpl = async (request) => {
    requestedUrl = new URL(request);
    return jsonResponse({ result: 'header\n$$SOE\n2461358.500000000, A.D. 2026-Nov-14 00:00:00.0000, 1.0E+08, 1.0E+08, 0, 0, 0, 0\n$$EOE' });
  };
  try {
    await run({ date: '2026-11-14', outputDir: directory, only: ['delay'] }, {
      fetchImpl, now: () => new Date('2026-11-15T01:00:00Z'), logger: { log() {} },
    });
    const output = JSON.parse(await readFile(path.join(directory, 'delay.json'), 'utf8'));
    assert.equal(requestedUrl.searchParams.get('START_TIME'), '2026-11-14');
    assert.equal(output.date, '2026-11-14');
    assert.equal(output.fetched, '2026-11-15');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('optional trivia refresh preserves curated facts while checking NASA metadata', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sol-sprouts-trivia-'));
  const input = path.join(directory, 'curated.json');
  const original = { source: ['https://images.nasa.gov/details/PIA1'], fetched: '2020-01-01', mock: false,
    trivia: [{ id: 'one', nasaId: 'PIA1', fact: 'Curated fact', source: 'https://images.nasa.gov/details/PIA1', sourceTitle: 'Old' }] };
  try {
    await writeFile(input, JSON.stringify(original));
    const fetchImpl = async () => jsonResponse({ collection: { items: [{ data: [{ nasa_id: 'PIA1', title: 'New title', date_created: '2021-02-03T00:00:00Z' }] }] } });
    const output = await run({ date: fetched, outputDir: directory, only: ['trivia'] }, {
      apiKey: 'test-key', triviaPath: input, fetchImpl, now: () => new Date('2026-11-14T12:00:00Z'), logger: { log() {} },
    });
    assert.equal(output.trivia.trivia[0].fact, 'Curated fact');
    assert.equal(output.trivia.trivia[0].sourceTitle, 'New title');
    assert.equal(output.trivia.trivia[0].sourceDate, '2021-02-03');
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'trivia.json'), 'utf8')), output.trivia);
    assert(!parseArgs([]).only.includes('trivia'));
    assert.deepEqual(parseArgs(['--only', 'trivia']).only, ['trivia']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
