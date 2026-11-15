import type Phaser from 'phaser';

type ViewSize = 'fit' | 'readable' | 'large';

/** Add touch-friendly viewport controls while keeping Phaser's existing game instance. */
export function initializeViewport(game: Phaser.Game): void {
  const viewport = document.getElementById('game-viewport');
  const select = document.getElementById('view-size') as HTMLSelectElement | null;
  const readingView = document.getElementById('reading-view') as HTMLDetailsElement | null;
  if (!viewport || !select || !readingView) return;

  const applyView = (view: ViewSize) => {
    viewport.dataset.view = view;
    document.getElementById('pan-controls')!.hidden = view === 'fit';
    // The parent dimensions changed; ask Phaser to refit the current game and scenes.
    game.scale.refresh();
  };

  for (const [id, direction] of [['pan-left', -1], ['pan-right', 1]] as const) {
    document.getElementById(id)?.addEventListener('click', () => {
      viewport.scrollLeft += direction * viewport.clientWidth * 0.75;
    });
  }

  // Decide the initial reading aid state once so resizing does not override the player's choice.
  if (window.matchMedia('(max-width: 700px)').matches) readingView.open = true;
  applyView('fit');
  select.addEventListener('change', () => {
    const value = select.value;
    if (value === 'readable' || value === 'large') applyView(value);
    else applyView('fit');
  });

  const labelCanvas = () => {
    const canvas = game.canvas;
    if (!canvas) return;
    canvas.setAttribute('aria-label', 'Faraway Garden game. Use arrow keys or WASD to move, Space to act, and H to open help. Touch players can tap the screen.');
    canvas.setAttribute('tabindex', '0');
  };
  labelCanvas();
  // Limit gameplay shortcuts to the focused canvas so normal page navigation remains usable.
  const keyboard = game.input.keyboard;
  if (keyboard) {
    keyboard.stopListeners();
    keyboard.target = game.canvas;
    keyboard.startListeners();
  }
  game.canvas.addEventListener('pointerdown', () => game.canvas.focus({ preventScroll: true }));
  game.canvas.addEventListener('blur', () => {
    for (const scene of game.scene.getScenes(true)) scene.input.keyboard?.resetKeys();
  });
}
