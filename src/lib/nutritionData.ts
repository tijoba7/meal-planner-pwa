// ─── Nutrition Database ────────────────────────────────────────────────────────
// Per-100g nutritional values for common cooking ingredients.
// Sources: USDA FoodData Central (approximate values).
// Fields: calories (kcal), protein (g), carbs (g), fat (g), fiber (g), sodium (mg)
// densityGml: grams per ml — used to convert volume units to weight
// typicalWeightG: grams per count unit (1 egg, 1 clove, etc.)

export interface NutritionEntry {
  name: string
  /** Lowercase substrings to match against an ingredient name (longest match wins) */
  aliases: string[]
  per100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sodium: number
  }
  /** g/ml — defaults to 1.0 when converting volume → weight */
  densityGml?: number
  /** grams per count unit (e.g. 1 egg = 50g) */
  typicalWeightG?: number
}

export const NUTRITION_DB: NutritionEntry[] = [
  // ─── Poultry ────────────────────────────────────────────────────────────────
  {
    name: 'Chicken breast',
    aliases: ['chicken breast'],
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74 },
  },
  {
    name: 'Chicken thigh',
    aliases: ['chicken thigh'],
    per100g: { calories: 177, protein: 24, carbs: 0, fat: 9, fiber: 0, sodium: 82 },
  },
  {
    name: 'Chicken (generic)',
    aliases: ['chicken'],
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74 },
  },
  {
    name: 'Turkey',
    aliases: ['turkey'],
    per100g: { calories: 189, protein: 29, carbs: 0, fat: 7.4, fiber: 0, sodium: 70 },
  },

  // ─── Beef ───────────────────────────────────────────────────────────────────
  {
    name: 'Ground beef (80/20)',
    aliases: ['ground beef', 'minced beef', 'beef mince'],
    per100g: { calories: 254, protein: 17, carbs: 0, fat: 20, fiber: 0, sodium: 75 },
  },
  {
    name: 'Beef steak',
    aliases: ['beef steak', 'sirloin', 'ribeye', 'flank steak', 'skirt steak', 'chuck'],
    per100g: { calories: 271, protein: 26, carbs: 0, fat: 18, fiber: 0, sodium: 54 },
  },
  {
    name: 'Beef (generic)',
    aliases: ['beef'],
    per100g: { calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, sodium: 65 },
  },

  // ─── Pork ───────────────────────────────────────────────────────────────────
  {
    name: 'Bacon',
    aliases: ['bacon'],
    per100g: { calories: 541, protein: 37, carbs: 0, fat: 42, fiber: 0, sodium: 1717 },
  },
  {
    name: 'Ham',
    aliases: ['ham'],
    per100g: { calories: 145, protein: 21, carbs: 2, fat: 5, fiber: 0, sodium: 1203 },
  },
  {
    name: 'Pork',
    aliases: ['pork'],
    per100g: { calories: 242, protein: 27, carbs: 0, fat: 14, fiber: 0, sodium: 62 },
  },
  {
    name: 'Italian sausage',
    aliases: ['italian sausage', 'sausage'],
    per100g: { calories: 304, protein: 14, carbs: 2, fat: 27, fiber: 0, sodium: 736 },
  },

  // ─── Seafood ────────────────────────────────────────────────────────────────
  {
    name: 'Salmon',
    aliases: ['salmon'],
    per100g: { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sodium: 59 },
  },
  {
    name: 'Tuna (canned)',
    aliases: ['tuna'],
    per100g: { calories: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0, sodium: 396 },
  },
  {
    name: 'Shrimp',
    aliases: ['shrimp', 'prawn', 'prawns'],
    per100g: { calories: 99, protein: 24, carbs: 0, fat: 0.3, fiber: 0, sodium: 111 },
  },
  {
    name: 'Cod',
    aliases: ['cod', 'tilapia', 'white fish'],
    per100g: { calories: 82, protein: 18, carbs: 0, fat: 0.7, fiber: 0, sodium: 54 },
  },

  // ─── Eggs & Tofu ────────────────────────────────────────────────────────────
  {
    name: 'Egg',
    aliases: ['egg', 'eggs'],
    per100g: { calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sodium: 124 },
    typicalWeightG: 50,
  },
  {
    name: 'Tofu',
    aliases: ['tofu', 'firm tofu', 'silken tofu'],
    per100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, sodium: 7 },
    densityGml: 1.0,
  },
  {
    name: 'Tempeh',
    aliases: ['tempeh'],
    per100g: { calories: 193, protein: 19, carbs: 9, fat: 11, fiber: 0, sodium: 9 },
  },

  // ─── Legumes ────────────────────────────────────────────────────────────────
  {
    name: 'Chickpeas',
    aliases: ['chickpea', 'chickpeas', 'garbanzo'],
    per100g: { calories: 164, protein: 9, carbs: 27, fat: 2.6, fiber: 7.6, sodium: 24 },
    densityGml: 0.85,
  },
  {
    name: 'Black beans',
    aliases: ['black bean', 'black beans'],
    per100g: { calories: 132, protein: 8.9, carbs: 23.7, fat: 0.5, fiber: 8.7, sodium: 1 },
    densityGml: 0.85,
  },
  {
    name: 'Kidney beans',
    aliases: ['kidney bean', 'kidney beans'],
    per100g: { calories: 127, protein: 8.7, carbs: 22.8, fat: 0.5, fiber: 6.4, sodium: 2 },
    densityGml: 0.85,
  },
  {
    name: 'Pinto beans',
    aliases: ['pinto bean', 'pinto beans'],
    per100g: { calories: 143, protein: 9, carbs: 26, fat: 0.6, fiber: 9, sodium: 1 },
    densityGml: 0.85,
  },
  {
    name: 'Lentils',
    aliases: ['lentil', 'lentils'],
    per100g: { calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sodium: 2 },
    densityGml: 0.85,
  },
  {
    name: 'Edamame',
    aliases: ['edamame'],
    per100g: { calories: 122, protein: 11, carbs: 9.9, fat: 5.2, fiber: 5.2, sodium: 63 },
  },

  // ─── Dairy ──────────────────────────────────────────────────────────────────
  {
    name: 'Whole milk',
    aliases: ['whole milk'],
    per100g: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sodium: 43 },
    densityGml: 1.03,
  },
  {
    name: 'Skim milk',
    aliases: ['skim milk', 'skimmed milk', 'nonfat milk', 'fat free milk'],
    per100g: { calories: 34, protein: 3.4, carbs: 5, fat: 0.2, fiber: 0, sodium: 44 },
    densityGml: 1.03,
  },
  {
    name: 'Milk (generic)',
    aliases: ['milk'],
    per100g: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sodium: 43 },
    densityGml: 1.03,
  },
  {
    name: 'Buttermilk',
    aliases: ['buttermilk'],
    per100g: { calories: 40, protein: 3.3, carbs: 4.8, fat: 0.9, fiber: 0, sodium: 105 },
    densityGml: 1.03,
  },
  {
    name: 'Heavy cream',
    aliases: ['heavy cream', 'heavy whipping cream', 'double cream', 'whipping cream'],
    per100g: { calories: 340, protein: 2.8, carbs: 2.8, fat: 36, fiber: 0, sodium: 38 },
    densityGml: 1.0,
  },
  {
    name: 'Half and half',
    aliases: ['half and half', 'half-and-half'],
    per100g: { calories: 130, protein: 3, carbs: 4.3, fat: 11.5, fiber: 0, sodium: 41 },
    densityGml: 1.02,
  },
  {
    name: 'Sour cream',
    aliases: ['sour cream'],
    per100g: { calories: 198, protein: 2.4, carbs: 4.6, fat: 19.4, fiber: 0, sodium: 53 },
    densityGml: 1.0,
  },
  {
    name: 'Cream cheese',
    aliases: ['cream cheese'],
    per100g: { calories: 342, protein: 6, carbs: 4.1, fat: 34, fiber: 0, sodium: 321 },
  },
  {
    name: 'Greek yogurt',
    aliases: ['greek yogurt', 'greek yoghurt'],
    per100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, sodium: 36 },
    densityGml: 1.0,
  },
  {
    name: 'Yogurt',
    aliases: ['yogurt', 'yoghurt'],
    per100g: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, sodium: 46 },
    densityGml: 1.0,
  },
  {
    name: 'Butter',
    aliases: ['butter'],
    per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sodium: 11 },
    densityGml: 0.91,
  },
  {
    name: 'Cheddar cheese',
    aliases: ['cheddar'],
    per100g: { calories: 402, protein: 25, carbs: 1.3, fat: 33, fiber: 0, sodium: 621 },
  },
  {
    name: 'Mozzarella',
    aliases: ['mozzarella'],
    per100g: { calories: 280, protein: 28, carbs: 2.2, fat: 17, fiber: 0, sodium: 627 },
  },
  {
    name: 'Parmesan',
    aliases: ['parmesan', 'parmigiano'],
    per100g: { calories: 431, protein: 38, carbs: 4.1, fat: 29, fiber: 0, sodium: 1529 },
  },
  {
    name: 'Feta cheese',
    aliases: ['feta'],
    per100g: { calories: 264, protein: 14, carbs: 4, fat: 21, fiber: 0, sodium: 1116 },
  },
  {
    name: 'Swiss cheese',
    aliases: ['swiss cheese', 'gruyere', 'gruyère'],
    per100g: { calories: 380, protein: 27, carbs: 5, fat: 28, fiber: 0, sodium: 192 },
  },
  {
    name: 'Ricotta',
    aliases: ['ricotta'],
    per100g: { calories: 174, protein: 11, carbs: 3, fat: 13, fiber: 0, sodium: 84 },
  },
  {
    name: 'Cheese (generic)',
    aliases: ['cheese'],
    per100g: { calories: 350, protein: 22, carbs: 2, fat: 28, fiber: 0, sodium: 600 },
  },

  // ─── Grains & Flour ─────────────────────────────────────────────────────────
  {
    name: 'All-purpose flour',
    aliases: ['all-purpose flour', 'all purpose flour', 'plain flour', 'white flour'],
    per100g: { calories: 364, protein: 10, carbs: 76, fat: 1, fiber: 2.7, sodium: 2 },
    densityGml: 0.6,
  },
  {
    name: 'Whole wheat flour',
    aliases: ['whole wheat flour', 'whole-wheat flour', 'wholemeal flour'],
    per100g: { calories: 340, protein: 13, carbs: 72, fat: 2.5, fiber: 10.7, sodium: 3 },
    densityGml: 0.6,
  },
  {
    name: 'Bread flour',
    aliases: ['bread flour'],
    per100g: { calories: 365, protein: 12, carbs: 73, fat: 2, fiber: 2.7, sodium: 2 },
    densityGml: 0.6,
  },
  {
    name: 'Almond flour',
    aliases: ['almond flour', 'almond meal'],
    per100g: { calories: 576, protein: 21, carbs: 22, fat: 50, fiber: 12, sodium: 1 },
    densityGml: 0.45,
  },
  {
    name: 'Flour (generic)',
    aliases: ['flour'],
    per100g: { calories: 364, protein: 10, carbs: 76, fat: 1, fiber: 2.7, sodium: 2 },
    densityGml: 0.6,
  },
  {
    name: 'White rice (cooked)',
    aliases: ['white rice', 'cooked rice', 'jasmine rice', 'basmati rice'],
    per100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sodium: 1 },
    densityGml: 1.0,
  },
  {
    name: 'Brown rice (cooked)',
    aliases: ['brown rice'],
    per100g: { calories: 111, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8, sodium: 5 },
    densityGml: 1.0,
  },
  {
    name: 'Rice (generic)',
    aliases: ['rice'],
    per100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sodium: 1 },
    densityGml: 1.0,
  },
  {
    name: 'Pasta (cooked)',
    aliases: [
      'pasta',
      'spaghetti',
      'penne',
      'fettuccine',
      'linguine',
      'rigatoni',
      'noodle',
      'noodles',
      'macaroni',
    ],
    per100g: { calories: 158, protein: 5.8, carbs: 31, fat: 0.9, fiber: 1.8, sodium: 1 },
    densityGml: 1.0,
  },
  {
    name: 'Oats',
    aliases: ['oat', 'oats', 'oatmeal', 'rolled oats'],
    per100g: { calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 11, sodium: 2 },
    densityGml: 0.43,
  },
  {
    name: 'Quinoa (cooked)',
    aliases: ['quinoa'],
    per100g: { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8, sodium: 7 },
    densityGml: 1.0,
  },
  {
    name: 'Bread',
    aliases: ['bread'],
    per100g: { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sodium: 491 },
    densityGml: 0.5,
    typicalWeightG: 28,
  },
  {
    name: 'Breadcrumbs',
    aliases: ['breadcrumb', 'breadcrumbs', 'panko'],
    per100g: { calories: 395, protein: 14, carbs: 74, fat: 5, fiber: 4.2, sodium: 712 },
    densityGml: 0.37,
  },
  {
    name: 'Cornstarch',
    aliases: ['cornstarch', 'cornflour', 'corn starch'],
    per100g: { calories: 381, protein: 0.3, carbs: 91, fat: 0.1, fiber: 0.9, sodium: 9 },
    densityGml: 0.6,
  },
  {
    name: 'Cornmeal',
    aliases: ['cornmeal', 'polenta', 'corn meal'],
    per100g: { calories: 362, protein: 8.1, carbs: 76, fat: 3.6, fiber: 7.3, sodium: 35 },
    densityGml: 0.6,
  },
  {
    name: 'Tortilla',
    aliases: ['tortilla', 'tortillas', 'wrap'],
    per100g: { calories: 306, protein: 8, carbs: 55, fat: 6.3, fiber: 3.5, sodium: 535 },
    typicalWeightG: 45,
  },

  // ─── Vegetables ─────────────────────────────────────────────────────────────
  {
    name: 'Onion',
    aliases: [
      'onion',
      'yellow onion',
      'white onion',
      'red onion',
      'spring onion',
      'green onion',
      'scallion',
    ],
    per100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sodium: 4 },
    typicalWeightG: 110,
  },
  {
    name: 'Shallot',
    aliases: ['shallot', 'shallots'],
    per100g: { calories: 72, protein: 2.5, carbs: 17, fat: 0.1, fiber: 3.2, sodium: 12 },
    typicalWeightG: 40,
  },
  {
    name: 'Garlic',
    aliases: ['garlic'],
    per100g: { calories: 149, protein: 6.4, carbs: 33.1, fat: 0.5, fiber: 2.1, sodium: 17 },
    typicalWeightG: 3,
  },
  {
    name: 'Tomato',
    aliases: ['tomato', 'tomatoes', 'cherry tomato', 'cherry tomatoes', 'roma tomato'],
    per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sodium: 5 },
    typicalWeightG: 120,
  },
  {
    name: 'Bell pepper',
    aliases: ['bell pepper', 'bell peppers', 'capsicum', 'sweet pepper'],
    per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sodium: 4 },
    typicalWeightG: 150,
  },
  {
    name: 'Red pepper',
    aliases: ['red pepper', 'red peppers'],
    per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sodium: 4 },
    typicalWeightG: 150,
  },
  {
    name: 'Green pepper',
    aliases: ['green pepper', 'green peppers'],
    per100g: { calories: 20, protein: 0.9, carbs: 4.6, fat: 0.2, fiber: 1.7, sodium: 3 },
    typicalWeightG: 150,
  },
  {
    name: 'Jalapeño',
    aliases: ['jalapeño', 'jalapeno', 'chili pepper', 'chilli', 'serrano'],
    per100g: { calories: 29, protein: 1.4, carbs: 6.5, fat: 0.4, fiber: 2.8, sodium: 3 },
    typicalWeightG: 14,
  },
  {
    name: 'Broccoli',
    aliases: ['broccoli'],
    per100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, sodium: 33 },
  },
  {
    name: 'Cauliflower',
    aliases: ['cauliflower'],
    per100g: { calories: 25, protein: 2, carbs: 5, fat: 0.3, fiber: 2, sodium: 30 },
  },
  {
    name: 'Spinach',
    aliases: ['spinach', 'baby spinach'],
    per100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sodium: 79 },
    densityGml: 0.25,
  },
  {
    name: 'Kale',
    aliases: ['kale'],
    per100g: { calories: 49, protein: 4.3, carbs: 9, fat: 0.9, fiber: 3.6, sodium: 38 },
    densityGml: 0.25,
  },
  {
    name: 'Lettuce',
    aliases: ['lettuce', 'romaine', 'arugula', 'mixed greens'],
    per100g: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, sodium: 28 },
  },
  {
    name: 'Carrot',
    aliases: ['carrot', 'carrots'],
    per100g: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sodium: 69 },
    typicalWeightG: 61,
  },
  {
    name: 'Celery',
    aliases: ['celery'],
    per100g: { calories: 16, protein: 0.7, carbs: 3, fat: 0.2, fiber: 1.6, sodium: 80 },
    typicalWeightG: 40,
  },
  {
    name: 'Cucumber',
    aliases: ['cucumber'],
    per100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sodium: 2 },
    typicalWeightG: 200,
  },
  {
    name: 'Potato',
    aliases: ['potato', 'potatoes', 'russet potato', 'yukon gold'],
    per100g: { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sodium: 6 },
    typicalWeightG: 150,
  },
  {
    name: 'Sweet potato',
    aliases: ['sweet potato', 'sweet potatoes', 'yam'],
    per100g: { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sodium: 55 },
    typicalWeightG: 150,
  },
  {
    name: 'Zucchini',
    aliases: ['zucchini', 'courgette'],
    per100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, sodium: 8 },
    typicalWeightG: 200,
  },
  {
    name: 'Eggplant',
    aliases: ['eggplant', 'aubergine'],
    per100g: { calories: 25, protein: 1, carbs: 6, fat: 0.2, fiber: 3, sodium: 2 },
    typicalWeightG: 300,
  },
  {
    name: 'Mushroom',
    aliases: ['mushroom', 'mushrooms', 'cremini', 'portobello', 'shiitake'],
    per100g: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, sodium: 5 },
    typicalWeightG: 18,
  },
  {
    name: 'Corn',
    aliases: ['corn', 'sweetcorn', 'sweet corn', 'corn kernel', 'corn kernels'],
    per100g: { calories: 86, protein: 3.3, carbs: 19, fat: 1.4, fiber: 2.7, sodium: 15 },
    typicalWeightG: 100,
  },
  {
    name: 'Peas',
    aliases: ['pea', 'peas', 'green peas', 'frozen peas'],
    per100g: { calories: 81, protein: 5.4, carbs: 14, fat: 0.4, fiber: 5.1, sodium: 5 },
    densityGml: 0.75,
  },
  {
    name: 'Avocado',
    aliases: ['avocado'],
    per100g: { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 6.7, sodium: 7 },
    typicalWeightG: 150,
  },
  {
    name: 'Asparagus',
    aliases: ['asparagus'],
    per100g: { calories: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1, sodium: 2 },
    typicalWeightG: 18,
  },
  {
    name: 'Green beans',
    aliases: ['green bean', 'green beans', 'string bean', 'string beans', 'haricot'],
    per100g: { calories: 31, protein: 1.8, carbs: 7, fat: 0.2, fiber: 2.7, sodium: 6 },
  },
  {
    name: 'Brussels sprouts',
    aliases: ['brussels sprout', 'brussels sprouts'],
    per100g: { calories: 43, protein: 3.4, carbs: 9, fat: 0.3, fiber: 3.8, sodium: 25 },
    typicalWeightG: 20,
  },
  {
    name: 'Leek',
    aliases: ['leek', 'leeks'],
    per100g: { calories: 61, protein: 1.5, carbs: 14, fat: 0.3, fiber: 1.8, sodium: 20 },
    typicalWeightG: 90,
  },
  {
    name: 'Bok choy',
    aliases: ['bok choy', 'pak choi'],
    per100g: { calories: 13, protein: 1.5, carbs: 2.2, fat: 0.2, fiber: 1, sodium: 65 },
  },
  {
    name: 'Artichoke',
    aliases: ['artichoke'],
    per100g: { calories: 47, protein: 3.3, carbs: 11, fat: 0.2, fiber: 5.4, sodium: 94 },
    typicalWeightG: 120,
  },
  {
    name: 'Sun-dried tomatoes',
    aliases: ['sun-dried tomato', 'sun-dried tomatoes', 'sun dried tomato'],
    per100g: { calories: 258, protein: 14, carbs: 55.8, fat: 2.9, fiber: 12.3, sodium: 2095 },
  },

  // ─── Fruits ──────────────────────────────────────────────────────────────────
  {
    name: 'Apple',
    aliases: ['apple'],
    per100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sodium: 1 },
    typicalWeightG: 180,
  },
  {
    name: 'Banana',
    aliases: ['banana'],
    per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sodium: 1 },
    typicalWeightG: 118,
  },
  {
    name: 'Lemon',
    aliases: ['lemon', 'lemon juice', 'lemon zest'],
    per100g: { calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8, sodium: 2 },
    typicalWeightG: 58,
    densityGml: 1.0,
  },
  {
    name: 'Lime',
    aliases: ['lime', 'lime juice', 'lime zest'],
    per100g: { calories: 30, protein: 0.7, carbs: 11, fat: 0.2, fiber: 2.8, sodium: 2 },
    typicalWeightG: 44,
    densityGml: 1.0,
  },
  {
    name: 'Orange',
    aliases: ['orange'],
    per100g: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sodium: 0 },
    typicalWeightG: 150,
  },
  {
    name: 'Strawberry',
    aliases: ['strawberry', 'strawberries'],
    per100g: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, sodium: 1 },
  },
  {
    name: 'Blueberry',
    aliases: ['blueberry', 'blueberries'],
    per100g: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4, sodium: 1 },
  },
  {
    name: 'Raspberry',
    aliases: ['raspberry', 'raspberries'],
    per100g: { calories: 52, protein: 1.2, carbs: 12, fat: 0.7, fiber: 6.5, sodium: 1 },
  },
  {
    name: 'Mango',
    aliases: ['mango'],
    per100g: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, sodium: 1 },
    typicalWeightG: 300,
  },
  {
    name: 'Pineapple',
    aliases: ['pineapple'],
    per100g: { calories: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4, sodium: 1 },
  },
  {
    name: 'Grapes',
    aliases: ['grape', 'grapes'],
    per100g: { calories: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9, sodium: 2 },
  },

  // ─── Oils & Fats ─────────────────────────────────────────────────────────────
  {
    name: 'Olive oil',
    aliases: ['olive oil'],
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 2 },
    densityGml: 0.91,
  },
  {
    name: 'Vegetable oil',
    aliases: ['vegetable oil', 'canola oil', 'sunflower oil', 'grapeseed oil', 'corn oil'],
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 0 },
    densityGml: 0.92,
  },
  {
    name: 'Coconut oil',
    aliases: ['coconut oil'],
    per100g: { calories: 892, protein: 0, carbs: 0, fat: 99, fiber: 0, sodium: 0 },
    densityGml: 0.92,
  },
  {
    name: 'Sesame oil',
    aliases: ['sesame oil', 'toasted sesame oil'],
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 0 },
    densityGml: 0.92,
  },
  {
    name: 'Oil (generic)',
    aliases: ['oil'],
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 0 },
    densityGml: 0.92,
  },

  // ─── Sweeteners ──────────────────────────────────────────────────────────────
  {
    name: 'White sugar',
    aliases: ['white sugar', 'granulated sugar', 'caster sugar', 'superfine sugar'],
    per100g: { calories: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, sodium: 1 },
    densityGml: 0.85,
  },
  {
    name: 'Brown sugar',
    aliases: ['brown sugar', 'dark brown sugar', 'light brown sugar'],
    per100g: { calories: 380, protein: 0, carbs: 98, fat: 0, fiber: 0, sodium: 28 },
    densityGml: 0.85,
  },
  {
    name: 'Sugar (generic)',
    aliases: ['sugar'],
    per100g: { calories: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, sodium: 1 },
    densityGml: 0.85,
  },
  {
    name: 'Powdered sugar',
    aliases: ['powdered sugar', 'icing sugar', 'confectioners sugar', "confectioner's sugar"],
    per100g: { calories: 389, protein: 0, carbs: 100, fat: 0, fiber: 0, sodium: 2 },
    densityGml: 0.56,
  },
  {
    name: 'Honey',
    aliases: ['honey'],
    per100g: { calories: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, sodium: 4 },
    densityGml: 1.42,
  },
  {
    name: 'Maple syrup',
    aliases: ['maple syrup'],
    per100g: { calories: 260, protein: 0, carbs: 67, fat: 0, fiber: 0, sodium: 12 },
    densityGml: 1.32,
  },
  {
    name: 'Agave',
    aliases: ['agave', 'agave nectar', 'agave syrup'],
    per100g: { calories: 310, protein: 0.1, carbs: 76, fat: 0.5, fiber: 0.2, sodium: 4 },
    densityGml: 1.35,
  },
  {
    name: 'Molasses',
    aliases: ['molasses'],
    per100g: { calories: 290, protein: 0, carbs: 74.7, fat: 0.1, fiber: 0, sodium: 37 },
    densityGml: 1.4,
  },

  // ─── Nuts & Seeds ─────────────────────────────────────────────────────────────
  {
    name: 'Almonds',
    aliases: ['almond', 'almonds', 'slivered almond', 'sliced almond'],
    per100g: { calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, sodium: 1 },
    densityGml: 0.6,
  },
  {
    name: 'Walnuts',
    aliases: ['walnut', 'walnuts'],
    per100g: { calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, sodium: 2 },
    densityGml: 0.55,
  },
  {
    name: 'Peanuts',
    aliases: ['peanut', 'peanuts'],
    per100g: { calories: 567, protein: 26, carbs: 16, fat: 49, fiber: 8.5, sodium: 18 },
    densityGml: 0.62,
  },
  {
    name: 'Peanut butter',
    aliases: ['peanut butter'],
    per100g: { calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, sodium: 17 },
    densityGml: 1.1,
  },
  {
    name: 'Cashews',
    aliases: ['cashew', 'cashews'],
    per100g: { calories: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, sodium: 12 },
    densityGml: 0.6,
  },
  {
    name: 'Pecans',
    aliases: ['pecan', 'pecans'],
    per100g: { calories: 691, protein: 9.2, carbs: 14, fat: 72, fiber: 9.6, sodium: 0 },
    densityGml: 0.5,
  },
  {
    name: 'Pine nuts',
    aliases: ['pine nut', 'pine nuts', 'pignoli'],
    per100g: { calories: 673, protein: 14, carbs: 13, fat: 68, fiber: 3.7, sodium: 2 },
    densityGml: 0.55,
  },
  {
    name: 'Sesame seeds',
    aliases: ['sesame seed', 'sesame seeds'],
    per100g: { calories: 573, protein: 18, carbs: 23, fat: 50, fiber: 11.8, sodium: 11 },
    densityGml: 0.55,
  },
  {
    name: 'Chia seeds',
    aliases: ['chia seed', 'chia seeds', 'chia'],
    per100g: { calories: 486, protein: 17, carbs: 42, fat: 31, fiber: 34, sodium: 16 },
    densityGml: 0.45,
  },
  {
    name: 'Flaxseed',
    aliases: ['flaxseed', 'flax seed', 'linseed'],
    per100g: { calories: 534, protein: 18, carbs: 29, fat: 42, fiber: 27, sodium: 30 },
    densityGml: 0.5,
  },
  {
    name: 'Sunflower seeds',
    aliases: ['sunflower seed', 'sunflower seeds'],
    per100g: { calories: 584, protein: 21, carbs: 20, fat: 51, fiber: 8.6, sodium: 9 },
    densityGml: 0.55,
  },
  {
    name: 'Tahini',
    aliases: ['tahini'],
    per100g: { calories: 595, protein: 17, carbs: 21.2, fat: 53.8, fiber: 9.3, sodium: 115 },
    densityGml: 1.1,
  },

  // ─── Condiments & Sauces ─────────────────────────────────────────────────────
  {
    name: 'Soy sauce',
    aliases: ['soy sauce', 'tamari', 'shoyu'],
    per100g: { calories: 53, protein: 8, carbs: 5, fat: 0.1, fiber: 0.8, sodium: 5493 },
    densityGml: 1.1,
  },
  {
    name: 'Ketchup',
    aliases: ['ketchup', 'tomato ketchup'],
    per100g: { calories: 101, protein: 1.3, carbs: 27, fat: 0.1, fiber: 0.3, sodium: 907 },
    densityGml: 1.1,
  },
  {
    name: 'Mustard',
    aliases: ['mustard', 'dijon mustard', 'yellow mustard', 'whole grain mustard'],
    per100g: { calories: 66, protein: 4.4, carbs: 8, fat: 3.7, fiber: 3.3, sodium: 1135 },
    densityGml: 0.9,
  },
  {
    name: 'Mayonnaise',
    aliases: ['mayonnaise', 'mayo'],
    per100g: { calories: 680, protein: 1, carbs: 0.6, fat: 75, fiber: 0, sodium: 635 },
    densityGml: 0.9,
  },
  {
    name: 'Hot sauce',
    aliases: ['hot sauce', 'sriracha', 'tabasco', 'chili sauce'],
    per100g: { calories: 11, protein: 0.5, carbs: 0.6, fat: 0.4, fiber: 0.6, sodium: 1088 },
    densityGml: 1.0,
  },
  {
    name: 'Worcestershire sauce',
    aliases: ['worcestershire', 'worcestershire sauce'],
    per100g: { calories: 78, protein: 0, carbs: 19, fat: 0, fiber: 0, sodium: 980 },
    densityGml: 1.1,
  },
  {
    name: 'Fish sauce',
    aliases: ['fish sauce'],
    per100g: { calories: 35, protein: 5, carbs: 3.6, fat: 0.1, fiber: 0, sodium: 5670 },
    densityGml: 1.1,
  },
  {
    name: 'Oyster sauce',
    aliases: ['oyster sauce'],
    per100g: { calories: 51, protein: 0.9, carbs: 11, fat: 0.5, fiber: 0.2, sodium: 2733 },
    densityGml: 1.15,
  },
  {
    name: 'Hoisin sauce',
    aliases: ['hoisin sauce', 'hoisin'],
    per100g: { calories: 220, protein: 3.8, carbs: 43, fat: 4.4, fiber: 1.5, sodium: 1875 },
    densityGml: 1.15,
  },
  {
    name: 'Vinegar',
    aliases: [
      'white vinegar',
      'apple cider vinegar',
      'rice vinegar',
      'balsamic vinegar',
      'red wine vinegar',
      'vinegar',
    ],
    per100g: { calories: 20, protein: 0, carbs: 0.9, fat: 0, fiber: 0, sodium: 2 },
    densityGml: 1.0,
  },
  {
    name: 'Tomato paste',
    aliases: ['tomato paste', 'tomato purée', 'tomato puree'],
    per100g: { calories: 82, protein: 4.3, carbs: 18.9, fat: 0.5, fiber: 4.2, sodium: 1014 },
    densityGml: 1.1,
  },
  {
    name: 'Tomato sauce',
    aliases: ['tomato sauce', 'marinara', 'passata', 'crushed tomatoes', 'diced tomatoes'],
    per100g: { calories: 29, protein: 1.5, carbs: 6.8, fat: 0.2, fiber: 1.5, sodium: 400 },
    densityGml: 1.0,
  },
  {
    name: 'Coconut milk',
    aliases: ['coconut milk', 'coconut cream'],
    per100g: { calories: 197, protein: 2, carbs: 2.8, fat: 21, fiber: 0.2, sodium: 15 },
    densityGml: 1.0,
  },
  {
    name: 'Chicken broth',
    aliases: ['chicken broth', 'chicken stock', 'chicken bouillon'],
    per100g: { calories: 15, protein: 1.5, carbs: 0.8, fat: 0.5, fiber: 0, sodium: 400 },
    densityGml: 1.0,
  },
  {
    name: 'Beef broth',
    aliases: ['beef broth', 'beef stock', 'beef bouillon'],
    per100g: { calories: 15, protein: 2.7, carbs: 0, fat: 0.5, fiber: 0, sodium: 380 },
    densityGml: 1.0,
  },
  {
    name: 'Vegetable broth',
    aliases: ['vegetable broth', 'vegetable stock', 'veggie broth'],
    per100g: { calories: 7, protein: 0.2, carbs: 1, fat: 0, fiber: 0.1, sodium: 430 },
    densityGml: 1.0,
  },
  {
    name: 'Broth (generic)',
    aliases: ['broth', 'stock'],
    per100g: { calories: 12, protein: 1.5, carbs: 0.5, fat: 0.3, fiber: 0, sodium: 400 },
    densityGml: 1.0,
  },
  {
    name: 'Salsa',
    aliases: ['salsa'],
    per100g: { calories: 36, protein: 1.3, carbs: 8, fat: 0.3, fiber: 1.5, sodium: 467 },
    densityGml: 1.0,
  },
  {
    name: 'Hummus',
    aliases: ['hummus'],
    per100g: { calories: 177, protein: 7.9, carbs: 20, fat: 8.6, fiber: 6, sodium: 379 },
    densityGml: 1.0,
  },

  // ─── Baking ───────────────────────────────────────────────────────────────────
  {
    name: 'Baking powder',
    aliases: ['baking powder'],
    per100g: { calories: 94, protein: 0, carbs: 47, fat: 0, fiber: 0.2, sodium: 10600 },
    densityGml: 0.9,
  },
  {
    name: 'Baking soda',
    aliases: ['baking soda', 'bicarbonate of soda', 'bicarb'],
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 27360 },
    densityGml: 1.15,
  },
  {
    name: 'Salt',
    aliases: ['salt', 'kosher salt', 'sea salt', 'table salt'],
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 38758 },
    densityGml: 1.2,
  },
  {
    name: 'Vanilla extract',
    aliases: ['vanilla extract', 'vanilla'],
    per100g: { calories: 288, protein: 0, carbs: 12.7, fat: 0.1, fiber: 0, sodium: 9 },
    densityGml: 0.9,
  },
  {
    name: 'Cocoa powder',
    aliases: ['cocoa powder', 'cacao powder', 'unsweetened cocoa'],
    per100g: { calories: 228, protein: 19.6, carbs: 58, fat: 13.7, fiber: 37, sodium: 21 },
    densityGml: 0.5,
  },
  {
    name: 'Chocolate chips',
    aliases: ['chocolate chip', 'chocolate chips', 'chocolate chunks'],
    per100g: { calories: 496, protein: 5, carbs: 60, fat: 28, fiber: 4.9, sodium: 24 },
    densityGml: 0.75,
  },
  {
    name: 'Dark chocolate',
    aliases: ['dark chocolate', 'semi-sweet chocolate', 'bittersweet chocolate'],
    per100g: { calories: 598, protein: 7.8, carbs: 45.9, fat: 42.6, fiber: 10.9, sodium: 20 },
  },
  {
    name: 'Milk chocolate',
    aliases: ['milk chocolate'],
    per100g: { calories: 535, protein: 7.6, carbs: 59.2, fat: 29.7, fiber: 3.4, sodium: 79 },
  },
  {
    name: 'Yeast',
    aliases: ['yeast', 'instant yeast', 'active dry yeast'],
    per100g: { calories: 325, protein: 40, carbs: 41, fat: 7.6, fiber: 26, sodium: 51 },
    densityGml: 0.7,
  },

  // ─── Herbs & Spices ───────────────────────────────────────────────────────────
  {
    name: 'Black pepper',
    aliases: ['black pepper', 'ground pepper', 'white pepper'],
    per100g: { calories: 251, protein: 10, carbs: 64, fat: 3, fiber: 25, sodium: 20 },
    densityGml: 0.5,
  },
  {
    name: 'Cinnamon',
    aliases: ['cinnamon', 'ground cinnamon'],
    per100g: { calories: 247, protein: 4, carbs: 81, fat: 1.2, fiber: 53.1, sodium: 10 },
    densityGml: 0.5,
  },
  {
    name: 'Cumin',
    aliases: ['cumin', 'ground cumin'],
    per100g: { calories: 375, protein: 18, carbs: 44, fat: 22, fiber: 10.5, sodium: 168 },
    densityGml: 0.5,
  },
  {
    name: 'Paprika',
    aliases: ['paprika', 'smoked paprika'],
    per100g: { calories: 282, protein: 14, carbs: 54, fat: 13, fiber: 34, sodium: 68 },
    densityGml: 0.5,
  },
  {
    name: 'Chili powder',
    aliases: ['chili powder', 'chilli powder', 'cayenne pepper', 'cayenne'],
    per100g: { calories: 282, protein: 13, carbs: 50, fat: 14, fiber: 27, sodium: 1600 },
    densityGml: 0.5,
  },
  {
    name: 'Oregano',
    aliases: ['oregano', 'dried oregano'],
    per100g: { calories: 265, protein: 9, carbs: 69, fat: 4.3, fiber: 42.5, sodium: 25 },
    densityGml: 0.35,
  },
  {
    name: 'Basil',
    aliases: ['basil', 'fresh basil', 'dried basil'],
    per100g: { calories: 23, protein: 3.2, carbs: 2.7, fat: 0.6, fiber: 1.6, sodium: 4 },
    densityGml: 0.25,
  },
  {
    name: 'Parsley',
    aliases: ['parsley', 'fresh parsley', 'flat-leaf parsley'],
    per100g: { calories: 36, protein: 3, carbs: 6.3, fat: 0.8, fiber: 3.3, sodium: 56 },
    densityGml: 0.25,
  },
  {
    name: 'Thyme',
    aliases: ['thyme', 'fresh thyme', 'dried thyme'],
    per100g: { calories: 101, protein: 5.6, carbs: 24.5, fat: 1.7, fiber: 14, sodium: 9 },
    densityGml: 0.35,
    typicalWeightG: 1,
  },
  {
    name: 'Rosemary',
    aliases: ['rosemary', 'fresh rosemary', 'dried rosemary'],
    per100g: { calories: 131, protein: 3.3, carbs: 20.7, fat: 5.9, fiber: 14.1, sodium: 26 },
    densityGml: 0.35,
    typicalWeightG: 1,
  },
  {
    name: 'Bay leaf',
    aliases: ['bay leaf', 'bay leaves'],
    per100g: { calories: 313, protein: 7.6, carbs: 75, fat: 8.4, fiber: 26.3, sodium: 23 },
    typicalWeightG: 0.5,
  },
  {
    name: 'Turmeric',
    aliases: ['turmeric', 'ground turmeric'],
    per100g: { calories: 354, protein: 8, carbs: 65, fat: 10, fiber: 21.1, sodium: 38 },
    densityGml: 0.5,
  },
  {
    name: 'Ginger',
    aliases: ['ginger', 'fresh ginger', 'ground ginger', 'ginger root'],
    per100g: { calories: 80, protein: 1.8, carbs: 18, fat: 0.8, fiber: 2, sodium: 13 },
    typicalWeightG: 4,
  },
  {
    name: 'Coriander',
    aliases: ['coriander', 'cilantro', 'ground coriander'],
    per100g: { calories: 23, protein: 2.1, carbs: 3.7, fat: 0.5, fiber: 2.8, sodium: 46 },
    densityGml: 0.25,
  },
  {
    name: 'Garlic powder',
    aliases: ['garlic powder'],
    per100g: { calories: 331, protein: 16.5, carbs: 72.7, fat: 0.7, fiber: 9, sodium: 60 },
    densityGml: 0.5,
  },
  {
    name: 'Onion powder',
    aliases: ['onion powder'],
    per100g: { calories: 341, protein: 10.4, carbs: 79.1, fat: 1.0, fiber: 7.4, sodium: 15 },
    densityGml: 0.5,
  },
  {
    name: 'Italian seasoning',
    aliases: ['italian seasoning', 'mixed herbs'],
    per100g: { calories: 268, protein: 11.5, carbs: 61, fat: 4.8, fiber: 38, sodium: 40 },
    densityGml: 0.4,
  },

  // ─── Liquids ──────────────────────────────────────────────────────────────────
  {
    name: 'Water',
    aliases: ['water'],
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 3 },
    densityGml: 1.0,
  },
  {
    name: 'Red wine',
    aliases: ['red wine'],
    per100g: { calories: 85, protein: 0.1, carbs: 2.6, fat: 0, fiber: 0, sodium: 5 },
    densityGml: 0.99,
  },
  {
    name: 'White wine',
    aliases: ['white wine'],
    per100g: { calories: 82, protein: 0.1, carbs: 2.6, fat: 0, fiber: 0, sodium: 9 },
    densityGml: 0.99,
  },
  {
    name: 'Beer',
    aliases: ['beer'],
    per100g: { calories: 43, protein: 0.5, carbs: 3.6, fat: 0, fiber: 0, sodium: 14 },
    densityGml: 1.0,
  },
]
