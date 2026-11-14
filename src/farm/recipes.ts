// Kitchen recipes. Harvests go to the pantry; cooking different crops together feeds the crew
// more than eating them raw, so it pays to plant a mix and time the harvests.
// Food and seed values are game-balance choices, not NASA measurements.

export interface Recipe {
  id: string;
  name: string;
  needs: Record<string, number>; // crop id → how many
  food: number;
  seeds: number; // seeds saved for replanting
  text: string;
}

export const RECIPES: Recipe[] = [
  {
    id: 'space-salad', name: 'Space Salad', needs: { 'red-romaine': 1, mizuna: 1 }, food: 45, seeds: 0,
    text: 'Red romaine and peppery mizuna: two greens astronauts really grew and ate on the space station.',
  },
  {
    id: 'radish-wraps', name: 'Radish Lettuce Wraps', needs: { radish: 1, 'red-romaine': 1 }, food: 55, seeds: 0,
    text: 'Crunchy radish rolled up in lettuce leaves.',
  },
  {
    id: 'chile-tacos', name: 'Mars Chile Tacos', needs: { chile: 1, radish: 1, mizuna: 1 }, food: 95, seeds: 0,
    text: 'Spicy chile, crunchy radish and mizuna on top. A feast for the whole crew!',
  },
  {
    id: 'zinnia-seeds', name: 'Save Zinnia Seeds', needs: { zinnia: 1 }, food: 0, seeds: 3,
    text: 'Zinnias aren\'t for eating, but a dried flower head is full of seeds to plant again.',
  },
];

export const recipeById = (id: string) => RECIPES.find((r) => r.id === id) ?? null;
