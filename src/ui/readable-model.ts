/** Explicit alternatives for controls drawn inside the game canvas. */
export interface ReadableAction {
  label: string;
  activate: () => void;
  pressed?: boolean;
}

export interface ReadableNode {
  visible?: boolean;
  alpha?: number;
  text?: string;
  list?: readonly ReadableNode[];
  getData?: (key: string) => unknown;
  input?: { enabled?: boolean } | null;
  listenerCount?: (event: string) => number;
  emit?: (event: string, ...args: unknown[]) => unknown;
}

export interface ReadableEntry {
  text: string;
  activate?: () => void;
  pressed?: boolean;
}

/** Hidden parents hide descendants. An explicit control replaces its decorative children. */
export function readableEntries(nodes: readonly ReadableNode[]): ReadableEntry[] {
  return nodes.flatMap((node): ReadableEntry[] => {
    if (node.visible === false || node.alpha === 0) return [];
    const action = node.getData?.('readableAction') as ReadableAction | undefined;
    if (action) return [{ text: action.label, activate: action.activate, ...(action.pressed === undefined ? {} : { pressed: action.pressed }) }];
    const children = node.list ? readableEntries(node.list) : [];
    const copy = node.getData?.('readableText') ?? node.text;
    if (typeof copy !== 'string' || !copy.trim()) return children;
    // Source links are already text objects with real pointer handlers. Ignore passive blockers.
    const clickable = node.input?.enabled && (node.listenerCount?.('pointerdown') ?? 0) > 0;
    return [{ text: copy, ...(clickable ? { activate: () => node.emit?.('pointerdown') } : {}) }, ...children];
  });
}
