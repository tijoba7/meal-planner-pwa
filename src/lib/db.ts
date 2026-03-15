import Dexie, { type Table } from 'dexie'
import type { Recipe, MealPlan, ShoppingList, ShoppingItem } from '../types'

// ─── Database ────────────────────────────────────────────────────────────────

class MealPlannerDB extends Dexie {
  recipes!: Table<Recipe>
  mealPlans!: Table<MealPlan>
  shoppingLists!: Table<ShoppingList>

  constructor() {
    super('meal-planner')
    this.version(1).stores({
      recipes: '&id, title, *tags, createdAt',
      mealPlans: '&id, weekStartDate, createdAt',
      shoppingLists: '&id, name, mealPlanId, createdAt',
    })
    this.version(2)
      .stores({
        recipes: '&id, name, *keywords, dateCreated',
        mealPlans: '&id, weekStartDate, createdAt',
        shoppingLists: '&id, name, mealPlanId, createdAt',
      })
      .upgrade((tx) => {
        return tx
          .table('recipes')
          .toCollection()
          .modify((recipe: Record<string, unknown>) => {
            recipe.name = recipe.title
            delete recipe.title
            recipe.recipeYield = String(recipe.servings ?? 1)
            delete recipe.servings
            recipe.prepTime = minutesToDuration((recipe.prepTimeMinutes as number) ?? 0)
            delete recipe.prepTimeMinutes
            recipe.cookTime = minutesToDuration((recipe.cookTimeMinutes as number) ?? 0)
            delete recipe.cookTimeMinutes
            recipe.recipeIngredient = recipe.ingredients ?? []
            delete recipe.ingredients
            recipe.recipeInstructions = ((recipe.instructions as string[]) ?? []).map((text) => ({
              '@type': 'HowToStep',
              text,
            }))
            delete recipe.instructions
            recipe.keywords = recipe.tags ?? []
            delete recipe.tags
            if (recipe.imageUrl !== undefined) {
              recipe.image = recipe.imageUrl
              delete recipe.imageUrl
            }
            recipe.dateCreated = recipe.createdAt
            delete recipe.createdAt
            recipe.dateModified = recipe.updatedAt
            delete recipe.updatedAt
          })
      })
  }
}

export const db = new MealPlannerDB()

// ─── Duration helpers ─────────────────────────────────────────────────────────

export function minutesToDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m === 0) return 'PT0M'
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h > 0 && rem > 0) return `PT${h}H${rem}M`
  if (h > 0) return `PT${h}H`
  return `PT${rem}M`
}

export function durationToMinutes(duration: string): number {
  if (!duration) return 0
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 0
  const hours = parseInt(match[1] ?? '0', 10)
  const mins = parseInt(match[2] ?? '0', 10)
  return hours * 60 + mins
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function id(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

// ─── Recipe CRUD ──────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('dateCreated').toArray()
}

export async function getRecipe(recipeId: string): Promise<Recipe | undefined> {
  return db.recipes.get(recipeId)
}

export async function createRecipe(
  data: Omit<Recipe, 'id' | 'dateCreated' | 'dateModified'>
): Promise<Recipe> {
  const recipe: Recipe = { ...data, id: id(), dateCreated: now(), dateModified: now() }
  await db.recipes.add(recipe)
  return recipe
}

export async function updateRecipe(
  recipeId: string,
  data: Partial<Omit<Recipe, 'id' | 'dateCreated'>>
): Promise<Recipe> {
  const updated = { ...data, dateModified: now() }
  await db.recipes.update(recipeId, updated)
  return (await db.recipes.get(recipeId))!
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await db.recipes.delete(recipeId)
}

// ─── MealPlan CRUD ────────────────────────────────────────────────────────────

export async function getMealPlans(): Promise<MealPlan[]> {
  return db.mealPlans.orderBy('weekStartDate').toArray()
}

export async function getMealPlan(planId: string): Promise<MealPlan | undefined> {
  return db.mealPlans.get(planId)
}

export async function getMealPlanForWeek(weekStartDate: string): Promise<MealPlan | undefined> {
  return db.mealPlans.where('weekStartDate').equals(weekStartDate).first()
}

export async function createMealPlan(
  data: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MealPlan> {
  const plan: MealPlan = { ...data, id: id(), createdAt: now(), updatedAt: now() }
  await db.mealPlans.add(plan)
  return plan
}

export async function updateMealPlan(
  planId: string,
  data: Partial<Omit<MealPlan, 'id' | 'createdAt'>>
): Promise<MealPlan> {
  await db.mealPlans.update(planId, { ...data, updatedAt: now() })
  return (await db.mealPlans.get(planId))!
}

export async function deleteMealPlan(planId: string): Promise<void> {
  await db.mealPlans.delete(planId)
}

// ─── ShoppingList CRUD ────────────────────────────────────────────────────────

export async function getShoppingLists(): Promise<ShoppingList[]> {
  return db.shoppingLists.orderBy('createdAt').toArray()
}

export async function getShoppingList(listId: string): Promise<ShoppingList | undefined> {
  return db.shoppingLists.get(listId)
}

export async function createShoppingList(
  data: Omit<ShoppingList, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ShoppingList> {
  const list: ShoppingList = { ...data, id: id(), createdAt: now(), updatedAt: now() }
  await db.shoppingLists.add(list)
  return list
}

export async function updateShoppingList(
  listId: string,
  data: Partial<Omit<ShoppingList, 'id' | 'createdAt'>>
): Promise<ShoppingList> {
  await db.shoppingLists.update(listId, { ...data, updatedAt: now() })
  return (await db.shoppingLists.get(listId))!
}

export async function deleteShoppingList(listId: string): Promise<void> {
  await db.shoppingLists.delete(listId)
}

export async function toggleShoppingItem(listId: string, itemId: string): Promise<void> {
  const list = await db.shoppingLists.get(listId)
  if (!list) return
  const items = list.items.map((item: ShoppingItem) =>
    item.id === itemId ? { ...item, checked: !item.checked } : item
  )
  await db.shoppingLists.update(listId, { items, updatedAt: now() })
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_RECIPES: Omit<Recipe, 'id' | 'dateCreated' | 'dateModified'>[] = [
  {
    name: 'Spaghetti Bolognese',
    description: 'A classic Italian meat sauce served over spaghetti.',
    recipeYield: '4',
    prepTime: 'PT15M',
    cookTime: 'PT45M',
    recipeIngredient: [
      { name: 'spaghetti', amount: 400, unit: 'g' },
      { name: 'ground beef', amount: 500, unit: 'g' },
      { name: 'canned tomatoes', amount: 400, unit: 'g' },
      { name: 'onion', amount: 1, unit: 'medium' },
      { name: 'garlic cloves', amount: 3, unit: 'cloves' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
      { name: 'tomato paste', amount: 2, unit: 'tbsp' },
      { name: 'dried oregano', amount: 1, unit: 'tsp' },
      { name: 'salt', amount: 1, unit: 'tsp' },
      { name: 'black pepper', amount: 0.5, unit: 'tsp' },
    ],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Bring a large pot of salted water to boil.' },
      { '@type': 'HowToStep', text: 'Heat olive oil in a large pan over medium heat. Sauté diced onion until soft, about 5 minutes.' },
      { '@type': 'HowToStep', text: 'Add minced garlic and cook for 1 minute.' },
      { '@type': 'HowToStep', text: 'Add ground beef and cook until browned, breaking it up as it cooks.' },
      { '@type': 'HowToStep', text: 'Stir in tomato paste and cook for 2 minutes.' },
      { '@type': 'HowToStep', text: 'Add canned tomatoes and oregano. Simmer for 30 minutes, stirring occasionally.' },
      { '@type': 'HowToStep', text: 'Cook spaghetti according to package directions. Drain and serve topped with sauce.' },
    ],
    keywords: ['italian', 'pasta', 'beef', 'dinner'],
  },
  {
    name: 'Chicken Caesar Salad',
    description: 'Crisp romaine lettuce with grilled chicken, Parmesan, and Caesar dressing.',
    recipeYield: '2',
    prepTime: 'PT20M',
    cookTime: 'PT15M',
    recipeIngredient: [
      { name: 'chicken breast', amount: 2, unit: 'pieces' },
      { name: 'romaine lettuce', amount: 1, unit: 'head' },
      { name: 'Parmesan cheese', amount: 40, unit: 'g' },
      { name: 'croutons', amount: 60, unit: 'g' },
      { name: 'Caesar dressing', amount: 4, unit: 'tbsp' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'salt', amount: 0.5, unit: 'tsp' },
      { name: 'black pepper', amount: 0.25, unit: 'tsp' },
    ],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Season chicken breasts with salt, pepper, and olive oil.' },
      { '@type': 'HowToStep', text: 'Grill or pan-fry over medium-high heat for 6–7 minutes per side until cooked through.' },
      { '@type': 'HowToStep', text: 'Let chicken rest for 5 minutes, then slice.' },
      { '@type': 'HowToStep', text: 'Chop romaine lettuce and place in a large bowl.' },
      { '@type': 'HowToStep', text: 'Add Caesar dressing and toss to coat.' },
      { '@type': 'HowToStep', text: 'Top with sliced chicken, croutons, and shaved Parmesan.' },
    ],
    keywords: ['salad', 'chicken', 'lunch', 'healthy'],
  },
  {
    name: 'Vegetable Stir-Fry',
    description: 'A quick and colourful stir-fry with seasonal vegetables in a savory sauce.',
    recipeYield: '3',
    prepTime: 'PT15M',
    cookTime: 'PT10M',
    recipeIngredient: [
      { name: 'broccoli florets', amount: 200, unit: 'g' },
      { name: 'bell pepper', amount: 1, unit: 'large' },
      { name: 'snap peas', amount: 150, unit: 'g' },
      { name: 'carrot', amount: 1, unit: 'medium' },
      { name: 'garlic cloves', amount: 2, unit: 'cloves' },
      { name: 'fresh ginger', amount: 1, unit: 'tsp' },
      { name: 'soy sauce', amount: 3, unit: 'tbsp' },
      { name: 'sesame oil', amount: 1, unit: 'tbsp' },
      { name: 'vegetable oil', amount: 2, unit: 'tbsp' },
      { name: 'cooked rice', amount: 2, unit: 'cups' },
    ],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Prepare all vegetables: cut broccoli into florets, slice pepper and carrot, trim snap peas.' },
      { '@type': 'HowToStep', text: 'Mix soy sauce and sesame oil in a small bowl.' },
      { '@type': 'HowToStep', text: 'Heat vegetable oil in a wok or large frying pan over high heat.' },
      { '@type': 'HowToStep', text: 'Add garlic and ginger, stir-fry for 30 seconds.' },
      { '@type': 'HowToStep', text: 'Add harder vegetables (carrot, broccoli) first and stir-fry for 3 minutes.' },
      { '@type': 'HowToStep', text: 'Add remaining vegetables and stir-fry for 2–3 minutes until tender-crisp.' },
      { '@type': 'HowToStep', text: 'Pour sauce over and toss to coat. Serve over rice.' },
    ],
    keywords: ['vegetarian', 'asian', 'quick', 'dinner', 'healthy'],
  },
]

export async function seedIfEmpty(): Promise<void> {
  const count = await db.recipes.count()
  if (count > 0) return

  const ts = new Date()
  for (let i = 0; i < SEED_RECIPES.length; i++) {
    // stagger dateCreated so orderBy gives a stable order
    const dateCreated = new Date(ts.getTime() + i * 1000).toISOString()
    await db.recipes.add({
      ...SEED_RECIPES[i],
      id: id(),
      dateCreated,
      dateModified: dateCreated,
    })
  }
}
