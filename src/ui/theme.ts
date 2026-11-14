import Phaser from 'phaser';

// Visual language for every UI panel: deep "night sky" panels, a teal frame and warm text.
export const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';
export const W = 1280;
export const H = 720;

export const C = {
  panel: 0x1d2333,
  panelDark: 0x141927,
  frame: 0x3fa7a0,
  frameDark: 0x2a6f6b,
  gold: 0xffd166,
  red: 0xe05050,
  text: '#f7efe2',
  dim: '#a9b3c4',
  goldText: '#ffd166',
  teal: '#7fd6cf',
  warn: '#ff8a5c',
  ok: '#9ee493',
  sim: '#c9a6ff',
};

export function text(scene: Phaser.Scene, x: number, y: number, str: string, size = 22, color = C.text, opts: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, ...opts });
}

/** A framed panel drawn with Graphics. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = C.panel, alpha = 0.96) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x + 4, y + 6, w, h, 10);
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(4, C.frame, 1);
  g.strokeRoundedRect(x, y, w, h, 10);
  g.lineStyle(2, C.frameDark, 1);
  g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 6);
  return g;
}

/** A clickable pill button. Returns the container. */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, w = 200, h = 48, color = C.frame) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 12);
    g.fillStyle(hover ? Phaser.Display.Color.ValueToColor(color).lighten(15).color : color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(3, 0x0f1420, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  };
  draw(false);
  const t = text(scene, 0, 0, label, 22, '#0f1420', { fontStyle: 'bold' }).setOrigin(0.5);
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => draw(true));
  zone.on('pointerout', () => draw(false));
  zone.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
    e?.stopPropagation?.();
    onClick();
  });
  c.add([g, t, zone]);
  c.setSize(w, h);
  return c;
}

export function hourLabel(fraction: number) {
  const minutes = Math.floor(6 * 60 + fraction * 16 * 60);
  const h = Math.floor(minutes / 60);
  const m = Math.floor((minutes % 60) / 10) * 10;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function fmtMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
