import Phaser from 'phaser';
import { makeCharacter } from '../farm/art';
import { HAIRS, PANTS, SKINS, SUITS, loadAstronaut, saveAstronaut, type Astronaut, type PetKind } from '../farm/look';
import { C, H, W, button, panel, text } from '../ui/theme';
import { startMission } from './TitleScene';

const DIRS = ['down', 'right', 'up', 'left'] as const;
const PET_LABELS: [PetKind, string][] = [['cat', 'Cat'], ['dog', 'Dog'], ['alien', 'Mars alien'], ['none', 'No pet']];

/** "Make your astronaut": girl or boy, hair, skin tone, clothes and a pet. Opens before a mission. */
export class CustomizeScene extends Phaser.Scene {
  private astro!: Astronaut;
  private fresh = true;
  private dir = 0;
  private preview!: Phaser.GameObjects.Sprite;
  private petPreview!: Phaser.GameObjects.Sprite;
  private rows!: Phaser.GameObjects.Container;

  constructor() {
    super('Customize');
  }

  init(data: { fresh?: boolean }) {
    this.fresh = data.fresh ?? true;
  }

  create() {
    this.astro = loadAstronaut();
    this.dir = 0;
    this.cameras.main.setBackgroundColor('#0b1026');
    text(this, W / 2, 44, 'Make your astronaut', 44, C.goldText, { fontStyle: 'bold' }).setOrigin(0.5);

    panel(this, 40, 96, 420, 500);
    this.preview = this.add.sprite(250, 300, 'player-down-0').setScale(6);
    this.petPreview = this.add.sprite(370, 420, 'pet-cat-0').setScale(3);
    this.add.existing(button(this, 120, 540, '«', () => this.turn(-1), 64, 44, 0x9aa3b0));
    this.add.existing(button(this, 380, 540, '»', () => this.turn(1), 64, 44, 0x9aa3b0));
    text(this, 250, 540, 'Turn around', 18, C.dim).setOrigin(0.5);

    panel(this, 490, 96, 750, 500);
    this.rows = this.add.container(0, 0);

    this.add.existing(button(this, 200, 650, '« Back', () => this.scene.start('Title'), 200, 52, 0x9aa3b0));
    const go = this.fresh ? 'Start mission »' : 'Continue mission »';
    this.add.existing(button(this, W - 220, 650, go, () => this.start(), 320, 56, 0xffd166));
    text(this, W / 2, H - 24, 'Your look is saved for every mission. Enter starts, Esc goes back.', 16, C.dim).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => this.start());
    kb.on('keydown-ESC', () => this.scene.start('Title'));
    kb.on('keydown-LEFT', () => this.turn(-1));
    kb.on('keydown-RIGHT', () => this.turn(1));
    this.refresh();
  }

  private start() {
    saveAstronaut(this.astro);
    startMission(this, this.fresh);
  }

  private turn(by: number) {
    this.dir = (this.dir + by + DIRS.length) % DIRS.length;
    this.refreshPreview();
  }

  private set(change: Partial<Astronaut>) {
    Object.assign(this.astro, change);
    makeCharacter(this, 'player', this.astro);
    this.refresh();
  }

  private refresh() {
    this.refreshPreview();
    this.rows.removeAll(true);
    const a = this.astro;
    let y = 130;
    const row = (label: string) => {
      this.rows.add(text(this, 520, y + 6, label, 20, C.text));
      const at = y;
      y += 64;
      return at;
    };
    const choices = <T>(at: number, options: [T, string][], current: T, pick: (v: T) => void, w = 130) => {
      options.forEach(([value, label], i) => {
        const on = value === current;
        this.rows.add(button(this, 720 + i * (w + 12), at + 18, label, () => pick(value), w, 40, on ? 0xffd166 : 0x9aa3b0));
      });
    };
    const swatches = (at: number, colours: string[], current: string, pick: (c: string) => void) => {
      colours.forEach((c, i) => {
        const x = 676 + i * 56;
        const on = c === current;
        const sw = this.add.rectangle(x, at + 18, 42, 36, Phaser.Display.Color.HexStringToColor(c).color)
          .setStrokeStyle(on ? 5 : 2, on ? 0xffd166 : 0x0f1420)
          .setInteractive({ useHandCursor: true });
        sw.on('pointerdown', () => pick(c));
        this.rows.add(sw);
      });
    };

    choices<Astronaut['kid']>(row("I'm a"), [['girl', 'Girl'], ['boy', 'Boy']], a.kid, (kid) => this.set({ kid, hairStyle: kid === 'girl' ? 'long' : 'short' }));
    const styles: [Astronaut['hairStyle'], string][] = [['short', 'Short'], ['long', 'Long']];
    if (a.kid === 'girl') styles.push(['puffs', 'Puffs']);
    choices<Astronaut['hairStyle']>(row('Hair style'), styles, a.hairStyle, (hairStyle) => this.set({ hairStyle }));
    swatches(row('Hair colour'), HAIRS, a.hair, (hair) => this.set({ hair }));
    swatches(row('Skin tone'), SKINS, a.skin, (skin) => this.set({ skin }));
    swatches(row('Space suit'), SUITS, a.suit, (suit) => this.set({ suit }));
    swatches(row('Trousers'), PANTS, a.pants, (pants) => this.set({ pants }));
    choices(row('Pet'), PET_LABELS, a.pet, (pet) => this.set({ pet }), 128);
  }

  private refreshPreview() {
    this.preview.setTexture(`player-${DIRS[this.dir]}-0`);
    const pet = this.astro.pet;
    this.petPreview.setVisible(pet !== 'none');
    if (pet !== 'none') this.petPreview.setTexture(`pet-${pet}-0`);
  }
}
