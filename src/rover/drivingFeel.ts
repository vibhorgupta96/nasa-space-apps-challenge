/** Visual interpolation only: the store remains responsible for the rover's position and clock. */
export function lunarDrivePose(progress: number, terrainCost: number) {
  const t = Math.max(0, Math.min(1, progress));
  // Ease into and out of each tile, with a small bounce on rougher ground.
  const eased = t * t * (3 - 2 * t);
  const bounce = Math.sin(Math.PI * t) * (1 + Math.min(3, Math.max(1, terrainCost)));
  return { progress: eased, bounce };
}
