import Phaser from 'phaser';
import { getData, mockFiles } from '../data/loaders';
import { C, H, W, button, panel, text } from './theme';
import { collectSourceLinks, sourceLabel } from './source-list.mjs';

const SOURCES_PER_PAGE = 8;

// “NASA Data We Used” lists every unique source URL attached to the loaded data.
export function showCredits(scene: Phaser.Scene) {
  const d = getData();
  const c = scene.add.container(0, 0).setDepth(500);
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());
  c.add(panel(scene, 70, 30, W - 140, H - 60));
  c.add(text(scene, 100, 50, 'NASA data we used', 32, C.goldText, { fontStyle: 'bold' }));
  c.add(text(scene, 100, 89,
    'Every linked source in the loaded game data. Storm timing, strength, and outpost effects are simulated.',
    16, C.dim, { wordWrap: { width: W - 220 } }));

  const links = collectSourceLinks(d);
  const pageCount = Math.max(1, Math.ceil(links.length / SOURCES_PER_PAGE));
  let page = 0;
  let rows: Phaser.GameObjects.Container | null = null;
  let pageLabel: Phaser.GameObjects.Text | null = null;

  const renderPage = () => {
    rows?.destroy(true);
    rows = scene.add.container(0, 0);
    c.add(rows);
    const start = page * SOURCES_PER_PAGE;
    const visible = links.slice(start, start + SOURCES_PER_PAGE);
    if (!visible.length) {
      rows.add(text(scene, 100, 140, 'No linked data sources were loaded.', 18, C.dim));
    }
    visible.forEach((url, index) => {
      const y = 139 + index * 45;
      const title = text(scene, 104, y, sourceLabel(url), 17, C.teal, {
        wordWrap: { width: W - 250 },
      }).setInteractive({ useHandCursor: true });
      title.on('pointerdown', () => window.open(url, '_blank', 'noopener'));
      rows!.add(title);
      rows!.add(text(scene, W - 108, y, 'Open »', 15, C.goldText).setOrigin(1, 0));
    });
    pageLabel?.destroy();
    pageLabel = text(scene, W / 2, 515, `Sources ${links.length ? start + 1 : 0}–${start + visible.length} of ${links.length}`, 16, C.dim).setOrigin(0.5, 0);
    c.add(pageLabel);
  };

  renderPage();
  c.add(button(scene, 170, 525, '« Previous', () => {
    page = (page + pageCount - 1) % pageCount;
    renderPage();
  }, 170, 42, C.frame));
  c.add(button(scene, W - 170, 525, 'Next »', () => {
    page = (page + 1) % pageCount;
    renderPage();
  }, 170, 42, C.frame));

  const mockNames = mockFiles(d);
  const mockNote = mockNames.length ? ` MOCK DATA: ${mockNames.join(', ')}.` : '';
  c.add(text(scene, 100, 570,
    `NASA facts link to their sources. Storm effects and game balance are simulations.${mockNote}\n` +
      'AI use: Claude and OpenAI Codex helped with code and source summaries; team review is pending. See docs/AI_USAGE.md.\n' +
      'Built with Phaser 3 (MIT), Vite (MIT), and TypeScript (Apache 2.0). DotGothic16 font: SIL Open Font License.',
    14, C.dim, { wordWrap: { width: W - 200 }, lineSpacing: 3 }));
  c.add(button(scene, W / 2, H - 43, 'Close', () => c.destroy(), 180, 42, 0xffd166));
  return c;
}
