// ─── Dietary preference definitions ──────────────────────────────────────────

export interface DietaryPreference {
  id: string
  label: string
  description: string
}

export const DIETARY_PREFERENCES: DietaryPreference[] = [
  { id: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish' },
  { id: 'vegan', label: 'Vegan', description: 'No animal products' },
  { id: 'gluten-free', label: 'Gluten-free', description: 'No wheat, rye, barley, or oats' },
  { id: 'dairy-free', label: 'Dairy-free', description: 'No milk, cheese, or butter' },
  { id: 'nut-free', label: 'Nut-free', description: 'No tree nuts or peanuts' },
  { id: 'egg-free', label: 'Egg-free', description: 'No eggs or egg products' },
  { id: 'soy-free', label: 'Soy-free', description: 'No soy or soy products' },
  { id: 'halal', label: 'Halal', description: 'Halal certified' },
  { id: 'kosher', label: 'Kosher', description: 'Kosher certified' },
  { id: 'low-carb', label: 'Low-carb', description: 'Reduced carbohydrates' },
  { id: 'paleo', label: 'Paleo', description: 'No grains, legumes, or dairy' },
  { id: 'keto', label: 'Keto', description: 'Very low carb, high fat' },
]

// ─── Allergen keyword detection ───────────────────────────────────────────────

/**
 * Maps dietary preference IDs to ingredient name keywords that indicate a
 * violation. Used to highlight flagged ingredients in recipe views.
 */
export const ALLERGEN_INGREDIENT_KEYWORDS: Record<string, string[]> = {
  'gluten-free': [
    'wheat', 'flour', 'bread', 'pasta', 'spaghetti', 'fettuccine', 'penne',
    'linguine', 'tagliatelle', 'noodle', 'rye', 'barley', 'oat', 'couscous',
    'semolina', 'crouton', 'soy sauce', 'breadcrumb', 'pita', 'tortilla',
    'beer', 'ale', 'lager', 'biscuit', 'cookie', 'cake', 'muffin', 'roll',
    'bagel', 'croissant', 'cereal', 'bulgur', 'spelt', 'farro',
  ],
  'dairy-free': [
    'milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'whey',
    'lactose', 'parmesan', 'mozzarella', 'cheddar', 'brie', 'ricotta',
    'ghee', 'kefir', 'custard', 'gelato', 'ice cream', 'half-and-half',
    'sour cream', 'creme fraiche', 'mascarpone', 'provolone', 'gouda',
    'feta', 'goat cheese', 'blue cheese', 'gruyere',
  ],
  'nut-free': [
    'almond', 'walnut', 'peanut', 'cashew', 'pecan', 'hazelnut', 'pistachio',
    'macadamia', 'pine nut', 'chestnut', 'nut butter', 'tahini', 'praline',
    'marzipan', 'nougat', 'nut milk', 'almond milk', 'coconut', 'brazil nut',
  ],
  'egg-free': [
    'egg', 'mayonnaise', 'mayo', 'meringue', 'custard', 'aioli', 'hollandaise',
    'albumin', 'roe', 'caviar',
  ],
  'soy-free': [
    'soy', 'tofu', 'edamame', 'miso', 'tempeh', 'tamari', 'natto',
    'soy sauce', 'soya', 'bean curd',
  ],
  'vegetarian': [
    'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose',
    'rabbit', 'venison', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut',
    'trout', 'bass', 'snapper', 'mahi', 'shrimp', 'prawn', 'lobster', 'crab',
    'clam', 'oyster', 'scallop', 'mussel', 'squid', 'octopus', 'anchovy',
    'sardine', 'ham', 'bacon', 'sausage', 'pepperoni', 'salami', 'lard',
    'gelatin', 'ground beef', 'ground pork', 'ground turkey', 'mince',
    'brisket', 'ribs', 'steak', 'chop', 'roast', 'chicken breast',
    'chicken thigh', 'chicken wing', 'pork belly', 'chorizo', 'prosciutto',
    'pancetta',
  ],
  'vegan': [
    // all vegetarian items plus animal byproducts
    'beef', 'pork', 'chicken', 'turkey', 'lamb', 'veal', 'duck', 'goose',
    'rabbit', 'venison', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut',
    'trout', 'bass', 'snapper', 'mahi', 'shrimp', 'prawn', 'lobster', 'crab',
    'clam', 'oyster', 'scallop', 'mussel', 'squid', 'octopus', 'anchovy',
    'sardine', 'ham', 'bacon', 'sausage', 'pepperoni', 'salami', 'lard',
    'gelatin', 'ground beef', 'ground pork', 'ground turkey', 'mince',
    'brisket', 'ribs', 'steak', 'chop', 'roast', 'chicken breast',
    'chicken thigh', 'chicken wing', 'pork belly', 'chorizo', 'prosciutto',
    'pancetta',
    'milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'whey',
    'egg', 'honey', 'mayonnaise', 'parmesan', 'mozzarella', 'cheddar',
    'ghee', 'kefir', 'custard', 'gelato', 'ice cream', 'sour cream',
    'mascarpone', 'ricotta', 'feta', 'goat cheese',
  ],
}

// ─── Ingredient allergen detection ────────────────────────────────────────────

/**
 * Returns a set of ingredient indices that contain allergens for any of the
 * given active dietary preferences.
 */
export function detectAllergenIngredients(
  ingredientNames: string[],
  activeDiets: string[],
): Set<number> {
  const flagged = new Set<number>()
  if (activeDiets.length === 0) return flagged

  for (let i = 0; i < ingredientNames.length; i++) {
    const name = ingredientNames[i].toLowerCase()
    for (const diet of activeDiets) {
      const keywords = ALLERGEN_INGREDIENT_KEYWORDS[diet] ?? []
      if (keywords.some((kw) => name.includes(kw))) {
        flagged.add(i)
        break
      }
    }
  }
  return flagged
}

// ─── localStorage persistence ─────────────────────────────────────────────────

const DIETARY_PREFS_KEY = 'mise-dietary-prefs'

export function getDietaryPrefs(): string[] {
  try {
    const raw = localStorage.getItem(DIETARY_PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as string[]
    }
  } catch {}
  return []
}

export function saveDietaryPrefs(prefs: string[]): void {
  localStorage.setItem(DIETARY_PREFS_KEY, JSON.stringify(prefs))
}
