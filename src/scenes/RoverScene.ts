import Phaser from 'phaser';
import { store } from '../core/store';
import { getData } from '../data/loaders';
import { C, button, fmtMs, text } from '../ui/theme';
import { ITEM_ICON } from '../ui/icons';
import { getActiveFindsForSol } from '../rover/findsManager';
import { getActiveStormWarnings } from '../rover/stormMonitor';
import { evaluateRoute } from '../rover/routePlanner';
import { setScrollFactorTree } from '../ui/screen-space';

// Rover map: NASA Mars imagery or an original lunar terrain illustration. Plan a route like a real
// rover driver (the whole drive is decided before Bolt leaves), then watch it play out.

type Cell = [number, number];
const MORSE_JPL = '.---.--..-..'; // J .--- P .--. L .-.. (Curiosity's wheel pattern, see trivia.json)

export class RoverScene extends Phaser.Scene {
  private route: Cell[] = [];
  private legs: number[] = [];
  private routeGfx!: Phaser.GameObjects.Graphics;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private costGfx!: Phaser.GameObjects.Graphics;
  private rover!: Phaser.GameObjects.Image;
  private findIcons = new Map<string, Phaser.GameObjects.Container>();
  private info!: Phaser.GameObjects.Text;
  private sendBtn!: Phaser.GameObjects.Container;
  private planUi!: Phaser.GameObjects.Container;
  private hover!: Phaser.GameObjects.Rectangle;
  private showCost = true;
  private lastAngle = 0;
  private findsKey = '';
  private lastStatus = '';

  constructor() {
    super('Rover');
  }

  create() {
    this.findIcons = new Map();
    const t = store.data.terrain;
    const cell = t.cell;
    const worldW = t.width * cell;
    const worldH = t.height * cell;
    if (t.tiles.length) {
      for (const tile of t.tiles) this.add.image(tile.x, tile.y, `trek:${tile.file}`).setOrigin(0);
    } else {
      this.drawIllustratedTerrain(t);
    }

    this.costGfx = this.add.graphics().setDepth(1);
    this.drawCost();
    this.trailGfx = this.add.graphics().setDepth(2);
    this.routeGfx = this.add.graphics().setDepth(3);
    this.hover = this.add.rectangle(0, 0, cell, cell).setStrokeStyle(2, 0xffffff, 0.8).setDepth(4);

    const [dx, dy] = t.dome;
    this.add.image(dx * cell + cell / 2, dy * cell + cell / 2, 'dome-top').setDepth(5);
    this.refreshFinds();
    this.rover = this.add.image(0, 0, 'rover-top').setDepth(6);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.centerOn(dx * cell, dy * cell);
    cam.setBackgroundColor('#1a0f0c');
    cam.fadeIn(250);

    this.buildPanel();
    this.resetRoute();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const [x, y] = this.cellAt(p);
      this.hover.setPosition(x * cell + cell / 2, y * cell + cell / 2);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (store.paused || p.y > 570) return; // the info panel and its credit line start here
      if (p.rightButtonDown()) return this.undo();
      this.extendTo(this.cellAt(p));
    });
    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    kb.on('keydown-BACKSPACE', () => this.undo());
    kb.on('keydown-C', () => {
      this.showCost = !this.showCost;
      this.drawCost();
    });
    kb.on('keydown-ESC', () => this.leave());
    // Scene events outlive a restart, so remove this listener again on shutdown.
    const onWake = () => {
      this.cameras.main.fadeIn(250);
      this.resetRoute();
    };
    this.events.on('wake', onWake);
    this.events.once('shutdown', () => this.events.off('wake', onWake));
    this.lastStatus = store.state.rover.status;
  }

  private refreshFinds() {
    for (const icon of this.findIcons.values()) icon.destroy();
    this.findIcons.clear();
    const t = store.data.terrain;
    const cell = t.cell;
    const sol = this.findsSol();
    this.findsKey = `${store.state.stormWeekId}:${sol}`;
    for (const f of [...t.finds, ...getActiveFindsForSol(t, store.state.stormWeekId, sol)]) {
      const c = this.add.container(f.x * cell + cell / 2, f.y * cell + cell / 2).setDepth(4);
      const glow = this.add.image(0, 0, 'find-glow').setAlpha(0.8);
      this.tweens.add({ targets: glow, alpha: 0.2, scale: 1.2, yoyo: true, repeat: -1, duration: 900 });
      const icon = f.egg ? this.add.image(0, 0, 'propeller').setScale(2) : this.add.image(0, 0, ITEM_ICON[f.item]).setScale(1.6);
      c.add([glow, icon]);
      this.findIcons.set(f.id, c);
    }
  }

  /** While Bolt is out, keep showing the finds of the sol the trip started on (matches the store). */
  private findsSol() {
    const r = store.state.rover;
    return r.status === 'out' || r.status === 'stranded' ? r.lastLaunchSol : store.state.sol;
  }

  private cellAt(p: Phaser.Input.Pointer): Cell {
    const t = store.data.terrain;
    const x = Phaser.Math.Clamp(Math.floor(p.worldX / t.cell), 0, t.width - 1);
    const y = Phaser.Math.Clamp(Math.floor(p.worldY / t.cell), 0, t.height - 1);
    return [x, y];
  }

  private drawCost() {
    const t = store.data.terrain;
    const g = this.costGfx.clear();
    if (!this.showCost) return;
    for (let y = 0; y < t.height; y++) {
      for (let x = 0; x < t.width; x++) {
        const c = t.cost[y][x];
        if (c === 1) continue;
        g.fillStyle(c === 3 ? 0xff4d4d : 0xffc04d, c === 3 ? 0.2 : 0.1);
        g.fillRect(x * t.cell, y * t.cell, t.cell, t.cell);
      }
    }
  }

  /** The lunar map is an original game illustration; it has no orbital imagery tiles. */
  private drawIllustratedTerrain(terrain: ReturnType<typeof getData>['terrain']) {
    const g = this.add.graphics().setDepth(0);
    const cell = terrain.cell;
    for (let y = 0; y < terrain.height; y++) {
      for (let x = 0; x < terrain.width; x++) {
        const cost = terrain.cost[y]?.[x] ?? 1;
        const seed = (x * 73 + y * 131 + x * y * 17) % 29;
        const base = seed % 3 === 0 ? 0x756f7b : seed % 3 === 1 ? 0x625e6b : 0x817b85;
        g.fillStyle(base, 1).fillRect(x * cell, y * cell, cell, cell);
        if ((x * 17 + y * 31) % 13 === 0) {
          const cx = x * cell + cell * (0.35 + (seed % 4) * 0.1);
          const cy = y * cell + cell * (0.35 + ((seed * 3) % 4) * 0.1);
          const radius = 5 + (seed % 7);
          g.fillStyle(0x474450, 0.9).fillCircle(cx, cy, radius + 2);
          g.fillStyle(0x9b9299, 0.8).fillCircle(cx, cy, radius);
          g.fillStyle(0x514e5b, 0.85).fillCircle(cx - 1, cy - 1, Math.max(2, radius - 3));
        }
        if (cost > 1) {
          g.fillStyle(cost === 3 ? 0xa06c63 : 0xaaa078, cost === 3 ? 0.32 : 0.2)
            .fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    g.lineStyle(1, 0x33313d, 0.3);
    for (let x = 0; x <= terrain.width; x++) g.lineBetween(x * cell, 0, x * cell, terrain.height * cell);
    for (let y = 0; y <= terrain.height; y++) g.lineBetween(0, y * cell, terrain.width * cell, y * cell);
  }

  // ---------- planning ----------

  private resetRoute() {
    this.route = [store.data.terrain.dome];
    this.legs = [];
  }

  /** Cheapest path (by terrain cost) between two cells. */
  private path(from: Cell, to: Cell): Cell[] {
    const t = store.data.terrain;
    const key = (x: number, y: number) => y * t.width + x;
    const dist = new Map<number, number>([[key(...from), 0]]);
    const prev = new Map<number, number>();
    const open: [number, number, number][] = [[0, from[0], from[1]]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [d, x, y] = open.shift()!;
      if (x === to[0] && y === to[1]) break;
      if (d > (dist.get(key(x, y)) ?? Infinity)) continue;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= t.width || ny >= t.height) continue;
        const nd = d + t.cost[ny][nx];
        if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
          dist.set(key(nx, ny), nd);
          prev.set(key(nx, ny), key(x, y));
          open.push([nd, nx, ny]);
        }
      }
    }
    const out: Cell[] = [];
    let k: number | undefined = key(...to);
    while (k !== undefined && k !== key(...from)) {
      out.unshift([k % t.width, Math.floor(k / t.width)]);
      k = prev.get(k);
    }
    return out;
  }

  private planning() {
    return store.state.rover.status === 'home';
  }

  private extendTo(cell: Cell) {
    if (!this.planning()) return;
    const last = this.route[this.route.length - 1];
    if (last[0] === cell[0] && last[1] === cell[1]) return;
    const leg = this.path(last, cell);
    if (!leg.length) return;
    this.route.push(...leg);
    this.legs.push(leg.length);
  }

  private undo() {
    if (!this.planning() || !this.legs.length) return;
    const n = this.legs.pop()!;
    this.route.splice(this.route.length - n, n);
  }

  private returnHome() {
    if (!this.planning()) return;
    this.extendTo(store.data.terrain.dome);
  }

  private send() {
    const r = store.launchRover(this.route);
    if (!r.ok) {
      store.log(r.reason);
      return;
    }
    this.legs = [];
  }

  private leave() {
    if (store.paused) return;
    this.cameras.main.fadeOut(200);
    this.time.delayedCall(220, () => {
      this.scene.sleep();
      this.scene.wake('Farm');
      this.scene.bringToTop('UI');
    });
  }

  // ---------- UI ----------

  private buildPanel() {
    const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0x141927, 0.92).fillRoundedRect(16, 610, 1248, 98, 12);
    g.lineStyle(3, C.frame).strokeRoundedRect(16, 610, 1248, 98, 12);
    ui.add(g);
    this.info = text(this, 36, 622, '', 18, C.text, { lineSpacing: 6, wordWrap: { width: 640 } });
    ui.add(this.info);
    this.planUi = this.add.container(0, 0);
    this.planUi.add(button(this, 760, 658, '« Undo', () => this.undo(), 110, 44, 0x9aa3b0));
    this.planUi.add(button(this, 884, 658, '🏠 Return', () => this.returnHome(), 130, 44, 0x9aa3b0));
    this.sendBtn = button(this, 1034, 658, 'Send Bolt »', () => this.send(), 150, 50, 0xffd166);
    this.planUi.add(this.sendBtn);
    ui.add(this.planUi);
    ui.add(button(this, 1190, 658, 'Inside', () => this.leave(), 110, 44, C.frame));
    const terrain = store.data.terrain;
    const creditText = store.worldId === 'moon'
      ? `Illustrated Moon terrain · ${terrain.site.name} · 1 square ≈ ${terrain.kmPerCell} km · C: toggle rough ground`
      : `NASA Mars Trek · Viking colour mosaic · ${terrain.site.name} · 1 square ≈ ${terrain.kmPerCell} km · C: toggle rough ground`;
    const credit = text(this, 1252, 600, creditText, 14, C.dim, { backgroundColor: '#141927cc', padding: { x: 8, y: 4 } }).setOrigin(1, 1);
    ui.add(credit);
    // Pin each interactive child as well as the panel. Phaser's hit testing uses
    // the leaf Zone's scroll factor, even when a parent Container is fixed to the screen.
    setScrollFactorTree(ui, 0);
  }

  update() {
    const s = store.state;
    if (!s) return;
    const t = store.data.terrain;
    const cell = t.cell;
    const r = s.rover;
    if (this.findsKey !== `${s.stormWeekId}:${this.findsSol()}`) this.refreshFinds();
    // Bolt just got home (or out of repair): clear the finished route so it isn't re-sent.
    if (r.status !== this.lastStatus) {
      if (r.status === 'home') this.resetRoute();
      this.lastStatus = r.status;
    }

    for (const [id, c] of this.findIcons) c.setVisible(!r.collectedFindIds.includes(id));

    const pos = store.roverPosition();
    this.rover.setPosition(pos.x * cell + cell / 2, pos.y * cell + cell / 2);
    this.rover.setVisible(r.status !== 'repairing');
    if (r.status === 'out' && r.route[r.nextRouteIndex]) {
      const a = r.route[r.nextRouteIndex - 1];
      const b = r.route[r.nextRouteIndex];
      this.lastAngle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    this.rover.setRotation(this.lastAngle);
    this.rover.setTint(r.status === 'stranded' ? 0xff8080 : 0xffffff);

    // Route drawing.
    const g = this.routeGfx.clear();
    const planning = this.planning();
    const drawn = planning ? this.route : r.route.slice(Math.max(0, r.nextRouteIndex - 1));
    const budget = planning ? s.split.rover : r.batteryCells;
    let spent = 0;
    drawn.forEach((p, i) => {
      if (i > 0) spent += store.tileCost(p[0], p[1]);
      const over = spent > budget + 1e-9;
      g.fillStyle(over ? 0xff5a5a : 0xffd166, 1);
      g.fillCircle(p[0] * cell + cell / 2, p[1] * cell + cell / 2, i === drawn.length - 1 ? 6 : 4);
      if (i > 0) {
        const q = drawn[i - 1];
        g.lineStyle(3, over ? 0xff5a5a : 0xffd166, 0.7);
        g.lineBetween(q[0] * cell + cell / 2, q[1] * cell + cell / 2, p[0] * cell + cell / 2, p[1] * cell + cell / 2);
      }
    });

    // Wheel tracks behind Bolt, stamped in a dot-dash pattern (a nod to Curiosity's wheels).
    const tg = this.trailGfx.clear();
    if (r.status === 'out' || r.status === 'stranded') {
      const done = r.route.slice(0, r.nextRouteIndex);
      done.forEach((p, i) => {
        const ch = MORSE_JPL[i % MORSE_JPL.length];
        tg.fillStyle(0x3a1a10, 0.7);
        if (ch === '.') tg.fillCircle(p[0] * cell + cell / 2, p[1] * cell + cell / 2, 3);
        else tg.fillRect(p[0] * cell + cell / 2 - 7, p[1] * cell + cell / 2 - 2, 14, 4);
      });
    }

    // Info text.
    this.planUi.setVisible(planning);
    const dayLeft = store.dayEndMs() - s.missionElapsedMs;
    const stormLine = getActiveStormWarnings(s, store.data.storms.weeks)
      .map((st) => `\n⚠ ${store.worldId === 'moon' ? 'Radiation scenario' : 'Storm'} on ${store.world.dayLabel.toLowerCase()} ${st.event.scenario.gameSol} hits in ${fmtMs(st.hitAtMs - s.missionElapsedMs)} of daytime. Be home before it!`)
      .join('');
    if (planning) {
      const can = store.roverCanLaunch();
      const cost = evaluateRoute(this.route, t, s.split.rover, store.rules.roverCostPerTile).totalBatteryCost;
      const tiles = this.route.length - 1;
      const home = this.route.length > 1 && this.route[this.route.length - 1][0] === t.dome[0] && this.route[this.route.length - 1][1] === t.dome[1];
      this.info.setText(
        (can.ok ? `Plan a drive: click the map to add stops, then 🏠 Return.  Battery: ${s.split.rover} cell(s)\n` : `${can.reason}\n`) +
          `Route: ${tiles} squares · needs ${cost.toFixed(1)} cells · takes ${fmtMs(tiles * store.rules.roverMsPerTile)} (day left ${fmtMs(dayLeft)})` +
          (tiles && !home ? ' · must end at the dome' : '') +
          (cost > s.split.rover + 1e-9 ? ' · ⚠️ not enough battery!' : '') +
          stormLine,
      );
      this.info.setColor(can.ok ? C.text : C.warn);
    } else if (r.status === 'out') {
      const left = (r.route.length - r.nextRouteIndex) * store.rules.roverMsPerTile;
      const cargo = Object.entries(r.cargo).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ') || 'empty';
      this.info.setText(`Bolt is driving! Battery ${r.batteryCells.toFixed(1)} · home in about ${fmtMs(left)}\nCargo: ${cargo}${stormLine}`);
      this.info.setColor(C.teal);
    } else if (r.status === 'stranded') {
      this.info.setText('Bolt is stuck out here. The crew will tow the rover home tonight. Cargo will be lost.');
      this.info.setColor(C.warn);
    } else {
      this.info.setText(`The rover is in repair until ${store.world.dayLabel.toLowerCase()} ${r.availableSol}.`);
      this.info.setColor(C.warn);
    }
  }
}
