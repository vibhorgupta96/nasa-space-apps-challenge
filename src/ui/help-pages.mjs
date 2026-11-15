/** The three short how-to screens shown from Help and during the first-day tutorial. */
export function createHelpPages(cellsPerSol, heaterNeededBelowC, worldId = 'mars') {
  if (worldId === 'moon') {
    return [
      {
        title: '1 · Plant and care for crops',
        lines: [
          'Move with the arrow keys or WASD. Hold SHIFT for a short Moon-hop.',
          'Keys 1–5 choose lunar greenhouse seeds. SPACE plants; key 6 waters; key 7 harvests or clears.',
          'Tomatoes need extra water. Peas make extra air. The Arabidopsis experiment adds no food.',
        ],
      },
      {
        title: '2 · Plan for light and dark',
        lines: [
          `${cellsPerSol} power cells are available today. The compressed bright and dark stretches have different budgets.`,
          'Thermal control cools in daylight and warms the greenhouse during the dark stretch.',
          'Dust from a rover return reduces tomorrow’s power. Clean the rover at the airlock.',
        ],
      },
      {
        title: '3 · Watch lunar hazards',
        lines: [
          'Press TAB for the lunar hazard board. Radiation timing and effects in the game are simulated.',
          'Shelter cells plus shield layers must reach a hazard’s simulated strength.',
          'Plan stops and Return on the rover map. Choose Auto-drive or Drive yourself: WASD / arrows steer; SPACE brakes. Visit every checkpoint and dock slowly for 2× cargo. Let Bolt drive forfeits the bonus. Lunar jumps last longer.',
        ],
      },
    ];
  }
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
        'Use the top airlock to plan stops and a route that returns to the dome. Choose Auto-drive or Drive yourself: WASD / arrows steer; SPACE brakes. Visit all checkpoints and dock slowly for 2× cargo. Let Bolt drive forfeits the bonus.',
      ],
    },
  ];
}
