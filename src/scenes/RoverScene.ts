import Phaser from 'phaser';
import { store } from '../core/store';
import { getData } from '../data/loaders';
import { C, button, fmtMs, text } from '../ui/theme';
import { ITEM_ICON } from '../ui/icons';
import { getActiveFindsForSol } from '../rover/findsManager';
import { getActiveStormWarnings } from '../rover/stormMonitor';
import { evaluateRoute, findRoute } from '../rover/routePlanner';
import { STOP_INPUT } from '../rover/vehicle';
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
  private credit!: Phaser.GameObjects.Text;
  private mapCredit = '';
  private minimapLabel?: Phaser.GameObjects.Text;
  private drivingView?: import('../rover/DrivingView').DrivingView;
  private drivingImage?: Phaser.GameObjects.Image;
  private drivingTexture?: Phaser.Textures.CanvasTexture;
  private minimap?: Phaser.GameObjects.Graphics;
  private driveButton!: Phaser.GameObjects.Container;
  private handoffButton!: Phaser.GameObjects.Container;
  private loadingDrive = false;
  private viewGeneration = 0;
  private driveKeys!: Record<string, Phaser.Input.Keyboard.Key>;

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
    this.driveKeys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D', 'SPACE']);
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
      if (store.state.rover.manual) void this.openDriving();
    };
    this.events.on('wake', onWake);
    const onSleep = () => this.closeDriving();
    this.events.on('sleep', onSleep);
    this.events.once('shutdown', () => { this.events.off('wake', onWake); this.events.off('sleep', onSleep); this.closeDriving(); });
    if (store.state.rover.manual) void this.openDriving();
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
    return findRoute(from, to, store.data.terrain, (x, y) => store.tileCost(x, y));
  }

  private planning() {
    return store.state.rover.status === 'home';
  }

  private extendTo(cell: Cell) {
    if (!this.planning() || this.manualMode || this.loadingDrive) return;
    const last = this.route[this.route.length - 1];
    if (last[0] === cell[0] && last[1] === cell[1]) return;
    const leg = this.path(last, cell);
    if (!leg.length) return;
    this.route.push(...leg);
    this.legs.push(leg.length);
  }

  private undo() {
    if (!this.planning() || this.loadingDrive || !this.legs.length) return;
    const n = this.legs.pop()!;
    this.route.splice(this.route.length - n, n);
  }

  private returnHome() {
    if (!this.planning() || this.manualMode || this.loadingDrive) return;
    this.extendTo(store.data.terrain.dome);
  }

  private send() {
    if (this.manualMode || this.loadingDrive || store.paused) return;
    const r = store.launchRover(this.route);
    if (!r.ok) {
      store.log(r.reason);
      return;
    }
    this.legs = [];
  }

  private leave() {
    if (store.paused) return;
    store.setDriveInput(STOP_INPUT);
    this.cameras.main.fadeOut(200);
    this.time.delayedCall(220, () => {
      this.scene.sleep();
      this.scene.wake('Farm');
      this.scene.bringToTop('UI');
    });
  }

  private async openDriving(route?: Cell[], checkpoints?: Cell[]) {
    if (this.loadingDrive || this.drivingView) return;
    this.loadingDrive = true;
    const generation = ++this.viewGeneration;
    try {
      const { DrivingView } = await import('../rover/DrivingView');
      if (generation !== this.viewGeneration || !this.scene.isActive()) return;
      const r = store.state.rover, t = store.data.terrain;
      if (route && (store.paused || r.status !== 'home')) return;
      const stops = checkpoints ?? r.manual?.checkpoints;
      if (!stops) return;
      const view = new DrivingView(store.worldId, t, route ?? r.route, stops, [...t.finds, ...getActiveFindsForSol(t, store.state.stormWeekId, route ? store.state.sol : r.lastLaunchSol)]);
      this.drivingView = view;
      // CanvasTexture requires a 2D context; copy the WebGL output into its own canvas.
      this.drivingTexture = this.textures.createCanvas('manual-driving', 1280, 548)!;
      this.drivingImage = this.add.image(0, 0, 'manual-driving').setOrigin(0).setScrollFactor(0).setDepth(10);
      this.minimap = this.add.graphics().setScrollFactor(0).setDepth(11);
      this.minimapLabel = text(this, 28, 274, 'ROUTE · NEXT STOP', 13, C.teal).setScrollFactor(0).setDepth(12);
      if (route) {
        const result = store.launchManualRover(route, stops);
        if (!result.ok) { this.closeDriving(); store.log(result.reason); return; }
      }
      this.cameras.main.centerOn(t.dome[0] * t.cell, t.dome[1] * t.cell);
    } catch (error) {
      this.closeDriving();
      console.error('Manual driving could not initialize', error);
      store.log('3D driving is unavailable on this device. Choose Auto-drive or Let Bolt drive.');
    } finally { if (generation === this.viewGeneration) this.loadingDrive = false; }
  }

  private closeDriving() {
    this.viewGeneration++;
    this.loadingDrive = false;
    store.setDriveInput(STOP_INPUT);
    this.drivingImage?.destroy(); this.drivingImage = undefined;
    this.minimap?.destroy(); this.minimap = undefined;
    this.minimapLabel?.destroy(); this.minimapLabel = undefined;
    if (this.drivingTexture) this.textures.remove('manual-driving');
    this.drivingTexture = undefined;
    this.drivingView?.dispose(); this.drivingView = undefined;
  }

  private drawMinimap() {
    const g = this.minimap, r = store.state.rover, m = r.manual, t = store.data.terrain;
    if (!g || !m) return;
    const x = 28, y = 300, scale = 4.8;
    g.clear().fillStyle(0x101827, 0.88).fillRoundedRect(x - 10, y - 10, t.width * scale + 20, t.height * scale + 20, 8);
    g.lineStyle(1, 0xb4a271, 0.6);
    r.route.forEach((p, i) => { if (i) { const q = r.route[i - 1]; g.lineBetween(x + q[0] * scale, y + q[1] * scale, x + p[0] * scale, y + p[1] * scale); } });
    m.checkpoints.forEach((p, i) => { g.fillStyle(i < m.nextCheckpoint ? 0x53606d : i === m.nextCheckpoint ? 0x78ffe3 : 0xffd166); g.fillCircle(x + p[0] * scale, y + p[1] * scale, 3); });
    g.fillStyle(0xa5d9db).fillRect(x + t.dome[0] * scale - 3, y + t.dome[1] * scale - 3, 6, 6);
    const p = m.vehicle, px = x + p.x * scale, py = y + p.y * scale;
    g.fillStyle(0xffffff).fillCircle(px, py, 3);
    g.lineStyle(2, 0xffffff).lineBetween(px, py, px + Math.cos(p.heading) * 9, py + Math.sin(p.heading) * 9);
  }

  // ---------- UI ----------

  private buildPanel() {
    const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0x141927, 1).fillRect(0, 548, 1280, 62);
    g.fillStyle(0x141927, 0.92).fillRoundedRect(16, 610, 1248, 98, 12);
    g.lineStyle(3, C.frame).strokeRoundedRect(16, 610, 1248, 98, 12);
    ui.add(g);
    this.info = text(this, 36, 622, '', 18, C.text, { lineSpacing: 6, wordWrap: { width: 640 } });
    ui.add(this.info);
    this.planUi = this.add.container(0, 0);
    this.planUi.add(button(this, 760, 658, '« Undo', () => this.undo(), 110, 44, 0x9aa3b0));
    this.planUi.add(button(this, 884, 658, '🏠 Return', () => this.returnHome(), 130, 44, 0x9aa3b0));
    this.sendBtn = button(this, 1034, 658, 'Auto-drive »', () => this.send(), 150, 50, 0xffd166);
    this.planUi.add(this.sendBtn);
    ui.add(this.planUi);
    this.driveButton = button(this, 1050, 558, 'Drive yourself · 2× cargo', () => {
      if (store.paused || this.loadingDrive || !this.planning()) return;
      const stops: Cell[] = [];
      let i = 0;
      for (const leg of this.legs) { i += leg; stops.push([...this.route[i]]); }
      const plan = evaluateRoute(this.route, store.data.terrain, store.state.split.rover, store.rules.roverCostPerTile, store.rules.roverRockCostExtra);
      const can = store.roverCanLaunch();
      if (!can.ok || !plan.returnsHome || !plan.canAfford || !stops.length) { store.log(!can.ok ? can.reason : 'Choose stops, add Return, and check your battery first.'); return; }
      void this.openDriving(this.route.map(p => [...p]), stops);
    }, 350, 34, 0xffd166);
    this.handoffButton = button(this, 1050, 558, 'Let Bolt drive · lose 2× bonus', () => {
      const result = store.handoffRover();
      if (!result.ok) store.log(result.reason);
    }, 370, 34, C.frame);
    ui.add([this.driveButton, this.handoffButton]);
    this.modeLabel = text(this, 36, 560, '', 16, C.text);
    ui.add(this.modeLabel);
    ui.add(button(this, 1190, 658, 'Inside', () => this.leave(), 110, 44, C.frame));
    const terrain = store.data.terrain;
    const creditText = store.worldId === 'moon'
      ? `Illustrated Moon terrain · ${terrain.site.name} · 1 square ≈ ${terrain.kmPerCell} km · 5s/tile · battery 0.1 / 0.2 / 0.4 · C: rough ground`
      : `NASA Mars Trek · Viking colour mosaic · ${terrain.site.name} · 1 square ≈ ${terrain.kmPerCell} km · C: toggle rough ground`;
    const credit = text(this, 1252, 600, creditText, 14, C.dim, { backgroundColor: '#141927cc', padding: { x: 8, y: 4 } }).setOrigin(1, 1);
    this.credit = credit;
    this.mapCredit = creditText;
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
    this.credit.setText(r.manual ? `Illustrated ${store.world.name} terrain · compressed driving scale · gravity ${store.world.gravityMs2} m/s² · ${store.worldId === 'moon' ? 'longer jumps, lower traction' : 'firmer traction'}` : this.mapCredit);
    if (r.status === 'out') this.manualMode = r.driveMode === 'manual';
    this.driveButton.setVisible(this.planning());
    this.handoffButton.setVisible(r.status === 'out' && !!r.manual);
    if (r.manual) {
      const k = this.driveKeys;
      const throttle = k.UP.isDown || k.W.isDown ? 1 : k.DOWN.isDown || k.S.isDown ? -1 : 0;
      store.setDriveInput(this.drivingView && !store.paused ? { throttle, steer: (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0), brake: k.SPACE.isDown || (!throttle && !this.scene.isActive()) } : STOP_INPUT);
      if (this.drivingView && this.drivingTexture) {
        this.drivingView.render(r.manual, r.collectedFindIds);
        this.drivingTexture.context.drawImage(this.drivingView.renderer.domElement, 0, 0);
        this.drivingTexture.refresh(); this.drawMinimap();
      }
    } else if (this.drivingView) this.closeDriving();
    if (!r.manual && this.manualMode && !store.paused && s.phase === 'day' &&
        (r.status === 'home' || (r.status === 'out' && r.nextRouteIndex >= r.route.length))) {
      const k = this.driveKeys;
      const dx = k.LEFT.isDown || k.A.isDown ? -1 : k.RIGHT.isDown || k.D.isDown ? 1 : 0;
      const dy = dx ? 0 : k.UP.isDown || k.W.isDown ? -1 : k.DOWN.isDown || k.S.isDown ? 1 : 0;
      if (dx || dy) store.driveRover(dx, dy);
    }
    this.modeLabel.setText(r.manual ? (this.loadingDrive ? 'Loading terrain…' : 'WASD / Arrows · Space: brake · Dock slowly · H: help') : this.manualMode ? 'MANUAL · Arrows / WASD · Steer back to the dome to dock' : 'PLAN · Click stops, add Return, then choose who drives');
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
    if (!r.manual && store.worldId === 'moon' && r.status === 'out' && from && to && pos.moving) {
      const progress = Math.abs(pos.x - from[0]) + Math.abs(pos.y - from[1]);
      const pose = lunarDrivePose(progress, t.cost[to[1]]?.[to[0]] ?? 1);
      visualX = from[0] + (to[0] - from[0]) * pose.progress;
      visualY = from[1] + (to[1] - from[1]) * pose.progress;
      bounce = pose.bounce;
    }
    this.rover.setPosition(visualX * cell + cell / 2, visualY * cell + cell / 2 - bounce);
    this.roverShadow.setPosition(visualX * cell + cell / 2, visualY * cell + cell / 2 + 5)
      .setScale(1 - bounce * 0.04).setVisible(store.worldId === 'moon' && r.status !== 'repairing');
    if (!r.manual && r.status === 'out' && r.driveMode === 'manual') this.cameras.main.centerOn(visualX * cell + cell / 2, visualY * cell + cell / 2);
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
        tg.fillStyle(store.worldId === 'moon' ? 0x34313e : 0x3a1a10, 0.7);
        if (ch === '.') tg.fillCircle(p[0] * cell + cell / 2, p[1] * cell + cell / 2, 3);
        else tg.fillRect(p[0] * cell + cell / 2 - 7, p[1] * cell + cell / 2 - 2, 14, 4);
      });
    }

    // Info text.
    this.info.setFontSize(18);
    this.planUi.setVisible(planning);
    if (planning) this.manualMode = false;
    const dayLeft = store.dayEndMs() - s.missionElapsedMs;
    const stormLine = getActiveStormWarnings(s, store.data.storms.weeks)
      .map((st) => `\n⚠ ${store.worldId === 'moon' ? 'Radiation scenario' : 'Storm'} on ${store.world.dayLabel.toLowerCase()} ${st.event.scenario.gameSol} hits in ${fmtMs(st.hitAtMs - s.missionElapsedMs)} of daytime. Be home before it!`)
      .join('');
    if (planning) {
      const can = store.roverCanLaunch();
      const cost = evaluateRoute(this.route, t, s.split.rover, store.rules.roverCostPerTile, store.rules.roverRockCostExtra).totalBatteryCost;
      const tiles = this.route.length - 1;
      const home = this.route.length > 1 && this.route[this.route.length - 1][0] === t.dome[0] && this.route[this.route.length - 1][1] === t.dome[1];
      this.info.setText(this.manualMode ? (can.ok ? `Manual driving: hold Arrow Keys or WASD to launch and steer.\nBattery: ${s.split.rover} cells · Each tile takes ${store.rules.roverMsPerTile / 1000}s. Return to the dome to unload.${stormLine}` : can.reason) :
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
      this.info.setText(`${r.driveMode === 'manual' ? 'Manual: Arrow Keys / WASD · Steer home to dock.' : 'Bolt is driving!'} Battery ${r.batteryCells.toFixed(1)} ${r.driveMode === 'manual' ? '' : `· home in about ${fmtMs(left)}`}\nCargo: ${cargo}${stormLine}`);
      this.info.setColor(C.teal);
      if (r.manual) {
        const m = r.manual, p = m.vehicle, next = m.checkpoints[m.nextCheckpoint];
        const direction = next ? Math.atan2(next[1] - p.y, next[0] - p.x) - p.heading : 0;
        const relative = Math.atan2(Math.sin(direction), Math.cos(direction));
        const nav = !next ? 'Route complete · return to dome' : `Checkpoint ${m.nextCheckpoint + 1}/${m.checkpoints.length} · ${Math.hypot(next[0] - p.x, next[1] - p.y).toFixed(1)} squares · ${Math.abs(relative) < 0.3 ? 'ahead' : relative > 0 ? 'turn right' : 'turn left'}`;
        this.info.setText(`${nav}\nSpeed ${Math.hypot(p.vx, p.vy).toFixed(1)} m/s · Battery ${r.batteryCells.toFixed(2)} · 2× on full return\nCargo: ${cargo}${stormLine}`);
        this.info.setFontSize(16);
      } else this.info.setFontSize(18);
    } else if (r.status === 'stranded') {
      this.info.setText('Bolt is stuck out here. The crew will tow the rover home tonight. Cargo will be lost.');
      this.info.setColor(C.warn);
    } else {
      this.info.setText(`The rover is in repair until ${store.world.dayLabel.toLowerCase()} ${r.availableSol}.`);
      this.info.setColor(C.warn);
    }
  }
}
