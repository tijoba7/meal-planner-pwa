/**
 * suggest-pantry — Supabase Edge Function
 *
 * Server-side AI pantry suggestion. Keeps the AI provider API key
 * out of the browser (same H-1 class fix as extract-recipe, MEA-227).
 *
 * Request:  POST { systemPrompt: string, userMessage: string }
 * Response: { ok: true, text: string } | { ok: false, error: string }
 *
 * Returns the raw AI text so the caller can parse the JSON array of suggestions.
 *
 * Auth: Valid Supabase user JWT.
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

  // ── 2. Parse request body ────────────────────────────────────────────────────
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

  // ── 3. Load scraping config with service role ────────────────────────────────
  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data: settings, error: settingsError } = await adminClient
    .from('app_settings')
    .select('key, value')
    .in('key', ['scraping.api_key', 'scraping.provider', 'scraping.model'])

  if (settingsError || !settings) {
    return json({ ok: false, error: 'Failed to load AI configuration' })
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
      error: 'AI API key not configured — ask your admin to set up an API key in the Admin panel.',
    })
  }

  // ── 4. Call the AI provider ──────────────────────────────────────────────────
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

async function callAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
  provider: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (provider === 'openai') return callOpenAI(systemPrompt, userMessage, apiKey, model)
  if (provider === 'gemini') return callGemini(systemPrompt, userMessage, apiKey, model)
  return callClaude(systemPrompt, userMessage, apiKey, model)
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` }
    }
    const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
    return { ok: true, text: data.content.find((b) => b.type === 'text')?.text ?? '' }
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` }
    }
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
    return { ok: true, text: data.choices[0]?.message?.content ?? '' }
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` }
    }
    const data = (await res.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
    return { ok: true, text: data.candidates[0]?.content?.parts[0]?.text ?? '' }
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
