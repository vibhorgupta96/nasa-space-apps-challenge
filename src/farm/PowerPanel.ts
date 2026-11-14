import Phaser from 'phaser';
import type { PowerSlot } from '../core/types';
import { SLOTS, store } from '../core/store';

/** Where the morning panel draws its rows, so cells can be dropped on them. */
export interface PowerLayout {
  rowX: number;
  rowW: number;
  rowY: (i: number) => number;
  rowH: number;
  cellX: number;
  /** The last x a placed cell may sit at; cells pack closer together to fit before it. */
  cellMaxX: number;
  trayX: number;
  trayY: number;
  tint: (slot: PowerSlot) => number;
}

/**
 * Draws today's power cells as draggable icons: placed cells sit in their row, unplaced cells
 * wait in a tray. Dragging a cell onto another row moves it; dropping it anywhere else puts it
 * back in the tray. The +/– buttons stay as the keyboard/click alternative.
 */
export function addPowerCells(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  L: PowerLayout,
  rerender: () => void,
  onError: (reason: string) => void,
) {
  const s = store.state;
  const slotAt = (x: number, y: number): PowerSlot | null => {
    if (x < L.rowX || x > L.rowX + L.rowW) return null;
    const i = SLOTS.findIndex((_, k) => y >= L.rowY(k) && y <= L.rowY(k) + L.rowH);
    return i >= 0 ? SLOTS[i] : null;
  };

  const move = (from: PowerSlot | null, to: PowerSlot | null) => {
    if (from === to) return;
    if (to === 'rover' && !store.roverDrivableToday()) {
      onError('Bolt can\'t drive today, so rover cells would be wasted.');
      return;
    }
    const split = { ...s.split };
    if (from) split[from] -= 1;
    if (to) split[to] += 1;
    const r = store.setPowerSplit(split);
    if (!r.ok) onError(r.reason);
  };

  const cell = (x: number, y: number, from: PowerSlot | null) => {
    const img = scene.add.image(x, y, 'icon-power').setScale(1.6).setTint(from ? L.tint(from) : 0xffffff);
    img.setInteractive({ useHandCursor: true, draggable: true });
    img.on('dragstart', () => img.setScale(2.2).setDepth(10));
    img.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => img.setPosition(dx, dy));
    img.on('dragend', (p: Phaser.Input.Pointer) => {
      move(from, slotAt(p.x, p.y));
      // Re-render on the next frame so we don't destroy the object inside its own event.
      scene.time.delayedCall(0, rerender);
    });
    layer.add(img);
  };

  SLOTS.forEach((slot, i) => {
    const n = s.split[slot];
    const step = n > 1 ? Math.min(26, (L.cellMaxX - L.cellX) / (n - 1)) : 26;
    for (let k = 0; k < n; k++) cell(L.cellX + k * step, L.rowY(i) + L.rowH / 2, slot);
  });
  const left = s.cellsToday - store.splitTotal();
  for (let k = 0; k < left; k++) cell(L.trayX + k * 30, L.trayY, null);
}
