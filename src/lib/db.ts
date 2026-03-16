import Dexie, { type Table } from 'dexie'
import type {
  Recipe,
  MealPlan,
  ShoppingList,
  ShoppingItem,
  MealPlanTemplate,
  Collection,
  PantryItem,
} from '../types'

// ─── Database ────────────────────────────────────────────────────────────────

class MealPlannerDB extends Dexie {
  recipes!: Table<Recipe>
  mealPlans!: Table<MealPlan>
  shoppingLists!: Table<ShoppingList>
  mealPlanTemplates!: Table<MealPlanTemplate>
  collections!: Table<Collection>
  pantryItems!: Table<PantryItem>

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
    this.version(3).stores({
      recipes: '&id, name, *keywords, dateCreated',
      mealPlans: '&id, weekStartDate, createdAt',
      shoppingLists: '&id, name, mealPlanId, createdAt',
      mealPlanTemplates: '&id, name, createdAt',
    })
    this.version(4).stores({
      recipes: '&id, name, *keywords, dateCreated, isFavorite',
      mealPlans: '&id, weekStartDate, createdAt',
      shoppingLists: '&id, name, mealPlanId, createdAt',
      mealPlanTemplates: '&id, name, createdAt',
    })
    this.version(5).stores({
      recipes: '&id, name, *keywords, dateCreated, isFavorite',
      mealPlans: '&id, weekStartDate, createdAt',
      shoppingLists: '&id, name, mealPlanId, createdAt',
      mealPlanTemplates: '&id, name, createdAt',
      collections: '&id, name, createdAt',
    })
    this.version(6).stores({
      recipes: '&id, name, *keywords, dateCreated, isFavorite',
      mealPlans: '&id, weekStartDate, createdAt',
      shoppingLists: '&id, name, mealPlanId, createdAt',
      mealPlanTemplates: '&id, name, createdAt',
      collections: '&id, name, createdAt',
      pantryItems: '&id, name, expiryDate, createdAt',
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
  data: Omit<Recipe, 'id' | 'dateCreated' | 'dateModified'>,
  recipeId?: string
): Promise<Recipe> {
  const recipe: Recipe = { ...data, id: recipeId ?? id(), dateCreated: now(), dateModified: now() }
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

export async function duplicateRecipe(recipeId: string): Promise<Recipe> {
  const original = await db.recipes.get(recipeId)
  if (!original) throw new Error('Recipe not found')
  const { id: _id, dateCreated: _dc, dateModified: _dm, ...data } = original
  return createRecipe({ ...data, name: `${data.name} (Copy)`, isFavorite: false })
}

export async function toggleFavorite(recipeId: string): Promise<boolean> {
  const recipe = await db.recipes.get(recipeId)
  if (!recipe) throw new Error('Recipe not found')
  const newVal = !recipe.isFavorite
  await db.recipes.update(recipeId, { isFavorite: newVal, dateModified: now() })
  return newVal
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

// ─── MealPlanTemplate CRUD ────────────────────────────────────────────────────

export async function getMealPlanTemplates(): Promise<MealPlanTemplate[]> {
  return db.mealPlanTemplates.orderBy('createdAt').toArray()
}

export async function createMealPlanTemplate(
  data: Omit<MealPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MealPlanTemplate> {
  const template: MealPlanTemplate = { ...data, id: id(), createdAt: now(), updatedAt: now() }
  await db.mealPlanTemplates.add(template)
  return template
}

export async function deleteMealPlanTemplate(templateId: string): Promise<void> {
  await db.mealPlanTemplates.delete(templateId)
}

// ─── Collection CRUD ──────────────────────────────────────────────────────────

export async function getCollections(): Promise<Collection[]> {
  return db.collections.orderBy('createdAt').reverse().toArray()
}

export async function getCollection(collectionId: string): Promise<Collection | undefined> {
  return db.collections.get(collectionId)
}

export async function createCollection(
  data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Collection> {
  const collection: Collection = { ...data, id: id(), createdAt: now(), updatedAt: now() }
  await db.collections.add(collection)
  return collection
}

export async function updateCollection(
  collectionId: string,
  data: Partial<Omit<Collection, 'id' | 'createdAt'>>
): Promise<Collection> {
  await db.collections.update(collectionId, { ...data, updatedAt: now() })
  return (await db.collections.get(collectionId))!
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await db.collections.delete(collectionId)
}

export async function addRecipeToCollection(collectionId: string, recipeId: string): Promise<void> {
  const collection = await db.collections.get(collectionId)
  if (!collection) throw new Error('Collection not found')
  if (collection.recipeIds.includes(recipeId)) return
  await db.collections.update(collectionId, {
    recipeIds: [...collection.recipeIds, recipeId],
    updatedAt: now(),
  })
}

export async function removeRecipeFromCollection(
  collectionId: string,
  recipeId: string
): Promise<void> {
  const collection = await db.collections.get(collectionId)
  if (!collection) throw new Error('Collection not found')
  await db.collections.update(collectionId, {
    recipeIds: collection.recipeIds.filter((id) => id !== recipeId),
    updatedAt: now(),
  })
}

// ─── PantryItem CRUD ──────────────────────────────────────────────────────────

export async function getPantryItems(): Promise<PantryItem[]> {
  return db.pantryItems.orderBy('name').toArray()
}

export async function getPantryItem(itemId: string): Promise<PantryItem | undefined> {
  return db.pantryItems.get(itemId)
}

export async function createPantryItem(
  data: Omit<PantryItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PantryItem> {
  const item: PantryItem = { ...data, id: id(), createdAt: now(), updatedAt: now() }
  await db.pantryItems.add(item)
  return item
}

export async function updatePantryItem(
  itemId: string,
  data: Partial<Omit<PantryItem, 'id' | 'createdAt'>>
): Promise<PantryItem> {
  await db.pantryItems.update(itemId, { ...data, updatedAt: now() })
  return (await db.pantryItems.get(itemId))!
}

export async function deletePantryItem(itemId: string): Promise<void> {
  await db.pantryItems.delete(itemId)
}

