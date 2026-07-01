// ─── Input validation and sanitization ──────────────────────────────────────
// Used before any DB write or external API call to enforce field limits,
// block dangerous input, and rate-limit expensive operations.

// ─── URL validation ───────────────────────────────────────────────────────────

const MAX_URL_LENGTH = 2048

/** Hostnames that must never be contacted (loopback / wildcard). */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '0000:0000:0000:0000:0000:0000:0000:0001',
])

/** Regex patterns for private / link-local IPv4 and IPv6 ranges. */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // link-local
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 0.0.0.0/8 ("this host")
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // 100.64.0.0/10 (CGNAT)
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // full loopback /8, not just 127.0.0.1
  /^fc[0-9a-f]{2}/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
]

/**
 * Detects hosts written in a non-standard numeric form (decimal integer, hex,
 * octal, or short dotted notation) that browsers still resolve to a raw IP —
 * e.g. `2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1` all reach 127.0.0.1.
 * Real recipe sites never use these, so any such host is treated as private
 * to defeat SSRF filter-evasion via IP encoding.
 */
function isObfuscatedNumericHost(hostname: string): boolean {
  // Whole-host decimal integer, e.g. 2130706433
  if (/^\d+$/.test(hostname)) return true
  // Whole-host hexadecimal, e.g. 0x7f000001
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true

  const octets = hostname.split('.')
  const allNumericish = octets.every((o) => /^(0x[0-9a-f]+|\d+)$/i.test(o))
  if (allNumericish) {
    // Fewer than 4 numeric parts is short-form notation (e.g. 127.1).
    if (octets.length < 4) return true
    // Any hex (0x…) or octal (leading-zero) octet is an encoding trick.
    if (octets.some((o) => /^0x/i.test(o) || /^0\d/.test(o))) return true
  }
  return false
}

export type UrlValidationError = 'too_long' | 'invalid_url' | 'invalid_protocol' | 'private_host'

/**
 * Validates a URL before fetching / passing to the AI.
 * Returns a UrlValidationError key if invalid, otherwise null.
 */
export function validateImportUrl(rawUrl: string): UrlValidationError | null {
  if (rawUrl.length > MAX_URL_LENGTH) return 'too_long'

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return 'invalid_url'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'invalid_protocol'
  }

  const hostname = parsed.hostname.toLowerCase()

  if (BLOCKED_HOSTNAMES.has(hostname)) return 'private_host'
  if (isObfuscatedNumericHost(hostname)) return 'private_host'
  if (PRIVATE_IP_PATTERNS.some((re) => re.test(hostname))) return 'private_host'

  return null
}

/**
 * Returns the URL unchanged when it is a safe, public http(s) URL; otherwise ''.
 * Used to scrub scraped / AI-provided image and source URLs before they are
 * persisted, so a hostile value (private host, javascript:/data: scheme, etc.)
 * can never be stored or later become an `href`/`src` sink.
 */
export function sanitizeUrlField(rawUrl: string | undefined): string {
  if (!rawUrl) return ''
  return validateImportUrl(rawUrl) === null ? rawUrl : ''
}

export const URL_VALIDATION_MESSAGES: Record<UrlValidationError, string> = {
  too_long: 'URL is too long (maximum 2048 characters).',
  invalid_url: 'Please enter a valid URL.',
  invalid_protocol: 'Only http:// and https:// URLs are supported.',
  private_host: 'Cannot import from local or private network addresses.',
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

const RATE_LIMIT_STORAGE_KEY = 'mise_import_timestamps'

/** Maximum recipe imports per rolling time window. */
const RATE_LIMIT_MAX = 10

/** Rolling window in milliseconds (1 hour). */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

export interface RateLimitResult {
  allowed: boolean
  /** Milliseconds until the oldest entry expires and a slot opens up. */
  retryAfterMs?: number
}

/**
 * Checks and records a recipe-import attempt.
 * Records the attempt if allowed so subsequent calls within the window count it.
 * Pass `max` to override the default limit (e.g. from an admin setting).
 */
export function checkImportRateLimit(max?: number): RateLimitResult {
  const effectiveMax = max ?? RATE_LIMIT_MAX
  const now = Date.now()
  let timestamps: number[] = []

  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY)
    const parsed = JSON.parse(stored ?? '[]')
    if (Array.isArray(parsed)) timestamps = parsed as number[]
  } catch {
    timestamps = []
  }

  // Drop entries outside the rolling window
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  timestamps = timestamps.filter((t) => typeof t === 'number' && t > windowStart)

  if (timestamps.length >= effectiveMax) {
    const oldest = Math.min(...timestamps)
    return {
      allowed: false,
      retryAfterMs: oldest + RATE_LIMIT_WINDOW_MS - now,
    }
  }

  // Record this attempt
  timestamps.push(now)
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(timestamps))
  } catch {
    // Ignore quota errors; fail open
  }

  return { allowed: true }
}

/** Returns a human-readable wait string like "45 minutes" or "1 hour". */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  if (minutes >= 60) return '1 hour'
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`
}

// ─── Text sanitization ────────────────────────────────────────────────────────

/** Trims and truncates a string to the given max byte length. */
export function sanitizeText(text: string, maxLength: number): string {
  return text.trim().slice(0, maxLength)
}

/**
 * Per-field character limits. Mirror the CHECK constraints in
 * 20260316000007_input_constraints.sql — keep them in sync.
 */
export const RECIPE_FIELD_LIMITS = {
  name: 200,
  description: 2000,
  recipeYield: 50,
  ingredient_name: 200,
  ingredient_unit: 50,
  instruction_text: 2000,
  keyword: 100,
  author: 200,
  category: 100,
  cuisine: 100,
} as const

interface RecipeLike {
  name: string
  description: string
  recipeYield: string
  recipeIngredient: Array<{ name: string; amount: number; unit: string }>
  recipeInstructions: Array<{ '@type': string; text: string }>
  keywords: string[]
  author?: string
  recipeCategory?: string
  recipeCuisine?: string
  image?: string
  url?: string
}

/**
 * Returns a new object with all string fields trimmed and clamped to safe
 * limits. Excess array elements (> 200 ingredients, > 100 steps) are dropped.
 */
export function sanitizeRecipeData<T extends RecipeLike>(recipe: T): T {
  const L = RECIPE_FIELD_LIMITS
  return {
    ...recipe,
    name: sanitizeText(recipe.name, L.name),
    description: sanitizeText(recipe.description, L.description),
    recipeYield: sanitizeText(recipe.recipeYield, L.recipeYield),
    recipeIngredient: recipe.recipeIngredient.slice(0, 200).map((ing) => ({
      ...ing,
      name: sanitizeText(ing.name, L.ingredient_name),
      unit: sanitizeText(ing.unit, L.ingredient_unit),
    })),
    recipeInstructions: recipe.recipeInstructions.slice(0, 100).map((step) => ({
      ...step,
      text: sanitizeText(step.text, L.instruction_text),
    })),
    keywords: recipe.keywords.slice(0, 50).map((kw) => sanitizeText(kw, L.keyword)),
    ...(recipe.author !== undefined && {
      author: sanitizeText(recipe.author, L.author),
    }),
    ...(recipe.recipeCategory !== undefined && {
      recipeCategory: sanitizeText(recipe.recipeCategory, L.category),
    }),
    ...(recipe.recipeCuisine !== undefined && {
      recipeCuisine: sanitizeText(recipe.recipeCuisine, L.cuisine),
    }),
    // Scrub URL-bearing fields: only safe public http(s) URLs survive, so a
    // hostile image/source URL can never be persisted or become a `src`/`href`.
    ...(recipe.image !== undefined && { image: sanitizeUrlField(recipe.image) }),
    ...(recipe.url !== undefined && { url: sanitizeUrlField(recipe.url) }),
  }
}
