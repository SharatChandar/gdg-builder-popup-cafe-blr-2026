// Illustrative estimates for the approved fictional menu, not measured nutrition.
// Values describe one serving of the original recipe; substitutions are excluded.
const estimates = {
  "flat-white": [120, "180 ml"],
  "iced-latte": [160, "250 ml"],
  cappuccino: [100, "180 ml"],
  "cold-brew": [5, "250 ml"],
  croissant: [280, "1 pastry (70 g)"],
  "almond-croissant": [420, "1 pastry (100 g)"],
  "avocado-toast": [380, "1 plate"],
  "breakfast-toast": [360, "1 plate"],
  matcha: [170, "250 ml"],
  tea: [120, "200 ml"],
};

export function addMenuNutrition(state) {
  for (const item of state.menu) {
    const estimate = estimates[item.id];
    // Backfill existing databases without replacing staff-provided nutrition.
    if (estimate && !Object.hasOwn(item, "nutrition")) {
      item.nutrition = {
        calories: estimate[0],
        serving: estimate[1],
        estimated: true,
        basis: "Illustrative original recipe",
      };
    }
  }
}
