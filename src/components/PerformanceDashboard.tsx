/**
 * PerformanceDashboard
 *
 * Shows the last-measured Core Web Vitals in the Settings > About section.
 * Ratings use the same thresholds as web-vitals (good / needs improvement / poor).
 */

import { useEffect, useState } from 'react'
import { getVitalsSnapshot } from '../lib/vitals'
import type { Metric } from '../lib/vitals'

interface VitalRow {
  name: string
  label: string
  unit: string
  goodThreshold: number
  needsImprovementThreshold: number
}

const VITAL_META: VitalRow[] = [
  {
    name: 'LCP',
    label: 'Largest Contentful Paint',
    unit: 'ms',
    goodThreshold: 2500,
    needsImprovementThreshold: 4000,
  },
  {
    name: 'INP',
    label: 'Interaction to Next Paint',
    unit: 'ms',
    goodThreshold: 200,
    needsImprovementThreshold: 500,
  },
  {
    name: 'CLS',
    label: 'Cumulative Layout Shift',
    unit: '',
    goodThreshold: 0.1,
    needsImprovementThreshold: 0.25,
  },
  {
    name: 'TTFB',
    label: 'Time to First Byte',
    unit: 'ms',
    goodThreshold: 800,
    needsImprovementThreshold: 1800,
  },
]

function ratingColor(rating: Metric['rating']) {
  if (rating === 'good') return 'text-green-600 dark:text-green-400'
  if (rating === 'needs-improvement') return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function formatValue(name: string, value: number) {
  if (name === 'CLS') return value.toFixed(3)
  return `${Math.round(value)} ms`
}

export default function PerformanceDashboard() {
  const [vitals, setVitals] = useState<Record<string, Metric>>({})

  useEffect(() => {
    // Poll for new vitals every second (they arrive asynchronously as user interacts).
    const interval = setInterval(() => {
      const snapshot = getVitalsSnapshot()
      if (Object.keys(snapshot).length > 0) {
        setVitals({ ...snapshot })
      }
    }, 1000)

    // Initial read
    setVitals(getVitalsSnapshot())
    return () => clearInterval(interval)
  }, [])

  const measured = VITAL_META.filter((m) => vitals[m.name])

  if (measured.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Interact with the app to measure Core Web Vitals.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {measured.map((meta) => {
        const metric = vitals[meta.name]!
        return (
          <div key={meta.name} className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400" title={meta.label}>
              {meta.name}
            </span>
            <span className={`font-mono font-medium ${ratingColor(metric.rating)}`}>
              {formatValue(meta.name, metric.value)}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Measured this session</p>
    </div>
  )
}
