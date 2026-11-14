import Phaser from 'phaser';
import type { ItemId, WorldId } from '../core/types';

// Shapes of the files in public/data (PLAN.md section 7).
interface Sourced {
  source: string | string[];
  fetched: string;
  mock: boolean;
  note?: string;
}

export interface StormEvent {
  id: string;
  type: 'CME' | 'SEP' | string;
  realTime: string;
  link: string;
  observedTarget: string;
  speedKmS?: number;
  marsArrival: { status: 'predicted' | 'observed'; time: string; source: string; model?: string } | null;
  scenario: { strength: number; gameSol: number; hitOffsetMs: number; warningSols: number; label: string };
}

export interface StormWeek {
  id: string;
  label: string;
  realWindow: [string, string];
  events: StormEvent[];
  earthContext: { id: string; startTime: string; maxKp: number; link: string }[];
}

export interface Crop {
  id: string;
  name: string;
  growSols: number;
  food: number;
  color: string;
  fact: string;
  factSource: string;
  sourceTitle?: string;
  waterPerDay?: number;
  oxygenPerDay?: number;
}

export interface WeatherSol {
  marsSol: number;
  earthDate: string;
  minC: number;
  maxC: number;
  windAvg: number | null;
}

export interface Photo {
  nasaId: string;
  title: string;
  date?: string;
  url: string;
  page?: string;
  credit: string;
}

export interface Trivia {
  id: string;
  fact: string;
  source: string;
  sourceTitle?: string;
}

export interface ScienceFact {
  id: string;
  activity: 'sol' | 'plant' | 'water' | 'dialogue';
  text: string;
  source: string;
}

export interface Find {
  id: string;
  item: ItemId;
  amount: number;
  x: number;
  y: number;
  label?: string;
  egg?: boolean;
}

export interface Terrain extends Sourced {
  site: { name: string; lat: number; lon: number };
  kmPerCell: number;
  width: number;
  height: number;
  cell: number;
  tiles: { file: string; x: number; y: number }[];
  cost: number[][];
  dome: [number, number];
  finds: Find[];
}

export interface GameData {
  storms: Sourced & { weeks: StormWeek[] };
  weather: Sourced & { sols: WeatherSol[] };
  crops: Sourced & { crops: Crop[] };
  delay: Sourced & { date: string; distanceKm: number; oneWayMinutes: number };
  photos: Sourced & { photos: Photo[] };
  trivia: Sourced & { trivia: Trivia[] };
  science: Sourced & { facts: ScienceFact[] };
  terrain: Terrain;
}

export const DATA_FILES = ['storms', 'weather', 'crops', 'delay', 'photos', 'trivia', 'terrain', 'science'] as const;

export function queueDataFiles(scene: Phaser.Scene) {
  for (const name of DATA_FILES) scene.load.json(`data:${name}`, `data/${name}.json`);
  for (const name of DATA_FILES) scene.load.json(`data:moon:${name}`, `data/moon/${name}.json`);
}

let data: Record<WorldId, GameData> | null = null;

export function collectData(scene: Phaser.Scene): GameData {
  const worlds = {} as Record<WorldId, GameData>;
  for (const world of ['mars', 'moon'] as const) {
    const out: Record<string, unknown> = {};
    for (const name of DATA_FILES) {
      const value = scene.cache.json.get(world === 'mars' ? `data:${name}` : `data:moon:${name}`);
      if (!value) throw new Error(`Missing ${world} data: ${name}`);
      out[name] = value;
    }
    worlds[world] = out as unknown as GameData;
  }
  data = worlds;
  return worlds.mars;
}

export function getData(worldId: WorldId = 'mars'): GameData {
  if (!data) throw new Error('Game data not loaded yet');
  return data[worldId];
}

export function getAllWorldData(): GameData[] {
  return [getData('mars'), getData('moon')];
}

/** Names of any data files that are still mock placeholders. The UI shows a MOCK DATA badge for these. */
export function mockFiles(d: GameData = getData()): string[] {
  return DATA_FILES.filter((n) => (d[n] as Sourced).mock);
}

export function cropById(id: string | null, worldId: WorldId = 'mars'): Crop | undefined {
  return id ? getData(worldId).crops.crops.find((c) => c.id === id) : undefined;
}
