import type { Recipe, PantryItem } from '../types'
import { loadAdminScrapingConfig } from './scraper'

export interface PantryMatchResult {
  recipe: Recipe
  matchCount: number
  totalIngredients: number
  matchPercent: number
  matchedIngredients: string[]
  /** Matched ingredients whose pantry entry is expiring within 7 days */
  expiringMatchedIngredients: string[]
}

export interface AiRecipeSuggestion {
  name: string
  description: string
  keyIngredients: string[]
}

/**
 * Scores saved recipes by ingredient overlap with pantry contents.
 * Returns only recipes with at least one matching ingredient, sorted:
 *   1. Recipes using expiring pantry items first
 *   2. Then by match % descending
 */
export function matchRecipesToPantry(
  recipes: Recipe[],
  pantryItems: PantryItem[]
): PantryMatchResult[] {
  if (pantryItems.length === 0) return []

  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 7)
  const cutoffDate = cutoff.toISOString().split('T')[0]

  const pantryNormalized = pantryItems.map((item) => ({
    name: item.name.toLowerCase().trim(),
    isExpiring:
      !!item.expiryDate && item.expiryDate >= today && item.expiryDate <= cutoffDate,
  }))

  const results: PantryMatchResult[] = []

  for (const recipe of recipes) {
    const total = recipe.recipeIngredient.length
    if (total === 0) continue

    const matchedIngredients: string[] = []
    const expiringMatchedIngredients: string[] = []

    for (const ingredient of recipe.recipeIngredient) {
      const ingName = ingredient.name.toLowerCase().trim()
      const matched = pantryNormalized.find(
        (p) => ingName.includes(p.name) || p.name.includes(ingName)
      )
      if (matched) {
        matchedIngredients.push(ingredient.name)
        if (matched.isExpiring) expiringMatchedIngredients.push(ingredient.name)
      }
    }

    if (matchedIngredients.length === 0) continue

    results.push({
      recipe,
      matchCount: matchedIngredients.length,
      totalIngredients: total,
      matchPercent: Math.round((matchedIngredients.length / total) * 100),
      matchedIngredients,
      expiringMatchedIngredients,
    })
  }

  return results.sort((a, b) => {
    const expDiff =
      b.expiringMatchedIngredients.length - a.expiringMatchedIngredients.length
    if (expDiff !== 0) return expDiff
    return b.matchPercent - a.matchPercent
  })
}

/**
 * Returns pantry items whose expiryDate falls within the next `daysAhead` days.
 * Sorted by expiry date ascending (soonest first).
 */
export function getExpiringPantryItems(
  pantryItems: PantryItem[],
  daysAhead = 7
): PantryItem[] {
  const today = new Date().toISOString().split('T')[0]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)
  const cutoffDate = cutoff.toISOString().split('T')[0]

  return pantryItems
    .filter(
      (item) =>
        !!item.expiryDate && item.expiryDate >= today && item.expiryDate <= cutoffDate
    )
    .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))
}

/**
 * Formats an ISO date string ("YYYY-MM-DD") relative to today.
 * e.g. "today", "tomorrow", "Thursday", "Mar 20"
 */
export function formatExpiryDate(isoDate: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(isoDate + 'T00:00:00')
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 6)
    return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const AI_SUGGESTION_SYSTEM_PROMPT = `You are a creative recipe assistant. Given a list of pantry ingredients, suggest original recipe ideas.

Output schema (JSON array):
[{"name": string, "description": string, "keyIngredients": string[]}]

Rules:
- Output ONLY the raw JSON array — no markdown fences, no explanation.
- The very first character must be "[" and the last must be "]".
- Suggest recipes that primarily use the provided ingredients.
- Keep descriptions under 100 characters.
- keyIngredients lists 2–4 primary pantry ingredients used in the recipe.`

/**
 * Calls the configured AI provider to suggest new recipe ideas based on pantry contents.
 * Filters out any suggestions whose name exactly matches an existing saved recipe.
 */
export async function getAiPantrySuggestions(
  pantryItems: PantryItem[],
  savedRecipeNames: string[],
  count = 5
): Promise<{ ok: true; suggestions: AiRecipeSuggestion[] } | { ok: false; error: string }> {
  if (pantryItems.length === 0) {
    return { ok: false, error: 'No pantry items to suggest from.' }
  }

  let config: { apiKey: string | null; provider: string | null; model: string | null }
  try {
    config = await loadAdminScrapingConfig()
  } catch {
    return { ok: false, error: 'Could not load AI configuration.' }
  }

  if (!config.apiKey) {
    return {
      ok: false,
      error:
        'AI API key not configured. An admin must set the scraping API key in the Admin panel.',
    }
  }

  const provider = config.provider ?? 'anthropic'
  const model =
    config.model ??
    (provider === 'openai'
      ? 'gpt-4o-mini'
      : provider === 'gemini'
        ? 'gemini-2.0-flash'
        : 'claude-haiku-4-5-20251001')

  const pantryList = pantryItems.map((p) => p.name).join(', ')
  const savedList = savedRecipeNames.length > 0 ? savedRecipeNames.join(', ') : 'none'
  const userMessage = `My pantry contains: ${pantryList}

I already have these recipes saved: ${savedList}

Suggest ${count} new recipe ideas I could make. Do NOT suggest recipes I already have. Return exactly ${count} suggestions.`

  try {
    let raw: string

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: AI_SUGGESTION_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 1024,
        }),
      })
      if (!res.ok) return { ok: false, error: `AI request failed: ${res.statusText}` }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      raw = data.choices?.[0]?.message?.content ?? ''
    } else if (provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: AI_SUGGESTION_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 1024 },
        }),
      })
      if (!res.ok) return { ok: false, error: `AI request failed: ${res.statusText}` }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } else {
      // Default: Anthropic / Claude
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: AI_SUGGESTION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })
      if (!res.ok) return { ok: false, error: `AI request failed: ${res.statusText}` }
      const data = (await res.json()) as {
        content?: { text?: string }[]
      }
      raw = data.content?.[0]?.text ?? ''
    }

    raw = raw.trim()
    // Strip markdown fences if the model wrapped the JSON anyway
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    }

    const parsed = JSON.parse(raw) as AiRecipeSuggestion[]
    if (!Array.isArray(parsed)) throw new Error('Expected JSON array')

    // Filter exact name collisions with existing saved recipes
    const savedLower = new Set(savedRecipeNames.map((n) => n.toLowerCase()))
    const suggestions = parsed
      .filter((s) => s.name && !savedLower.has(s.name.toLowerCase()))
      .slice(0, count)

    return { ok: true, suggestions }
  } catch (err) {
    return { ok: false, error: `Failed to parse AI response: ${String(err)}` }
  }
}
