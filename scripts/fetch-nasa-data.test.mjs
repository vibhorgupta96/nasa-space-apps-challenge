import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  fetchJson,
  normalizeDelay,
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
  GST: [{ gstID: 'gst-1', startTime: '2024-05-10T15:00:00Z', link: 'https://api.nasa.gov/DONKI/GST/view/gst-1', allKpIndex: [{ source: 'NOAA' }] }],
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('normalizes only sourced DONKI records in the historical window and labels scenarios separately', () => {
  const result = normalizeStorms(donki, fetched);
  const events = result.weeks[0].events;
  assert.equal(result.mock, false);
  assert.deepEqual(events.map((event) => event.type), ['CME', 'SEP', 'GST']);
  assert.deepEqual(events.map((event) => event.observedTarget), ['unknown', 'unknown', 'unknown']);
  assert(events.every((event) => event.scenario.label.includes('Simulated') || event.scenario.label.includes('simulated')));
  assert.match(events[2].scenario.label, /Earth geomagnetic/);
  assert.deepEqual(new Set(events.map((event) => event.id)).size, 3);
  assert.equal(result.query.startDate, '2024-05-08');
});

test('rejects DONKI rows outside the sourced dates and malformed response types', () => {
  assert.throws(() => normalizeStorms({ CME: [{ ...donki.CME[0], startTime: '2024-05-07T23:59:59Z' }], SEP: [], GST: [] }, fetched), /no usable/);
  assert.throws(() => normalizeStorms({ CME: {}, SEP: [], GST: [] }, fetched), /must be an array/);
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
    assert.equal(requests, 4);
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
