import Phaser from 'phaser';
import { store, type Result } from '../core/store';
import { bus, EV } from '../core/events';
import { sfx } from '../core/audio';
import { loadAstronaut, PET_TRICKS, type PetKind } from '../farm/look';
import { cropById } from '../data/loaders';
import { cropStage } from '../farm/art';
import { adaptWorldLines, CHAT, EGGS, REACT, type Line } from '../story/script';
import { TOOLS } from '../ui/UIScene';
import { advanceHopClock, beginHop, moveSwept, type HopClock } from '../core/movement';

// The greenhouse dome: walk around, farm the 12 plots, use machines, chat with the crew.

const T = 32;
const MAP_W = 24;
const MAP_H = 15;
type Dir = 'down' | 'up' | 'left' | 'right';

interface Thing {
  kind: string;
  x: number;
  y: number;
  sprite?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
}

// The HUD covers the top corners and the hotbar the bottom of the screen; let the camera scroll
// this far past the map edges (world px) so nothing in the room stays hidden under them.
const HUD_TOP_PAD = 96;
const HUD_BOTTOM_PAD = 64;
const REACH = 1.8; // tiles

const PLOT_XS = [4, 6, 8, 10];
const PLOT_YS = [6, 8, 10];

export class FarmScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private facing: Dir = 'down';
  private stepMs = 0;
  private stepLeft = true;
  private sleepAskedAt = -Infinity;
  private pet: Phaser.GameObjects.Sprite | null = null;
  private petKind: PetKind = 'none';
  private petHopping = false;
  private solid = new Set<string>();
  private things: Thing[] = [];
  private plotTiles: Phaser.GameObjects.Image[] = [];
  private plotCrops: Phaser.GameObjects.Image[] = [];
  private plotSparkles: Phaser.GameObjects.Image[] = [];
  private crew: Record<string, Phaser.GameObjects.Sprite> = {};
  private walking = new Set<string>();
  private bolt!: Phaser.GameObjects.Image;
  private cursor!: Phaser.GameObjects.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private chatIndex: Record<string, number> = {};
  private eggTree?: Phaser.GameObjects.Image;
  private counters: Record<string, number> = {};
  private unsub: (() => void)[] = [];
  /** Tap/click-to-walk target (for touch screens), and the tile to use on arrival. */
  private walkTarget: { x: number; y: number; tile: [number, number]; stuckMs: number } | null = null;
  private hopClock: HopClock = { elapsedMs: null, cooldownMs: 0 };
  private hopStart: { x: number; y: number } | null = null;
  private hopDirection = { x: 0, y: 0 };
  private hopShadow!: Phaser.GameObjects.Ellipse;

  constructor() {
    super('Farm');
  }

  create() {
    this.solid.clear();
    this.things = [];
    this.plotTiles = [];
    this.plotCrops = [];
    this.plotSparkles = [];
    this.crew = {};
    this.walking = new Set();
    this.chatIndex = {};
    this.counters = {};
    this.unsub = [];
    this.walkTarget = null;
    this.hopClock = { elapsedMs: null, cooldownMs: 0 };
    this.hopStart = null;
    this.buildMap();
    this.buildThings();
    this.buildCrew();

    this.player = this.add.sprite(12 * T + T / 2, 4 * T + T / 2, 'player-down-0').setDepth(5);
    this.buildPet();
    this.hopShadow = this.add.ellipse(this.player.x, this.player.y + 12, 16, 6, 0x000000, 0.35).setDepth(4);
    this.cursor = this.add.rectangle(0, 0, T, T).setStrokeStyle(2, 0xffd166, 0.9).setDepth(4);

    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.setBounds(0, -HUD_TOP_PAD, MAP_W * T, MAP_H * T + HUD_TOP_PAD + HUD_BOTTOM_PAD);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setBackgroundColor(store.worldId === 'moon' ? '#555b64' : '#8f3d22');
    cam.fadeIn(300);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,E,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.act());
    kb.on('keydown-E', () => this.act());
    kb.on('keydown-SHIFT', () => this.startHop());
    const onHop = () => this.startHop();
    bus.on('ui:hop', onHop);
    this.unsub.push(() => bus.off('ui:hop', onHop));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (store.paused) return;
      const tx = Math.floor(p.worldX / T);
      const ty = Math.floor(p.worldY / T);
      if (this.hopStart) return;
      if (this.inReach(tx, ty)) this.actOn(tx, ty);
      else this.walkTarget = { x: tx * T + T / 2, y: ty * T + T / 2, tile: [tx, ty], stuckMs: 0 };
    });

    const onHit = () => this.cameras.main.shake(400, 0.004);
    bus.on(EV.STORM_HIT, onHit);
    this.unsub.push(() => bus.off(EV.STORM_HIT, onHit));
    // Scene events outlive a restart, so remove this listener again on shutdown.
    const onWake = () => this.cameras.main.fadeIn(250);
    this.events.on('wake', onWake);
    this.unsub.push(() => this.events.off('wake', onWake));
    this.events.once('shutdown', () => this.unsub.forEach((f) => f()));
  }

  // ---------- map ----------

  private buildMap() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const outside = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
        const wallTop = y === 1 && x >= 1 && x <= MAP_W - 2;
        const wallBottom = y === MAP_H - 2 && x >= 1 && x <= MAP_W - 2;
        const wallSide = (x === 1 || x === MAP_W - 2) && y >= 1 && y <= MAP_H - 2;
        let key = 'floor';
        if (outside) key = store.worldId === 'moon' ? 'moon' : 'mars';
        else if (wallSide) key = store.worldId === 'moon' ? 'moon-wall-side' : 'wall-side';
        else if (wallTop || wallBottom) key = store.worldId === 'moon' ? 'moon-wall' : 'wall';
        else if (x >= 3 && x <= 11 && y >= 5 && y <= 11) key = 'mat';
        const img = this.add.image(x * T, y * T, key).setOrigin(0);
        if (wallBottom) img.setFlipY(true);
        if (outside || wallSide || wallTop || wallBottom) this.solid.add(`${x},${y}`);
      }
    }
    PLOT_YS.forEach((py) =>
      PLOT_XS.forEach((px) => {
        const tile = this.add.image(px * T, py * T, 'plot-dry').setOrigin(0);
        const crop = this.add.image(px * T, py * T - 6, 'crop-mizuna-0').setOrigin(0).setDepth(3).setVisible(false);
        const sparkle = this.add.image(px * T + 26, py * T + 2, 'sparkle').setDepth(6).setVisible(false);
        this.tweens.add({ targets: sparkle, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
        this.plotTiles.push(tile);
        this.plotCrops.push(crop);
        this.plotSparkles.push(sparkle);
      }),
    );
  }

  private place(kind: string, x: number, y: number, tex: string, solid = true) {
    const sprite = this.add.image(x * T, y * T, tex).setOrigin(0).setDepth(2);
    if (solid) this.solid.add(`${x},${y}`);
    this.things.push({ kind, x, y, sprite });
    return sprite;
  }

  private buildThings() {
    // Things on the top wall.
    this.place('door', 12, 1, 'door');
    this.place('earth', 5, 1, 'earth-window');
    // Machines along the top.
    this.place('radio', 3, 2, 'm-radio');
    this.place('console', 15, 2, 'm-console');
    this.place('melter', 17, 2, 'm-melter');
    this.place('bench', 19, 2, 'm-bench');
    this.place('tank', 20, 2, 'm-tank');
    this.place('crate', 8, 2, 'm-crate');
    this.place('kitchen', 6, 2, 'm-kitchen');
    this.place('gerald', 13, 2, 'm-plant');
    this.place('pot', 10, 2, 'm-plant').setTint(0x8a7a6a);
    // Bottom of the dome.
    this.place('shelter', 16, 12, 'm-shelter');
    // One bed each for you, Rosa, Theo and Priya (Bolt recharges instead).
    for (const x of [18, 19, 20, 21]) this.place('bed', x, 12, 'm-bed');
    this.eggTree = this.add.image(10 * T, 2 * T - 12, 'egg-tree').setOrigin(0).setDepth(3).setVisible(false);
  }

  private buildCrew() {
    const spots: Record<string, [number, number]> = { rosa: [15, 4], theo: [13, 8], priya: [19, 4] };
    for (const [name, [x, y]] of Object.entries(spots)) {
      const s = this.add.sprite(x * T + T / 2, y * T + T / 2, `${name}-down-0`).setDepth(5);
      this.crew[name] = s;
      this.solid.add(`${x},${y}`);
      this.time.addEvent({ delay: 2600 + Math.random() * 2600, loop: true, callback: () => this.wander(name) });
      // Idle: a slow breath, plus now and then a glance around the dome.
      this.tweens.add({ targets: s, scaleY: 1.05, yoyo: true, repeat: -1, duration: 900 + Math.random() * 300, ease: 'Sine.easeInOut' });
      this.time.addEvent({ delay: 1700 + Math.random() * 1500, loop: true, callback: () => this.glance(name) });
    }
    this.bolt = this.add.image(4 * T + T / 2, 3 * T + T / 2, 'bolt').setDepth(5);
    this.solid.add('4,3');
    this.tweens.add({ targets: this.bolt, y: this.bolt.y - 2, yoyo: true, repeat: -1, duration: 700 });
  }

  private wander(name: string) {
    const s = this.crew[name];
    if (!s || store.paused || this.walking.has(name)) return;
    const x = Math.floor(s.x / T);
    const y = Math.floor(s.y / T);
    const dirs: [number, number, Dir][] = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'down'], [0, -1, 'up']];
    const [dx, dy, dir] = dirs[Math.floor(Math.random() * 4)];
    const nx = x + dx;
    const ny = y + dy;
    if (this.solid.has(`${nx},${ny}`) || this.playerTiles().has(`${nx},${ny}`) || this.isPlot(nx, ny) || ny < 3 || ny > 12) {
      s.setTexture(`${name}-${dir}-0`);
      return;
    }
    this.solid.delete(`${x},${y}`);
    this.solid.add(`${nx},${ny}`);
    this.walking.add(name);
    s.play(`${name}-walk-${dir}`);
    this.tweens.add({ targets: s, x: nx * T + T / 2, y: ny * T + T / 2, duration: 500, onComplete: () => {
      this.walking.delete(name);
      s.stop();
      s.setTexture(`${name}-${dir}-0`);
    } });
  }

  private glance(name: string) {
    const s = this.crew[name];
    if (!s || store.paused || this.walking.has(name) || Math.random() < 0.5) return;
    const dirs: Dir[] = ['down', 'left', 'right', 'down'];
    s.setTexture(`${name}-${dirs[Math.floor(Math.random() * dirs.length)]}-0`);
  }

  /** Every tile the player's body or feet touch, so the crew never steps onto them. */
  private playerTiles() {
    const { x, y } = this.player;
    const out = new Set<string>();
    for (const [px, py] of [[x - 9, y - 8], [x + 9, y - 8], [x - 9, y + 14], [x + 9, y + 14]]) out.add(`${Math.floor(px / T)},${Math.floor(py / T)}`);
    return out;
  }

  private inReach(tx: number, ty: number) {
    return Math.hypot(tx - (this.player.x / T - 0.5), ty - (this.player.y / T - 0.5)) <= REACH;
  }

  private isPlot(x: number, y: number) {
    return PLOT_XS.includes(x) && PLOT_YS.includes(y);
  }

  private plotIndex(x: number, y: number) {
    const ix = PLOT_XS.indexOf(x);
    const iy = PLOT_YS.indexOf(y);
    return ix < 0 || iy < 0 ? -1 : iy * PLOT_XS.length + ix;
  }

  // ---------- loop ----------

  update(_t: number, delta: number) {
    const s = store.state;
    if (!s) return;
    this.movePlayer(delta);
    this.movePet(delta);
    const ground = this.hopStart ?? this.player;
    this.hopShadow.setPosition(ground.x, ground.y + 12).setScale(this.hopStart ? 0.65 : 1).setAlpha(this.hopStart ? 0.22 : 0.35);
    this.refreshPlots();
    this.bolt.setVisible(s.rover.status === 'home' || s.rover.status === 'repairing');
    const tree = store.meta.storySeen.find((x) => x.startsWith('mystery-planted@'));
    this.eggTree?.setVisible(!!tree && s.sol > Number(tree.split('@')[1]));
    const [fx, fy] = this.facingTile();
    this.cursor.setPosition(fx * T + T / 2, fy * T + T / 2).setVisible(!store.paused);
  }

  private movePlayer(delta: number) {
    if (store.paused || store.state.phase !== 'day') {
      this.player.stop();
      this.cancelHop();
      return;
    }
    if (this.hopStart) {
      const clock = advanceHopClock(this.hopClock, delta, true);
      this.hopClock = clock.clock;
      const stepMs = clock.movedMs;
      const amount = 110 * 1.6 * 0.25 * (stepMs / 250);
      const moved = moveSwept(this.hopStart, {
        x: this.hopDirection.x * amount,
        y: this.hopDirection.y * amount,
      }, (x, y) => this.blocked(x, y) || this.isPlot(Math.floor(x / T), Math.floor((y + 8) / T)), 4);
      this.hopStart = moved;
      if (clock.complete) this.cancelHop();
      else {
        const arc = Math.sin((Math.PI * (this.hopClock.elapsedMs ?? 0)) / 250) * 12;
        this.player.setPosition(moved.x, moved.y - arc).setScale(1.12);
      }
      return;
    }
    this.hopClock = advanceHopClock(this.hopClock, delta, true).clock;
    const k = this.keys;
    let dx = 0;
    let dy = 0;
    if (k.LEFT.isDown || k.A.isDown) dx -= 1;
    if (k.RIGHT.isDown || k.D.isDown) dx += 1;
    if (k.UP.isDown || k.W.isDown) dy -= 1;
    if (k.DOWN.isDown || k.S.isDown) dy += 1;
    const target = this.walkTarget;
    if (dx || dy) this.walkTarget = null; // keys always win over a tap
    else if (target) {
      const [tx, ty] = target.tile;
      if (this.inReach(tx, ty) && this.hasUse(tx, ty)) {
        this.walkTarget = null;
        this.facing = this.directionTo(target.x, target.y);
        this.actOn(tx, ty);
        return;
      }
      const ex = target.x - this.player.x;
      const ey = target.y - 8 - this.player.y;
      if (Math.abs(ex) < 3 && Math.abs(ey) < 3) this.walkTarget = null;
      else {
        dx = Math.abs(ex) >= 3 ? Math.sign(ex) : 0;
        dy = Math.abs(ey) >= 3 ? Math.sign(ey) : 0;
      }
    }
    if (!dx && !dy) {
      this.player.stop();
      this.player.setTexture(`player-${this.facing}-0`);
      return;
    }
    const dir: Dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    if (dir !== this.facing || !this.player.anims.isPlaying) this.player.play(`player-walk-${dir}`);
    this.facing = dir;
    this.stepMs -= delta;
    if (this.stepMs <= 0) {
      this.stepMs = 320;
      sfx(this.stepLeft ? 'step-1' : 'step-2');
      this.stepLeft = !this.stepLeft;
    }
    const speed = (110 * delta) / 1000;
    const len = Math.hypot(dx, dy);
    const nx = this.player.x + (dx / len) * speed;
    const ny = this.player.y + (dy / len) * speed;
    const [x0, y0] = [this.player.x, this.player.y];
    if (!this.blocked(nx, this.player.y)) this.player.x = nx;
    if (!this.blocked(this.player.x, ny)) this.player.y = ny;
    // A tap target behind a wall or machine: give up instead of pushing forever.
    if (this.walkTarget && this.player.x === x0 && this.player.y === y0) {
      this.walkTarget.stuckMs += delta;
      if (this.walkTarget.stuckMs > 400) {
        this.walkTarget = null;
        this.hint('Can\'t walk straight there. Try another way!');
      }
    }
  }

  private directionTo(x: number, y: number): Dir {
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  /** True when tapping this tile should do something once the player gets close. */
  private hasUse(x: number, y: number) {
    if (this.plotIndex(x, y) >= 0) return true;
    if (Object.values(this.crew).some((c) => Math.floor(c.x / T) === x && Math.floor(c.y / T) === y)) return true;
    if (this.bolt.visible && x === 4 && y === 3) return true;
    return this.things.some((t) => t.x === x && t.y === y);
  }

  private startHop() {
    if (!store.world.hopEnabled || store.paused || store.state.phase !== 'day' || this.hopStart) return;
    const nextClock = beginHop(this.hopClock, true);
    if (!nextClock) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.LEFT.isDown || this.keys.A.isDown) dx -= 1;
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) dx += 1;
    if (this.keys.UP.isDown || this.keys.W.isDown) dy -= 1;
    if (this.keys.DOWN.isDown || this.keys.S.isDown) dy += 1;
    if (!dx && !dy) {
      const facing: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
      [dx, dy] = facing[this.facing];
    }
    const length = Math.hypot(dx, dy) || 1;
    this.hopDirection = { x: dx / length, y: dy / length };
    this.hopClock = nextClock;
    this.hopStart = { x: this.player.x, y: this.player.y };
  }

  private cancelHop() {
    if (this.hopStart && this.player?.active) this.player.setPosition(this.hopStart.x, this.hopStart.y);
    this.hopStart = null;
    this.hopClock = { ...this.hopClock, elapsedMs: null };
    if (this.player?.active) this.player.setScale(1);
  }

  private blocked(px: number, py: number) {
    // Small foot box so the player can slip between things.
    const pts = [[px - 9, py + 4], [px + 9, py + 4], [px - 9, py + 14], [px + 9, py + 14]];
    return pts.some(([x, y]) => this.solid.has(`${Math.floor(x / T)},${Math.floor(y / T)}`));
  }

  private facingTile(): [number, number] {
    const x = Math.floor(this.player.x / T);
    const y = Math.floor((this.player.y + 8) / T);
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.facing];
    return [x + d[0], y + d[1]];
  }

  private refreshPlots() {
    const s = store.state;
    s.plots.forEach((p, i) => {
      this.plotTiles[i].setTexture(p.wateredToday ? 'plot-wet' : 'plot-dry');
      const crop = cropById(p.cropId, store.worldId);
      const img = this.plotCrops[i];
      if (!crop) {
        img.setVisible(false);
        this.plotSparkles[i].setVisible(false);
        return;
      }
      const stage = cropStage(p.growthSols, crop.growSols);
      img.setTexture(`crop-${crop.id}-${stage}${p.condition === 'wilted' ? '-wilt' : ''}`).setVisible(true);
      this.plotSparkles[i].setVisible(stage === 3 && p.condition === 'healthy');
    });
  }

  // ---------- actions ----------

  private act() {
    if (store.paused || this.hopStart) return;
    const [x, y] = this.facingTile();
    this.actOn(x, y);
  }

  private say(lines: Line[]) {
    bus.emit('ui:say', adaptWorldLines(lines, store.worldId));
  }

  private hint(t: string) {
    store.log(t);
  }

  private report(r: Result, success?: () => void) {
    if (!r.ok) {
      sfx('error');
      this.hint(r.reason);
    } else success?.();
  }

  private actOn(x: number, y: number) {
    if (store.paused || this.hopStart) return;
    const s = store.state;
    const pi = this.plotIndex(x, y);
    if (pi >= 0) return this.usePlot(pi, x, y);

    if (this.pet && Math.hypot(this.pet.x - (x * T + T / 2), this.pet.y - (y * T + T / 2)) < 22) return this.usePet();

    for (const [name, sprite] of Object.entries(this.crew)) {
      if (Math.floor(sprite.x / T) === x && Math.floor(sprite.y / T) === y) return this.talk(name);
    }
    if (this.bolt.visible && x === 4 && y === 3) return this.talk('bolt');

    const thing = this.things.find((t) => t.x === x && t.y === y);
    if (!thing) return;
    switch (thing.kind) {
      case 'door':
        if (s.phase !== 'day') return this.hint('Start the day first!');
        if (store.worldId === 'moon' && s.dustLevel > 0 && s.dustCleanedSol !== s.sol) {
          const clean = store.cleanDust();
          if (clean.ok) return this.hint(`Airlock cleaned. Tomorrow's power budget returns to ${store.nextDayCells()} cells.`);
          return this.report(clean);
        }
        this.cancelHop();
        this.cameras.main.fadeOut(200);
        this.time.delayedCall(220, () => {
          this.scene.sleep();
          if (this.scene.isSleeping('Rover')) this.scene.wake('Rover');
          else this.scene.launch('Rover');
          this.scene.bringToTop('UI');
        });
        return;
      case 'radio':
        bus.emit('ui:open', 'board');
        return;
      case 'kitchen':
        if (s.phase !== 'day') return this.hint('Start the day first!');
        bus.emit('ui:open', 'kitchen');
        return;
      case 'console':
        return this.say([{ who: 'priya', text: `Today's power: ${s.split.growLights} grow lights, ${s.split.heater} ${store.worldId === 'moon' ? 'thermal control' : 'heater'}, ${s.split.shelter} shelter, ${s.split.rover} rover. The split is locked until tomorrow morning.` }]);
      case 'melter':
        return this.report(store.convertIce(), () => {
          sfx('melter');
          this.puff(x, y, 0x8fd3ff);
        });
      case 'bench':
        return this.report(store.craftShield(), () => {
          sfx('craft');
          this.puff(x, y, 0xb5532f);
        });
      case 'tank':
        return this.hint(`Water tank: ${s.inventory.water} water. Plants need water when planted and while growing.`);
      case 'shelter':
        return this.hint(`Storm shelter. Today: ${s.split.shelter} cell(s) + ${s.shield} shield layer(s) of protection.`);
      case 'bed':
        return this.useBed();
      case 'earth':
        this.counters.earth = (this.counters.earth || 0) + 1;
        if (this.counters.earth >= 3) return this.egg('egg-earth', EGGS.earth);
        return this.hint('A painted picture of Earth. It looks very far away.');
      case 'gerald':
        this.counters.gerald = (this.counters.gerald || 0) + 1;
        if (this.counters.gerald >= 3) return this.egg('egg-gerald', EGGS.gerald);
        return this.hint('A houseplant. It looks at you. Plants can\'t look. It looks anyway.');
      case 'crate':
        return this.useCrate();
      case 'pot':
        return this.usePot();
    }
  }

  private usePlot(pi: number, x: number, y: number) {
    const s = store.state;
    const p = s.plots[pi];
    const tool = TOOLS[(this.registry.get('tool') as number) ?? 0];
    const crop = cropById(p.cropId, store.worldId);
    if (!crop) {
      if (!tool.startsWith('seed:')) return this.hint('Choose a seed with keys 1–5, then plant.');
      const pick = store.data.crops.crops[Number(tool.slice(5))];
      return this.report(store.plant(pi, pick.id), () => {
        sfx('plant');
        this.puff(x, y, 0x9a6a45);
      });
    }
    if (p.condition === 'wilted') {
      return this.report(store.clearPlot(pi), () => {
        sfx('clear');
        this.puff(x, y, 0x8a7a5a);
      });
    }
    if (p.growthSols >= crop.growSols) {
      return this.report(store.harvest(pi), () => {
        sfx('harvest');
        this.puff(x, y, 0xfff3b0);
        if (store.worldId === 'mars' && crop.id === 'zinnia' && !store.meta.storySeen.includes('zinnia')) {
          store.meta.storySeen.push('zinnia');
          this.say([REACT.zinnia]);
        } else if (!store.meta.storySeen.includes('first-harvest')) {
          store.meta.storySeen.push('first-harvest');
          this.say([REACT.firstHarvest]);
        }
      });
    }
    if (!p.wateredToday) {
      return this.report(store.water(pi), () => {
        sfx('water');
        this.puff(x, y, 0x5aa9e6);
      });
    }
    const oxygen = crop.oxygenPerDay ?? 3;
    return this.hint(`${crop.name}: ${p.growthSols}/${crop.growSols} ${store.world.dayLabel.toLowerCase()}s of growth · ${oxygen} air per day. Watered today.`);
  }

  private talk(name: string) {
    if (name === 'bolt') {
      store.meta.boltTalks += 1;
      if (store.meta.boltTalks === 42) return this.egg('egg-bolt42', [EGGS.bolt42]);
    }
    const lines = CHAT[name as keyof typeof CHAT];
    const i = this.chatIndex[name] ?? (store.state.sol - 1) % lines.length;
    this.chatIndex[name] = (i + 1) % lines.length;
    const sprite = this.crew[name];
    if (sprite) {
      const dx = this.player.x - sprite.x;
      const dy = this.player.y - sprite.y;
      sprite.setTexture(`${name}-${Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'}-0`);
    }
    this.say([lines[i]]);
  }

  // ---------- pet ----------

  private buildPet() {
    this.petKind = loadAstronaut().pet;
    this.pet = null;
    if (this.petKind === 'none') return;
    this.pet = this.add.sprite(this.player.x - 26, this.player.y + 6, `pet-${this.petKind}-0`).setDepth(5);
    const intro = `pet-intro-${this.petKind}`;
    if (!store.meta.storySeen.includes(intro)) {
      store.meta.storySeen.push(intro);
      store.log(`Your ${PET_TRICKS[this.petKind].name} follows you around. Use it once a sol for a helpful trick!`);
    }
  }

  /** Trot after the player and sit down nearby, so turning to face the pet doesn't chase it off. */
  private movePet(delta: number) {
    const pet = this.pet;
    if (!pet || this.petHopping) return;
    const dx = this.player.x - pet.x;
    const dy = this.player.y + 6 - pet.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 34 || store.paused) {
      pet.stop();
      pet.setTexture(`pet-${this.petKind}-0`);
      return;
    }
    const step = Math.min(dist - 30, ((dist > 120 ? 180 : 100) * delta) / 1000);
    pet.x += (dx / dist) * step;
    pet.y += (dy / dist) * step;
    if (Math.abs(dx) > 1) pet.setFlipX(dx < 0);
    if (!pet.anims.isPlaying) pet.play(`pet-${this.petKind}-walk`);
  }


  private usePet() {
    const pet = this.pet;
    if (!pet || this.petKind === 'none') return;
    const trick = PET_TRICKS[this.petKind];
    this.petHopping = true;
    pet.stop();
    this.tweens.add({ targets: pet, y: pet.y - 10, yoyo: true, duration: 160, repeat: 1, onComplete: () => (this.petHopping = false) });
    const r = store.petTrick(trick.item, trick.amount);
    if (!r.ok) return this.hint(r.reason === 'already' ? trick.already : r.reason);
    sfx('found');
    this.puff(Math.floor(pet.x / T), Math.floor(pet.y / T), 0xffd166);
    this.say([{ who: 'you', text: trick.line }]);
  }

  /** During the day a bed sleeps until night (asks once first); before the day it's a secret. */
  private useBed() {
    const s = store.state;
    if (s.phase !== 'day') return this.egg('egg-bed', [EGGS.bed]);
    if (this.time.now - this.sleepAskedAt > 4000) {
      this.sleepAskedAt = this.time.now;
      const storm = store.pendingStorms().some((st) => st.hitAtMs <= store.dayEndMs());
      return this.hint(storm
        ? 'A storm hits before tonight! Sleep anyway? Use the bed again to sleep until night.'
        : 'Sleep until night? The rest of the sol passes. Use the bed again to sleep.');
    }
    this.sleepAskedAt = -Infinity;
    store.pause('sleep');
    const cam = this.cameras.main;
    cam.fadeOut(600, 11, 16, 38);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      store.resume('sleep');
      this.report(store.sleepNow());
      cam.fadeIn(600, 11, 16, 38);
    });
  }

  private useCrate() {
    const s = store.state;
    const planted = store.meta.storySeen.some((x) => x.startsWith('mystery-planted@'));
    if (s.sol >= 5 && !planted) {
      if (s.phase !== 'day') return this.hint('Start the day first!');
      store.meta.storySeen.push(`mystery-planted@${s.sol}`);
      store.save();
      return this.say([EGGS.mysterySeed]);
    }
    return this.hint(`Seed crate: ${s.inventory.seed} seeds. Supply drops found by the rover refill it.`);
  }

  private usePot() {
    const tag = store.meta.storySeen.find((x) => x.startsWith('mystery-planted@'));
    if (tag && store.state.sol > Number(tag.split('@')[1])) return this.egg('egg-tree', EGGS.mysteryTree);
    if (tag) return this.hint('Something is happening in the pot. Slowly. Suspiciously.');
    return this.hint('An empty pot. Gerald\'s spare. Gerald does not share.');
  }

  private egg(id: string, lines: Line[]) {
    const isNew = store.findEgg(id);
    this.say(lines);
    if (isNew) store.log(`⭐ Secret found! (${store.meta.eggs.length}/${EGGS.total})`);
  }

  private puff(x: number, y: number, color: number) {
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(x * T + T / 2, y * T + T / 2, 'px').setTint(color).setDepth(7);
      const a = (i / 8) * Math.PI * 2;
      this.tweens.add({ targets: p, x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 - 6, alpha: 0, duration: 450, onComplete: () => p.destroy() });
    }
  }
}
