import Phaser from 'phaser';

// Tiny pixel-art helper: every sprite in the game is drawn from text grids at boot,
// so the project has no image files of its own (all art is original, made by the team).
// '.' or ' ' is transparent; every other character looks up a colour in the palette.

export type Palette = Record<string, string>;

export function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], pal: Palette, scale = 2, flipX = false) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const tex = scene.textures.createCanvas(key, w * scale, h * scale);
  if (!tex) return;
  const ctx = tex.getContext();
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const color = pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      const dx = flipX ? w - 1 - x : x;
      ctx.fillRect(dx * scale, y * scale, scale, scale);
    }
  });
  tex.refresh();
}

/** Replace characters in a grid (handy for recolouring and animation frames). */
export function swap(rows: string[], map: Record<string, string>): string[] {
  return rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));
}

/** Simple deterministic noise so procedural tiles look the same every run. */
export function hash(x: number, y: number, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** A procedurally speckled square tile. */
export function noiseTile(scene: Phaser.Scene, key: string, size: number, base: string, specks: [string, number][], seed: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const n = hash(x, y, seed);
      let acc = 0;
      for (const [color, p] of specks) {
        acc += p;
        if (n < acc) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 2, 2);
          break;
        }
      }
    }
  }
  tex.refresh();
}
