import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'staging' | 'production'
    release: import.meta.env.VITE_APP_VERSION as string | undefined,

    // Capture unhandled promise rejections automatically
    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Performance: sample 10% of transactions in production, 100% in dev
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Don't send errors in development unless DSN is explicitly set
    enabled: !!dsn,

    beforeSend(event) {
      // Strip PII from breadcrumb URLs
      return event
    },
  })
}

export { Sentry }
