import type Phaser from 'phaser';
import { bus } from '../core/events';
import { readableEntries, type ReadableNode } from './readable-model';

/** Reflow canvas copy into normal HTML without scaling its font or changing game coordinates. */
export function initializeReadableView(game: Phaser.Game) {
  const details = document.querySelector<HTMLDetailsElement>('#reading-view')!;
  const content = document.querySelector<HTMLElement>('#reading-content')!;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Loading game…';
  const notification = document.createElement('p');
  notification.setAttribute('role', 'status');
  content.before(status, notification);
  let context = '';

  // DOM controls own their keys. In particular, Enter must not also start a mission and
  // Space/Tab must retain their native scrolling and focus behavior.
  for (const host of [details, document.querySelector('#game-toolbar'), document.querySelector('#pan-controls')]) {
    for (const event of ['keydown', 'keyup']) host?.addEventListener(event, e => e.stopPropagation());
  }
  const refresh = () => {
    if (!details.open) return;
    const scenes = game.scene.getScenes(true);
    const modal = [...scenes].reverse().flatMap(scene =>
      [...scene.children.list].reverse().filter(node => (node as unknown as ReadableNode).visible !== false && node.getData('readableModal')),
    )[0];
    const allNodes = scenes.flatMap(scene => scene.children.list);
    const notices = allNodes.filter(node => node.getData('readableNotification') && (node as unknown as ReadableNode).visible !== false);
    const message = readableEntries(notices as ReadableNode[]).map(entry => entry.text).join('\n');
    if (notification.textContent !== message) notification.textContent = message;
    const nodes = modal ? [modal] : allNodes.filter(node => !node.getData('readableNotification'));
    const entries = readableEntries(nodes as ReadableNode[]);
    if (!modal && scenes.some(scene => scene.scene.key === 'UI')) {
      for (const [text, panel] of [['Help', 'help'], ['Environment board', 'board'], ['Photo album', 'album']]) {
        entries.push({ text, activate: () => bus.emit('ui:open', panel) });
      }
    }
    const nextContext = modal ? entries.find(entry => !entry.activate)?.text ?? 'Game panel' : scenes.map(scene => scene.scene.key).join(' · ');
    const changed = context !== nextContext;
    const hadFocus = content.contains(document.activeElement);
    context = nextContext;
    if (changed) status.textContent = nextContext || 'Loading game…';

    // Keep existing DOM nodes, including keyboard focus, while counters/typewriter text update.
    const counts = new Map<string, number>();
    const old = new Map([...content.children].map(child => [(child as HTMLElement).dataset.readableKey!, child as HTMLElement]));
    for (const [index, entry] of entries.entries()) {
      const base = entry.activate ? `action:${entry.text}` : `text:${index}`;
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      const key = `${base}:${count}`;
      const element = old.get(key) ?? document.createElement(entry.activate ? 'button' : 'p');
      old.delete(key);
      element.dataset.readableKey = key;
      if (element.textContent !== entry.text) element.textContent = entry.text;
      if (entry.activate) {
        (element as HTMLButtonElement).type = 'button';
        if (entry.pressed === undefined) element.removeAttribute('aria-pressed');
        else element.setAttribute('aria-pressed', String(entry.pressed));
        element.onclick = () => { entry.activate?.(); refresh(); };
      }
      const at = content.children[index];
      if (at !== element) content.insertBefore(element, at ?? null);
    }
    for (const element of old.values()) element.remove();
    if (hadFocus && (changed || !content.contains(document.activeElement))) {
      // Panel changes should never drop keyboard users back to the browser document.
      content.tabIndex = -1;
      content.focus({ preventScroll: true });
    }
  };
  details.addEventListener('toggle', refresh);
  const timer = window.setInterval(refresh, 250);
  refresh();
  game.events.once('destroy', () => window.clearInterval(timer));
}
