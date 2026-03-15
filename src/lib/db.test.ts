import { describe, it, expect, beforeEach } from 'vitest'
import {
  db,
  createRecipe,
  getRecipe,
  getRecipes,
  updateRecipe,
  deleteRecipe,
  minutesToDuration,
  durationToMinutes,
} from './db'

// Wipe and re-open the database before each test to guarantee isolation.
beforeEach(async () => {
  await db.delete()
  await db.open()
})

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

describe('duration helpers', () => {
  it('converts minutes to ISO 8601 duration', () => {
    expect(minutesToDuration(0)).toBe('PT0M')
    expect(minutesToDuration(30)).toBe('PT30M')
    expect(minutesToDuration(60)).toBe('PT1H')
    expect(minutesToDuration(90)).toBe('PT1H30M')
  })

  it('converts ISO 8601 duration back to minutes', () => {
    expect(durationToMinutes('PT0M')).toBe(0)
    expect(durationToMinutes('PT30M')).toBe(30)
    expect(durationToMinutes('PT1H')).toBe(60)
    expect(durationToMinutes('PT1H30M')).toBe(90)
  })

  it('round-trips minutes through duration', () => {
    const cases = [0, 15, 30, 60, 75, 120]
    for (const mins of cases) {
      expect(durationToMinutes(minutesToDuration(mins))).toBe(mins)
    }
  })
})

describe('recipe CRUD', () => {
  it('creates and retrieves a recipe', async () => {
    const created = await createRecipe(sampleRecipe)
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('Test Pasta')
    expect(created.dateCreated).toBeTruthy()

    const fetched = await getRecipe(created.id)
    expect(fetched).toMatchObject({ name: 'Test Pasta' })
  })

  it('lists all recipes', async () => {
    await createRecipe(sampleRecipe)
    await createRecipe({ ...sampleRecipe, name: 'Second Recipe' })
    const recipes = await getRecipes()
    expect(recipes).toHaveLength(2)
  })

  it('updates a recipe', async () => {
    const created = await createRecipe(sampleRecipe)
    const updated = await updateRecipe(created.id, { name: 'Updated Pasta' })
    expect(updated.name).toBe('Updated Pasta')
    expect(updated.dateModified).not.toBe(created.dateModified)
  })

  it('deletes a recipe', async () => {
    const created = await createRecipe(sampleRecipe)
    await deleteRecipe(created.id)
    const fetched = await getRecipe(created.id)
    expect(fetched).toBeUndefined()
  })

  it('returns undefined for a non-existent recipe', async () => {
    const fetched = await getRecipe('non-existent-id')
    expect(fetched).toBeUndefined()
  })
})
