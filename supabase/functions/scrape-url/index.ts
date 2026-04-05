/**
 * scrape-url — Supabase Edge Function
 *
 * Server-side URL fetcher that bypasses browser CORS restrictions.
 * Called by the frontend scraper before falling back to a direct fetch.
 *
 * Request:  POST { url: string }
 * Response: { text: string | null, sourceType: 'social_video' | 'html' | null }
 *
 * Auth: Valid Supabase user JWT (M-2 fix: JWT is verified, not just presence-checked).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

type SourceType = 'social_video' | 'html'

// Social media video URL patterns per platform
const SOCIAL_VIDEO_PATTERNS: { host: string; patterns: RegExp[] }[] = [
  { host: 'instagram.com', patterns: [/\/reel\//i, /\/reels\//i] },
  { host: 'tiktok.com', patterns: [/\/@[^/]+\/video\//i, /\/v\//i] },
  { host: 'youtube.com', patterns: [/\/shorts\//i, /\/watch(\?|$)/i] },
  { host: 'youtu.be', patterns: [/.*/] }, // all short links are videos
]

function detectSocialVideoType(url: string): SourceType | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    for (const entry of SOCIAL_VIDEO_PATTERNS) {
      if (host === entry.host) {
        const target = parsed.pathname + parsed.search
        if (entry.patterns.some((p) => p.test(target))) return 'social_video'
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract rich metadata from social media HTML before full tag stripping.
 * Returns a structured text block with og/twitter meta content and JSON-LD.
 */
function extractSocialMetadata(html: string): string {
  const lines: string[] = []

  // <title>
  const titleMatch = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)
  if (titleMatch) lines.push(`title: ${titleMatch[1].trim()}`)

  // <meta> tag extraction — og:* properties and twitter:* / description names
  const metaRegex = /<meta\s[^>]+>/gi
  const seen = new Set<string>()
  for (const metaTag of html.matchAll(metaRegex)) {
    const tag = metaTag[0]
    // property="og:*" or property="twitter:*"
    const propMatch = tag.match(/property=["']([^"']+)["']/i)
    // name="twitter:*" or name="description"
    const nameMatch = tag.match(/name=["']([^"']+)["']/i)
    const contentMatch = tag.match(/content=["']([^"']{1,500})["']/i)
    const content = contentMatch?.[1]?.trim()
    if (!content) continue

    const key = propMatch?.[1] ?? nameMatch?.[1] ?? ''
    const normalized = key.toLowerCase()
    if (!normalized) continue

    // Capture og:*, twitter:*, description
    if (
      normalized.startsWith('og:') ||
      normalized.startsWith('twitter:') ||
      normalized === 'description'
    ) {
      const entry = `${normalized}: ${content}`
      if (!seen.has(entry)) {
        seen.add(entry)
        lines.push(entry)
      }
    }
  }

  // JSON-LD structured data blocks (YouTube has VideoObject schema, etc.)
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const block of html.matchAll(jsonLdRegex)) {
    try {
      const data = JSON.parse(block[1]) as unknown
      // Flatten to a compact readable form (skip large arrays)
      const compact = flattenJsonLd(data)
      if (compact) lines.push(`\nstructured_data:\n${compact}`)
    } catch {
      // skip invalid JSON-LD
    }
  }

  return lines.join('\n')
}

/** Recursively flatten JSON-LD to key: value lines, capped at ~2000 chars. */
function flattenJsonLd(data: unknown, depth = 0): string {
  if (depth > 3) return ''
  if (typeof data === 'string' || typeof data === 'number') return String(data).slice(0, 300)
  if (Array.isArray(data)) {
    return data
      .slice(0, 5)
      .map((item) => flattenJsonLd(item, depth + 1))
      .filter(Boolean)
      .join('\n')
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    return Object.entries(obj)
      .filter(([k]) => !k.startsWith('@') || k === '@type')
      .slice(0, 20)
      .map(([k, v]) => {
        const val = flattenJsonLd(v, depth + 1)
        return val ? `${k}: ${val}` : ''
      })
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000)
  }
  return ''
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // M-2: Verify JWT validity, not just presence of the Authorization header.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let url: string
  try {
    const body = (await req.json()) as { url?: unknown }
    if (!body.url || typeof body.url !== 'string') throw new Error('missing url')
    url = body.url.trim()
  } catch {
    return json({ error: 'Invalid request body — expected { url: string }' }, 400)
  }

  // Validate: only HTTP/HTTPS allowed, no internal network access
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return json({ error: 'Invalid URL' }, 400)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return json({ error: 'Only HTTP/HTTPS URLs are supported' }, 400)
  }

  // M-4: Block private/loopback hostnames by name first (fast path), then resolve
  // the hostname via DNS and check the resolved IP to prevent DNS rebinding SSRF.
  const host = parsed.hostname
  if (isPrivateHostname(host)) {
    return json({ error: 'Private network URLs are not allowed' }, 400)
  }

  // DNS rebinding protection: resolve the hostname and verify the resolved IP is public.
  // This prevents an attacker from using a public hostname that resolves to a private IP.
  if (!isIpAddress(host)) {
    const dnsBlocked = await resolvedIpIsPrivate(host)
    if (dnsBlocked) {
      return json({ error: 'Private network URLs are not allowed' }, 400)
    }
  }

  const result = await fetchUrlText(url)
  return json({ text: result.text, sourceType: result.sourceType })
})

/** Returns true if the hostname string itself looks like a private/loopback address. */
function isPrivateHostname(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('fc') || // IPv6 unique-local fc00::/7
    host.startsWith('fd') || // IPv6 unique-local fd00::/8
    host.startsWith('fe80') || // IPv6 link-local fe80::/10
    host.startsWith('169.254.') || // link-local + cloud instance metadata (AWS/GCP/Azure)
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) // RFC 1918: 172.16.0.0–172.31.255.255
  )
}

/** Returns true if the string is an IP address literal (IPv4 or IPv6). */
function isIpAddress(host: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  // IPv6 (with or without brackets)
  if (host.startsWith('[') || host.includes(':')) return true
  return false
}

/** Resolves a hostname and returns true if any resolved IP is private/loopback. */
async function resolvedIpIsPrivate(host: string): Promise<boolean> {
  try {
    const addresses = await Deno.resolveDns(host, 'A').catch(() => [] as string[])
    const addresses6 = await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[])
    for (const ip of [...addresses, ...addresses6]) {
      if (isPrivateHostname(ip)) return true
    }
    return false
  } catch {
    // If DNS resolution fails entirely, block the request to be safe.
    return true
  }
}

async function fetchUrlText(url: string): Promise<{ text: string | null; sourceType: SourceType | null }> {
  const socialType = detectSocialVideoType(url)
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return { text: null, sourceType: null }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { text: null, sourceType: null }
    }

    const html = await res.text()

    if (socialType === 'social_video') {
      // For social media videos, prepend rich metadata before the stripped page text
      // so the AI has captions, descriptions, and structured data to work with.
      const metadata = extractSocialMetadata(html)
      const stripped = stripHtml(html)
      const combined = [
        metadata ? `[Social Media Metadata]\n${metadata}` : '',
        stripped ? `\n[Page Text]\n${stripped}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      return { text: combined || null, sourceType: 'social_video' }
    }

    return { text: stripHtml(html), sourceType: 'html' }
  } catch {
    return { text: null, sourceType: null }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
