import Phaser from 'phaser';
import { getData } from '../data/loaders';
import { C, H, W, button, panel, text } from './theme';

// "NASA Data We Used" — every source the game shows, with what is real and what is simulated.
export function showCredits(scene: Phaser.Scene) {
  const d = getData();
  const c = scene.add.container(0, 0).setDepth(500);
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());
  c.add(panel(scene, 70, 30, W - 140, H - 60));
  c.add(text(scene, 100, 50, 'NASA data we used', 32, C.goldText, { fontStyle: 'bold' }));
  const first = (s: string | string[]) => (Array.isArray(s) ? s[0] : s);
  const rows: [string, string, string][] = [
    ['Solar storms', `NASA DONKI space weather records (CME/SEP/GST). Real dates & records; game strength, timing and Mars effects are SIMULATED.${d.storms.mock ? ' [MOCK until fetched]' : ''}`, 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/'],
    ['Mars weather', `NASA InSight Mars Weather Service, archived 2020 temperatures and wind at Elysium Planitia.${d.weather.mock ? ' [MOCK until fetched]' : ''}`, 'https://api.nasa.gov/'],
    ['Radio delay', `JPL Horizons: Earth–Mars distance on ${d.delay.date} = ${(d.delay.distanceKm / 1e6).toFixed(0)} million km → ${d.delay.oneWayMinutes} light-minutes one way.`, 'https://ssd.jpl.nasa.gov/horizons/'],
    ['Rover map', `NASA Mars Trek: Viking MDIM 2.1 colour mosaic + MOLA shaded relief around InSight's landing site. Driving costs are a game abstraction.`, 'https://trek.nasa.gov/mars/'],
    ['Space crops', 'NASA Image and Video Library records of Veggie and Advanced Plant Habitat experiments (lettuce, mizuna, radish, chile pepper, zinnia). Growth times & food values are game balance.', first(d.crops.source)],
    ['Fun facts', 'NASA/JPL Photojournal records (Ingenuity, Curiosity, InSight, Opportunity, dust devils, Perseverance).', first(d.trivia.source)],
    ['Photo album', `${d.photos.photos.length} Mars rover photos from the NASA Image and Video Library, credited on each card.`, 'https://images.nasa.gov/'],
  ];
  let y = 104;
  for (const [title, body, url] of rows) {
    c.add(text(scene, 100, y, title, 20, C.teal, { fontStyle: 'bold' }));
    c.add(text(scene, 280, y, body, 16, C.text, { wordWrap: { width: W - 420 } }));
    const link = text(scene, W - 110, y, '↗', 22, C.goldText).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    link.on('pointerdown', () => window.open(url, '_blank', 'noopener'));
    c.add(link);
    y += 62;
  }
  c.add(text(scene, 100, y + 4,
    'Made for NASA Space Apps 2026. Not affiliated with or endorsed by NASA. All pixel art, characters and story are original.\n' +
      'Built with Phaser 3 (MIT), Vite and TypeScript. Font: Pixelify Sans (SIL Open Font License).\n' +
      'AI use: code and dialogue were drafted with an AI coding assistant (Claude) and reviewed by the team. See docs/AI_USAGE.md.',
    14, C.dim, { wordWrap: { width: W - 200 }, lineSpacing: 4 }));
  c.add(button(scene, W / 2, H - 70, 'Close', () => c.destroy(), 180, 48, 0xffd166));
  return c;
}
