/**
 * Core Web Vitals reporting.
 *
 * Sends metrics to Sentry as a custom measurement on a dedicated "web-vitals"
 * span so they show up in the performance dashboard.
 *
 * Metrics collected: LCP, INP, CLS, TTFB
 */

import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'

// Persisted in memory for the Settings performance dashboard.
const vitalsStore: Record<string, Metric> = {}

function getVitalsSnapshot(): Record<string, Metric> {
  return { ...vitalsStore }
}

function handleMetric(metric: Metric) {
  vitalsStore[metric.name] = metric

  // Production: report to Sentry as a custom measurement.
  // Dynamic import so Sentry is not bundled into the vitals module in dev.
  import('./sentry').then(({ Sentry }) => {
    Sentry.setMeasurement(
      `web_vitals.${metric.name.toLowerCase()}`,
      metric.value,
      metric.name === 'CLS' ? '' : 'millisecond',
    )
  })
}

let started = false

export function startVitalsReporting() {
  if (started) return
  started = true

  onLCP(handleMetric)
  onINP(handleMetric)
  onCLS(handleMetric)
  onTTFB(handleMetric)
}

export { getVitalsSnapshot }
export type { Metric }
