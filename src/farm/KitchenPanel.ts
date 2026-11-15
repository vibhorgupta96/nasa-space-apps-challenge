import Phaser from 'phaser';
import { store, type Result } from '../core/store';
import { RULES } from '../core/rules';
import { cropById } from '../data/loaders';
import { sfx } from '../core/audio';
import { recipesForWorld } from './recipes';
import { C, button, panel, text } from '../ui/theme';

/**
 * The kitchen: today's pantry (tap a crop to eat it raw) and the recipes, each with a Cook
 * button. Keys 1–4 cook a recipe. Calls `rerender` after every change so counts stay right.
 */
export function addKitchen(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  rerender: () => void,
  onError: (reason: string) => void,
) {
  const s = store.state;
  const done = (r: Result, ok: () => void) => {
    if (!r.ok) {
      sfx('error');
      onError(r.reason);
      return;
    }
    ok();
    rerender();
  };

  c.add(panel(scene, x, y, w, h));
  c.add(text(scene, x + 32, y + 20, '🍲 Kitchen', 30, C.goldText, { fontStyle: 'bold' }));
  c.add(text(scene, x + w - 32, y + 24, `Food ${Math.round(s.food)} / ${RULES.resourceMax}`, 22, C.ok).setOrigin(1, 0));

  // Pantry: one card per crop type. Tap a crop to eat it raw.
  c.add(text(scene, x + 32, y + 70, 'Pantry: tap a crop to eat it raw', 18, C.dim));
  const crops = store.data.crops.crops;
  crops.forEach((crop, i) => {
    const cx = x + 32 + i * 150;
    const have = s.pantry[crop.id] || 0;
    const card = scene.add.rectangle(cx, y + 96, 138, 100, have ? 0x2a3247 : 0x1a1f2c).setOrigin(0).setStrokeStyle(2, 0x3c4660);
    c.add(card);
    c.add(scene.add.image(cx + 34, y + 132, `crop-${crop.id}-3`).setScale(1.6).setAlpha(have ? 1 : 0.35));
    c.add(text(scene, cx + 64, y + 102, `×${have}`, 24, have ? C.text : C.dim));
    c.add(text(scene, cx + 64, y + 136, crop.food ? `+${crop.food}` : 'not food', 16, C.dim));
    c.add(text(scene, cx + 69, y + 174, crop.name.split(' ').slice(0, 2).join(' '), 14, have ? C.text : C.dim).setOrigin(0.5, 0.5));
    if (have) {
      card.setData('readableAction', { label: `Eat ${crop.name} raw`, activate: () => done(store.eatRaw(crop.id), () => sfx('harvest')) });
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => done(store.eatRaw(crop.id), () => sfx('harvest')));
    }
  });

  // Recipes.
  c.add(text(scene, x + 32, y + 208, 'Recipes: cooking a mix feeds the crew more than eating raw', 18, C.dim));
  recipesForWorld(store.worldId).forEach((r, i) => {
    const ry = y + 236 + i * 72;
    const can = Object.entries(r.needs).every(([id, n]) => (s.pantry[id] || 0) >= n);
    c.add(scene.add.rectangle(x + 32, ry, w - 64, 66, 0x2a3247).setOrigin(0));
    c.add(text(scene, x + 48, ry + 8, `${i + 1}. ${r.name}`, 20, can ? C.goldText : C.text));
    const raw = Object.entries(r.needs).reduce((sum, [id, n]) => sum + (cropById(id, store.worldId)?.food ?? 0) * n, 0);
    const gain = r.food ? `+${r.food} food (raw: +${raw})` : `+${r.seeds} seeds`;
    c.add(text(scene, x + 48, ry + 38, gain, 16, C.ok));
    Object.entries(r.needs).forEach(([id, n], k) => {
      const got = Math.min(s.pantry[id] || 0, n);
      const ix = x + 330 + k * 60;
      c.add(scene.add.image(ix, ry + 30, `crop-${id}-3`).setScale(1.2).setAlpha(got >= n ? 1 : 0.3));
      c.add(text(scene, ix + 10, ry + 40, `${got}/${n}`, 14, got >= n ? C.ok : C.warn));
    });
    c.add(text(scene, x + 520, ry + 10, r.text, 14, C.dim, { wordWrap: { width: w - 720 } }));
    c.add(button(scene, x + w - 100, ry + 33, 'Cook', () => done(store.cook(r.id), () => sfx('craft')), 110, 44, can ? 0xffd166 : 0x6b7280));
  });

  c.add(text(scene, x + 32, y + h - 34, `Recipes and food values are game rules. If food drops below ${RULES.snackBelowFood} at night, the crew eats raw pantry crops.`, 14, C.dim));
}

/** Keys 1–4 cook the matching recipe. Returns true when the key was used. */
export function kitchenKey(key: string, rerender: () => void, onError: (reason: string) => void) {
  const i = Number(key) - 1;
  const recipes = recipesForWorld(store.worldId);
  if (!(i >= 0 && i < recipes.length)) return false;
  const r = store.cook(recipes[i].id);
  if (r.ok) sfx('craft');
  else {
    sfx('error');
    onError(r.reason);
  }
  rerender();
  return true;
}
