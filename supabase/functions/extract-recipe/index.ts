/**
 * extract-recipe — Supabase Edge Function
 *
 * Server-side AI recipe extraction. Keeps the AI provider API key
 * out of the browser (H-1 security fix for MEA-227).
 *
 * Request:  POST { systemPrompt: string, userMessage: string }
 * Response: { ok: true, recipe: object } | { ok: false, error: string }
 *
 * Auth: Valid Supabase user JWT (Authorization: Bearer <token>).
 *       Rate limiting is enforced server-side via check_scrape_rate_limit().
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // ── 1. Verify JWT ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // User-scoped client — verifies JWT and enforces RLS
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  // ── 2. Rate limit check (records attempt if allowed) ────────────────────────
  const { data: rateData, error: rateError } = await userClient.rpc('check_scrape_rate_limit')
  if (rateError || rateData === null) {
    return json({ ok: false, error: 'Rate limit check failed' })
  }
  const rate = rateData as { allowed: boolean; remaining: number; retry_after_sec: number }
  if (!rate.allowed) {
    return json({
      ok: false,
      error: `Too many import requests. Please wait ${rate.retry_after_sec} seconds before trying again.`,
      retryAfterSec: rate.retry_after_sec,
    })
  }

  // ── 3. Parse request body ────────────────────────────────────────────────────
  let systemPrompt: string
  let userMessage: string
  try {
    const body = (await req.json()) as { systemPrompt?: unknown; userMessage?: unknown }
    if (typeof body.systemPrompt !== 'string' || typeof body.userMessage !== 'string') {
      throw new Error('missing fields')
    }
    systemPrompt = body.systemPrompt
    userMessage = body.userMessage
  } catch {
    return json({ ok: false, error: 'Invalid request body — expected { systemPrompt, userMessage }' })
  }

  // ── 4. Load scraping config with service role (reads sensitive keys) ─────────
  // The Supabase JS client deserializes JSONB automatically, so JSONB text values
  // (stored as e.g. '"sk-ant-..."') arrive as plain JS strings.
  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: settings, error: settingsError } = await adminClient
    .from('app_settings')
    .select('key, value')
    .in('key', ['scraping.api_key', 'scraping.provider', 'scraping.model'])

  if (settingsError || !settings) {
    return json({ ok: false, error: 'Failed to load scraping configuration' })
  }

  const settingsMap = Object.fromEntries(
    (settings as Array<{ key: string; value: string | null }>).map((r) => [r.key, r.value]),
  )

  const apiKey = settingsMap['scraping.api_key'] ?? null
  const provider = settingsMap['scraping.provider'] ?? 'anthropic'
  const model = settingsMap['scraping.model'] ?? null

  if (!apiKey) {
    return json({
      ok: false,
      error: 'AI scraping not configured — ask your admin to set up an API key in the Admin panel.',
    })
  }

  // ── 5. Call the AI provider ──────────────────────────────────────────────────
  const defaultModel =
    provider === 'openai'
      ? DEFAULT_OPENAI_MODEL
      : provider === 'gemini'
        ? DEFAULT_GEMINI_MODEL
        : DEFAULT_MODEL
  const resolvedModel = model ?? defaultModel

  const result = await callAI(systemPrompt, userMessage, apiKey, resolvedModel, provider)
  return json(result)
})

// ── AI provider calls ──────────────────────────────────────────────────────────

async function callAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
  provider: string,
): Promise<{ ok: boolean; error?: string; recipe?: unknown }> {
  if (provider === 'openai') return callOpenAI(systemPrompt, userMessage, apiKey, model)
  if (provider === 'gemini') return callGemini(systemPrompt, userMessage, apiKey, model)
  return callClaude(systemPrompt, userMessage, apiKey, model)
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string; recipe?: unknown }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      const msg = body.error?.message ?? `HTTP ${res.status}`
      if (res.status === 401) return { ok: false, error: `Invalid AI API key — check the key in Admin settings. (${msg})` }
      if (res.status === 429) return { ok: false, error: `AI provider rate limit exceeded — try again in a few minutes. (${msg})` }
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
    const raw = data.content.find((b) => b.type === 'text')?.text ?? ''
    return parseAiResponseText(raw)
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: 'AI request timed out after 30 seconds. Please try again.' }
    }
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string; recipe?: unknown }> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
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
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      const msg = body.error?.message ?? `HTTP ${res.status}`
      if (res.status === 401) return { ok: false, error: `Invalid AI API key — check the key in Admin settings. (${msg})` }
      if (res.status === 429) return { ok: false, error: `AI provider rate limit exceeded — try again in a few minutes. (${msg})` }
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
    const raw = data.choices[0]?.message?.content ?? ''
    return parseAiResponseText(raw)
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: 'AI request timed out after 30 seconds. Please try again.' }
    }
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string; recipe?: unknown }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 2048, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      const msg = body.error?.message ?? `HTTP ${res.status}`
      if (res.status === 401 || res.status === 403) return { ok: false, error: `Invalid AI API key — check the key in Admin settings. (${msg})` }
      if (res.status === 429) return { ok: false, error: `AI provider rate limit exceeded — try again in a few minutes. (${msg})` }
      return { ok: false, error: `AI API error: ${msg}` }
    }

    const data = (await res.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
    const raw = data.candidates[0]?.content?.parts[0]?.text ?? ''
    return parseAiResponseText(raw)
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: 'AI request timed out after 30 seconds. Please try again.' }
    }
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ── Response parsing ───────────────────────────────────────────────────────────

function extractJsonFromResponse(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1)
  return trimmed
}

function parseAiResponseText(raw: string): { ok: boolean; error?: string; recipe?: unknown } {
  let parsed: Record<string, unknown>
  try {
    const cleaned = extractJsonFromResponse(raw)
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const preview = raw.length > 200 ? raw.slice(0, 200) + '…' : raw
    return { ok: false, error: `Could not parse AI response as JSON. Response preview: ${preview}` }
  }

  if (parsed.error) return { ok: false, error: parsed.error as string }
  if (!parsed.name) return { ok: false, error: 'No recipe found.' }

  return { ok: true, recipe: parsed }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
