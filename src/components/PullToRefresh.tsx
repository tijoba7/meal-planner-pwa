import { useState, useRef } from 'react'

const PULL_THRESHOLD = 80

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void
  children: React.ReactNode
}

/**
 * Wraps children with pull-to-refresh gesture support.
 * Shows a circular progress indicator while pulling and a spinner while refreshing.
 * Only activates when the page is scrolled to the top (scrollY === 0).
 */
export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDelta, setPullDelta] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const pulling = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
    pulling.current = true
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!pulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      setPullDelta(Math.min(delta, PULL_THRESHOLD * 1.5))
    }
  }

  async function handleTouchEnd() {
    if (!pulling.current) return
    pulling.current = false
    if (pullDelta >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDelta(PULL_THRESHOLD)
      await onRefresh()
      setRefreshing(false)
    }
    setPullDelta(0)
  }

  const indicatorOffset = Math.min(pullDelta, PULL_THRESHOLD)
  const progress = pullDelta / PULL_THRESHOLD
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference * Math.min(progress, 1)

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDelta > 0 || refreshing) && (
        <div
          className="flex justify-center overflow-hidden"
          style={{ height: indicatorOffset }}
          aria-hidden="true"
        >
          <div
            className="flex items-center justify-center w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md"
            style={{ marginTop: Math.max(0, indicatorOffset - 36) }}
          >
            {refreshing ? (
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" className="text-green-600">
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - strokeDash}
                  strokeLinecap="round"
                  transform="rotate(-90 12 12)"
                />
              </svg>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
