import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  db,
  createRecipe,
  getRecipe,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  createMealPlan,
  getMealPlan,
  getMealPlans,
  getMealPlanForWeek,
  updateMealPlan,
  deleteMealPlan,
  createShoppingList,
  getShoppingList,
  getShoppingLists,
  updateShoppingList,
  deleteShoppingList,
  toggleShoppingItem,
  seedIfEmpty,
  minutesToDuration,
  durationToMinutes,
} from './db'
import type { ShoppingItem } from '../types'

// Clear all tables before each test to guarantee isolation.
// db.delete() can hang in fake-indexeddb after transactions are made;
// clearing individual tables is reliable and fast.
beforeEach(async () => {
  if (!db.isOpen()) await db.open()
  await Promise.all([db.recipes.clear(), db.mealPlans.clear(), db.shoppingLists.clear()])
})

// Restore real timers after each test so fake Date doesn't bleed between tests.
afterEach(() => {
  vi.useRealTimers()
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleRecipe = {
  name: 'Test Pasta',
  description: 'A test recipe',
  recipeYield: '2',
  prepTime: 'PT10M',
  cookTime: 'PT20M',
  recipeIngredient: [{ name: 'pasta', amount: 200, unit: 'g' }],
  recipeInstructions: [{ '@type': 'HowToStep' as const, text: 'Boil water and cook pasta.' }],
  keywords: ['test', 'pasta'],
}

const sampleMealPlan = {
  weekStartDate: '2026-03-16',
  days: {},
}

const sampleShoppingList = {
  name: 'Weekly Shopping',
  items: [] as ShoppingItem[],
}

// Helper: fake only the Date object (not setTimeout) so IDB async ops still work.
function fakeDate(isoDate: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(isoDate))
}

// ─── Duration helpers ──────────────────────────────────────────────────────────

describe('duration helpers', () => {
  it('converts minutes to ISO 8601 duration', () => {
    expect(minutesToDuration(0)).toBe('PT0M')
    expect(minutesToDuration(30)).toBe('PT30M')
    expect(minutesToDuration(60)).toBe('PT1H')
    expect(minutesToDuration(90)).toBe('PT1H30M')
    expect(minutesToDuration(120)).toBe('PT2H')
  })

  it('clamps negative minutes to PT0M', () => {
    expect(minutesToDuration(-5)).toBe('PT0M')
  })

  it('converts ISO 8601 duration back to minutes', () => {
    expect(durationToMinutes('PT0M')).toBe(0)
    expect(durationToMinutes('PT30M')).toBe(30)
    expect(durationToMinutes('PT1H')).toBe(60)
    expect(durationToMinutes('PT1H30M')).toBe(90)
  })

  it('returns 0 for an empty or unrecognised duration string', () => {
    expect(durationToMinutes('')).toBe(0)
    expect(durationToMinutes('invalid')).toBe(0)
  })

  it('round-trips minutes through duration', () => {
    for (const mins of [0, 15, 30, 60, 75, 120]) {
      expect(durationToMinutes(minutesToDuration(mins))).toBe(mins)
    }
  })
})

// ─── Recipe CRUD ──────────────────────────────────────────────────────────────

describe('recipe CRUD', () => {
  it('creates and retrieves a recipe', async () => {
    const created = await createRecipe(sampleRecipe)
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('Test Pasta')
    expect(created.dateCreated).toBeTruthy()
    expect(created.dateModified).toBeTruthy()

    const fetched = await getRecipe(created.id)
    expect(fetched).toMatchObject({ name: 'Test Pasta' })
  })

  it('assigns a unique UUID to each recipe', async () => {
    const a = await createRecipe(sampleRecipe)
    const b = await createRecipe({ ...sampleRecipe, name: 'Second' })
    expect(a.id).not.toBe(b.id)
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('lists all recipes', async () => {
    await createRecipe(sampleRecipe)
    await createRecipe({ ...sampleRecipe, name: 'Second Recipe' })
    const recipes = await getRecipes()
    expect(recipes).toHaveLength(2)
  })

  it('returns recipes ordered by dateCreated ascending', async () => {
    fakeDate('2026-01-01T10:00:00Z')
    const first = await createRecipe(sampleRecipe)
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'))
    const second = await createRecipe({ ...sampleRecipe, name: 'Later Recipe' })

    const recipes = await getRecipes()
    expect(recipes[0].id).toBe(first.id)
    expect(recipes[1].id).toBe(second.id)
  })

  it('updates a recipe and bumps dateModified', async () => {
    fakeDate('2026-01-01T10:00:00Z')
    const created = await createRecipe(sampleRecipe)
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'))
    const updated = await updateRecipe(created.id, { name: 'Updated Pasta' })

    expect(updated.name).toBe('Updated Pasta')
    expect(updated.dateModified).toBe('2026-01-01T11:00:00.000Z')
    expect(updated.dateModified).not.toBe(created.dateModified)
  })

  it('preserves dateCreated on update', async () => {
    const created = await createRecipe(sampleRecipe)
    const updated = await updateRecipe(created.id, { name: 'Updated Pasta' })
    expect(updated.dateCreated).toBe(created.dateCreated)
  })

  it('deletes a recipe', async () => {
    const created = await createRecipe(sampleRecipe)
    await deleteRecipe(created.id)
    expect(await getRecipe(created.id)).toBeUndefined()
  })

  it('returns undefined for a non-existent recipe', async () => {
    expect(await getRecipe('non-existent-id')).toBeUndefined()
  })
})

// ─── MealPlan CRUD ────────────────────────────────────────────────────────────

describe('meal plan CRUD', () => {
  it('creates and retrieves a meal plan', async () => {
    const created = await createMealPlan(sampleMealPlan)
    expect(created.id).toBeTruthy()
    expect(created.weekStartDate).toBe('2026-03-16')
    expect(created.createdAt).toBeTruthy()
    expect(created.updatedAt).toBeTruthy()

    const fetched = await getMealPlan(created.id)
    expect(fetched).toMatchObject({ weekStartDate: '2026-03-16' })
  })

  it('assigns unique IDs to each meal plan', async () => {
    const a = await createMealPlan({ weekStartDate: '2026-03-16', days: {} })
    const b = await createMealPlan({ weekStartDate: '2026-03-23', days: {} })
    expect(a.id).not.toBe(b.id)
  })

  it('lists all meal plans ordered by weekStartDate', async () => {
    await createMealPlan({ weekStartDate: '2026-03-23', days: {} })
    await createMealPlan({ weekStartDate: '2026-03-16', days: {} })
    const plans = await getMealPlans()
    expect(plans).toHaveLength(2)
    expect(plans[0].weekStartDate).toBe('2026-03-16')
    expect(plans[1].weekStartDate).toBe('2026-03-23')
  })

  it('retrieves a meal plan by week start date', async () => {
    const created = await createMealPlan({ weekStartDate: '2026-03-16', days: {} })
    const found = await getMealPlanForWeek('2026-03-16')
    expect(found?.id).toBe(created.id)
  })

  it('returns undefined for a week with no plan', async () => {
    expect(await getMealPlanForWeek('2099-01-01')).toBeUndefined()
  })

  it('updates a meal plan and bumps updatedAt', async () => {
    fakeDate('2026-01-01T10:00:00Z')
    const created = await createMealPlan(sampleMealPlan)
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'))
    const updated = await updateMealPlan(created.id, {
      days: { '2026-03-16': { dinner: { recipes: [{ recipeId: 'abc', servings: 2 }] } } },
    })

    expect(updated.updatedAt).not.toBe(created.updatedAt)
    expect(updated.days['2026-03-16']?.dinner?.recipes[0].recipeId).toBe('abc')
  })

  it('preserves createdAt on update', async () => {
    const created = await createMealPlan(sampleMealPlan)
    const updated = await updateMealPlan(created.id, {})
    expect(updated.createdAt).toBe(created.createdAt)
  })

  it('deletes a meal plan', async () => {
    const created = await createMealPlan(sampleMealPlan)
    await deleteMealPlan(created.id)
    expect(await getMealPlan(created.id)).toBeUndefined()
  })

  it('returns undefined for a non-existent meal plan', async () => {
    expect(await getMealPlan('non-existent-id')).toBeUndefined()
  })
})

// ─── ShoppingList CRUD ────────────────────────────────────────────────────────

describe('shopping list CRUD', () => {
  it('creates and retrieves a shopping list', async () => {
    const created = await createShoppingList(sampleShoppingList)
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('Weekly Shopping')
    expect(created.createdAt).toBeTruthy()
    expect(created.updatedAt).toBeTruthy()

    const fetched = await getShoppingList(created.id)
    expect(fetched).toMatchObject({ name: 'Weekly Shopping' })
  })

  it('lists all shopping lists ordered by createdAt', async () => {
    fakeDate('2026-01-01T10:00:00Z')
    const first = await createShoppingList(sampleShoppingList)
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'))
    const second = await createShoppingList({ ...sampleShoppingList, name: 'Second' })

    const lists = await getShoppingLists()
    expect(lists).toHaveLength(2)
    expect(lists[0].id).toBe(first.id)
    expect(lists[1].id).toBe(second.id)
  })

  it('stores optional mealPlanId', async () => {
    const plan = await createMealPlan(sampleMealPlan)
    const list = await createShoppingList({ ...sampleShoppingList, mealPlanId: plan.id })
    expect(list.mealPlanId).toBe(plan.id)
  })

  it('creates list with items', async () => {
    const items: ShoppingItem[] = [{ id: 'i1', name: 'Milk', amount: 1, unit: 'L', checked: false }]
    const created = await createShoppingList({ ...sampleShoppingList, items })
    expect(created.items).toHaveLength(1)
    expect(created.items[0].name).toBe('Milk')
  })

  it('updates a shopping list and bumps updatedAt', async () => {
    fakeDate('2026-01-01T10:00:00Z')
    const created = await createShoppingList(sampleShoppingList)
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'))
    const updated = await updateShoppingList(created.id, { name: 'Updated List' })

    expect(updated.name).toBe('Updated List')
    expect(updated.updatedAt).not.toBe(created.updatedAt)
  })

  it('deletes a shopping list', async () => {
    const created = await createShoppingList(sampleShoppingList)
    await deleteShoppingList(created.id)
    expect(await getShoppingList(created.id)).toBeUndefined()
  })

  it('returns undefined for a non-existent shopping list', async () => {
    expect(await getShoppingList('non-existent-id')).toBeUndefined()
  })
})

// ─── toggleShoppingItem ───────────────────────────────────────────────────────

describe('toggleShoppingItem', () => {
  it('toggles an item from unchecked to checked', async () => {
    const items: ShoppingItem[] = [{ id: 'i1', name: 'Milk', amount: 1, unit: 'L', checked: false }]
    const list = await createShoppingList({ ...sampleShoppingList, items })
    await toggleShoppingItem(list.id, 'i1')
    const updated = await getShoppingList(list.id)
    expect(updated?.items[0].checked).toBe(true)
  })

  it('toggles an item from checked to unchecked', async () => {
    const items: ShoppingItem[] = [{ id: 'i1', name: 'Milk', amount: 1, unit: 'L', checked: true }]
    const list = await createShoppingList({ ...sampleShoppingList, items })
    await toggleShoppingItem(list.id, 'i1')
    const updated = await getShoppingList(list.id)
    expect(updated?.items[0].checked).toBe(false)
  })

  it('only toggles the targeted item', async () => {
    const items: ShoppingItem[] = [
      { id: 'i1', name: 'Milk', amount: 1, unit: 'L', checked: false },
      { id: 'i2', name: 'Eggs', amount: 12, unit: 'count', checked: false },
    ]
    const list = await createShoppingList({ ...sampleShoppingList, items })
    await toggleShoppingItem(list.id, 'i1')
    const updated = await getShoppingList(list.id)
    expect(updated?.items.find((i) => i.id === 'i1')?.checked).toBe(true)
    expect(updated?.items.find((i) => i.id === 'i2')?.checked).toBe(false)
  })

  it('does nothing if the list does not exist', async () => {
    await expect(toggleShoppingItem('no-such-list', 'i1')).resolves.toBeUndefined()
  })
})

// ─── seedIfEmpty ──────────────────────────────────────────────────────────────

describe('seedIfEmpty', () => {
  it('seeds three recipes when the database is empty', async () => {
    await seedIfEmpty()
    const recipes = await getRecipes()
    expect(recipes).toHaveLength(3)
  })

  it('seeds the expected recipe names', async () => {
    await seedIfEmpty()
    const names = (await getRecipes()).map((r) => r.name)
    expect(names).toContain('Spaghetti Bolognese')
    expect(names).toContain('Chicken Caesar Salad')
    expect(names).toContain('Vegetable Stir-Fry')
  })

  it('seeds recipes with ingredients and instructions', async () => {
    await seedIfEmpty()
    for (const recipe of await getRecipes()) {
      expect(recipe.recipeIngredient.length).toBeGreaterThan(0)
      expect(recipe.recipeInstructions.length).toBeGreaterThan(0)
    }
  })

  it('seeds recipes with staggered dateCreated for stable ordering', async () => {
    await seedIfEmpty()
    const recipes = await getRecipes()
    expect(recipes[0].dateCreated < recipes[1].dateCreated).toBe(true)
    expect(recipes[1].dateCreated < recipes[2].dateCreated).toBe(true)
  })

  it('does not seed again when recipes already exist', async () => {
    await createRecipe(sampleRecipe)
    await seedIfEmpty()
    const recipes = await getRecipes()
    expect(recipes).toHaveLength(1)
  })

  it('assigns unique IDs to seeded recipes', async () => {
    await seedIfEmpty()
    const ids = (await getRecipes()).map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── Schema v1 → v2 migration ─────────────────────────────────────────────────

describe('schema v1 to v2 migration', () => {
  async function buildV1Db(records: Record<string, unknown>[]) {
    await db.close()
    const dbName = 'meal-planner'

    await new Promise<void>((resolve, reject) => {
      const req = globalThis.indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    await new Promise<void>((resolve, reject) => {
      const req = globalThis.indexedDB.open(dbName, 1)
      req.onupgradeneeded = (event) => {
        const idb = (event.target as IDBOpenDBRequest).result
        idb.createObjectStore('recipes', { keyPath: 'id' })
        idb.createObjectStore('mealPlans', { keyPath: 'id' })
        idb.createObjectStore('shoppingLists', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const idb = req.result
        const tx = idb.transaction('recipes', 'readwrite')
        for (const record of records) {
          tx.objectStore('recipes').add(record)
        }
        tx.oncomplete = () => {
          idb.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }

  it('maps v1 field names to v2 field names', async () => {
    await buildV1Db([
      {
        id: 'migration-id',
        title: 'Old Recipe',
        description: 'Classic dish',
        servings: 4,
        prepTimeMinutes: 15,
        cookTimeMinutes: 45,
        ingredients: [{ name: 'flour', amount: 200, unit: 'g' }],
        instructions: ['Mix ingredients', 'Bake at 180°C'],
        tags: ['baking', 'easy'],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      },
    ])

    await db.open()

    const migrated = await db.recipes.get('migration-id')

    expect(migrated?.name).toBe('Old Recipe')
    expect(migrated?.recipeYield).toBe('4')
    expect(migrated?.prepTime).toBe('PT15M')
    expect(migrated?.cookTime).toBe('PT45M')
    expect(migrated?.recipeIngredient).toEqual([{ name: 'flour', amount: 200, unit: 'g' }])
    expect(migrated?.recipeInstructions).toEqual([
      { '@type': 'HowToStep', text: 'Mix ingredients' },
      { '@type': 'HowToStep', text: 'Bake at 180°C' },
    ])
    expect(migrated?.keywords).toEqual(['baking', 'easy'])
    expect(migrated?.dateCreated).toBe('2025-01-01T00:00:00.000Z')
    expect(migrated?.dateModified).toBe('2025-01-02T00:00:00.000Z')

    const raw = migrated as unknown as Record<string, unknown>
    expect(raw.title).toBeUndefined()
    expect(raw.servings).toBeUndefined()
    expect(raw.prepTimeMinutes).toBeUndefined()
    expect(raw.cookTimeMinutes).toBeUndefined()
    expect(raw.ingredients).toBeUndefined()
    expect(raw.instructions).toBeUndefined()
    expect(raw.tags).toBeUndefined()
    expect(raw.createdAt).toBeUndefined()
    expect(raw.updatedAt).toBeUndefined()
  })

  it('migrates imageUrl to image', async () => {
    await buildV1Db([
      {
        id: 'img-test-id',
        title: 'Photo Recipe',
        description: '',
        servings: 2,
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        ingredients: [],
        instructions: [],
        tags: [],
        imageUrl: 'https://example.com/photo.jpg',
        createdAt: '2025-06-01T00:00:00.000Z',
        updatedAt: '2025-06-01T00:00:00.000Z',
      },
    ])

    await db.open()

    const migrated = await db.recipes.get('img-test-id')
    expect(migrated?.image).toBe('https://example.com/photo.jpg')
    expect((migrated as unknown as Record<string, unknown>).imageUrl).toBeUndefined()
  })
})
