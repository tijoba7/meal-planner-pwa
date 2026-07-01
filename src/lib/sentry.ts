import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

/** Query-string params whose values may carry auth material or one-time codes. */
const SENSITIVE_URL_PARAMS = [
  'access_token',
  'refresh_token',
  'token',
  'code',
  'apikey',
  'api_key',
]

/**
 * Redacts sensitive query params (auth tokens, magic-link codes) from any URL
 * string before it is sent to Sentry. Returns the input unchanged if it isn't
 * a parseable URL. Also strips the URL fragment, where Supabase returns tokens.
 */
export function scrubUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    let changed = false
    for (const key of SENSITIVE_URL_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[Filtered]')
        changed = true
      }
    }
    if (url.hash && /(access_token|refresh_token|token|code)=/.test(url.hash)) {
      url.hash = ''
      changed = true
    }
    return changed ? url.toString() : rawUrl
  } catch {
    return rawUrl
  }
}

export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'staging' | 'production'
    release: import.meta.env.VITE_APP_VERSION as string | undefined,

    // Capture unhandled promise rejections automatically
    integrations: [Sentry.browserTracingIntegration()],

    // Performance: sample 10% of transactions in production, 100% in dev
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Don't send errors in development unless DSN is explicitly set
    enabled: !!dsn,

    // Never attach cookies / IP / request bodies by default.
    sendDefaultPii: false,

    beforeBreadcrumb(breadcrumb) {
      // Scrub auth tokens / one-time codes from navigation & fetch/xhr URLs.
      if (breadcrumb.data && typeof breadcrumb.data.url === 'string') {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url)
      }
      return breadcrumb
    },

    beforeSend(event) {
      // Strip auth tokens / codes from the request URL captured with the event.
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url)
      }
      return event
    },
  })
}

export { Sentry }
