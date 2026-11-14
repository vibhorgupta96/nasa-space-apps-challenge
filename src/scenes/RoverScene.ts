import Phaser from 'phaser';
import { store } from '../core/store';
import { getData } from '../data/loaders';
import { C, button, fmtMs, text } from '../ui/theme';
import { ITEM_ICON } from '../ui/icons';
import { getActiveFindsForSol } from '../rover/findsManager';
import { getActiveStormWarnings } from '../rover/stormMonitor';
import { evaluateRoute } from '../rover/routePlanner';
import { lunarDrivePose } from '../rover/drivingFeel';
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
  private roverShadow!: Phaser.GameObjects.Ellipse;
  private findIcons = new Map<string, Phaser.GameObjects.Container>();
  private info!: Phaser.GameObjects.Text;
  private sendBtn!: Phaser.GameObjects.Container;
  private planUi!: Phaser.GameObjects.Container;
  private hover!: Phaser.GameObjects.Rectangle;
  private showCost = true;
  private lastAngle = 0;
  private findsKey = '';
  private lastStatus = '';
  private manualMode = false;
  private modeLabel!: Phaser.GameObjects.Text;
  private driveKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private driveUi!: Phaser.GameObjects.Container;
  private homeBtn!: Phaser.GameObjects.Container;
  /** A tapped on-screen arrow, used as soon as Bolt finishes the current square. */
  private tapped: Cell | null = null;
  /** Squares still to drive on "Drive home" (manual mode autopilot). */
  private autoHome: Cell[] = [];
  private homeCostFor: { key: string; cost: number } | null = null;

  constructor() {
    super('Rover');
  }

  create() {
    this.findIcons = new Map();
    this.manualMode = store.state.rover.status === 'out' && store.state.rover.driveMode === 'manual';
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
    this.roverShadow = this.add.ellipse(0, 0, 24, 10, 0x17151f, 0.4).setDepth(5);
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
      if (store.paused || p.y > 548) return; // the info panel and its credit line start here
      if (p.rightButtonDown()) return this.undo();
      this.extendTo(this.cellAt(p));
    });
    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.driveKeys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D']);
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
        const nd = d + store.tileCost(nx, ny);
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
    if (!this.planning() || this.manualMode) return;
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
    if (!this.planning() || this.manualMode) return;
    this.extendTo(store.data.terrain.dome);
  }

  private send() {
    if (this.manualMode || store.paused) return;
    const r = store.launchRover(this.route);
    if (!r.ok) {
      store.log(r.reason);
      return;
    }
    this.legs = [];
  }

  /** The square Bolt is on, or about to finish, in manual mode. */
  private manualTile(): Cell {
    const r = store.state.rover;
    const at = r.status === 'out' ? r.route[r.nextRouteIndex - 1] : undefined;
    return at ? [at[0], at[1]] : [...store.data.terrain.dome];
  }

  private tapArrow(dx: number, dy: number) {
    if (!this.manualMode || store.paused) return;
    this.autoHome = [];
    this.tapped = [dx, dy];
  }

  private driveHome() {
    const r = store.state.rover;
    if (!this.manualMode || r.status !== 'out' || store.paused) return;
    this.tapped = null;
    this.autoHome = this.path(this.manualTile(), store.data.terrain.dome);
  }

  /** Battery needed to get back to the dome from Bolt's square by the cheapest path. */
  private homeCost() {
    const at = this.manualTile();
    const key = `${at[0]},${at[1]}`;
    if (this.homeCostFor?.key !== key) {
      const cost = this.path(at, store.data.terrain.dome).reduce((n, [x, y]) => n + store.tileCost(x, y), 0);
      this.homeCostFor = { key, cost: Math.round(cost * 10) / 10 };
    }
    return this.homeCostFor.cost;
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
    // Manual driving for touch and mouse (the keyboard uses the arrows or WASD).
    this.driveUi = this.add.container(0, 0);
    const arrows: [string, number, number, number][] = [['◀', -1, 0, 720], ['▲', 0, -1, 780], ['▼', 0, 1, 840], ['▶', 1, 0, 900]];
    for (const [label, dx, dy, x] of arrows) this.driveUi.add(button(this, x, 658, label, () => this.tapArrow(dx, dy), 54, 54, 0x7fd6cf));
    this.homeBtn = button(this, 1034, 658, '🏠 Drive home', () => this.driveHome(), 180, 50, 0xffd166);
    this.driveUi.add(this.homeBtn);
    ui.add(this.driveUi);
    const mode = button(this, 1090, 570, 'Switch driving mode', () => {
      if (store.paused || store.state.rover.status !== 'home') return;
      this.manualMode = !this.manualMode;
      this.resetRoute();
    }, 270, 34, C.frame);
    ui.add(mode);
    this.modeLabel = text(this, 36, 560, '', 16, C.text);
    ui.add(this.modeLabel);
    ui.add(button(this, 1190, 658, 'Inside', () => this.leave(), 110, 44, C.frame));
    const terrain = store.data.terrain;
    const creditText = store.worldId === 'moon'
      ? `Illustrated Moon terrain · ${terrain.site.name} · 1 square ≈ ${terrain.kmPerCell} km · 5s/tile · battery 0.1 / 0.2 / 0.4 · C: rough ground`
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
    if (r.status === 'out') this.manualMode = r.driveMode === 'manual';
    if (this.manualMode && !store.paused && s.phase === 'day' &&
        (r.status === 'home' || (r.status === 'out' && r.nextRouteIndex >= r.route.length))) {
      const k = this.driveKeys;
      const dx = k.LEFT.isDown || k.A.isDown ? -1 : k.RIGHT.isDown || k.D.isDown ? 1 : 0;
      const dy = dx ? 0 : k.UP.isDown || k.W.isDown ? -1 : k.DOWN.isDown || k.S.isDown ? 1 : 0;
      if (dx || dy) {
        this.autoHome = [];
        this.tapped = null;
        store.driveRover(dx, dy);
      } else if (this.tapped) {
        store.driveRover(...this.tapped);
        this.tapped = null;
      } else if (this.autoHome.length && r.status === 'out') {
        const [ax, ay] = this.manualTile();
        const [nx, ny] = this.autoHome[0];
        if (store.driveRover(nx - ax, ny - ay).ok) this.autoHome.shift();
        else this.autoHome = [];
      }
    }
    if (!this.manualMode || r.status !== 'out') this.autoHome = [];
    this.modeLabel.setText(this.manualMode ? 'MANUAL · Arrows / WASD · Steer back to the dome to dock' : 'PLAN · Click stops, add Return, then Send Bolt');
    if (this.findsKey !== `${s.stormWeekId}:${this.findsSol()}`) this.refreshFinds();
    // Bolt just got home (or out of repair): clear the finished route so it isn't re-sent.
    if (r.status !== this.lastStatus) {
      if (r.status === 'home') this.resetRoute();
      this.lastStatus = r.status;
    }

    for (const [id, c] of this.findIcons) c.setVisible(!r.collectedFindIds.includes(id));

    const pos = store.roverPosition();
    let visualX = pos.x;
    let visualY = pos.y;
    let bounce = 0;
    const from = r.route[r.nextRouteIndex - 1];
    const to = r.route[r.nextRouteIndex];
    if (store.worldId === 'moon' && r.status === 'out' && from && to && pos.moving) {
      const progress = Math.abs(pos.x - from[0]) + Math.abs(pos.y - from[1]);
      const pose = lunarDrivePose(progress, t.cost[to[1]]?.[to[0]] ?? 1);
      visualX = from[0] + (to[0] - from[0]) * pose.progress;
      visualY = from[1] + (to[1] - from[1]) * pose.progress;
      bounce = pose.bounce;
    }
    this.rover.setPosition(visualX * cell + cell / 2, visualY * cell + cell / 2 - bounce);
    this.roverShadow.setPosition(visualX * cell + cell / 2, visualY * cell + cell / 2 + 5)
      .setScale(1 - bounce * 0.04).setVisible(store.worldId === 'moon' && r.status !== 'repairing');
    if (r.status === 'out' && r.driveMode === 'manual') this.cameras.main.centerOn(visualX * cell + cell / 2, visualY * cell + cell / 2);
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

    if (this.autoHome.length) {
      g.lineStyle(3, 0x7fd6cf, 0.8);
      let [px, py] = this.manualTile();
      for (const [x, y] of this.autoHome) {
        g.lineBetween(px * cell + cell / 2, py * cell + cell / 2, x * cell + cell / 2, y * cell + cell / 2);
        [px, py] = [x, y];
      }
    }

    // Wheel tracks behind Bolt, stamped in a dot-dash pattern (a nod to Curiosity's wheels).
    const tg = this.trailGfx.clear();
    if (r.status === 'out' || r.status === 'stranded') {
      const done = r.route.slice(0, r.nextRouteIndex);
      done.forEach((p, i) => {
        const ch = MORSE_JPL[i % MORSE_JPL.length];
        tg.fillStyle(store.worldId === 'moon' ? 0x34313e : 0x3a1a10, 0.7);
        if (ch === '.') tg.fillCircle(p[0] * cell + cell / 2, p[1] * cell + cell / 2, 3);
        else tg.fillRect(p[0] * cell + cell / 2 - 7, p[1] * cell + cell / 2 - 2, 14, 4);
      });
    }

    // Info text.
    this.planUi.setVisible(planning && !this.manualMode);
    this.driveUi.setVisible(this.manualMode && (r.status === 'out' || (planning && store.roverCanLaunch().ok)));
    this.homeBtn.setVisible(r.status === 'out');
    const dayLeft = store.dayEndMs() - s.missionElapsedMs;
    const stormLine = getActiveStormWarnings(s, store.data.storms.weeks)
      .map((st) => `\n⚠ ${store.worldId === 'moon' ? 'Radiation scenario' : 'Storm'} on ${store.world.dayLabel.toLowerCase()} ${st.event.scenario.gameSol} hits in ${fmtMs(st.hitAtMs - s.missionElapsedMs)} of daytime. Be home before it!`)
      .join('');
    if (planning) {
      const can = store.roverCanLaunch();
      const cost = evaluateRoute(this.route, t, s.split.rover, store.rules.roverCostPerTile, store.rules.roverRockCostExtra).totalBatteryCost;
      const tiles = this.route.length - 1;
      const home = this.route.length > 1 && this.route[this.route.length - 1][0] === t.dome[0] && this.route[this.route.length - 1][1] === t.dome[1];
      this.info.setText(this.manualMode ? (can.ok ? `Manual driving: hold Arrow Keys or WASD, or tap the arrows, to launch and steer.\nBattery: ${s.split.rover} cells · Each tile takes ${store.rules.roverMsPerTile / 1000}s. Return to the dome to unload.${stormLine}` : can.reason) :
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
      if (r.driveMode === 'manual') {
        const home = this.homeCost();
        const low = r.batteryCells < home + 0.2 - 1e-9;
        this.info.setText(`Manual: Arrow Keys / WASD or the arrows · Steer home to dock.\nBattery ${r.batteryCells.toFixed(1)} · getting home needs ${home.toFixed(1)}${low ? ' · ⚠️ turn back now!' : ''} · Cargo: ${cargo}${stormLine}`);
        this.info.setColor(low ? C.warn : C.teal);
      } else {
        this.info.setText(`Bolt is driving! Battery ${r.batteryCells.toFixed(1)} · home in about ${fmtMs(left)}\nCargo: ${cargo}${stormLine}`);
        this.info.setColor(C.teal);
      }
    } else if (r.status === 'stranded') {
      this.info.setText('Bolt is stuck out here. The crew will tow the rover home tonight. Cargo will be lost.');
      this.info.setColor(C.warn);
    } else {
      this.info.setText(`The rover is in repair until ${store.world.dayLabel.toLowerCase()} ${r.availableSol}.`);
      this.info.setColor(C.warn);
    }
  }
}
