import type { Recipe, Ingredient, HowToStep } from '../types'
import {
  validateImportUrl,
  URL_VALIDATION_MESSAGES,
  checkImportRateLimit,
  formatRetryAfter,
  sanitizeRecipeData,
} from './validation'
import { APP_SETTING_KEYS, getAppSettingString } from './appSettingsService'

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

export type ScrapeResult = { ok: true; recipe: ExtractedRecipe } | { ok: false; error: string }

export type BatchItemState = {
  label: string
  status: 'pending' | 'loading' | 'done' | 'error'
  recipe?: ExtractedRecipe
  error?: string
  savedId?: string
}

export type InputMode =
  | { type: 'single-url'; url: string }
  | { type: 'batch-urls'; urls: string[] }
  | { type: 'json'; json: unknown }
  | { type: 'text'; text: string }

const EXTRACT_JSON_SCHEMA = `{
  "name": string,
  "description": string,
  "recipeYield": string,
  "prepTime": string,
  "cookTime": string,
  "recipeIngredient": Array<{ "name": string, "amount": number, "unit": string }>,
  "recipeInstructions": Array<{ "@type": "HowToStep", "text": string }>,
  "keywords": string[],
  "image": string | undefined,
  "author": string | undefined,
  "url": string | undefined,
  "recipeCategory": string | undefined,
  "recipeCuisine": string | undefined
}`

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Given a URL (and optionally page content), extract all available recipe information and return it as a single JSON object matching exactly this TypeScript interface:

${EXTRACT_JSON_SCHEMA}

Rules:
- Return ONLY a valid JSON object, no markdown fences, no explanation.
- For amounts in ingredients, use 0 if not specified.
- For units, use empty string "" if not specified.
- If you cannot find any recipe in the content, return: {"error": "No recipe found at this URL"}
- For social media posts (Instagram, TikTok, Pinterest), extract from any captions, descriptions, or use your knowledge of commonly shared recipes matching the URL context.`

const TEXT_SYSTEM_PROMPT = `You are a recipe extraction assistant. Given raw recipe text, extract all recipe information and return it as a single JSON object matching exactly this TypeScript interface:

${EXTRACT_JSON_SCHEMA}

Rules:
- Return ONLY a valid JSON object, no markdown fences, no explanation.
- For amounts in ingredients, use 0 if not specified.
- For units, use empty string "" if not specified.
- If you cannot find any recipe in the text, return: {"error": "No recipe found in this text"}
- Preserve the original ingredient amounts and units as closely as possible.`

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

// Cache admin scraping config for 60 s to avoid a Supabase round-trip on every URL in a batch.
let _adminConfig: { apiKey: string | null; model: string | null; provider: string | null } | null =
  null
let _adminConfigAt = 0
const ADMIN_CONFIG_TTL_MS = 60_000

async function loadAdminScrapingConfig(): Promise<{
  apiKey: string | null
  model: string | null
  provider: string | null
}> {
  const now = Date.now()
  if (_adminConfig && now - _adminConfigAt < ADMIN_CONFIG_TTL_MS) return _adminConfig
  const [apiKey, model, provider] = await Promise.all([
    getAppSettingString(APP_SETTING_KEYS.SCRAPING_API_KEY),
    getAppSettingString(APP_SETTING_KEYS.SCRAPING_MODEL),
    getAppSettingString(APP_SETTING_KEYS.SCRAPING_PROVIDER),
  ])
  _adminConfig = { apiKey, model, provider }
  _adminConfigAt = now
  return _adminConfig
}

async function resolveApiKeyAndModel(): Promise<
  { apiKey: string; model: string; provider: string } | { error: string }
> {
  const admin = await loadAdminScrapingConfig()
  if (!admin.apiKey) {
    return {
      error: 'AI API key not configured. An admin must set the scraping API key in the Admin panel.',
    }
  }
  const provider = admin.provider ?? 'anthropic'
  const defaultModel =
    provider === 'openai'
      ? DEFAULT_OPENAI_MODEL
      : provider === 'gemini'
        ? DEFAULT_GEMINI_MODEL
        : DEFAULT_MODEL
  return { apiKey: admin.apiKey, model: admin.model ?? defaultModel, provider }
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '...[truncated]'
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const html = await res.text()
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

function extractJsonFromResponse(raw: string): string {
  // Strategy 1: Try the raw string directly (model returned pure JSON)
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed

  // Strategy 2: Extract from markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // Strategy 3: Find the first { and last } to extract embedded JSON
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

function parseAiResponseText(raw: string): ScrapeResult {
  let parsed: Record<string, unknown>
  try {
    const cleaned = extractJsonFromResponse(raw)
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const preview = raw.length > 200 ? raw.slice(0, 200) + '…' : raw
    console.error('[scraper] Failed to parse AI response:', preview)
    return {
      ok: false,
      error: `Could not parse AI response as JSON. Response preview: ${preview}`,
    }
  }

  if (parsed.error) return { ok: false, error: parsed.error as string }

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
    url: parsed.url ? String(parsed.url) : undefined,
    recipeCategory: parsed.recipeCategory ? String(parsed.recipeCategory) : undefined,
    recipeCuisine: parsed.recipeCuisine ? String(parsed.recipeCuisine) : undefined,
  }

  if (!recipe.name) return { ok: false, error: 'No recipe found.' }
  return { ok: true, recipe: sanitizeRecipeData(recipe) }
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model = DEFAULT_MODEL
): Promise<ScrapeResult> {
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
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
    raw = data.content.find((b) => b.type === 'text')?.text ?? ''
  } catch (err) {
    return {
      ok: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return parseAiResponseText(raw)
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model = DEFAULT_OPENAI_MODEL
): Promise<ScrapeResult> {
  let raw: string
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    raw = data.choices[0]?.message?.content ?? ''
  } catch (err) {
    return {
      ok: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return parseAiResponseText(raw)
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model = DEFAULT_GEMINI_MODEL
): Promise<ScrapeResult> {
  let raw: string
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 2048, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    }
    raw = data.candidates[0]?.content?.parts[0]?.text ?? ''
  } catch (err) {
    return {
      ok: false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return parseAiResponseText(raw)
}

async function callAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
  provider: string
): Promise<ScrapeResult> {
  if (provider === 'openai') return callOpenAI(systemPrompt, userMessage, apiKey, model)
  if (provider === 'gemini') return callGemini(systemPrompt, userMessage, apiKey, model)
  return callClaude(systemPrompt, userMessage, apiKey, model)
}

export async function extractRecipeFromUrl(url: string): Promise<ScrapeResult> {
  const urlError = validateImportUrl(url)
  if (urlError) return { ok: false, error: URL_VALIDATION_MESSAGES[urlError] }

  const rateLimit = checkImportRateLimit()
  if (!rateLimit.allowed) {
    const wait = rateLimit.retryAfterMs ? formatRetryAfter(rateLimit.retryAfterMs) : 'an hour'
    return {
      ok: false,
      error: `Too many import requests. Please wait ${wait} before trying again.`,
    }
  }

  const resolved = await resolveApiKeyAndModel()
  if ('error' in resolved) return { ok: false, error: resolved.error }

  const pageText = await fetchPageText(url)
  const MAX_PAGE_CHARS = 12_000
  const userMessage = pageText
    ? `URL: ${url}\n\nPage content:\n${truncate(pageText, MAX_PAGE_CHARS)}`
    : `URL: ${url}\n\n(Page content could not be fetched — extract from URL context and your knowledge.)`

  const result = await callAI(
    SYSTEM_PROMPT,
    userMessage,
    resolved.apiKey,
    resolved.model,
    resolved.provider
  )
  if (result.ok && !result.recipe.url) {
    return { ok: true, recipe: { ...result.recipe, url } }
  }
  return result
}

export async function extractRecipeFromText(text: string): Promise<ScrapeResult> {
  const rateLimit = checkImportRateLimit()
  if (!rateLimit.allowed) {
    const wait = rateLimit.retryAfterMs ? formatRetryAfter(rateLimit.retryAfterMs) : 'an hour'
    return {
      ok: false,
      error: `Too many import requests. Please wait ${wait} before trying again.`,
    }
  }

  const resolved = await resolveApiKeyAndModel()
  if ('error' in resolved) return { ok: false, error: resolved.error }

  const MAX_TEXT_CHARS = 12_000
  return callAI(
    TEXT_SYSTEM_PROMPT,
    `Recipe text:\n\n${truncate(text, MAX_TEXT_CHARS)}`,
    resolved.apiKey,
    resolved.model,
    resolved.provider
  )
}

export async function extractRecipesFromUrls(
  urls: string[],
  onProgress: (items: BatchItemState[]) => void
): Promise<BatchItemState[]> {
  const items: BatchItemState[] = urls.map((url) => ({ label: url, status: 'pending' as const }))
  onProgress([...items])

  for (let i = 0; i < items.length; i++) {
    items[i] = { ...items[i], status: 'loading' }
    onProgress([...items])

    const result = await extractRecipeFromUrl(items[i].label)

    if (result.ok) {
      items[i] = { ...items[i], status: 'done', recipe: result.recipe }
    } else {
      items[i] = { ...items[i], status: 'error', error: result.error }
    }

    onProgress([...items])
  }

  return items
}

// ─── Input mode detection ──────────────────────────────────────────────────────

export function detectInputMode(raw: string): InputMode {
  const trimmed = raw.trim()
  if (!trimmed) return { type: 'text', text: '' }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { type: 'json', json: JSON.parse(trimmed) }
    } catch {
      // not valid JSON
    }
  }

  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const urlLines = lines.filter((l) => /^https?:\/\//i.test(l))

  if (urlLines.length > 1) return { type: 'batch-urls', urls: urlLines }
  if (urlLines.length === 1 && lines.length === 1) return { type: 'single-url', url: lines[0] }
  return { type: 'text', text: trimmed }
}

// ─── JSON-LD parser ────────────────────────────────────────────────────────────

export function parseJsonLdRecipe(data: unknown): ScrapeResult {
  function findRecipeNode(obj: unknown): Record<string, unknown> | null {
    if (!obj || typeof obj !== 'object') return null
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findRecipeNode(item)
        if (found) return found
      }
      return null
    }
    const o = obj as Record<string, unknown>
    const type = o['@type']
    if (type === 'Recipe' || (Array.isArray(type) && (type as string[]).includes('Recipe')))
      return o
    if (o['@graph']) return findRecipeNode(o['@graph'])
    return null
  }

  const node = findRecipeNode(data)
  if (!node) return { ok: false, error: 'No Recipe found in JSON-LD.' }

  const name = String(node.name ?? '').trim()
  if (!name) return { ok: false, error: 'Recipe has no name.' }

  const yieldRaw = node.recipeYield
  const recipeYield = Array.isArray(yieldRaw)
    ? yieldRaw.map(String).join(', ')
    : String(yieldRaw ?? '2').trim() || '2'

  const kwRaw = node.keywords
  const keywords: string[] = Array.isArray(kwRaw)
    ? kwRaw.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
    : typeof kwRaw === 'string'
      ? kwRaw
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
      : []

  let image: string | undefined
  const imgRaw = node.image
  if (typeof imgRaw === 'string') image = imgRaw
  else if (Array.isArray(imgRaw)) {
    const first = imgRaw[0]
    image = typeof first === 'string' ? first : (first as Record<string, string> | null)?.url
  } else if (imgRaw && typeof imgRaw === 'object') {
    image = (imgRaw as Record<string, unknown>).url as string | undefined
  }

  let author: string | undefined
  const authorRaw = node.author
  if (typeof authorRaw === 'string') author = authorRaw
  else if (Array.isArray(authorRaw) && authorRaw.length > 0) {
    const first = authorRaw[0]
    author = typeof first === 'string' ? first : (first as Record<string, string> | null)?.name
  } else if (authorRaw && typeof authorRaw === 'object') {
    author = (authorRaw as Record<string, unknown>).name as string | undefined
  }

  const ingRaw = node.recipeIngredient
  const recipeIngredient: Ingredient[] = Array.isArray(ingRaw)
    ? ingRaw
        .map((i) => {
          if (typeof i === 'string') return parseIngredientString(i)
          const io = i as Record<string, unknown>
          return {
            name: String(io.name ?? '').trim(),
            amount: Number(io.amount ?? 0),
            unit: String(io.unit ?? '').trim(),
          }
        })
        .filter((i) => i.name)
    : []

  const catRaw = node.recipeCategory
  const recipeCategory = Array.isArray(catRaw)
    ? String(catRaw[0] ?? '') || undefined
    : catRaw
      ? String(catRaw)
      : undefined
  const cusRaw = node.recipeCuisine
  const recipeCuisine = Array.isArray(cusRaw)
    ? String(cusRaw[0] ?? '') || undefined
    : cusRaw
      ? String(cusRaw)
      : undefined

  const recipe: ExtractedRecipe = {
    name,
    description: String(node.description ?? '').trim(),
    recipeYield,
    prepTime: String(node.prepTime ?? 'PT0M'),
    cookTime: String(node.cookTime ?? 'PT0M'),
    recipeIngredient,
    recipeInstructions: flattenJsonLdInstructions(node.recipeInstructions),
    keywords,
    image,
    author,
    url: node.url ? String(node.url) : undefined,
    recipeCategory,
    recipeCuisine,
  }

  return { ok: true, recipe: sanitizeRecipeData(recipe) }
}

function flattenJsonLdInstructions(raw: unknown): HowToStep[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    return raw
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ '@type': 'HowToStep' as const, text }))
  }
  if (!Array.isArray(raw)) return []
  const steps: HowToStep[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item.trim()) steps.push({ '@type': 'HowToStep', text: item.trim() })
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      if (o['@type'] === 'HowToSection' && Array.isArray(o.itemListElement)) {
        for (const sub of o.itemListElement as unknown[]) {
          if (sub && typeof sub === 'object' && (sub as Record<string, unknown>).text) {
            steps.push({
              '@type': 'HowToStep',
              text: String((sub as Record<string, unknown>).text).trim(),
            })
          }
        }
      } else if (o.text) {
        steps.push({ '@type': 'HowToStep', text: String(o.text).trim() })
      }
    }
  }
  return steps.filter((s) => s.text.length > 0)
}

// ─── Paprika parser ────────────────────────────────────────────────────────────

function parseTimeToPT(s: string | null | undefined): string {
  if (!s) return 'PT0M'
  const h = s.match(/(\d+)\s*h(our)?s?/i)
  const m = s.match(/(\d+)\s*m(in(ute)?s?)?/i)
  const hours = h ? parseInt(h[1], 10) : 0
  const mins = m ? parseInt(m[1], 10) : 0
  if (hours > 0 && mins > 0) return `PT${hours}H${mins}M`
  if (hours > 0) return `PT${hours}H`
  if (mins > 0) return `PT${mins}M`
  const num = parseInt(s, 10)
  if (!isNaN(num) && num > 0) return `PT${num}M`
  return 'PT0M'
}

export function parsePaprikaRecipe(data: unknown): ScrapeResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Not a Paprika recipe object.' }
  }
  const d = data as Record<string, unknown>
  const name = String(d.name ?? '').trim()
  if (!name) return { ok: false, error: 'Paprika recipe has no name.' }

  const ingredientLines = String(d.ingredients ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const directionParagraphs = String(d.directions ?? '')
    .split(/\n\n+/)
    .map((s) => s.trim().replace(/\n/g, ' '))
    .filter(Boolean)

  const categories: string[] = Array.isArray(d.categories)
    ? (d.categories as unknown[]).map(String).filter(Boolean)
    : typeof d.categories === 'string'
      ? d.categories
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  const recipe: ExtractedRecipe = {
    name,
    description: String(d.description ?? d.notes ?? '').trim(),
    recipeYield: String(d.servings ?? '2').trim(),
    prepTime: parseTimeToPT(String(d.prepTime ?? d.prep_time ?? '')),
    cookTime: parseTimeToPT(String(d.cookTime ?? d.cook_time ?? '')),
    recipeIngredient: ingredientLines.map(parseIngredientString).filter((i) => i.name),
    recipeInstructions: directionParagraphs.map((text) => ({
      '@type': 'HowToStep' as const,
      text,
    })),
    keywords: categories.map((c) => c.toLowerCase()),
    image: d.imageUrl ? String(d.imageUrl) : undefined,
    author: undefined,
    url: d.sourceUrl ? String(d.sourceUrl) : d.source_url ? String(d.source_url) : undefined,
    recipeCategory: categories[0] ?? undefined,
    recipeCuisine: undefined,
  }

  return { ok: true, recipe: sanitizeRecipeData(recipe) }
}

// ─── Crouton parser ────────────────────────────────────────────────────────────

export function parseCroutonExport(data: unknown): ScrapeResult[] {
  let recipeList: unknown[]
  if (Array.isArray(data)) {
    recipeList = data
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    recipeList = Array.isArray(d.recipes) ? (d.recipes as unknown[]) : []
  } else {
    return [{ ok: false, error: 'Not a Crouton export.' }]
  }
  if (recipeList.length === 0) return [{ ok: false, error: 'No recipes found in Crouton export.' }]

  return recipeList.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false as const, error: 'Invalid recipe entry.' }
    }
    const d = item as Record<string, unknown>
    const name = String(d.name ?? '').trim()
    if (!name) return { ok: false as const, error: 'Recipe has no name.' }

    const rawIng = d.ingredients
    const recipeIngredient: Ingredient[] = Array.isArray(rawIng)
      ? rawIng.map((i) => {
          if (typeof i === 'string') return parseIngredientString(i)
          if (i && typeof i === 'object') {
            const io = i as Record<string, unknown>
            const qty = io.quantity ? String(io.quantity) : ''
            const ingName = String(io.name ?? '')
            return qty
              ? parseIngredientString(`${qty} ${ingName}`)
              : { name: ingName, amount: 0, unit: '' }
          }
          return { name: String(i), amount: 0, unit: '' }
        })
      : []

    const rawSteps = d.steps
    const recipeInstructions: HowToStep[] = Array.isArray(rawSteps)
      ? rawSteps
          .map((s) => ({ '@type': 'HowToStep' as const, text: String(s).trim() }))
          .filter((s) => s.text)
      : []

    const tags: string[] = Array.isArray(d.tags)
      ? (d.tags as unknown[]).map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : []

    const recipe: ExtractedRecipe = {
      name,
      description: String(d.description ?? '').trim(),
      recipeYield: d.yield ? String(d.yield) : d.servings ? String(d.servings) : '2',
      prepTime: typeof d.prepTime === 'number' ? `PT${d.prepTime}M` : 'PT0M',
      cookTime: typeof d.cookTime === 'number' ? `PT${d.cookTime}M` : 'PT0M',
      recipeIngredient,
      recipeInstructions,
      keywords: tags,
      image: typeof d.image === 'string' ? d.image : undefined,
      author: undefined,
      url: d.source ? String(d.source) : undefined,
      recipeCategory: undefined,
      recipeCuisine: undefined,
    }
    return { ok: true as const, recipe: sanitizeRecipeData(recipe) }
  })
}

// ─── Ingredient string parser ──────────────────────────────────────────────────

const KNOWN_UNITS = new Set([
  'cup',
  'cups',
  'tablespoon',
  'tablespoons',
  'tbsp',
  'tbs',
  'teaspoon',
  'teaspoons',
  'tsp',
  'ounce',
  'ounces',
  'oz',
  'pound',
  'pounds',
  'lb',
  'lbs',
  'gram',
  'grams',
  'g',
  'kilogram',
  'kilograms',
  'kg',
  'milliliter',
  'milliliters',
  'ml',
  'liter',
  'liters',
  'l',
  'pint',
  'pints',
  'quart',
  'quarts',
  'pinch',
  'pinches',
  'dash',
  'dashes',
  'clove',
  'cloves',
  'can',
  'cans',
  'piece',
  'pieces',
  'slice',
  'slices',
  'stalk',
  'stalks',
  'bunch',
  'bunches',
  'package',
  'packages',
  'pkg',
])

function parseFraction(s: string): number {
  const unicodeFractions: Record<string, number> = {
    '½': 0.5,
    '¼': 0.25,
    '¾': 0.75,
    '⅓': 1 / 3,
    '⅔': 2 / 3,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
  }
  let total = 0
  for (const part of s.trim().split(/\s+/)) {
    if (unicodeFractions[part] !== undefined) total += unicodeFractions[part]
    else if (part.includes('/')) {
      const [num, den] = part.split('/')
      total += (parseFloat(num) || 0) / (parseFloat(den) || 1)
    } else {
      total += parseFloat(part) || 0
    }
  }
  return total
}

export function parseIngredientString(s: string): Ingredient {
  const trimmed = s.trim().replace(/^[*\-•]+\s*/, '')
  if (!trimmed) return { name: '', amount: 0, unit: '' }

  const amtMatch = trimmed.match(/^([\d½¼¾⅓⅔⅛⅜⅝⅞\s/]+)/)
  if (amtMatch) {
    const amtStr = amtMatch[1].trim()
    const rest = trimmed.slice(amtMatch[0].length).trim()
    const amount = parseFraction(amtStr)
    if (amount > 0 || amtStr.includes('/')) {
      const unitMatch = rest.match(/^(\w+)\s+(.+)$/)
      if (unitMatch) {
        const [, possibleUnit, name] = unitMatch
        if (KNOWN_UNITS.has(possibleUnit.toLowerCase())) {
          return { name: name.trim(), amount, unit: possibleUnit.toLowerCase() }
        }
      }
      if (rest) return { name: rest, amount, unit: '' }
    }
  }
  return { name: trimmed, amount: 0, unit: '' }
}

// ─── Paprika file decompression ────────────────────────────────────────────────

export async function decompressPaprikaFile(buffer: ArrayBuffer): Promise<ScrapeResult> {
  try {
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    const reader = ds.readable.getReader()
    writer.write(new Uint8Array(buffer))
    writer.close()
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const combined = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    return parsePaprikaRecipe(JSON.parse(new TextDecoder().decode(combined)) as unknown)
  } catch (err) {
    return {
      ok: false,
      error: `Failed to read Paprika file: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── File import dispatcher ────────────────────────────────────────────────────

export async function importFromFile(file: File): Promise<ScrapeResult[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.paprikarecipe')) {
    return [await decompressPaprikaFile(await file.arrayBuffer())]
  }

  if (name.endsWith('.json')) {
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch {
      return [{ ok: false, error: 'Invalid JSON file.' }]
    }
    const jsonLd = parseJsonLdRecipe(json)
    if (jsonLd.ok) return [jsonLd]
    const crouton = parseCroutonExport(json)
    if (crouton.some((r) => r.ok)) return crouton
    const paprika = parsePaprikaRecipe(json)
    if (paprika.ok) return [paprika]
    return [
      {
        ok: false,
        error: 'Unrecognized JSON format. Supports JSON-LD, Crouton, and Paprika exports.',
      },
    ]
  }

  return [{ ok: false, error: 'Unsupported file type. Use .paprikarecipe or .json.' }]
}

// ─── Normalization helpers ─────────────────────────────────────────────────────

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
  return raw.map((k) => String(k).trim().toLowerCase()).filter((k) => k.length > 0)
}

// Re-export Recipe type for convenience
export type { Recipe }
