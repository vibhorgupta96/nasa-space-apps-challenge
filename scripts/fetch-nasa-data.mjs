#!/usr/bin/env node

/**
 * Build the committed, historical NASA data snapshots used by Sprout Station.
 * This file is a Node-only build tool; importing it makes no network requests.
 */

import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'public', 'data');
const DAY_MS = 86_400_000;
const LIGHT_KM_PER_SECOND = 299_792.458;
const DEFAULT_API_KEY = 'DEMO_KEY';
const ATTEMPTS = 3;
const TIMEOUT_MS = 12_000;

export const DATASETS = ['storms', 'weather', 'crops', 'delay', 'photos'];
const SELECTABLE_DATASETS = [...DATASETS, 'trivia'];

const NASA_SOURCES = {
  storms: [
    'https://api.nasa.gov/DONKI/CME',
    'https://api.nasa.gov/DONKI/SEP',
    'https://api.nasa.gov/DONKI/GST',
    'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    'https://ccmc.gsfc.nasa.gov/DONKI/guide/data-reference/',
  ],
  weather: [
    'https://api.nasa.gov/insight_weather/',
    'https://mars.nasa.gov/insight/weather/',
  ],
  crops: [
    'https://osdr.nasa.gov/osdr/data/search?term=plants',
    'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/',
    'https://www.nasa.gov/image-article/mizuna-mustard-greens-are-growing-aboard-international-space-station-2/',
    'https://www.nasa.gov/missions/station/astronauts-harvest-radish-crop-on-international-space-station/',
    'https://www.nasa.gov/missions/station/iss-research/chile-peppers-start-spicing-up-the-space-station/',
    'https://www.nasa.gov/missions/station/nasas-second-pepper-harvest-sets-record-on-space-station/',
    'https://www.nasa.gov/gallery/plants/',
  ],
  delay: 'https://ssd.jpl.nasa.gov/api/horizons.api',
  photos: 'https://images-api.nasa.gov/search',
};

const CROP_FACTS = [
  {
    id: 'red-romaine', name: 'Red Romaine Lettuce', growSols: 3, food: 18, color: '#b8344a',
    fact: 'Astronauts grew and ate red romaine lettuce on the space station.',
    factSource: 'https://www.nasa.gov/missions/station/iss-research/chile-peppers-start-spicing-up-the-space-station/',
  },
  {
    id: 'mizuna', name: 'Mizuna Greens', growSols: 3, food: 15, color: '#5fae4a',
    fact: 'Astronauts grew, harvested, and ate mizuna mustard greens on the space station.',
    factSource: 'https://www.nasa.gov/image-article/mizuna-mustard-greens-are-growing-aboard-international-space-station-2/',
  },
  {
    id: 'radish', name: 'Radish', growSols: 4, food: 24, color: '#d4486a',
    fact: 'Radishes grew in the space station’s Advanced Plant Habitat.',
    factSource: 'https://www.nasa.gov/missions/station/astronauts-harvest-radish-crop-on-international-space-station/',
  },
  {
    id: 'chile', name: 'Chile Pepper', growSols: 5, food: 32, color: '#e0512b',
    fact: 'Astronauts harvested 26 chile peppers from four Space Station plants and sampled some of them.',
    factSource: 'https://www.nasa.gov/missions/station/nasas-second-pepper-harvest-sets-record-on-space-station/',
  },
  {
    id: 'zinnia', name: 'Zinnia', growSols: 3, food: 0, color: '#f0a630',
    fact: 'NASA’s Veggie garden grew zinnia flowers on the space station.',
    factSource: 'https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/',
  },
];

const finite = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

function requireDate(date) {
  const timestamp = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(`${date}T00:00:00Z`)
    : Number.NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid date: ${date}; expected YYYY-MM-DD`);
  }
  return date;
}

function dateStamp(date) {
  return Date.parse(`${requireDate(date)}T00:00:00Z`);
}

function dataFile(fetched, source, payload) {
  return { source, fetched, mock: false, ...payload };
}

function getObservationTime(record, type) {
  return type === 'SEP' ? record.eventTime : record.startTime;
}

function getRecordId(record, type) {
  return type === 'SEP' ? record.sepID : type === 'GST' ? record.gstID : record.activityID;
}

function recordLink(record, type) {
  if (typeof record.link === 'string' && /^https:\/\//.test(record.link)) return record.link;
  return null;
}

function observationSummary(record, type) {
  if (type === 'CME') {
    return {
      instruments: Array.isArray(record.instruments) ? record.instruments.map((item) => item.displayName).filter(Boolean) : [],
    };
  }
  if (type === 'SEP') {
    return {
      instruments: Array.isArray(record.instruments) ? record.instruments.map((item) => item.displayName).filter(Boolean) : [],
      linkedEvents: Array.isArray(record.linkedEvents) ? record.linkedEvents.map((item) => item.activityID).filter(Boolean) : [],
    };
  }
  return {
    source: Array.isArray(record.allKpIndex) ? record.allKpIndex.map((item) => item.source).filter(Boolean) : [],
    kpIndexCount: Array.isArray(record.allKpIndex) ? record.allKpIndex.length : 0,
  };
}

/** Historical windows replayed as storm weeks. Each new mission rotates to the next one. */
export const STORM_WEEKS = [
  { id: '2024-05', label: 'May 2024 historical scenario', start: '2024-05-08', end: '2024-05-14' },
  { id: '2024-10', label: 'October 2024 historical scenario', start: '2024-10-03', end: '2024-10-10' },
  { id: '2017-09', label: 'September 2017 historical scenario', start: '2017-09-04', end: '2017-09-10' },
];

function inWindow(time, week) {
  const at = Date.parse(time);
  return Number.isFinite(at) && at >= Date.parse(`${week.start}T00:00:00Z`) && at < Date.parse(`${week.end}T00:00:00Z`) + 86_400_000;
}

function usable(records, type, week) {
  if (!Array.isArray(records)) throw new Error(`DONKI ${type} response must be an array`);
  return records
    .filter((record) => record && typeof getRecordId(record, type) === 'string' && typeof getObservationTime(record, type) === 'string'
      && recordLink(record, type) && inWindow(getObservationTime(record, type), week))
    .sort((a, b) => getObservationTime(a, type).localeCompare(getObservationTime(b, type)));
}

function maxKp(record) {
  const values = Array.isArray(record.allKpIndex) ? record.allKpIndex.map((item) => finite(item?.kpIndex)).filter((v) => v !== null) : [];
  return values.length ? Math.max(...values) : null;
}

/**
 * Convert DONKI responses into storm weeks. Only CME and SEP records become outpost storm
 * scenarios; GST records are Earth geomagnetic storms and stay as Earth context (PLAN.md 4C).
 * `responsesByWeek` maps a STORM_WEEKS id to `{ CME, SEP, GST }` response arrays.
 */
export function normalizeStorms(responsesByWeek, fetched, weeks = STORM_WEEKS) {
  const out = [];
  for (const week of weeks) {
    const responses = responsesByWeek[week.id];
    if (!responses) continue;
    const cmes = usable(responses.CME, 'CME', week).map((record) => ({ type: 'CME', record }));
    const seps = usable(responses.SEP, 'SEP', week).map((record) => ({ type: 'SEP', record }));
    const gsts = usable(responses.GST ?? [], 'GST', week);
    // Up to three storms: the first CME and first SEP, then the next earliest of either.
    const picked = [cmes[0], seps[0]].filter(Boolean);
    const rest = [...cmes.slice(1), ...seps.slice(1)]
      .sort((a, b) => getObservationTime(a.record, a.type).localeCompare(getObservationTime(b.record, b.type)));
    while (picked.length < 3 && rest.length) picked.push(rest.shift());
    picked.sort((a, b) => getObservationTime(a.record, a.type).localeCompare(getObservationTime(b.record, b.type)));
    if (picked.length === 0) continue;
    if (new Set(picked.map(({ type, record }) => getRecordId(record, type))).size !== picked.length) {
      throw new Error('DONKI returned duplicate source record IDs');
    }
    const events = picked.map(({ type, record }, index) => ({
      id: getRecordId(record, type),
      type,
      realTime: getObservationTime(record, type),
      link: recordLink(record, type),
      observedTarget: 'unknown',
      marsArrival: null,
      observation: observationSummary(record, type),
      scenario: {
        strength: [3, 2, 1][index],
        gameSol: [3, 6, 9][index],
        hitOffsetMs: 60_000,
        warningSols: 2,
        label: 'Simulated Mars-outpost effect (game scenario, not a measured Mars impact)',
      },
    }));
    const earthContext = gsts
      .map((record) => ({ id: getRecordId(record, 'GST'), startTime: getObservationTime(record, 'GST'), maxKp: maxKp(record), link: recordLink(record, 'GST') }))
      .filter((g) => g.maxKp !== null);
    out.push({ id: week.id, label: week.label, realWindow: [week.start, week.end], events, earthContext });
  }
  if (!out.some((week) => week.id === '2024-05')) throw new Error('DONKI returned no usable CME or SEP records for May 8–14, 2024');
  return dataFile(fetched, NASA_SOURCES.storms, {
    query: { weeks: weeks.map(({ id, start, end }) => ({ id, startDate: start, endDate: end })), types: ['CME', 'SEP', 'GST'] },
    weeks: out,
  });
}

/** Parse archived InSight API `sol_keys`, `AT`, and `HWS` values. */
export function normalizeWeather(response, fetched) {
  if (!response || !Array.isArray(response.sol_keys)) throw new Error('InSight response has no sol_keys array');
  const sols = response.sol_keys.map((sol) => {
    const reading = response[sol];
    if (!reading || typeof reading !== 'object') return null;
    const minC = finite(reading.AT?.mn);
    const maxC = finite(reading.AT?.mx);
    const earthDate = typeof reading.First_UTC === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(reading.First_UTC)
      ? reading.First_UTC.slice(0, 10)
      : null;
    if (minC === null || maxC === null || !earthDate || minC > maxC) return null;
    const windAvg = finite(reading.HWS?.av);
    return { marsSol: Number(sol), earthDate, minC, maxC, windAvg };
  }).filter((row) => row && Number.isInteger(row.marsSol)).sort((a, b) => a.marsSol - b.marsSol);
  if (sols.length === 0) throw new Error('InSight returned no sols with valid minimum and maximum temperatures');
  return dataFile(fetched, NASA_SOURCES.weather, { sols });
}

/** Parse JPL Horizons VECTORS output in KM-S; values in the state vector are X/Y/Z km. */
export function parseHorizonsDistance(response) {
  if (!response || typeof response.result !== 'string') throw new Error('Horizons response has no result text');
  if (response.error) throw new Error('Horizons reported an error');
  const result = response.result;
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start < 0 || end < start) throw new Error('Horizons response has no ephemeris data row');
  const row = result.slice(start + 5, end).trim().split(/\r?\n/)[0];
  const fields = row.split(',').map((field) => field.trim());
  // CSV columns are JD, calendar label, X, Y, Z, VX, VY, VZ.
  const julianDate = finite(fields[0]);
  const x = finite(fields[2]);
  const y = finite(fields[3]);
  const z = finite(fields[4]);
  if (julianDate === null || x === null || y === null || z === null) throw new Error('Horizons ephemeris row has invalid distance fields');
  const distanceKm = Math.hypot(x, y, z);
  const oneWayMinutes = (distanceKm / LIGHT_KM_PER_SECOND) / 60;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(oneWayMinutes)) throw new Error('Horizons distance is not positive and finite');
  return { julianDate, epochLabel: fields[1], distanceKm, oneWayMinutes };
}

export function normalizeDelay(response, date, fetched) {
  const parsed = parseHorizonsDistance(response);
  return dataFile(fetched, NASA_SOURCES.delay, {
    date,
    epoch: { julianDate: parsed.julianDate, label: parsed.epochLabel, timeScale: 'TDB' },
    referenceFrame: 'ICRF',
    query: { target: '499 (Mars)', center: '500@399 (Earth geocenter)', ephemeris: 'VECTORS', units: 'KM-S', vectorTable: 2 },
    distanceKm: parsed.distanceKm,
    oneWayMinutes: parsed.oneWayMinutes,
  });
}

/** Choose only NASA image search results with a usable NASA image URL and metadata credit. */
export function normalizePhotos(response, fetched) {
  const items = response?.collection?.items;
  if (!Array.isArray(items)) throw new Error('NASA Image Library response has no collection items');
  const photos = [];
  const ids = new Set();
  for (const item of items) {
    const metadata = item?.data?.[0];
    if (!metadata || metadata.media_type !== 'image' || typeof metadata.nasa_id !== 'string' || ids.has(metadata.nasa_id)) continue;
    const image = Array.isArray(item.links) ? item.links.find((link) => typeof link.href === 'string' && /^https:\/\/images-assets\.nasa\.gov\//.test(link.href)) : null;
    if (!image) continue;
    const credit = metadata.photographer || metadata.secondary_creator || (metadata.center ? `NASA/${metadata.center}` : null);
    if (!credit) continue;
    ids.add(metadata.nasa_id);
    photos.push({
      nasaId: metadata.nasa_id,
      title: metadata.title || 'Mars image',
      url: image.href,
      credit,
      source: metadata.url || `https://images.nasa.gov/details/${encodeURIComponent(metadata.nasa_id)}`,
    });
    if (photos.length === 6) break;
  }
  if (photos.length === 0) throw new Error('NASA Image Library returned no usable credited Mars images');
  return dataFile(fetched, [
    'https://images-api.nasa.gov/search?q=Mars+rover+rock&media_type=image&page_size=20',
    'https://images-api.nasa.gov/search?q=Mars+surface&media_type=image&page_size=20',
  ], { photos });
}

export function normalizeCrops(fetched, osdrResultCount) {
  return dataFile(fetched, NASA_SOURCES.crops, {
    osdrSearch: { query: 'plants', resultCount: osdrResultCount },
    crops: CROP_FACTS,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(error, secret) {
  let message = String(error?.message || error || 'request failed');
  if (secret) message = message.split(secret).join('[redacted]');
  return message.replace(/([?&]api_key=)[^&\s]+/gi, '$1[redacted]').replace(/\s+/g, ' ').slice(0, 240);
}

/** Fetch JSON with bounded timeouts and retries, while never returning a credential-bearing URL. */
export async function fetchJson(url, {
  fetchImpl = globalThis.fetch,
  attempts = ATTEMPTS,
  timeoutMs = TIMEOUT_MS,
  apiKey,
  sleepImpl = sleep,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Node fetch is unavailable');
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error?.retryable === false || (error?.message?.startsWith('HTTP ') && !error.retryable)) break;
      if (attempt < attempts) await sleepImpl(250 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`NASA data request failed: ${safeError(lastError, apiKey)}`);
}

function endpoint(url, query = {}) {
  const result = new URL(url);
  for (const [key, value] of Object.entries(query)) result.searchParams.set(key, String(value));
  return result;
}

async function fetchPage(url, { fetchImpl = globalThis.fetch, attempts = ATTEMPTS, timeoutMs = TIMEOUT_MS, sleepImpl = sleep } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'text/html' } });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (error?.retryable === false || (error?.message?.startsWith('HTTP ') && !error.retryable)) break;
      if (attempt < attempts) await sleepImpl(250 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`NASA source page request failed: ${safeError(lastError)}`);
}

function visibleText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').toLowerCase();
}

async function verifyCropSources(fetchImpl) {
  const checks = [
    ['https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/', ['zinnia', 'veggie']],
    ['https://www.nasa.gov/image-article/mizuna-mustard-greens-are-growing-aboard-international-space-station-2/', ['mizuna mustard greens', 'harvested']],
    ['https://www.nasa.gov/missions/station/astronauts-harvest-radish-crop-on-international-space-station/', ['radish', 'advanced plant habitat']],
    ['https://www.nasa.gov/missions/station/iss-research/chile-peppers-start-spicing-up-the-space-station/', ['hatch', 'advanced plant habitat']],
    ['https://www.nasa.gov/missions/station/nasas-second-pepper-harvest-sets-record-on-space-station/', ['harvested', 'sampled', '26 chile peppers', 'four plants']],
    ['https://www.nasa.gov/gallery/plants/', ['red romaine', 'radish plants']],
  ];
  for (const [url, phrases] of checks) {
    const text = visibleText(await fetchPage(url, { fetchImpl }));
    if (phrases.some((phrase) => !text.includes(phrase))) throw new Error(`NASA crop source no longer confirms expected wording: ${new URL(url).pathname}`);
  }
}

function createCropsApiUrl() {
  return 'https://osdr.nasa.gov/osdr/data/search?term=plants';
}

function addKey(url, apiKey) {
  const result = new URL(url);
  result.searchParams.set('api_key', apiKey);
  return result;
}

async function readApiKey() {
  if (process.env.NASA_API_KEY?.trim()) return process.env.NASA_API_KEY.trim();
  // The plan expects .env. This parser reads it without creating or modifying it.
  try {
    const contents = await readFile(path.join(ROOT, '.env'), 'utf8');
    const line = contents.split(/\r?\n/).find((item) => /^\s*NASA_API_KEY\s*=/.test(item));
    const value = line?.replace(/^\s*NASA_API_KEY\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  } catch {
    // No .env is expected in a clean checkout.
  }
  return DEFAULT_API_KEY;
}

async function fetchStorms(apiKey, fetched, fetchImpl) {
  const responsesByWeek = {};
  for (const week of STORM_WEEKS) {
    const params = { startDate: week.start, endDate: week.end };
    responsesByWeek[week.id] = {};
    for (const type of ['CME', 'SEP', 'GST']) {
      const url = addKey(endpoint(`https://api.nasa.gov/DONKI/${type}`, params), apiKey);
      responsesByWeek[week.id][type] = await fetchJson(url, { fetchImpl, apiKey });
    }
  }
  return normalizeStorms(responsesByWeek, fetched);
}

async function fetchWeather(apiKey, fetched, fetchImpl) {
  const url = addKey(endpoint('https://api.nasa.gov/insight_weather/', { feedtype: 'json', ver: '1.0' }), apiKey);
  return normalizeWeather(await fetchJson(url, { fetchImpl, apiKey }), fetched);
}

async function fetchCrops(fetched, fetchImpl) {
  // OSDR is a research catalogue reference; each kid-facing fact is validated against its linked NASA article.
  const response = await fetchJson(new URL(createCropsApiUrl()), { fetchImpl });
  const hits = response?.hits?.total;
  if (!Number.isFinite(Number(hits)) || !Array.isArray(response?.hits?.hits)) {
    throw new Error('OSDR plant search response has an unexpected shape');
  }
  await verifyCropSources(fetchImpl);
  return normalizeCrops(fetched, Number(hits));
}

async function fetchDelay(date, fetched, fetchImpl) {
  const nextDate = new Date(dateStamp(date) + DAY_MS).toISOString().slice(0, 10);
  const url = endpoint(NASA_SOURCES.delay, {
    format: 'json', COMMAND: '499', CENTER: '500@399', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
    START_TIME: date, STOP_TIME: nextDate, STEP_SIZE: '1d', OUT_UNITS: 'KM-S', VEC_TABLE: '2', CSV_FORMAT: 'YES',
  });
  return normalizeDelay(await fetchJson(url, { fetchImpl }), date, fetched);
}

async function fetchPhotos(fetchImpl, fetched) {
  const results = [];
  for (const term of ['Mars rover rock', 'Mars surface']) {
    const url = endpoint(NASA_SOURCES.photos, { q: term, media_type: 'image', page_size: 20 });
    const response = await fetchJson(url, { fetchImpl });
    if (!Array.isArray(response?.collection?.items)) throw new Error('NASA Image Library returned an invalid collection');
    results.push(...response.collection.items);
  }
  return normalizePhotos({ collection: { items: results } }, fetched);
}

// Refresh metadata for the existing curated trivia; checking an ID does not verify its fact.
async function fetchTrivia(fetched, fetchImpl, triviaPath) {
  const existing = JSON.parse(await readFile(triviaPath, 'utf8'));
  if (existing.mock !== false || !Array.isArray(existing.trivia) || !existing.trivia.length) {
    throw new Error('Existing trivia must be a non-mock curated collection');
  }
  const trivia = [];
  for (const record of existing.trivia) {
    if (typeof record.nasaId !== 'string' || !record.nasaId || typeof record.fact !== 'string') {
      throw new Error('Existing trivia record lacks NASA ID or fact');
    }
    const url = endpoint(NASA_SOURCES.photos, { nasa_id: record.nasaId });
    const response = await fetchJson(url, { fetchImpl });
    const metadata = response?.collection?.items?.flatMap((item) => item.data || [])
      .find((item) => item.nasa_id === record.nasaId);
    if (!metadata || typeof metadata.title !== 'string') throw new Error(`NASA trivia record not found: ${record.nasaId}`);
    trivia.push({ ...record, sourceTitle: metadata.title, sourceDate: metadata.date_created?.slice(0, 10) || record.sourceDate });
  }
  return { ...existing, fetched, trivia };
}

export function parseArgs(args) {
  const options = { date: null, outputDir: DEFAULT_OUTPUT_DIR, only: DATASETS, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--date') {
      options.date = args[++index];
      if (!options.date || options.date.startsWith('--')) throw new Error('--date requires a YYYY-MM-DD value');
    } else if (arg === '--output-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--output-dir requires a directory');
      options.outputDir = path.resolve(value);
    }
    else if (arg === '--only') {
      const names = (args[++index] || '').split(',').map((name) => name.trim()).filter(Boolean);
      if (names.length === 0 || names.some((name) => !SELECTABLE_DATASETS.includes(name))) throw new Error(`--only must be a comma-separated list of: ${SELECTABLE_DATASETS.join(', ')}`);
      options.only = [...new Set(names)];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.date) requireDate(options.date);
  return options;
}

export const HELP = `Usage: node scripts/fetch-nasa-data.mjs [options]

Fetch historical and current NASA data into public/data/*.json.
Options:
  --date YYYY-MM-DD       Horizons snapshot date (defaults to current UTC date)
  --only names            Comma-separated subset: ${SELECTABLE_DATASETS.join(', ')}
  --output-dir directory  Write files to another directory for review
  --help                  Show this help

Set NASA_API_KEY in the environment (or an existing, ignored .env file).
Without a key, NASA's shared DEMO_KEY is used and may be rate limited.
This script runs in Node at build time; the browser does not call NASA APIs.
`;

async function writeOutputs(outputDir, outputs) {
  await mkdir(outputDir, { recursive: true });
  const staged = [];
  try {
    for (const [name, data] of Object.entries(outputs)) {
      const destination = path.join(outputDir, `${name}.json`);
      const temporary = path.join(outputDir, `.${name}.${process.pid}.${Date.now()}.tmp`);
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      staged.push({ temporary, destination });
    }
    for (const file of staged) await rename(file.temporary, file.destination);
  } catch (error) {
    await Promise.all(staged.map(({ temporary }) => unlink(temporary).catch(() => {})));
    throw error;
  }
}

export async function run(options, {
  fetchImpl = globalThis.fetch,
  apiKey,
  now = () => new Date(),
  logger = console,
  triviaPath = path.join(DEFAULT_OUTPUT_DIR, 'trivia.json'),
} = {}) {
  const date = requireDate(options.date || now().toISOString().slice(0, 10));
  const fetched = requireDate(now().toISOString().slice(0, 10));
  const key = apiKey || await readApiKey();
  const fetchers = {
    storms: () => fetchStorms(key, fetched, fetchImpl),
    weather: () => fetchWeather(key, fetched, fetchImpl),
    crops: () => fetchCrops(fetched, fetchImpl),
    delay: () => fetchDelay(date, fetched, fetchImpl),
    photos: () => fetchPhotos(fetchImpl, fetched),
    trivia: () => fetchTrivia(fetched, fetchImpl, triviaPath),
  };
  const outputs = {};
  for (const name of options.only) {
    logger.log(`Fetching ${name}...`);
    outputs[name] = await fetchers[name]();
    if (outputs[name].mock !== false) throw new Error(`${name} did not produce a verified non-mock dataset`);
  }
  await writeOutputs(options.outputDir, outputs);
  logger.log(`Wrote ${Object.keys(outputs).join(', ')} to ${options.outputDir}`);
  return outputs;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(HELP);
    return;
  }
  await run(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Data fetch failed: ${safeError(error, process.env.NASA_API_KEY)}`);
    process.exitCode = 1;
  });
}
