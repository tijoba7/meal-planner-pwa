/**
 * scrape-url — Supabase Edge Function
 *
 * Server-side URL fetcher that bypasses browser CORS restrictions.
 * Called by the frontend scraper before falling back to a direct fetch.
 *
 * Request:  POST { url: string }
 * Response: { text: string | null }
 *
 * Auth: Any valid Supabase JWT (anon key or user session).
 */

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

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Require an Authorization header (anon key or user JWT passed by supabase-js)
  if (!req.headers.get('Authorization')) {
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
  // Block local/private addresses
  const host = parsed.hostname
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.')
  ) {
    return json({ error: 'Private network URLs are not allowed' }, 400)
  }

  const text = await fetchUrlText(url)
  return json({ text })
})

async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }

    const html = await res.text()
    return stripHtml(html)
  } catch {
    return null
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
