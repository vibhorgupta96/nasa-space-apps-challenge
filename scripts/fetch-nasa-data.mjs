// Downloads NASA data once and writes it to public/data/*.json.
//
//   cp .env.example .env    # put your free key from https://api.nasa.gov in it
//   npm run fetch-data
//
// Each output file records "source", "fetched" and "mock". A file is only overwritten
// with mock:false when its real download succeeded; otherwise the existing file is kept.
// Raw responses are cached in scripts/.cache so re-running doesn't burn rate limits.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public/data');
const cacheDir = join(root, 'scripts/.cache');
mkdirSync(cacheDir, { recursive: true });

function loadEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();
const KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const today = new Date().toISOString().slice(0, 10);

async function getJson(url, cacheName) {
  const file = join(cacheDir, `${cacheName}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url.replace(KEY, '***')}: ${text.slice(0, 120)}`);
  const json = JSON.parse(text);
  if (json && json.error) throw new Error(`${url.replace(KEY, '***')}: ${JSON.stringify(json.error).slice(0, 120)}`);
  writeFileSync(file, text);
  return json;
}

function write(name, obj) {
  writeFileSync(join(dataDir, name), JSON.stringify(obj, null, 1) + '\n');
  console.log(`✔ ${name}${obj.mock ? ' (mock)' : ''}`);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`✘ ${name}: ${err.message} — keeping existing file`);
  }
}

// ---------- DONKI: historical solar events → storms.json ----------
// The game's strength, sol and hit time are SIMULATED adaptations; the source fields are the real record.
const WEEKS = [
  { id: '2024-05', label: 'May 2024 historical scenario', start: '2024-05-08', end: '2024-05-14' },
  { id: '2024-10', label: 'October 2024 historical scenario', start: '2024-10-01', end: '2024-10-10' },
  { id: '2017-09', label: 'September 2017 historical scenario', start: '2017-09-04', end: '2017-09-10' },
];
const GAME_SOLS = [3, 6, 9];

function cmeStrength(speed) {
  if (speed >= 1500) return 3;
  if (speed >= 800) return 2;
  return 1;
}

await step('storms.json', async () => {
  const weeks = [];
  const sources = [];
  for (const w of WEEKS) {
    const q = `startDate=${w.start}&endDate=${w.end}&api_key=${KEY}`;
    const cmeUrl = `https://api.nasa.gov/DONKI/CME?${q}`;
    const sepUrl = `https://api.nasa.gov/DONKI/SEP?${q}`;
    const gstUrl = `https://api.nasa.gov/DONKI/GST?${q}`;
    const [cmes, seps, gsts] = await Promise.all([
      getJson(cmeUrl, `donki-cme-${w.id}`),
      getJson(sepUrl, `donki-sep-${w.id}`),
      getJson(gstUrl, `donki-gst-${w.id}`),
    ]);
    for (const u of [cmeUrl, sepUrl, gstUrl]) sources.push(u.replace(`&api_key=${KEY}`, ''));

    const candidates = [];
    for (const c of cmes || []) {
      const a = (c.cmeAnalyses || []).find((x) => x.isMostAccurate) || (c.cmeAnalyses || [])[0];
      if (!a || !a.speed) continue;
      let marsArrival = null;
      for (const e of a.enlilList || []) {
        const hit = (e.impactList || []).find((i) => /mars/i.test(i.location));
        if (hit) {
          marsArrival = { status: 'predicted', time: hit.arrivalTime, source: e.link || c.link, model: 'WSA-ENLIL' };
          break;
        }
      }
      candidates.push({
        id: c.activityID,
        type: 'CME',
        realTime: c.startTime,
        link: c.link,
        observedTarget: 'unknown',
        speedKmS: a.speed,
        marsArrival,
        rank: a.speed + (marsArrival ? 400 : 0),
        strength: cmeStrength(a.speed),
      });
    }
    for (const s of seps || []) {
      candidates.push({
        id: s.sepID,
        type: 'SEP',
        realTime: s.eventTime,
        link: s.link,
        observedTarget: (s.instruments || []).map((i) => i.displayName).join(', ') || 'unknown',
        marsArrival: null,
        rank: 1000,
        strength: 2,
      });
    }
    candidates.sort((a, b) => b.rank - a.rank);
    const chosen = candidates.slice(0, 3).sort((a, b) => a.realTime.localeCompare(b.realTime));
    const events = chosen.map((c, i) => ({
      id: c.id,
      type: c.type,
      realTime: c.realTime,
      link: c.link,
      observedTarget: c.observedTarget,
      ...(c.speedKmS ? { speedKmS: c.speedKmS } : {}),
      marsArrival: c.marsArrival,
      scenario: {
        strength: c.strength,
        gameSol: GAME_SOLS[i],
        hitOffsetMs: 60000,
        warningSols: 2,
        label: 'simulated Mars-outpost effect',
      },
    }));
    const earthContext = (gsts || []).map((g) => ({
      id: g.gstID,
      startTime: g.startTime,
      maxKp: Math.max(...(g.allKpIndex || []).map((k) => k.kpIndex), 0),
      link: g.link,
    }));
    weeks.push({ id: w.id, label: w.label, realWindow: [w.start, w.end], events, earthContext });
  }
  write('storms.json', {
    source: sources,
    fetched: today,
    mock: false,
    note: 'Source fields are DONKI records. "scenario" fields (strength 1–3, game sol, hit time) are simulated game adaptations, not observed Mars effects. GST (Kp) is Earth geomagnetic context only.',
    weeks,
  });
});

// ---------- InSight weather (archived) → weather.json ----------
await step('weather.json', async () => {
  const url = `https://api.nasa.gov/insight_weather/?api_key=${KEY}&feedtype=json&ver=1.0`;
  const j = await getJson(url, 'insight-weather');
  const sols = (j.sol_keys || [])
    .filter((k) => j[k] && j[k].AT)
    .map((k) => ({
      marsSol: Number(k),
      earthDate: (j[k].First_UTC || '').slice(0, 10),
      minC: Math.round(j[k].AT.mn * 10) / 10,
      maxC: Math.round(j[k].AT.mx * 10) / 10,
      windAvg: j[k].HWS ? Math.round(j[k].HWS.av * 10) / 10 : null,
      season: j[k].Season || null,
    }));
  if (!sols.length) throw new Error('no sols in response');
  write('weather.json', {
    source: 'https://api.nasa.gov/insight_weather/ (InSight Mars Weather Service, archived 2020)',
    fetched: today,
    mock: false,
    note: 'Real temperatures and winds recorded by NASA InSight at Elysium Planitia in 2020. The game reuses these archived sols in order.',
    sols,
  });
});

// ---------- JPL Horizons → delay.json ----------
await step('delay.json', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const url =
    `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='499'&OBJ_DATA='NO'&MAKE_EPHEM='YES'` +
    `&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&START_TIME='${today}'&STOP_TIME='${tomorrow}'&STEP_SIZE='1d'&QUANTITIES='20'`;
  const j = await getJson(url, `horizons-${today}`);
  const block = j.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n')[0];
  const au = Number(block.trim().split(/\s+/)[2]);
  if (!au) throw new Error('could not parse Horizons range');
  const km = au * 149597870.7;
  write('delay.json', {
    date: today,
    distanceKm: Math.round(km),
    distanceAu: au,
    oneWayMinutes: Math.round((km / 299792.458 / 60) * 10) / 10,
    source: url,
    fetched: today,
    mock: false,
    note: 'Earth–Mars distance from JPL Horizons (Mars as seen from Earth\'s centre) at 00:00 UT; one-way light time = distance ÷ speed of light.',
  });
});

// ---------- NASA Image and Video Library → photos.json ----------
await step('photos.json', async () => {
  const queries = ['Curiosity rover rock Mars', 'Perseverance rover rock Mars'];
  const photos = [];
  for (const q of queries) {
    const url = `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(q)}`;
    const j = await getJson(url, `images-${q.replace(/\W+/g, '-')}`);
    for (const it of j.collection.items) {
      const d = it.data[0];
      const thumb = (it.links || []).find((l) => l.rel === 'preview');
      if (!thumb || photos.some((p) => p.nasaId === d.nasa_id)) continue;
      photos.push({
        nasaId: d.nasa_id,
        title: d.title,
        date: (d.date_created || '').slice(0, 10),
        url: thumb.href,
        page: `https://images.nasa.gov/details/${d.nasa_id}`,
        credit: d.secondary_creator || d.photographer || `NASA ${d.center || ''}`.trim(),
      });
      if (photos.filter((p) => p.nasaId).length >= 12) break;
    }
  }
  write('photos.json', { source: 'https://images-api.nasa.gov/', fetched: today, mock: false, photos: photos.slice(0, 12) });
});

// ---------- Crops and trivia (facts written by the team, each tied to a NASA record) ----------
// The script checks every NASA ID still exists and stores the record title so judges can trace it.
const CROPS = [
  {
    id: 'red-romaine', name: 'Red Romaine Lettuce', growSols: 3, food: 18, color: '#b8344a',
    nasaId: 'KSC-2013-3563',
    fact: 'NASA grew "Outredgeous" red romaine lettuce in Veggie, a plant box built for the Space Station.',
  },
  {
    id: 'mizuna', name: 'Mizuna Greens', growSols: 3, food: 15, color: '#5fae4a',
    nasaId: 'iss060e006116',
    fact: 'Mizuna mustard greens grew on the Space Station in 2019 to test how light colour changes plants.',
  },
  {
    id: 'radish', name: 'Radish', growSols: 4, food: 24, color: '#d4486a',
    nasaId: 'KSC-20201214-PH-KLS01_0017',
    fact: 'Radishes grew in NASA\'s Advanced Plant Habitat for the PH-02 experiment. This batch grew on Earth to compare with space.',
  },
  {
    id: 'chile', name: 'Chile Pepper', growSols: 5, food: 32, color: '#e0512b',
    nasaId: 'iss066e023179',
    fact: 'In October 2021 an astronaut tasted a red chile pepper grown on the Space Station. The seeds were planted that July.',
  },
  {
    id: 'zinnia', name: 'Zinnia', growSols: 3, food: 0, color: '#f0a630',
    nasaId: 'KSC-20181127-PH_JBS01_0069',
    fact: 'Zinnia seeds grown on the Space Station came back to Earth and were planted again in 2018.',
  },
];

const TRIVIA = [
  { id: 'wright', nasaId: 'PIA24438', fact: 'NASA\'s Ingenuity helicopter carried a tiny piece of fabric from the Wright brothers\' first airplane to Mars.' },
  { id: 'morse', nasaId: 'PIA16112', fact: 'Curiosity\'s wheels have holes that print "JPL" in Morse code into the Martian dirt. It helps the rover track how far it really moved.' },
  { id: 'insight-dust', nasaId: 'PIA25284', fact: 'InSight\'s solar panels made about 5,000 watt-hours a sol after landing. By spring 2022, dust cut that to about 500.' },
  { id: 'opportunity', nasaId: 'PIA22908', fact: 'The solar-powered Opportunity rover went silent during a giant dust storm in June 2018.' },
  { id: 'dust-devils', nasaId: 'PIA21457', fact: 'Martian dust devils sometimes blew dust off the Spirit and Opportunity rovers\' solar panels, giving them more power.' },
  { id: 'names', nasaId: 'KSC-20200316-PH-JPL01_0002', fact: 'The Perseverance rover carried the names of more than 10 million people to Mars on tiny chips.' },
];

async function nasaRecord(nasaId) {
  const url = `https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(nasaId)}`;
  const j = await getJson(url, `record-${nasaId}`);
  const it = j.collection.items[0];
  if (!it) throw new Error(`NASA record ${nasaId} not found`);
  const preview = (it.links || []).find((l) => l.rel === 'preview');
  return { title: it.data[0].title, date: (it.data[0].date_created || '').slice(0, 10), preview: preview ? preview.href : null };
}

await step('crops.json', async () => {
  const crops = [];
  for (const c of CROPS) {
    const rec = await nasaRecord(c.nasaId);
    crops.push({ ...c, factSource: `https://images.nasa.gov/details/${c.nasaId}`, sourceTitle: rec.title, sourceDate: rec.date });
  }
  write('crops.json', {
    source: crops.map((c) => c.factSource),
    fetched: today,
    mock: false,
    note: 'Facts are short summaries of the linked NASA records. growSols and food are game-balance values; zinnia has food 0.',
    crops,
  });
});

await step('trivia.json', async () => {
  const trivia = [];
  for (const t of TRIVIA) {
    const rec = await nasaRecord(t.nasaId);
    trivia.push({ ...t, source: `https://images.nasa.gov/details/${t.nasaId}`, sourceTitle: rec.title, sourceDate: rec.date });
  }
  write('trivia.json', { source: trivia.map((t) => t.source), fetched: today, mock: false, trivia });
});

console.log('Done.');
