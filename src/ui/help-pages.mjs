/** The three short how-to screens shown from Help and during the first-sol tutorial. */
export function createHelpPages(cellsPerSol, heaterNeededBelowC) {
  return [
    {
      title: '1 · Plant and care for crops',
      lines: [
        'Move with the arrow keys or WASD, or tap where to go. Next to a plot, press SPACE or tap it.',
        'Keys 1–5 choose seeds. Planting uses one seed and one water.',
        'Key 6 waters, key 7 harvests or clears. Cook harvests in the kitchen: recipes mix crops for more food.',
      ],
    },
    {
      title: '2 · Share power each morning',
      lines: [
        `Split ${cellsPerSol} power cells between grow lights, heater, shelter, and Bolt’s rover.`,
        `Crops need water, light, and warmth. Below ${heaterNeededBelowC}°C, use a heater cell.`,
        'In the game, healthy growing crops add air. Harvested crops add food for the crew.',
      ],
    },
    {
      title: '3 · Watch storms and plan rover trips',
      lines: [
        'Press TAB for the storm board (M mutes sound). Strength and effects at the dome are game simulations.',
        'Shelter cells plus shield layers must reach the storm’s simulated strength.',
        'Use the top airlock to plan a route that returns to the dome. Bring ice home to make water.',
      ],
    },
  ];
}
