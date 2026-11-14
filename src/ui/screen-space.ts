/** Minimal structural shape shared by Phaser Containers and their nested objects. */
interface ScrollFactorNode {
  setScrollFactor?: (x: number, y?: number) => unknown;
  list?: readonly unknown[];
}

/** Pin every descendant, including interactive Zones, to the screen coordinates. */
export function setScrollFactorTree(root: ScrollFactorNode, x: number, y = x): void {
  root.setScrollFactor?.(x, y);
  for (const child of root.list ?? []) {
    if (child && typeof child === 'object') setScrollFactorTree(child as ScrollFactorNode, x, y);
  }
}
