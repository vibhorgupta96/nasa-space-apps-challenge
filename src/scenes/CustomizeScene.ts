import Phaser from 'phaser';
import { makeCharacter } from '../farm/art';
import { HAIRS, NAME_MAX, PANTS, SKINS, SUITS, loadAstronaut, saveAstronaut, type Astronaut, type PetKind } from '../farm/look';
import { C, H, W, button, panel, text } from '../ui/theme';
import { startMission } from './TitleScene';
import type { WorldId } from '../core/types';

const DIRS = ['down', 'right', 'up', 'left'] as const;
const PET_LABELS: [PetKind, string][] = [['cat', 'Cat'], ['dog', 'Dog'], ['alien', 'Mars alien'], ['none', 'No pet']];
const WORLD_PET_LABELS: [PetKind, string][] = [['cat', 'Cat'], ['dog', 'Dog'], ['alien', 'Alien visitor'], ['none', 'No pet']];

/** "Make your astronaut": girl or boy, hair, skin tone, clothes and a pet. Opens before a mission. */
export class CustomizeScene extends Phaser.Scene {
  private astro!: Astronaut;
  private fresh = true;
  private worldId: WorldId = 'mars';
  private dir = 0;
  private preview!: Phaser.GameObjects.Sprite;
  private petPreview!: Phaser.GameObjects.Sprite;
  private rows!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private nameWarn!: Phaser.GameObjects.Text;
  private nameEditorCleanup: ((deferPointerRestore?: boolean) => void) | null = null;
  private nameEditorRestorePointer: (() => void) | null = null;
  private nameEditorRestoreTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Customize');
  }

  init(data: { fresh?: boolean; worldId?: WorldId }) {
    this.fresh = data.fresh ?? true;
    this.worldId = data.worldId ?? 'mars';
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
    kb.on('keydown', (e: KeyboardEvent) => this.typeName(e));
    this.events.once('shutdown', () => this.closeNameEditor(false));
    this.nameWarn = text(this, W - 220, 604, '', 18, C.warn).setOrigin(0.5);
    this.refresh();
  }

  private start() {
    if (!this.astro.name.trim()) {
      this.nameWarn.setText('Type your astronaut name first!');
      this.cameras.main.shake(150, 0.003);
      return;
    }
    this.astro.name = this.astro.name.trim();
    saveAstronaut(this.astro);
    startMission(this, this.fresh, this.worldId);
  }

  /** Letters, digits, spaces and dashes type into the name; Backspace deletes. */
  private typeName(e: KeyboardEvent) {
    const a = this.astro;
    if (e.key === 'Backspace') a.name = a.name.slice(0, -1);
    else if (e.key.length === 1 && /[\p{L}\p{N} '-]/u.test(e.key) && a.name.length < NAME_MAX) a.name += e.key;
    else return;
    this.nameWarn.setText('');
    this.showName();
  }

  /** A regular DOM dialog keeps name entry usable on touch screens and embedded browsers. */
  private askName() {
    if (this.nameEditorCleanup) return;
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '10000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', boxSizing: 'border-box', background: 'rgba(5, 7, 15, 0.78)', fontFamily: 'system-ui, sans-serif',
    });
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    Object.assign(form.style, {
      width: 'min(420px, 100%)', boxSizing: 'border-box', padding: '24px', borderRadius: '16px',
      color: '#2a2440', background: '#fff8e7', border: '3px solid #e0b44f', boxShadow: '0 16px 48px #0009',
    });
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2');
    heading.textContent = 'Name your astronaut';
    Object.assign(heading.style, { margin: '0 0 16px', fontSize: '24px' });
    const label = document.createElement('label');
    label.htmlFor = 'astronaut-name-input';
    label.textContent = 'Astronaut name';
    Object.assign(label.style, { display: 'block', marginBottom: '8px', fontWeight: '700' });
    const input = document.createElement('input');
    input.id = 'astronaut-name-input';
    input.name = 'astronautName';
    input.type = 'text';
    input.value = this.astro.name;
    input.maxLength = NAME_MAX;
    input.setAttribute('autocomplete', 'nickname');
    input.setAttribute('aria-label', 'Astronaut name');
    Object.assign(input.style, {
      width: '100%', boxSizing: 'border-box', minHeight: '46px', padding: '10px 12px', border: '2px solid #3fa7a0',
      borderRadius: '8px', background: '#fff', color: '#2a2440', font: 'inherit', fontSize: '18px',
    });
    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' });
    const makeButton = (caption: string, primary: boolean) => {
      const button = document.createElement('button');
      button.type = primary ? 'submit' : 'button';
      button.textContent = caption;
      Object.assign(button.style, {
        minHeight: '42px', padding: '8px 16px', borderRadius: '8px', border: '0', cursor: 'pointer',
        color: primary ? '#2a2440' : '#fff', background: primary ? '#ffd166' : '#586174', font: 'inherit', fontWeight: '700',
      });
      return button;
    };
    const cancel = makeButton('Cancel', false);
    const save = makeButton('Save', true);
    actions.append(cancel, save);
    form.append(heading, label, input, actions);
    overlay.append(form);
    document.body.append(overlay);

    const keyboard = this.input.keyboard;
    const wasEnabled = keyboard?.enabled ?? true;
    const wasInputEnabled = this.input.enabled;
    this.input.enabled = false;
    if (keyboard) {
      keyboard.enabled = false;
      keyboard.disableGlobalCapture();
    }
    let finished = false;
    const cleanup = (deferPointerRestore = true) => {
      if (finished) return;
      finished = true;
      overlay.remove();
      if (keyboard) {
        keyboard.enabled = wasEnabled;
        keyboard.enableGlobalCapture();
      }
      this.nameEditorCleanup = null;
      const restorePointer = () => {
        this.input.enabled = wasInputEnabled;
        this.nameEditorRestoreTimer = null;
        this.nameEditorRestorePointer = null;
      };
      this.nameEditorRestorePointer = restorePointer;
      if (deferPointerRestore) this.nameEditorRestoreTimer = this.time.delayedCall(0, restorePointer);
      else restorePointer();
    };
    const finish = (saveName: boolean) => {
      if (saveName) {
        this.astro.name = input.value.replace(/[^\p{L}\p{N} '-]/gu, '').slice(0, NAME_MAX);
        this.nameWarn.setText('');
        this.showName();
        saveAstronaut(this.astro);
      }
      cleanup();
    };
    this.nameEditorCleanup = cleanup;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(true);
    });
    cancel.addEventListener('click', () => finish(false));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Tab') {
        const focusables = [input, cancel, save];
        const index = focusables.indexOf(document.activeElement as HTMLInputElement | HTMLButtonElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          save.focus();
        } else if (!event.shiftKey && index === focusables.length - 1) {
          event.preventDefault();
          input.focus();
        }
      }
    });
    for (const eventName of ['pointerdown', 'pointerup', 'pointermove', 'click', 'auxclick', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel', 'contextmenu']) {
      overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }
    input.focus();
  }

  private closeNameEditor(deferPointerRestore = true) {
    this.nameEditorCleanup?.(deferPointerRestore);
    if (!this.nameEditorCleanup && !this.nameEditorRestorePointer) return;
    if (this.nameEditorRestoreTimer) {
      this.nameEditorRestoreTimer.remove(false);
      this.nameEditorRestoreTimer = null;
    }
    this.nameEditorRestorePointer?.();
  }

  private showName() {
    const blink = Math.floor(this.time.now / 500) % 2 === 0 ? '_' : ' ';
    this.nameText?.setText(this.astro.name ? `${this.astro.name}${blink}` : `Type your name${blink}`).setColor(this.astro.name ? C.text : C.dim);
  }

  update() {
    this.showName();
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
    let y = 118;
    let rowLabel = '';
    const row = (label: string) => {
      rowLabel = label;
      this.rows.add(text(this, 520, y + 6, label, 20, C.text));
      const at = y;
      y += 58;
      return at;
    };
    const choices = <T>(at: number, options: [T, string][], current: T, pick: (v: T) => void, w = 130) => {
      options.forEach(([value, label], i) => {
        const on = value === current;
        this.rows.add(button(this, 720 + i * (w + 12), at + 18, label, () => pick(value), w, 40, on ? 0xffd166 : 0x9aa3b0).setData('readableAction', { label: `${rowLabel}: ${label}`, pressed: on, activate: () => pick(value) }));
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
        sw.setData('readableAction', { label: `${rowLabel}: colour ${i + 1}`, pressed: on, activate: () => pick(c) });
        this.rows.add(sw);
      });
    };

    const nameAt = row('My name');
    const box = this.add.rectangle(676 - 21, nameAt + 18, 520, 40, 0x141927).setOrigin(0, 0.5).setStrokeStyle(2, 0xffd166)
      .setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => this.askName());
    box.setData('readableAction', { label: 'Edit astronaut name', activate: () => this.askName() });
    this.nameText = text(this, 676 - 9, nameAt + 18, '', 22, C.text).setOrigin(0, 0.5);
    this.rows.add([box, this.nameText]);
    this.showName();
    choices<Astronaut['kid']>(row("I'm a"), [['girl', 'Girl'], ['boy', 'Boy']], a.kid, (kid) => this.set({ kid, hairStyle: kid === 'girl' ? 'long' : 'short' }));
    const styles: [Astronaut['hairStyle'], string][] = [['short', 'Short'], ['long', 'Long']];
    if (a.kid === 'girl') styles.push(['puffs', 'Puffs']);
    choices<Astronaut['hairStyle']>(row('Hair style'), styles, a.hairStyle, (hairStyle) => this.set({ hairStyle }));
    swatches(row('Hair colour'), HAIRS, a.hair, (hair) => this.set({ hair }));
    swatches(row('Skin tone'), SKINS, a.skin, (skin) => this.set({ skin }));
    swatches(row('Space suit'), SUITS, a.suit, (suit) => this.set({ suit }));
    swatches(row('Trousers'), PANTS, a.pants, (pants) => this.set({ pants }));
    choices(row('Pet'), this.worldId === 'moon' ? WORLD_PET_LABELS : PET_LABELS, a.pet, (pet) => this.set({ pet }), 128);
  }

  private refreshPreview() {
    this.preview.setTexture(`player-${DIRS[this.dir]}-0`);
    const pet = this.astro.pet;
    this.petPreview.setVisible(pet !== 'none');
    if (pet !== 'none') this.petPreview.setTexture(`pet-${pet}-0`);
  }
}
