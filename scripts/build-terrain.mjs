// Builds the rover map from NASA Mars Trek tiles around InSight's landing site
// (Elysium Planitia, 4.502°N 135.623°E).
//
//   npm run build-terrain
//
// Output:
//   public/data/terrain/viking_<row>_<col>.jpg   Viking colour mosaic tiles (what the map looks like)
//   public/data/terrain.json                     driving-cost grid + finds + sources
//
// The driving cost is a GAME ABSTRACTION: we measure how much the MOLA shaded-relief
// brightness changes inside each 32×32 map cell (bumpy ground = bigger changes) and bucket
// that into costs 1–3. It is not a measured slope.
//
// Decoding JPEGs uses macOS `sips` (built in) so the project needs no image libraries.
// Run on a Mac; the outputs are committed so nobody else needs to run it.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/data/terrain');
const cacheDir = join(root, 'scripts/.cache/terrain');
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const LOOK_LAYER = 'Mars_Viking_MDIM21_ClrMosaic_global_232m';
const RELIEF_LAYER = 'Mars_MGS_MOLA_ClrShade_merge_global_463m';
const ZOOM = 7; // 256 × 128 tiles; each tile is 1.40625° wide
const INSIGHT = { lat: 4.502, lon: 135.623 };
const COLS = 5;
const ROWS = 3;
const CELL = 32;
const TILE = 256;
const GRID_W = (COLS * TILE) / CELL; // 40
const GRID_H = (ROWS * TILE) / CELL; // 24

const deg = 360 / 2 ** (ZOOM + 1);
const centerCol = Math.floor((INSIGHT.lon + 180) / deg);
const centerRow = Math.floor((90 - INSIGHT.lat) / deg);
const col0 = centerCol - Math.floor(COLS / 2);
const row0 = centerRow - Math.floor(ROWS / 2);

const tileUrl = (layer, z, row, col) => `${TREK}/${layer}/1.0.0/default/default028mm/${z}/${row}/${col}.jpg`;

async function download(url, file) {
  if (existsSync(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// Minimal BMP reader for the 24/32-bit files sips writes.
function readBmp(file) {
  const b = readFileSync(file);
  const dataOffset = b.readUInt32LE(10);
  const width = b.readInt32LE(18);
  const rawHeight = b.readInt32LE(22);
  const bpp = b.readUInt16LE(28);
  const height = Math.abs(rawHeight);
  const bottomUp = rawHeight > 0;
  const bytes = bpp / 8;
  const stride = Math.ceil((width * bytes) / 4) * 4;
  const lum = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const srcY = bottomUp ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const i = dataOffset + srcY * stride + x * bytes;
      const bl = b[i], g = b[i + 1], r = b[i + 2];
      lum[y * width + x] = 0.299 * r + 0.587 * g + 0.114 * bl;
    }
  }
  return { width, height, lum };
}

function toBmp(jpg) {
  const bmp = jpg.replace(/\.jpg$/, '.bmp');
  if (!existsSync(bmp)) execFileSync('sips', ['-s', 'format', 'bmp', jpg, '--out', bmp], { stdio: 'ignore' });
  return readBmp(bmp);
}

const sources = [];
const tiles = [];

// 1) Look layer: copy into public/ so the game bundles it.
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const row = row0 + r, col = col0 + c;
    const url = tileUrl(LOOK_LAYER, ZOOM, row, col);
    const name = `viking_${row}_${col}.jpg`;
    await download(url, join(outDir, name));
    sources.push(url);
    tiles.push({ file: `data/terrain/${name}`, x: c * TILE, y: r * TILE });
  }
}

// 2) Relief layer: find the deepest zoom that exists (MOLA is coarser than Viking).
let reliefZoom = ZOOM;
for (; reliefZoom >= 4; reliefZoom--) {
  const s = 2 ** (ZOOM - reliefZoom);
  const res = await fetch(tileUrl(RELIEF_LAYER, reliefZoom, Math.floor(row0 / s), Math.floor(col0 / s)));
  if (res.ok && (res.headers.get('content-type') || '').includes('image')) break;
}
const scale = 2 ** (ZOOM - reliefZoom);
console.log(`Relief layer zoom ${reliefZoom} (scale 1/${scale})`);

const reliefCache = new Map();
async function reliefTile(row, col) {
  const key = `${row}_${col}`;
  if (!reliefCache.has(key)) {
    const url = tileUrl(RELIEF_LAYER, reliefZoom, row, col);
    const file = join(cacheDir, `mola_${reliefZoom}_${key}.jpg`);
    await download(url, file);
    if (!sources.includes(url)) sources.push(url);
    reliefCache.set(key, toBmp(file));
  }
  return reliefCache.get(key);
}

// Sample relief luminance at a map pixel (in ZOOM-level pixel space).
async function reliefAt(px, py) {
  const gx = (col0 * TILE + px) / scale;
  const gy = (row0 * TILE + py) / scale;
  const t = await reliefTile(Math.floor(gy / TILE), Math.floor(gx / TILE));
  const lx = Math.min(TILE - 1, Math.floor(gx % TILE));
  const ly = Math.min(TILE - 1, Math.floor(gy % TILE));
  return t.lum[ly * t.width + lx];
}

// 3) Roughness per cell = mean absolute brightness change between neighbouring samples.
const STEP = 4;
const rough = [];
for (let cy = 0; cy < GRID_H; cy++) {
  const rowVals = [];
  for (let cx = 0; cx < GRID_W; cx++) {
    let sum = 0, n = 0;
    for (let y = 0; y < CELL; y += STEP) {
      for (let x = 0; x < CELL; x += STEP) {
        const px = cx * CELL + x, py = cy * CELL + y;
        const here = await reliefAt(px, py);
        sum += Math.abs(here - (await reliefAt(px + STEP, py))) + Math.abs(here - (await reliefAt(px, py + STEP)));
        n += 2;
      }
    }
    rowVals.push(sum / n);
  }
  rough.push(rowVals);
}
const sorted = rough.flat().sort((a, b) => a - b);
const p60 = sorted[Math.floor(sorted.length * 0.6)];
const p85 = sorted[Math.floor(sorted.length * 0.85)];
const cost = rough.map((r) => r.map((v) => (v > p85 ? 3 : v > p60 ? 2 : 1)));

// Dome sits on InSight's landing site.
const domePx = ((INSIGHT.lon + 180) / deg - col0) * TILE;
const domePy = ((90 - INSIGHT.lat) / deg - row0) * TILE;
const dome = [Math.floor(domePx / CELL), Math.floor(domePy / CELL)];
cost[dome[1]][dome[0]] = 1;

// Finds are game placements (not real deposits), spread at fixed spots so every run is fair.
const finds = [
  { id: 'ice-1', item: 'ice', amount: 2, x: dome[0] + 6, y: dome[1] - 3 },
  { id: 'ice-2', item: 'ice', amount: 2, x: dome[0] - 9, y: dome[1] - 6 },
  { id: 'ice-3', item: 'ice', amount: 3, x: dome[0] + 13, y: dome[1] + 4 },
  { id: 'ice-4', item: 'ice', amount: 2, x: dome[0] - 15, y: dome[1] + 3 },
  { id: 'reg-1', item: 'regolith', amount: 3, x: dome[0] - 4, y: dome[1] + 3 },
  { id: 'reg-2', item: 'regolith', amount: 3, x: dome[0] + 9, y: dome[1] + 7 },
  { id: 'reg-3', item: 'regolith', amount: 3, x: dome[0] + 3, y: dome[1] - 9 },
  { id: 'reg-4', item: 'regolith', amount: 3, x: dome[0] - 12, y: dome[1] - 1 },
  { id: 'sup-1', item: 'seed', amount: 6, x: dome[0] - 7, y: dome[1] + 6, label: 'supply drop' },
  { id: 'sup-2', item: 'seed', amount: 6, x: dome[0] + 16, y: dome[1] - 8, label: 'supply drop' },
  { id: 'smp-1', item: 'sample', amount: 1, x: dome[0] + 4, y: dome[1] + 5 },
  { id: 'smp-2', item: 'sample', amount: 1, x: dome[0] - 6, y: dome[1] - 10 },
  { id: 'smp-3', item: 'sample', amount: 1, x: dome[0] + 18, y: dome[1] + 1 },
  { id: 'egg-heli', item: 'parts', amount: 1, x: dome[0] - 17, y: dome[1] - 9, label: 'mysterious tiny propeller', egg: true },
].map((f) => ({ ...f, x: Math.max(0, Math.min(GRID_W - 1, f.x)), y: Math.max(0, Math.min(GRID_H - 1, f.y)) }));

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(root, 'public/data/terrain.json'),
  JSON.stringify(
    {
      source: sources,
      fetched: today,
      mock: false,
      note: 'Imagery: NASA Mars Trek (Viking MDIM 2.1 colour mosaic). Driving cost: game abstraction from MOLA shaded-relief brightness changes, not a measured slope. Find locations are game placements.',
      site: { name: 'Elysium Planitia (InSight landing site)', lat: INSIGHT.lat, lon: INSIGHT.lon },
      zoom: ZOOM,
      kmPerCell: Math.round(((deg / TILE) * CELL * 3389.5 * Math.PI) / 180),
      width: GRID_W,
      height: GRID_H,
      cell: CELL,
      tiles,
      cost,
      dome,
      finds,
    },
    null,
    1,
  ),
);
console.log(`terrain.json written: ${GRID_W}×${GRID_H}, dome at ${dome}`);
