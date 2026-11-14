import Phaser from 'phaser';
import { store, type Result } from '../core/store';
import { bus, EV } from '../core/events';
import { cropById, getData } from '../data/loaders';
import { cropStage } from '../farm/art';
import { CHAT, EGGS, REACT, type Line } from '../story/script';
import { TOOLS } from '../ui/UIScene';

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

const PLOT_XS = [4, 6, 8, 10];
const PLOT_YS = [6, 8, 10];

export class FarmScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private facing: Dir = 'down';
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
    this.buildMap();
    this.buildThings();
    this.buildCrew();

    this.player = this.add.sprite(12 * T + T / 2, 4 * T + T / 2, 'player-down-0').setDepth(5);
    this.cursor = this.add.rectangle(0, 0, T, T).setStrokeStyle(2, 0xffd166, 0.9).setDepth(4);

    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.setBounds(0, 0, MAP_W * T, MAP_H * T);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setBackgroundColor('#8f3d22');
    cam.fadeIn(300);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,E') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.act());
    kb.on('keydown-E', () => this.act());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const tx = Math.floor(p.worldX / T);
      const ty = Math.floor(p.worldY / T);
      const px = this.player.x / T - 0.5;
      const py = this.player.y / T - 0.5;
      if (Math.hypot(tx - px, ty - py) <= 1.8) this.actOn(tx, ty);
      else this.hint('Walk closer to use that.');
    });

    const onHit = () => this.cameras.main.shake(400, 0.004);
    bus.on(EV.STORM_HIT, onHit);
    this.unsub.push(() => bus.off(EV.STORM_HIT, onHit));
    this.events.on('wake', () => this.cameras.main.fadeIn(250));
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
        if (outside) key = 'mars';
        else if (wallSide) key = 'wall-side';
        else if (wallTop || wallBottom) key = 'wall';
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
    this.place('gerald', 13, 2, 'm-plant');
    this.place('pot', 10, 2, 'm-plant').setTint(0x8a7a6a);
    // Bottom of the dome.
    this.place('shelter', 16, 12, 'm-shelter');
    this.place('bed', 19, 12, 'm-bed');
    this.place('bed', 20, 12, 'm-bed');
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
    const px = Math.floor(this.player.x / T);
    const py = Math.floor(this.player.y / T);
    if (this.solid.has(`${nx},${ny}`) || (nx === px && ny === py) || this.isPlot(nx, ny) || ny < 3 || ny > 12) {
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
    this.refreshPlots();
    this.bolt.setVisible(s.rover.status === 'home' || s.rover.status === 'repairing');
    const tree = store.meta.storySeen.find((x) => x.startsWith('mystery-planted@'));
    this.eggTree?.setVisible(!!tree && s.sol > Number(tree.split('@')[1]));
    const [fx, fy] = this.facingTile();
    this.cursor.setPosition(fx * T + T / 2, fy * T + T / 2).setVisible(!store.paused);
  }

  private movePlayer(delta: number) {
    if (store.paused) {
      this.player.stop();
      return;
    }
    const k = this.keys;
    let dx = 0;
    let dy = 0;
    if (k.LEFT.isDown || k.A.isDown) dx -= 1;
    if (k.RIGHT.isDown || k.D.isDown) dx += 1;
    if (k.UP.isDown || k.W.isDown) dy -= 1;
    if (k.DOWN.isDown || k.S.isDown) dy += 1;
    if (!dx && !dy) {
      this.player.stop();
      this.player.setTexture(`player-${this.facing}-0`);
      return;
    }
    const dir: Dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    if (dir !== this.facing || !this.player.anims.isPlaying) this.player.play(`player-walk-${dir}`);
    this.facing = dir;
    const speed = (110 * delta) / 1000;
    const len = Math.hypot(dx, dy);
    const nx = this.player.x + (dx / len) * speed;
    const ny = this.player.y + (dy / len) * speed;
    if (!this.blocked(nx, this.player.y)) this.player.x = nx;
    if (!this.blocked(this.player.x, ny)) this.player.y = ny;
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
      const crop = cropById(p.cropId);
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
    if (store.paused) return;
    const [x, y] = this.facingTile();
    this.actOn(x, y);
  }

  private say(lines: Line[]) {
    bus.emit('ui:say', lines);
  }

  private hint(t: string) {
    store.log(t);
  }

  private report(r: Result, success?: () => void) {
    if (!r.ok) this.hint(r.reason);
    else success?.();
  }

  private actOn(x: number, y: number) {
    if (store.paused) return;
    const s = store.state;
    const pi = this.plotIndex(x, y);
    if (pi >= 0) return this.usePlot(pi, x, y);

    for (const [name, sprite] of Object.entries(this.crew)) {
      if (Math.floor(sprite.x / T) === x && Math.floor(sprite.y / T) === y) return this.talk(name);
    }
    if (this.bolt.visible && x === 4 && y === 3) return this.talk('bolt');

    const thing = this.things.find((t) => t.x === x && t.y === y);
    if (!thing) return;
    switch (thing.kind) {
      case 'door':
        if (s.phase !== 'day') return this.hint('Start the day first!');
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
      case 'console':
        return this.say([{ who: 'priya', text: `Today's power: ${s.split.growLights} grow lights, ${s.split.heater} heater, ${s.split.shelter} shelter, ${s.split.rover} rover. The split is locked until tomorrow morning.` }]);
      case 'melter':
        return this.report(store.convertIce(), () => this.puff(x, y, 0x8fd3ff));
      case 'bench':
        return this.report(store.craftShield(), () => this.puff(x, y, 0xb5532f));
      case 'tank':
        return this.hint(`Water tank: ${s.inventory.water} water. Each plant drinks 1 per sol.`);
      case 'shelter':
        return this.hint(`Storm shelter. Today: ${s.split.shelter} cell(s) + ${s.shield} shield layer(s) of protection.`);
      case 'bed':
        return this.egg('egg-bed', [EGGS.bed]);
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
    const crop = cropById(p.cropId);
    if (!crop) {
      if (!tool.startsWith('seed:')) return this.hint('Choose a seed with keys 1–5, then plant.');
      const pick = getData().crops.crops[Number(tool.slice(5))];
      return this.report(store.plant(pi, pick.id), () => this.puff(x, y, 0x9a6a45));
    }
    if (p.condition === 'wilted') return this.report(store.clearPlot(pi), () => this.puff(x, y, 0x8a7a5a));
    if (p.growthSols >= crop.growSols) {
      return this.report(store.harvest(pi), () => {
        this.puff(x, y, 0xfff3b0);
        if (crop.food === 0 && !store.meta.storySeen.includes('zinnia')) {
          store.meta.storySeen.push('zinnia');
          this.say([REACT.zinnia]);
        } else if (!store.meta.storySeen.includes('first-harvest')) {
          store.meta.storySeen.push('first-harvest');
          this.say([REACT.firstHarvest]);
        }
      });
    }
    if (!p.wateredToday) return this.report(store.water(pi), () => this.puff(x, y, 0x5aa9e6));
    return this.hint(`${crop.name}: ${p.growthSols}/${crop.growSols} sols of growth. Watered today.`);
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
    if (isNew) store.log(`★ Secret found! (${store.meta.eggs.length}/${EGGS.total})`);
  }

  private puff(x: number, y: number, color: number) {
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(x * T + T / 2, y * T + T / 2, 'px').setTint(color).setDepth(7);
      const a = (i / 8) * Math.PI * 2;
      this.tweens.add({ targets: p, x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 - 6, alpha: 0, duration: 450, onComplete: () => p.destroy() });
    }
  }
}
