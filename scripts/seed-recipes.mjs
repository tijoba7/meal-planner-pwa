#!/usr/bin/env node
/**
 * seed-recipes.mjs — Seed ~100 curated public recipes into the mise Supabase database.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> [ANTHROPIC_API_KEY=<key>] node scripts/seed-recipes.mjs
 *
 * Required:
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS, allows admin user creation)
 *
 * Optional:
 *   ANTHROPIC_API_KEY   — fallback AI extraction when JSON-LD not found (reads from Supabase if absent)
 *   SUPABASE_URL        — override URL (defaults to VITE_SUPABASE_URL in .env.local)
 *   CONCURRENCY         — parallel scrape limit (default: 3)
 *   DRY_RUN             — set to "1" to validate without inserting
 *   SKIP_EXISTING       — set to "0" to re-process already-seeded URLs (default: skip)
 *
 * Idempotency: recipes are keyed on (author_id, data->>'url'). Re-runs skip already-seeded URLs.
 *
 * Part of MEA-211.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ─── Environment ─────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const lines = readFileSync(filePath, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = val
  }
  return env
}

const dotenv = parseEnvFile(join(ROOT, '.env.local'))

function env(key, fallback) {
  return process.env[key] ?? dotenv[key] ?? fallback
}

const SUPABASE_URL = env('SUPABASE_URL', env('VITE_SUPABASE_URL', ''))
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY', '')
const ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', '')
const CONCURRENCY = parseInt(env('CONCURRENCY', '3'), 10)
const DRY_RUN = env('DRY_RUN', '0') === '1'
const SKIP_EXISTING = env('SKIP_EXISTING', '1') !== '0'

if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL / VITE_SUPABASE_URL is required.')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required.')
  process.exit(1)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MISE_SYSTEM_EMAIL = 'system@mise.app'
const MISE_SYSTEM_DISPLAY_NAME = 'mise'

const EXTRACT_SYSTEM_PROMPT = `You are a recipe extraction assistant. Given a URL and optional page content, extract all available recipe information and return it as a single JSON object.

Output schema:
{
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
  "url": string,
  "recipeCategory": string | undefined,
  "recipeCuisine": string | undefined
}

Rules:
- Output ONLY the raw JSON object — no markdown fences, no explanation.
- Times use ISO 8601 duration format: "PT15M" = 15 min, "PT1H30M" = 1h 30min.
- For ingredient amounts, use 0 if not specified. For units, use "" if not specified.
- If you cannot find a recipe, return: {"error": "No recipe found"}

Example: {"name":"Pasta Carbonara","description":"Classic Roman pasta.","recipeYield":"4 servings","prepTime":"PT10M","cookTime":"PT20M","recipeIngredient":[{"name":"spaghetti","amount":400,"unit":"g"}],"recipeInstructions":[{"@type":"HowToStep","text":"Boil pasta."}],"keywords":["pasta","italian"],"url":"https://example.com/carbonara","recipeCategory":"Main Course","recipeCuisine":"Italian"}`

// ─── Curated Recipe URLs (100 recipes) ───────────────────────────────────────
// Diversity: ~20 breakfast, ~30 mains, ~15 sides/salads, ~15 desserts, ~10 snacks, ~10 soups
// Cuisines: American, Italian, Mexican, Asian, Middle Eastern, Mediterranean
// Dietary: 15+ vegetarian (V), 10+ vegan (Vg), 10+ gluten-free (GF)

const RECIPE_URLS = [
  // ─── Breakfast (~20) ─────────────────────────────────────────────────────
  'https://www.budgetbytes.com/easy-overnight-oats/',               // V, GF
  'https://www.budgetbytes.com/shakshuka/',                         // V
  'https://www.budgetbytes.com/breakfast-burritos/',
  'https://www.budgetbytes.com/banana-oat-pancakes/',               // V
  'https://www.budgetbytes.com/chia-seed-pudding/',                 // Vg, GF
  'https://www.budgetbytes.com/stove-top-granola/',                 // Vg, GF
  'https://www.seriouseats.com/the-food-lab-how-to-make-perfect-scrambled-eggs',
  'https://www.seriouseats.com/extra-crispy-french-toast',
  'https://www.seriouseats.com/congee-jook-recipe',                 // GF
  'https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/',
  'https://www.allrecipes.com/recipe/17891/belgian-waffles/',
  'https://www.allrecipes.com/recipe/109518/eggs-benedict/',
  'https://www.allrecipes.com/recipe/229960/california-avocado-toast/', // V
  'https://www.allrecipes.com/recipe/22180/huevos-rancheros/',
  'https://www.allrecipes.com/recipe/79489/simple-crepes/',         // V
  'https://www.bbcgoodfood.com/recipes/granola',                    // Vg, GF
  'https://www.bbcgoodfood.com/recipes/full-english-breakfast',
  'https://www.bbcgoodfood.com/recipes/bircher-muesli',             // V, GF
  'https://www.bbcgoodfood.com/recipes/smoothie-bowl',              // Vg, GF
  'https://www.smittenkitchen.com/2019/04/fluffy-pancakes/',        // V

  // ─── Lunch & Dinner Mains (~30) ──────────────────────────────────────────
  'https://www.budgetbytes.com/one-pot-pasta/',                     // V
  'https://www.budgetbytes.com/black-bean-burgers/',                // V
  'https://www.budgetbytes.com/vegetarian-burrito-bowl/',           // V, GF
  'https://www.budgetbytes.com/easy-bulgogi-korean-beef/',
  'https://www.budgetbytes.com/thai-green-curry/',                  // V, GF
  'https://www.budgetbytes.com/dal-makhani/',                       // V, GF
  'https://www.budgetbytes.com/mushroom-risotto/',                  // V, GF
  'https://www.budgetbytes.com/eggplant-parmesan/',                 // V
  'https://www.budgetbytes.com/lemon-herb-baked-salmon/',           // GF
  'https://www.budgetbytes.com/easy-homemade-pizza/',               // V
  'https://www.seriouseats.com/pasta-alla-carbonara-recipe',
  'https://www.seriouseats.com/butterflied-roasted-chicken-recipe', // GF
  'https://www.seriouseats.com/pad-thai-recipe',
  'https://www.seriouseats.com/lamb-kofta-recipe',                  // GF
  'https://www.seriouseats.com/arroz-con-pollo-recipe',
  'https://www.seriouseats.com/pork-carnitas-recipe',               // GF
  'https://www.seriouseats.com/miso-glazed-salmon-recipe',          // GF
  'https://www.seriouseats.com/easy-weeknight-sheet-pan-chicken-thighs-with-mustard-and-herbs',
  'https://www.allrecipes.com/recipe/45580/chicken-tikka-masala/',
  'https://www.allrecipes.com/recipe/6553/classic-margherita-pizza/', // V
  'https://www.allrecipes.com/recipe/229961/quick-and-easy-beef-stir-fry/',
  'https://www.allrecipes.com/recipe/8692/chicken-fried-rice/',
  'https://www.allrecipes.com/recipe/202012/greek-moussaka/',
  'https://www.allrecipes.com/recipe/8781/easy-bibimbap/',
  'https://www.allrecipes.com/recipe/14439/fish-and-chips/',
  'https://www.allrecipes.com/recipe/26317/chicken-marsala/',
  'https://www.allrecipes.com/recipe/8850/teriyaki-salmon/',        // GF
  'https://www.bbcgoodfood.com/recipes/chicken-shawarma',
  'https://www.smittenkitchen.com/2017/03/gado-gado/',              // Vg, GF
  'https://www.smittenkitchen.com/2008/01/spaghetti-with-carbonara-sauce/',

  // ─── Sides & Salads (~15) ────────────────────────────────────────────────
  'https://www.budgetbytes.com/roasted-vegetables/',                // Vg, GF
  'https://www.budgetbytes.com/mexican-street-corn-elotes/',        // V
  'https://www.budgetbytes.com/homemade-hummus/',                   // Vg, GF
  'https://www.budgetbytes.com/garlic-bread/',                      // V
  'https://www.budgetbytes.com/simple-steamed-rice/',               // Vg, GF
  'https://www.seriouseats.com/easy-caesar-salad-recipe',
  'https://www.seriouseats.com/the-best-roasted-garlic-mashed-potatoes-recipe', // V, GF
  'https://www.seriouseats.com/creamy-coleslaw-recipe',             // V, GF
  'https://www.seriouseats.com/better-than-takeaway-fried-rice-recipe', // V
  'https://www.seriouseats.com/caprese-salad-recipe',               // V, GF
  'https://www.allrecipes.com/recipe/131708/authentic-greek-salad/', // V, GF
  'https://www.allrecipes.com/recipe/96956/tabbouleh/',             // Vg
  'https://www.allrecipes.com/recipe/267786/quinoa-salad/',         // Vg, GF
  'https://www.allrecipes.com/recipe/231984/baked-sweet-potato-fries/', // Vg, GF
  'https://www.bbcgoodfood.com/recipes/tzatziki',                   // V, GF

  // ─── Desserts (~15) ──────────────────────────────────────────────────────
  'https://www.budgetbytes.com/classic-chocolate-chip-cookies/',    // V
  'https://www.budgetbytes.com/super-moist-banana-bread/',          // V
  'https://www.budgetbytes.com/no-bake-energy-balls/',              // Vg, GF
  'https://www.budgetbytes.com/mango-chia-pudding-parfait/',        // Vg, GF
  'https://www.seriouseats.com/new-york-cheesecake-recipe',
  'https://www.seriouseats.com/creme-brulee-recipe',                // GF
  'https://www.seriouseats.com/dark-chocolate-mousse-recipe',       // GF
  'https://www.seriouseats.com/japanese-mochi-recipe',              // GF
  'https://www.allrecipes.com/recipe/10549/best-brownies/',         // V
  'https://www.allrecipes.com/recipe/12682/apple-pie-by-grandma-ople/', // V
  'https://www.allrecipes.com/recipe/21412/tiramisu-ii/',
  'https://www.allrecipes.com/recipe/10294/lemon-bars/',            // V
  'https://www.allrecipes.com/recipe/9836/baklava/',                // V
  'https://www.bbcgoodfood.com/recipes/easy-mug-cake',              // V
  'https://www.bbcgoodfood.com/recipes/vanilla-panna-cotta',        // V, GF

  // ─── Snacks (~10) ────────────────────────────────────────────────────────
  'https://www.budgetbytes.com/easy-guacamole/',                    // Vg, GF
  'https://www.budgetbytes.com/crispy-roasted-chickpeas/',          // Vg, GF
  'https://www.budgetbytes.com/homemade-pita-chips/',               // Vg
  'https://www.budgetbytes.com/homemade-trail-mix/',                // Vg, GF
  'https://www.seriouseats.com/deviled-eggs-recipe',                // V, GF
  'https://www.seriouseats.com/loaded-nachos-recipe',               // V
  'https://www.seriouseats.com/crispy-potato-skins-recipe',         // V, GF
  'https://www.allrecipes.com/recipe/8103/baked-buffalo-wings/',    // GF
  'https://www.allrecipes.com/recipe/23180/bruschetta/',            // V
  'https://www.allrecipes.com/recipe/35487/hot-spinach-artichoke-dip/', // V

  // ─── Soups (~10) ─────────────────────────────────────────────────────────
  'https://www.budgetbytes.com/simple-tomato-soup/',                // V, GF
  'https://www.budgetbytes.com/lentil-soup/',                       // Vg, GF
  'https://www.budgetbytes.com/minestrone-soup/',                   // Vg
  'https://www.budgetbytes.com/easy-black-bean-soup/',              // Vg, GF
  'https://www.seriouseats.com/the-best-french-onion-soup-recipe',
  'https://www.seriouseats.com/easy-15-minute-ramen-recipe',
  'https://www.seriouseats.com/pho-recipe',
  'https://www.allrecipes.com/recipe/13357/homemade-chicken-noodle-soup/',
  'https://www.allrecipes.com/recipe/84069/new-england-clam-chowder-ii/', // GF
  'https://www.allrecipes.com/recipe/82634/gazpacho/',              // Vg, GF
]

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── System user bootstrap ───────────────────────────────────────────────────

async function ensureMiseSystemUser() {
  console.log('🔍  Checking for mise system user...')

  // Check if the user already exists in auth.users via admin API
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) throw new Error(`Failed to list auth users: ${listErr.message}`)

  const existing = userList?.users?.find((u) => u.email === MISE_SYSTEM_EMAIL)
  if (existing) {
    console.log(`✅  mise system user already exists (${existing.id})`)
    // Ensure profile display_name is correct
    await supabase
      .from('profiles')
      .update({ display_name: MISE_SYSTEM_DISPLAY_NAME })
      .eq('id', existing.id)
    return existing.id
  }

  console.log('➕  Creating mise system user...')
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: MISE_SYSTEM_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: MISE_SYSTEM_DISPLAY_NAME },
    // No password — this account is never used for interactive login
    password: crypto.randomUUID() + crypto.randomUUID(),
  })
  if (createErr) throw new Error(`Failed to create mise system user: ${createErr.message}`)

  const userId = created.user.id
  console.log(`✅  Created mise system user (${userId})`)

  // The on_auth_user_created trigger auto-inserts the profile row.
  // Give the trigger a moment, then verify.
  await new Promise((r) => setTimeout(r, 500))
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()
  if (!profile) {
    // Trigger may not have fired (local dev) — insert manually
    await supabase
      .from('profiles')
      .insert({ id: userId, display_name: MISE_SYSTEM_DISPLAY_NAME })
      .throwOnError()
  }

  return userId
}

// ─── Already-seeded URL index ─────────────────────────────────────────────────

async function loadSeededUrls(authorId) {
  const { data, error } = await supabase
    .from('recipes_cloud')
    .select('data')
    .eq('author_id', authorId)
    .eq('visibility', 'public')
  if (error) throw new Error(`Failed to load seeded recipes: ${error.message}`)
  const seeded = new Set()
  for (const row of data ?? []) {
    const url = row.data?.url
    if (url) seeded.add(url)
  }
  return seeded
}

// ─── Page fetching ───────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (compatible; mise-seed-bot/1.0; +https://mise.app) AppleWebKit/537.36'

async function fetchPageText(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html
  } catch {
    return null
  }
}

// ─── JSON-LD extraction ───────────────────────────────────────────────────────

function extractJsonLd(html) {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const candidates = []
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      candidates.push(parsed)
    } catch {
      // malformed JSON-LD — skip
    }
  }

  // Flatten @graph entries
  const all = []
  for (const item of candidates) {
    if (Array.isArray(item['@graph'])) {
      all.push(...item['@graph'])
    } else if (Array.isArray(item)) {
      all.push(...item)
    } else {
      all.push(item)
    }
  }

  return all.find((item) => {
    const type = item['@type']
    if (typeof type === 'string') return type === 'Recipe'
    if (Array.isArray(type)) return type.includes('Recipe')
    return false
  })
}

function normaliseIngredients(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return { name: item.trim(), amount: 0, unit: '' }
    return {
      name: String(item.name ?? item.text ?? '').trim(),
      amount: Number(item.amount ?? 0),
      unit: String(item.unit ?? '').trim(),
    }
  })
}

function normaliseInstructions(raw) {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (typeof item === 'string') return [{ '@type': 'HowToStep', text: item.trim() }]
    if (item['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
      return item.itemListElement.map((step) => ({
        '@type': 'HowToStep',
        text: String(step.text ?? step.name ?? '').trim(),
      }))
    }
    return [{ '@type': 'HowToStep', text: String(item.text ?? item.name ?? '').trim() }]
  })
}

function normaliseKeywords(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  return String(raw)
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean)
}

function jsonLdToExtractedRecipe(ld, sourceUrl) {
  const ingredients = normaliseIngredients(ld.recipeIngredient)
  const instructions = normaliseInstructions(ld.recipeInstructions)
  if (!ld.name || ingredients.length < 3 || instructions.length < 2) return null

  return {
    name: String(ld.name).trim(),
    description: String(ld.description ?? '').trim(),
    recipeYield: String(ld.recipeYield ?? (Array.isArray(ld.recipeYield) ? ld.recipeYield[0] : '') ?? '').trim(),
    prepTime: String(ld.prepTime ?? 'PT0M'),
    cookTime: String(ld.cookTime ?? 'PT0M'),
    recipeIngredient: ingredients,
    recipeInstructions: instructions,
    keywords: normaliseKeywords(ld.keywords),
    image: ld.image
      ? typeof ld.image === 'string'
        ? ld.image
        : ld.image?.url ?? ld.image?.[0]?.url ?? undefined
      : undefined,
    author: ld.author
      ? typeof ld.author === 'string'
        ? ld.author
        : ld.author?.name ?? undefined
      : undefined,
    url: sourceUrl,
    recipeCategory: ld.recipeCategory
      ? Array.isArray(ld.recipeCategory)
        ? ld.recipeCategory[0]
        : String(ld.recipeCategory)
      : undefined,
    recipeCuisine: ld.recipeCuisine
      ? Array.isArray(ld.recipeCuisine)
        ? ld.recipeCuisine[0]
        : String(ld.recipeCuisine)
      : undefined,
    extractionSource: 'structured_data',
  }
}

// ─── AI extraction (Claude) ───────────────────────────────────────────────────

async function callClaude(url, pageText) {
  if (!ANTHROPIC_API_KEY) return null

  const userMessage = pageText
    ? `URL: ${url}\n\nPage content (truncated):\n${pageText.slice(0, 6000)}`
    : `URL: ${url}\n\nNo page content available — use your knowledge of this recipe to populate all fields.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.warn(`  Claude API error for ${url}: HTTP ${res.status} — ${body?.error?.message ?? ''}`)
      return null
    }

    const data = await res.json()
    const raw = data.content?.find((b) => b.type === 'text')?.text ?? ''

    let parsed
    try {
      const cleaned = raw.trim().startsWith('{') ? raw.trim() : raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '')
      parsed = JSON.parse(cleaned)
    } catch {
      console.warn(`  Failed to parse Claude response for ${url}`)
      return null
    }

    if (parsed.error) return null

    const ingredients = normaliseIngredients(parsed.recipeIngredient)
    const instructions = normaliseInstructions(parsed.recipeInstructions)

    if (!parsed.name || ingredients.length < 3 || instructions.length < 2) return null

    return {
      name: String(parsed.name).trim(),
      description: String(parsed.description ?? '').trim(),
      recipeYield: String(parsed.recipeYield ?? '').trim(),
      prepTime: String(parsed.prepTime ?? 'PT0M'),
      cookTime: String(parsed.cookTime ?? 'PT0M'),
      recipeIngredient: ingredients,
      recipeInstructions: instructions,
      keywords: normaliseKeywords(parsed.keywords),
      image: parsed.image ? String(parsed.image) : undefined,
      author: parsed.author ? String(parsed.author) : undefined,
      url,
      recipeCategory: parsed.recipeCategory ? String(parsed.recipeCategory) : undefined,
      recipeCuisine: parsed.recipeCuisine ? String(parsed.recipeCuisine) : undefined,
      extractionSource: 'ai_inferred',
    }
  } catch (err) {
    console.warn(`  Claude call failed for ${url}: ${err.message}`)
    return null
  }
}

// ─── Recipe extraction pipeline ──────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractRecipe(url) {
  const html = await fetchPageText(url)

  // 1. Try JSON-LD (fastest and most accurate)
  if (html) {
    const ld = extractJsonLd(html)
    if (ld) {
      const recipe = jsonLdToExtractedRecipe(ld, url)
      if (recipe) return { ok: true, recipe, source: 'json-ld' }
    }
  }

  // 2. Fall back to AI extraction
  const pageText = html ? stripHtml(html) : null
  const recipe = await callClaude(url, pageText)
  if (recipe) return { ok: true, recipe, source: 'ai' }

  return { ok: false, error: `Could not extract recipe from ${url}` }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRecipe(recipe) {
  if (!recipe.name || recipe.name.length < 2) return 'missing name'
  if (!recipe.recipeIngredient || recipe.recipeIngredient.length < 3) return 'fewer than 3 ingredients'
  if (!recipe.recipeInstructions || recipe.recipeInstructions.length < 2) return 'fewer than 2 instructions'
  return null
}

// ─── DB insertion ─────────────────────────────────────────────────────────────

async function insertRecipe(authorId, recipe) {
  const data = {
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.description,
    recipeYield: recipe.recipeYield,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    recipeIngredient: recipe.recipeIngredient,
    recipeInstructions: recipe.recipeInstructions,
    keywords: recipe.keywords,
    image: recipe.image,
    author: recipe.author,
    url: recipe.url,
    recipeCategory: recipe.recipeCategory,
    recipeCuisine: recipe.recipeCuisine,
  }
  const now = new Date().toISOString()
  const { error } = await supabase.from('recipes_cloud').insert({
    author_id: authorId,
    data,
    visibility: 'public',
    published_at: now,
  })
  if (error) throw new Error(`DB insert failed: ${error.message}`)
}

// ─── Concurrency helper ───────────────────────────────────────────────────────

async function mapWithConcurrency(items, limit, fn) {
  const results = []
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  mise recipe seed  (MEA-211)')
  console.log(`  Target: ${RECIPE_URLS.length} URLs  |  Concurrency: ${CONCURRENCY}`)
  if (DRY_RUN) console.log('  ⚠️  DRY RUN — nothing will be inserted')
  if (!ANTHROPIC_API_KEY) console.log('  ⚠️  No ANTHROPIC_API_KEY — AI fallback disabled')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Ensure mise system user exists
  const authorId = await ensureMiseSystemUser()

  // 2. Load already-seeded URLs
  const seededUrls = SKIP_EXISTING ? await loadSeededUrls(authorId) : new Set()
  if (seededUrls.size > 0) {
    console.log(`⏭   ${seededUrls.size} URL(s) already seeded — skipping`)
  }

  // 3. Filter URLs
  const toProcess = RECIPE_URLS.filter((url) => !seededUrls.has(url))
  console.log(`📋  Processing ${toProcess.length} URL(s)\n`)

  // 4. Process
  const stats = { inserted: 0, failed: 0, invalid: 0, skipped: seededUrls.size }

  await mapWithConcurrency(toProcess, CONCURRENCY, async (url, idx) => {
    const label = `[${String(idx + 1).padStart(3, ' ')}/${toProcess.length}]`
    process.stdout.write(`${label}  ${url.replace(/^https?:\/\/(www\.)?/, '')}\n`)

    const result = await extractRecipe(url)
    if (!result.ok) {
      console.log(`       ❌  ${result.error}`)
      stats.failed++
      return
    }

    const validationError = validateRecipe(result.recipe)
    if (validationError) {
      console.log(`       ⚠️  Rejected (${validationError}): ${result.recipe.name || 'unnamed'}`)
      stats.invalid++
      return
    }

    if (DRY_RUN) {
      console.log(`       ✔  [DRY] "${result.recipe.name}" via ${result.source}`)
      stats.inserted++
      return
    }

    try {
      await insertRecipe(authorId, result.recipe)
      console.log(`       ✔  "${result.recipe.name}" via ${result.source}`)
      stats.inserted++
    } catch (err) {
      console.log(`       ❌  Insert failed: ${err.message}`)
      stats.failed++
    }
  })

  // 5. Summary
  const total = stats.inserted + stats.failed + stats.invalid + stats.skipped
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Seed complete')
  console.log(`  ✔  Inserted : ${stats.inserted}`)
  console.log(`  ⏭  Skipped  : ${stats.skipped} (already seeded)`)
  console.log(`  ⚠️  Invalid  : ${stats.invalid}`)
  console.log(`  ❌  Failed   : ${stats.failed}`)
  console.log(`  ─  Total    : ${total}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (stats.inserted < 50 && !DRY_RUN) {
    console.error('\n⚠️  WARNING: Fewer than 50 recipes were inserted. Check errors above.')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
