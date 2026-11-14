import Phaser from 'phaser';
import { store, SLOTS, type NightReport } from '../core/store';
import { bus, EV, UI_EV } from '../core/events';
import { RULES } from '../core/rules';
import type { ItemId, PowerSlot } from '../core/types';
import { getData, mockFiles } from '../data/loaders';
import { C, H, W, button, fmtMs, hourLabel, panel, text } from './theme';
import { SPEAKERS, type Line } from '../story/script';
import { Director } from '../story/director';
import { addPowerCells } from '../farm/PowerPanel';

// The always-on overlay: HUD, hotbar, toasts, and every modal (dialogue, morning plan,
// night report, storm board, help, photos). Modals pause the simulation while open.

type Modal = { build: () => Phaser.GameObjects.Container | null; pause?: boolean };

export const TOOLS = ['seed:0', 'seed:1', 'seed:2', 'seed:3', 'seed:4', 'can', 'hand'] as const;

const SLOT_INFO: Record<PowerSlot, { label: string; icon: string; color: number }> = {
  growLights: { label: 'Grow lights', icon: 'icon-light', color: 0xfff1a8 },
  heater: { label: 'Heater', icon: 'icon-heater', color: 0xf08a3a },
  shelter: { label: 'Storm shelter', icon: 'icon-shield', color: 0x9aa3b0 },
  rover: { label: 'Rover battery', icon: 'icon-rover', color: 0x5ee7ff },
};

export class UIScene extends Phaser.Scene {
  private queue: Modal[] = [];
  private current: Phaser.GameObjects.Container | null = null;
  private currentPauses = false;
  private advance: (() => void) | null = null;
  private hud!: {
    sol: Phaser.GameObjects.Text;
    clock: Phaser.GameObjects.Text;
    weather: Phaser.GameObjects.Text;
    dayBar: Phaser.GameObjects.Graphics;
    bars: Phaser.GameObjects.Graphics;
    air: Phaser.GameObjects.Text;
    food: Phaser.GameObjects.Text;
    cells: Phaser.GameObjects.Image[];
    inv: Record<string, Phaser.GameObjects.Text>;
    alert: Phaser.GameObjects.Text;
    rover: Phaser.GameObjects.Text;
    hotbar: Phaser.GameObjects.Container;
    hotSel: Phaser.GameObjects.Graphics;
    toolName: Phaser.GameObjects.Text;
  };
  private toasts: Phaser.GameObjects.Text[] = [];
  private director!: Director;
  private listeners: [string, (...a: never[]) => void][] = [];
  private planningOpen = false;
  private boardOpen = false;
  private tint!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('UI');
  }

  create() {
    this.queue = [];
    this.current = null;
    this.planningOpen = false;
    this.boardOpen = false;
    this.toasts = [];
    this.tint = this.add.rectangle(0, 0, W, H, 0x0b1026, 0).setOrigin(0).setDepth(-10);
    this.buildHud();
    this.buildHotbar();
    this.buildBadge();
    this.director = new Director((lines) => this.say(lines));

    const kb = this.input.keyboard!;
    kb.addCapture('TAB,SPACE');
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));

    this.on(UI_EV.TOAST, (p: { text: string }) => this.toast(p.text));
    this.on(EV.RADIO_MESSAGE, (m: { text: string; delayMinutes: number }) => {
      this.toast(`📡 ${m.text}`, C.goldText);
      this.say([{ who: 'radio', text: `${m.text}\n\n(📡 arrived after ${m.delayMinutes} light-minutes; 1 radio minute = 1 game second)` }]);
    });
    this.on(EV.STORM_WARNING, (p: { stormId: string }) => this.director.stormWarning(p.stormId));
    this.on(EV.STORM_HIT, (p: { safe: boolean }) => {
      this.cameras.main.flash(600, 255, 160, 60);
      this.director.stormHit(p.safe);
    });
    this.on(EV.ROVER_DAMAGED, (p: { reason: string }) => this.director.roverDamaged(p.reason));
    this.on(EV.ROVER_RETURN, (p: { deliveredItems: Record<ItemId, number> }) => {
      this.director.roverHome(p.deliveredItems);
      if (p.deliveredItems.sample > 0) this.queuePhotos(p.deliveredItems.sample);
    });
    this.on(EV.ROVER_ITEM_FOUND, (p: { findId: string; item: string; amount: number }) => {
      if (p.findId === 'egg-heli') this.director.propeller();
      else this.toast(`Bolt found ${p.amount} ${p.item === 'seed' ? 'seeds (supply drop!)' : p.item}.`, C.teal);
    });
    this.on(UI_EV.NIGHT_REPORT, (r: NightReport) => this.enqueue({ build: () => this.buildNight(r), pause: true }));
    this.on(EV.SOL_START, (p: { sol: number }) => this.director.morning(p.sol));
    this.on(UI_EV.PHASE_CHANGED, (p: { phase: string }) => {
      if (p.phase === 'rescue') this.director.ending(false, () => this.enqueue({ build: () => this.toDebrief() }));
      if (p.phase === 'debrief') this.director.ending(true, () => this.enqueue({ build: () => this.toDebrief() }));
    });
    this.on('ui:say', (lines: Line[]) => this.say(lines));
    this.on('ui:open', (what: string) => {
      if (what === 'board') this.openBoard();
      if (what === 'help') this.openHelp();
      if (what === 'album') this.openAlbum();
    });

    this.events.once('shutdown', () => {
      for (const [ev, fn] of this.listeners) bus.off(ev, fn);
      this.listeners = [];
      store.resume('modal');
    });

    // Fresh scene: replay the morning story for the current sol if it hasn't been seen.
    if (store.state.phase === 'planning') this.director.morning(store.state.sol);
  }

  private on(ev: string, fn: (...a: never[]) => void) {
    bus.on(ev, fn);
    this.listeners.push([ev, fn]);
  }

  // ---------- modal queue ----------

  enqueue(m: Modal) {
    this.queue.push(m);
    if (!this.current) this.showNext();
  }

  private showNext() {
    if (this.current) return;
    while (this.queue.length) {
      const m = this.queue.shift()!;
      const c = m.build();
      if (!c) continue;
      this.current = c.setDepth(100);
      this.currentPauses = m.pause !== false;
      if (this.currentPauses) store.pause('modal');
      return;
    }
  }

  close() {
    this.current?.destroy();
    this.current = null;
    this.advance = null;
    this.planningOpen = false;
    this.boardOpen = false;
    store.resume('modal');
    this.showNext();
  }

  get busy() {
    return !!this.current || this.queue.length > 0;
  }

  say(lines: Line[]) {
    for (const l of lines) this.enqueue({ build: () => this.buildDialogue(l), pause: true });
  }

  // ---------- keyboard ----------

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (this.current && this.advance && (k === ' ' || k === 'Enter' || k === 'e' || k === 'E')) {
      this.advance();
      return;
    }
    if (this.current && (k === 'Escape' || (k === 'Tab' && this.boardOpen))) {
      if (!this.planningOpen) this.close();
      return;
    }
    if (this.current) return;
    if (k === 'Tab') this.openBoard();
    else if (k === 'h' || k === 'H') this.openHelp();
    else if (k === 'p' || k === 'P') this.openAlbum();
    else if (/^[1-7]$/.test(k)) this.selectTool(Number(k) - 1);
  }

  selectTool(i: number) {
    this.registry.set('tool', i);
  }

  // ---------- HUD ----------

  private buildHud() {
    panel(this, 12, 12, 360, 168, C.panel, 0.9);
    const sol = text(this, 32, 24, '', 30, C.goldText, { fontStyle: 'bold' });
    const clock = text(this, 352, 30, '', 22, C.text).setOrigin(1, 0);
    const dayBar = this.add.graphics();
    const weather = text(this, 32, 86, '', 16, C.dim);
    const bars = this.add.graphics();
    this.add.image(40, 128, 'icon-air').setScale(2);
    this.add.image(204, 128, 'icon-food').setScale(2);
    const air = text(this, 62, 116, '', 18, C.text);
    const food = text(this, 226, 116, '', 18, C.text);
    const cells: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < RULES.cellsPerSol; i++) cells.push(this.add.image(40 + i * 30, 160, 'icon-power').setScale(1.6));
    const right = panel(this, W - 352, 12, 340, 120, C.panel, 0.9);
    right.setDepth(0);
    const inv: Record<string, Phaser.GameObjects.Text> = {};
    const items: [string, string][] = [['seed', 'icon-seed'], ['water', 'icon-water'], ['ice', 'icon-ice'], ['regolith', 'icon-regolith'], ['sample', 'icon-sample'], ['shield', 'icon-shield']];
    items.forEach(([id, icon], i) => {
      const x = W - 330 + (i % 3) * 108;
      const y = 44 + Math.floor(i / 3) * 44;
      this.add.image(x, y, icon).setScale(2);
      inv[id] = text(this, x + 20, y - 12, '', 20, C.text);
    });
    const alert = text(this, W - 20, 142, '', 20, C.warn, { fontStyle: 'bold', align: 'right', backgroundColor: '#1d2333cc', padding: { x: 10, y: 6 } }).setOrigin(1, 0);
    const rover = text(this, W - 20, 186, '', 18, C.teal, { align: 'right', backgroundColor: '#1d2333cc', padding: { x: 10, y: 5 } }).setOrigin(1, 0);
    const hint = text(this, W - 20, H - 18, 'TAB storm board · H help · P photo album', 16, C.dim).setOrigin(1, 1);
    hint.setAlpha(0.8);
    this.hud = { sol, clock, weather, dayBar, bars, air, food, cells, inv, alert, rover, hotbar: this.add.container(0, 0), hotSel: this.add.graphics(), toolName: text(this, 0, 0, '') };
  }

  private buildHotbar() {
    const crops = getData().crops.crops;
    const n = TOOLS.length;
    const size = 64;
    const x0 = W / 2 - (n * size) / 2;
    const y = H - 52;
    const bar = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x0 - 8, y - size / 2 - 6, n * size + 16, size + 16, 12);
    g.fillStyle(C.panel, 0.95);
    g.fillRoundedRect(x0 - 10, y - size / 2 - 10, n * size + 20, size + 16, 12);
    g.lineStyle(3, C.frame);
    g.strokeRoundedRect(x0 - 10, y - size / 2 - 10, n * size + 20, size + 16, 12);
    bar.add(g);
    TOOLS.forEach((tool, i) => {
      const cx = x0 + i * size + size / 2;
      const slot = this.add.rectangle(cx, y - 2, size - 8, size - 8, 0x2a3247).setStrokeStyle(2, 0x3c4660);
      const icon = tool.startsWith('seed:') ? `crop-${crops[Number(tool.slice(5))]?.id}-3` : `icon-${tool}`;
      const img = this.add.image(cx, y - 2, icon).setScale(tool.startsWith('seed:') ? 1.5 : 2.4);
      const num = text(this, cx - size / 2 + 8, y - size / 2 + 2, String(i + 1), 14, C.dim);
      slot.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectTool(i));
      bar.add([slot, img, num]);
    });
    this.hud.hotbar = bar;
    this.hud.hotSel = this.add.graphics();
    this.hud.toolName = text(this, W / 2, H - 104, '', 18, C.text, { backgroundColor: '#1d2333dd', padding: { x: 10, y: 4 } }).setOrigin(0.5, 1);
    if (this.registry.get('tool') === undefined) this.registry.set('tool', 0);
  }

  private buildBadge() {
    const mocks = mockFiles();
    if (!mocks.length) return;
    text(this, W / 2, 8, `MOCK DATA: ${mocks.join(', ')}`, 16, '#1d2333', { backgroundColor: '#ffd166', padding: { x: 8, y: 4 }, fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(200);
  }

  update(_time: number, delta: number) {
    const s = store.state;
    if (!s) return;
    store.tick(delta);
    const h = this.hud;
    const frac = s.phase === 'planning' ? 0 : store.dayFraction();
    h.sol.setText(`Sol ${s.sol} / ${RULES.missionSols}`);
    h.clock.setText(s.phase === 'planning' ? 'Morning' : hourLabel(frac));
    h.dayBar.clear();
    h.dayBar.fillStyle(0x2a3247).fillRoundedRect(32, 68, 320, 10, 5);
    h.dayBar.fillStyle(frac > 0.75 ? 0x7c6cd6 : 0xffd166).fillRoundedRect(32, 68, Math.max(10, 320 * frac), 10, 5);
    const w = store.weather();
    h.weather.setText(`Mars low ${Math.round(w.minC)}°C · high ${Math.round(w.maxC)}°C (InSight)`);

    h.bars.clear();
    const bar = (x: number, v: number, color: number) => {
      h.bars.fillStyle(0x2a3247).fillRoundedRect(x, 136, 120, 10, 5);
      h.bars.fillStyle(v < 25 ? C.red : color).fillRoundedRect(x, 136, Math.max(4, (120 * v) / RULES.resourceMax), 10, 5);
    };
    bar(62, s.air, 0x8fd3ff);
    bar(226, s.food, 0xf08a3a);
    h.air.setText(`Air ${Math.round(s.air)}`);
    h.food.setText(`Food ${Math.round(s.food)}`);

    let ci = 0;
    for (const slot of SLOTS) {
      for (let k = 0; k < s.split[slot]; k++) h.cells[ci] && h.cells[ci++].setTint(SLOT_INFO[slot].color).setAlpha(1);
    }
    for (; ci < h.cells.length; ci++) h.cells[ci].setTint(0x555d70).setAlpha(s.phase === 'planning' ? 0.9 : 0.4);

    for (const id of ['seed', 'water', 'ice', 'regolith', 'sample'] as ItemId[]) h.inv[id].setText(String(s.inventory[id]));
    h.inv.shield.setText(`${s.shield}/${RULES.maxShieldLayers}`);

    const pending = store.pendingStorms();
    if (pending.length) {
      const next = pending[0];
      const left = next.hitAtMs - s.missionElapsedMs;
      const need = Math.max(0, next.event.scenario.strength - s.shield);
      h.alert.setText(`⚠ STORM in ${fmtMs(left)} (sol ${next.event.scenario.gameSol}) · shelter needs ${need}`);
      h.alert.setVisible(true).setAlpha(left < 30000 ? 0.6 + 0.4 * Math.abs(Math.sin(this.time.now / 200)) : 1);
    } else h.alert.setVisible(false);

    const r = s.rover;
    const roverText =
      r.status === 'out' ? `Bolt is driving · battery ${r.batteryCells.toFixed(1)}` :
      r.status === 'stranded' ? 'Bolt is stuck outside (towed home tonight)' :
      r.status === 'repairing' ? `Rover in repair until sol ${r.availableSol}` :
      s.split.rover > 0 && r.lastLaunchSol !== s.sol ? `Rover ready · ${s.split.rover} cell${s.split.rover > 1 ? 's' : ''}` : 'Bolt is home';
    h.rover.setText(roverText);

    // Hotbar selection.
    const tool = (this.registry.get('tool') as number) ?? 0;
    const size = 64;
    const x0 = W / 2 - (TOOLS.length * size) / 2;
    h.hotSel.clear().lineStyle(4, C.gold).strokeRoundedRect(x0 + tool * size + 2, H - 52 - size / 2 + 0, size - 4, size - 4, 8);
    const crops = getData().crops.crops;
    const t = TOOLS[tool];
    const inFarm = this.scene.isActive('Farm');
    h.hotbar.setVisible(inFarm);
    h.hotSel.setVisible(inFarm);
    h.toolName.setVisible(inFarm);
    h.toolName.setText(t.startsWith('seed:') ? `${crops[Number(t.slice(5))]?.name} seeds` : t === 'can' ? 'Watering can' : 'Hand (harvest / clear)');

    // Evening light.
    this.tint.setFillStyle(0x0b1026, inFarm && s.phase === 'day' ? Math.max(0, (frac - 0.7) * 1.2) : 0);

    // Morning planning panel appears once nothing else is queued.
    if (s.phase === 'planning' && !this.current && !this.queue.length && !this.planningOpen) {
      this.planningOpen = true;
      this.enqueue({ build: () => this.buildMorning(), pause: true });
      this.planningOpen = true;
    }

    // Toast fade.
    const toastBase = this.scene.isActive('Rover') ? H - 150 : H - 130;
    this.toasts.forEach((t, i) => t.setY(toastBase - (this.toasts.length - 1 - i) * 34));
  }

  toast(str: string, color = C.text) {
    const t = text(this, 16, H - 130, str, 18, color, { backgroundColor: '#141927dd', padding: { x: 10, y: 5 }, wordWrap: { width: 400 } }).setDepth(50);
    this.toasts.push(t);
    if (this.toasts.length > 4) this.toasts.shift()?.destroy();
    this.tweens.add({ targets: t, alpha: 0, delay: 5000, duration: 800, onComplete: () => {
      t.destroy();
      this.toasts = this.toasts.filter((x) => x !== t);
    } });
  }

  // ---------- dialogue ----------

  private buildDialogue(line: Line) {
    const c = this.add.container(0, 0);
    const sp = SPEAKERS[line.who];
    const x = 120, y = H - 250, w = W - 240, h = 200;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.25).setOrigin(0).setInteractive());
    c.add(panel(this, x, y, w, h));
    const portraitKey = line.who === 'bolt' && line.mood ? `portrait-bolt-${line.mood}` : sp.portrait;
    c.add(this.add.rectangle(x + 96, y + h / 2, 140, 140, 0x2a3247).setStrokeStyle(3, C.frameDark));
    if (this.textures.exists(portraitKey)) c.add(this.add.image(x + 96, y + h / 2 + 6, portraitKey).setScale(line.who === 'radio' ? 1.9 : 2));
    c.add(text(this, x + 186, y + 22, sp.name, 22, sp.color, { fontStyle: 'bold' }));
    const body = text(this, x + 186, y + 58, '', 24, C.text, { wordWrap: { width: w - 220 }, lineSpacing: 6 });
    c.add(body);
    const more = text(this, x + w - 24, y + h - 18, '▼ SPACE', 16, C.dim).setOrigin(1, 1);
    c.add(more);
    this.tweens.add({ targets: more, alpha: 0.3, yoyo: true, repeat: -1, duration: 500 });
    const full = this.director.fill(line.text);
    let shown = 0;
    const timer = this.time.addEvent({ delay: 18, loop: true, callback: () => {
      shown = Math.min(full.length, shown + 2);
      body.setText(full.slice(0, shown));
      if (shown >= full.length) timer.remove();
    } });
    c.once('destroy', () => timer.remove()); // Escape can close the line mid-typing

    this.advance = () => {
      if (shown < full.length) {
        shown = full.length;
        body.setText(full);
        timer.remove();
      } else this.close();
    };
    c.list[0].on('pointerdown', () => this.advance?.());
    return c;
  }

  // ---------- morning: power planning ----------

  private buildMorning() {
    const c = this.add.container(0, 0);
    const s = store.state;
    const x = 200, y = 70, w = W - 400, h = 590;
    c.add(this.add.rectangle(0, 0, W, H, 0x0b1026, 0.55).setOrigin(0).setInteractive());
    c.add(panel(this, x, y, w, h));
    c.add(text(this, W / 2, y + 26, `Good morning! Sol ${s.sol}`, 34, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const wx = store.weather();
    const cold = store.needsHeater();
    c.add(text(this, x + 40, y + 84,
      `Real Mars weather · NASA InSight, Mars sol ${wx.marsSol} (Earth date ${wx.earthDate})\nLow ${wx.minC}°C, high ${wx.maxC}°C${wx.windAvg !== null ? `, wind ${wx.windAvg} m/s` : ''}. Archived 2020 data, replayed in the game.`,
      17, C.teal, { wordWrap: { width: w - 80 } }));
    c.add(text(this, x + 40, y + 140, `Split today's ${s.cellsToday} power cells. Unused cells are wasted. (Game rules, not NASA numbers.)`, 18, C.dim));

    const rows = this.add.container(0, 0);
    c.add(rows);
    const storms = store.storms().filter((st) => st.event.scenario.gameSol === s.sol && !s.processedStormHits.includes(st.event.id));
    const warned = storms.filter((st) => s.processedWarnings.includes(st.event.id));
    const roverCan = store.roverCanLaunch();
    const hints: Record<PowerSlot, () => string> = {
      growLights: () => `Each cell lights up to ${RULES.growLightsPlotsPerCell} watered plants so they grow and make air. Planted: ${s.plots.filter((p) => p.cropId).length}.`,
      heater: () => (cold ? `Tonight is colder than ${RULES.heaterNeededBelowC}°C. Without 1 heater cell, plants won't grow.` : 'Warm enough tonight. The heater is optional.'),
      shelter: () => warned.length
        ? `⚠ STORM TODAY! Strength ${warned[0].event.scenario.strength} (simulated). Shelter cells + ${s.shield} shield layer(s) must reach it.`
        : 'No storm warning for today. Check the storm board (TAB).',
      rover: () => (s.rover.status === 'home' && s.sol >= s.rover.availableSol ? 'Cells here become Bolt\'s battery for one drive today.' : roverCan.ok ? '' : `Rover can't drive today: ${s.rover.status === 'out' ? 'Bolt is still out.' : 'in repair.'}`),
    };
    const render = () => {
      rows.removeAll(true);
      const total = store.splitTotal();
      SLOTS.forEach((slot, i) => {
        const ry = y + 190 + i * 76;
        const info = SLOT_INFO[slot];
        rows.add(this.add.rectangle(x + 40, ry, w - 80, 66, 0x2a3247).setOrigin(0, 0));
        rows.add(this.add.image(x + 74, ry + 33, info.icon).setScale(3));
        rows.add(text(this, x + 108, ry + 8, info.label, 22, C.text, { fontStyle: 'bold' }));
        rows.add(text(this, x + 108, ry + 38, hints[slot](), 15, slot === 'shelter' && warned.length ? C.warn : C.dim, { wordWrap: { width: 470 } }));
        const minus = button(this, x + w - 160, ry + 33, '–', () => {
          if (s.split[slot] > 0) store.setPowerSplit({ ...s.split, [slot]: s.split[slot] - 1 });
          render();
        }, 54, 44, 0x9aa3b0);
        const plus = button(this, x + w - 90, ry + 33, '+', () => {
          const r = store.setPowerSplit({ ...s.split, [slot]: s.split[slot] + 1 });
          if (!r.ok) this.toast(r.reason, C.warn);
          render();
        }, 54, 44, total < s.cellsToday ? C.frame : 0x555d70);
        rows.add([minus, plus]);
      });
      const left = s.cellsToday - total;
      rows.add(text(this, x + 40, y + h - 66, left > 0 ? `${left} cell${left > 1 ? 's' : ''} left · drag ⚡ into a row` : 'All cells placed!', 22, left > 0 ? C.goldText : C.ok));
      addPowerCells(this, rows, {
        rowX: x + 40, rowW: w - 80, rowY: (i) => y + 190 + i * 76, rowH: 66,
        cellX: x + 600, trayX: x + 380, trayY: y + h - 52, tint: (sl) => SLOT_INFO[sl].color,
      }, render, (reason) => this.toast(reason, C.warn));
    };
    render();
    c.add(button(this, x + w - 150, y + h - 50, 'Start the day ▶', () => {
      store.startDay();
      this.close();
    }, 240, 54, 0xffd166));
    return c;
  }

  // ---------- night ----------

  private buildNight(r: NightReport) {
    const c = this.add.container(0, 0);
    const x = 220, y = 80, w = W - 440, h = 560;
    c.add(this.add.rectangle(0, 0, W, H, 0x05070f, 0.75).setOrigin(0).setInteractive());
    c.add(panel(this, x, y, w, h, C.panelDark));
    c.add(text(this, W / 2, y + 26, `Night falls on sol ${r.sol}`, 32, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const lines = [
      `🫁 Air: ${Math.round(r.air[0])} → ${Math.round(r.air[1])}    🥕 Food: ${Math.round(r.food[0])} → ${Math.round(r.food[1])}`,
      r.blackout ? '⚡ The storm knocked out the grow lights today. Nothing grew.' :
        !r.warm ? `❄ Too cold (${r.minC}°C) and no heater: the plants took a sol off.` :
        `🌱 ${r.litPlots} plant${r.litPlots === 1 ? '' : 's'} got light; ${r.grownPlots} grew a step.`,
    ];
    if (r.roverRecovered) lines.push('🚙 The crew towed the rover home. It needs a sol of repairs.');
    if (r.outcome === 'rescue') lines.push('⚠ Supplies ran out. Time to call for help.');
    if (r.outcome === 'debrief') lines.push('🚀 That was the final sol!');
    c.add(text(this, x + 40, y + 90, lines.join('\n'), 21, C.text, { lineSpacing: 10, wordWrap: { width: w - 80 } }));
    if (r.card) {
      const cy = y + 250;
      c.add(this.add.rectangle(x + 40, cy, w - 80, 200, 0x2a3247).setOrigin(0).setStrokeStyle(2, C.frame));
      c.add(this.add.image(x + 100, cy + 100, 'portrait-bolt-happy').setScale(1.5));
      c.add(text(this, x + 160, cy + 16, 'Bolt\'s science card · real NASA fact', 18, C.goldText, { fontStyle: 'bold' }));
      c.add(text(this, x + 160, cy + 48, r.card.text, 19, C.text, { wordWrap: { width: w - 240 }, lineSpacing: 4 }));
      const src = text(this, x + 160, cy + 172, `Source: ${r.card.source.replace(/^https?:\/\//, '').slice(0, 70)} ↗`, 15, C.teal).setInteractive({ useHandCursor: true });
      src.on('pointerdown', () => window.open(r.card!.source, '_blank', 'noopener'));
      c.add(src);
    }
    const label = r.outcome === 'next' ? 'Sleep until morning ▶' : 'Continue ▶';
    c.add(button(this, W / 2, y + h - 48, label, () => this.close(), 300, 54, 0xffd166));
    this.advance = () => this.close();
    return c;
  }

  // ---------- storm board ----------

  openBoard() {
    if (this.current) return;
    this.enqueue({ build: () => this.buildBoard(), pause: true });
    this.boardOpen = true;
  }

  private buildBoard() {
    this.boardOpen = true;
    const c = this.add.container(0, 0);
    const s = store.state;
    const week = store.week();
    const x = 140, y = 50, w = W - 280, h = 620;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.5).setOrigin(0).setInteractive().on('pointerdown', () => this.close()));
    c.add(panel(this, x, y, w, h));
    c.add(text(this, x + 32, y + 22, '☀ Space Weather Board', 30, C.goldText, { fontStyle: 'bold' }));
    c.add(text(this, x + 32, y + 62, `Scenario: ${week.label} · real events from ${week.realWindow[0]} to ${week.realWindow[1]}, replayed over ${RULES.missionSols} sols.`, 17, C.dim, { wordWrap: { width: w - 64 } }));
    let yy = y + 104;
    for (const st of store.storms()) {
      const e = st.event;
      const warned = s.processedWarnings.includes(e.id);
      const hit = s.processedStormHits.includes(e.id);
      c.add(this.add.rectangle(x + 32, yy, w - 64, 128, 0x2a3247).setOrigin(0));
      if (!warned && !hit) {
        c.add(text(this, x + 52, yy + 20, '❔ No forecast yet', 22, C.dim));
        c.add(text(this, x + 52, yy + 56, 'Mission Control will radio a warning when its forecasters spot something.', 17, C.dim));
      } else {
        for (let i = 0; i < e.scenario.strength; i++) c.add(this.add.image(x + 64 + i * 34, yy + 30, 'icon-sun').setScale(2));
        c.add(text(this, x + 64 + 3 * 34, yy + 16, `Strength ${e.scenario.strength}`, 20, C.text, { fontStyle: 'bold' }));
        c.add(text(this, x + 64 + 3 * 34 + 130, yy + 18, 'SIMULATED', 14, '#1d2333', { backgroundColor: '#c9a6ff', padding: { x: 6, y: 2 } }));
        const status = hit ? 'Passed' : `Hits sol ${e.scenario.gameSol} at 1:00 pm · in ${fmtMs(st.hitAtMs - s.missionElapsedMs)} of daytime`;
        c.add(text(this, x + w - 52, yy + 18, status, 19, hit ? C.ok : C.warn, { fontStyle: 'bold' }).setOrigin(1, 0));
        const real = new Date(e.realTime).toUTCString().replace(' GMT', ' UTC').slice(5);
        const kind = e.type === 'CME' ? 'Coronal mass ejection (CME)' : e.type === 'SEP' ? 'Solar energetic particles (SEP)' : e.type;
        const arrival = e.marsArrival ? ` · ${e.marsArrival.model || 'model'} ${e.marsArrival.status} Mars arrival ${e.marsArrival.time}` : '';
        c.add(text(this, x + 52, yy + 58, `Real record: ${kind}, ${real}${e.speedKmS ? `, ${e.speedKmS} km/s` : ''}\nObserved by/target: ${e.observedTarget === 'unknown' ? 'target not listed' : e.observedTarget}${arrival}`, 16, C.teal, { wordWrap: { width: w - 120 } }));
        const link = text(this, x + w - 52, yy + 100, 'NASA DONKI record ↗', 15, C.goldText).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        link.on('pointerdown', () => window.open(e.link, '_blank', 'noopener'));
        c.add(link);
      }
      yy += 140;
    }
    c.add(text(this, x + 32, y + h - 76,
      'Strength, timing and effects on our outpost are a game scenario. The dates and records are real NASA DONKI data.\nTimeline compressed. 1 radio minute = 1 second of game time. Shelter cells + shield layers ≥ strength keeps everyone safe.',
      15, C.sim, { wordWrap: { width: w - 64 }, lineSpacing: 4 }));
    c.add(text(this, x + w - 24, y + 20, '✕ TAB', 18, C.dim).setOrigin(1, 0));
    return c;
  }

  // ---------- help ----------

  openHelp() {
    if (this.current) return;
    this.enqueue({ build: () => this.buildHelp(), pause: true });
  }

  private buildHelp() {
    const c = this.add.container(0, 0);
    const x = 180, y = 60, w = W - 360, h = 600;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.5).setOrigin(0).setInteractive().on('pointerdown', () => this.close()));
    c.add(panel(this, x, y, w, h));
    c.add(text(this, x + 32, y + 22, 'How to play', 30, C.goldText, { fontStyle: 'bold' }));
    const body = [
      'MOVE: arrow keys or WASD.   ACT: SPACE (or click a nearby square).',
      'TOOLS: 1–5 seeds · 6 watering can · 7 hand (harvest / clear wilted plants).',
      '',
      'Every morning, split 6 power cells between grow lights, heater, shelter and rover.',
      'Plants need water every sol, light, and warmth to grow. Growing plants make AIR.',
      'Harvest ripe crops for FOOD. The crew uses air and food every night.',
      'Storms: shelter cells + shield layers must be at least the storm strength.',
      'Rover: walk to the airlock (top door). Plan a route that starts and ends at the dome.',
      'Ice → water at the melter. 3 regolith → 1 shield layer at the workbench.',
      '',
      'Keep air and food above zero for 10 sols until the supply ship arrives!',
      'TAB storm board · P photo album · H this help · ESC closes panels.',
    ].join('\n');
    c.add(text(this, x + 32, y + 80, body, 20, C.text, { lineSpacing: 8, wordWrap: { width: w - 64 } }));
    c.add(button(this, W / 2, y + h - 48, 'Got it', () => this.close(), 200, 50, 0xffd166));
    this.advance = () => this.close();
    return c;
  }

  // ---------- photos ----------

  private queuePhotos(n: number) {
    const earned = store.meta.photosEarned;
    const photos = getData().photos.photos.filter((p) => earned.includes(p.nasaId)).slice(-n);
    for (const p of photos) this.enqueue({ build: () => this.buildPhoto(p.nasaId), pause: true });
  }

  private buildPhoto(nasaId: string) {
    const p = getData().photos.photos.find((x) => x.nasaId === nasaId)!;
    const c = this.add.container(0, 0);
    const x = 260, y = 70, w = W - 520, h = 580;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive());
    c.add(panel(this, x, y, w, h));
    c.add(text(this, W / 2, y + 22, 'New photo for the mission album!', 26, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    const holder = this.add.rectangle(W / 2, y + 260, w - 80, 340, 0x2a3247);
    c.add(holder);
    const loading = text(this, W / 2, y + 260, 'Loading NASA photo…', 18, C.dim).setOrigin(0.5);
    c.add(loading);
    const key = `photo-${nasaId}`;
    const place = () => {
      if (!c.active) return;
      loading.destroy();
      if (!this.textures.exists(key)) {
        c.add(text(this, W / 2, y + 260, '(Photo could not load. Your rock sample still counts!)', 18, C.dim).setOrigin(0.5));
        return;
      }
      const img = this.add.image(W / 2, y + 260, key);
      const sc = Math.min((w - 90) / img.width, 330 / img.height);
      img.setScale(sc);
      c.add(img);
    };
    if (this.textures.exists(key)) place();
    else {
      this.load.setCORS('anonymous');
      this.load.image(key, p.url);
      this.load.once('complete', place);
      this.load.start();
    }
    c.add(text(this, W / 2, y + 446, p.title, 20, C.text, { align: 'center', wordWrap: { width: w - 80 } }).setOrigin(0.5, 0));
    const credit = text(this, W / 2, y + 486, `Credit: ${p.credit} · NASA Image and Video Library ↗`, 15, C.teal).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    credit.on('pointerdown', () => window.open(p.page || `https://images.nasa.gov/details/${p.nasaId}`, '_blank', 'noopener'));
    c.add(credit);
    c.add(button(this, W / 2, y + h - 36, 'Add to album', () => this.close(), 220, 46, 0xffd166));
    this.advance = () => this.close();
    return c;
  }

  openAlbum() {
    if (this.current) return;
    const earned = store.meta.photosEarned;
    if (!earned.length) {
      this.say([{ who: 'bolt', text: 'Our photo album is empty. Bring rock samples home with the rover and Mission Control sends a real NASA photo for each one!' }]);
      return;
    }
    for (const id of earned) this.enqueue({ build: () => this.buildPhoto(id), pause: true });
  }

  private toDebrief() {
    this.time.delayedCall(10, () => {
      this.scene.stop('Farm');
      this.scene.stop('Rover');
      this.scene.start('Debrief');
    });
    return null;
  }
}


