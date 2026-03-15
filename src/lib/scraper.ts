import type { Recipe, Ingredient, HowToStep } from '../types'

export interface ExtractedRecipe {
  name: string
  description: string
  recipeYield: string
  prepTime: string
  cookTime: string
  recipeIngredient: Ingredient[]
  recipeInstructions: HowToStep[]
  keywords: string[]
  image?: string
  author?: string
  url?: string
  recipeCategory?: string
  recipeCuisine?: string
}

export type ScrapeResult =
  | { ok: true; recipe: ExtractedRecipe }
  | { ok: false; error: string }

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Given a URL (and optionally page content), extract all available recipe information and return it as a single JSON object matching exactly this TypeScript interface:

{
  "name": string,               // recipe name/title
  "description": string,        // short description (1-3 sentences)
  "recipeYield": string,        // servings, e.g. "4" or "4 servings"
  "prepTime": string,           // ISO 8601 duration e.g. "PT15M", "PT1H30M", or "PT0M" if unknown
  "cookTime": string,           // ISO 8601 duration e.g. "PT45M", or "PT0M" if unknown
  "recipeIngredient": Array<{ "name": string, "amount": number, "unit": string }>,
  "recipeInstructions": Array<{ "@type": "HowToStep", "text": string }>,
  "keywords": string[],         // relevant tags/categories
  "image": string | undefined,  // image URL if available
  "author": string | undefined, // recipe author or creator handle
  "url": string,                // the source URL
  "recipeCategory": string | undefined,
  "recipeCuisine": string | undefined
}

Rules:
- Return ONLY a valid JSON object, no markdown fences, no explanation.
- For amounts in ingredients, use 0 if not specified.
- For units, use empty string "" if not specified.
- If you cannot find any recipe in the content, return: {"error": "No recipe found at this URL"}
- For social media posts (Instagram, TikTok, Pinterest), extract from any captions, descriptions, or use your knowledge of commonly shared recipes matching the URL context.`

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '...[truncated]'
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const html = await res.text()
    // Strip tags and collapse whitespace for a rough plain-text extraction
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text
  } catch {
    return null
  }
}

export async function extractRecipeFromUrl(
  url: string,
  apiKey: string
): Promise<ScrapeResult> {
  // Best-effort page fetch (will fail for CORS-blocked social platforms)
  const pageText = await fetchPageText(url)

  const userMessage = pageText
    ? `URL: ${url}\n\nPage content:\n${truncate(pageText, 12000)}`
    : `URL: ${url}\n\n(Page content could not be fetched — extract from URL context and your knowledge.)`

  let raw: string
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>
    }
    raw = data.content.find((b) => b.type === 'text')?.text ?? ''
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Parse JSON from response
  let parsed: Record<string, unknown>
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Could not parse AI response as JSON.' }
  }

  if (parsed.error) {
    return { ok: false, error: parsed.error as string }
  }

  // Normalise and validate the extracted data
  const recipe: ExtractedRecipe = {
    name: String(parsed.name ?? '').trim(),
    description: String(parsed.description ?? '').trim(),
    recipeYield: String(parsed.recipeYield ?? '2').trim(),
    prepTime: String(parsed.prepTime ?? 'PT0M').trim(),
    cookTime: String(parsed.cookTime ?? 'PT0M').trim(),
    recipeIngredient: normaliseIngredients(parsed.recipeIngredient),
    recipeInstructions: normaliseInstructions(parsed.recipeInstructions),
    keywords: normaliseKeywords(parsed.keywords),
    image: parsed.image ? String(parsed.image) : undefined,
    author: parsed.author ? String(parsed.author) : undefined,
    url: String(parsed.url ?? url),
    recipeCategory: parsed.recipeCategory ? String(parsed.recipeCategory) : undefined,
    recipeCuisine: parsed.recipeCuisine ? String(parsed.recipeCuisine) : undefined,
  }

  if (!recipe.name) {
    return { ok: false, error: 'No recipe found at this URL.' }
  }

  return { ok: true, recipe }
}

function normaliseIngredients(raw: unknown): Ingredient[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      amount: Number(item.amount ?? 0),
      unit: String(item.unit ?? '').trim(),
    }))
    .filter((ing) => ing.name.length > 0)
}

function normaliseInstructions(raw: unknown): HowToStep[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      '@type': 'HowToStep' as const,
      text: String(item.text ?? '').trim(),
    }))
    .filter((step) => step.text.length > 0)
}

function normaliseKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((k) => String(k).trim().toLowerCase())
    .filter((k) => k.length > 0)
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

const API_KEY_STORAGE_KEY = 'mise_anthropic_api_key'

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

export function setStoredApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }
}

// Re-export Recipe type for convenience
export type { Recipe }
