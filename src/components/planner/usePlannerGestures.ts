import { useState, useRef, useEffect, useCallback } from 'react'

// ── Pull-to-refresh ───────────────────────────────────────────────────────────

export function usePullToRefresh(onRefresh: () => void) {
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState(0) // 0–1
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const THRESHOLD = 72

  const handleRefresh = useCallback(() => {
    onRefresh()
  }, [onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      setPulling(false)
      setPullProgress(0)
      progressRef.current = 0
    }

    function onTouchMove(e: TouchEvent) {
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) return
      const progress = Math.min(dy / THRESHOLD, 1)
      progressRef.current = progress
      setPulling(true)
      setPullProgress(progress)
    }

    function onTouchEnd() {
      if (progressRef.current >= 1) handleRefresh()
      setPulling(false)
      setPullProgress(0)
      progressRef.current = 0
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleRefresh])

  return { pulling, pullProgress, containerRef }
}

// ── Swipe between weeks ───────────────────────────────────────────────────────

export function useSwipeWeek(onSwipe: (delta: -1 | 1) => void) {
  const startX = useRef(0)
  const startY = useRef(0)
  const ref = useRef<HTMLDivElement>(null)
  const axisLocked = useRef<'h' | 'v' | null>(null)
  const cb = useCallback(
    (delta: -1 | 1) => {
      onSwipe(delta)
    },
    [onSwipe]
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      axisLocked.current = null
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - startX.current
      const dy = e.touches[0].clientY - startY.current
      if (!axisLocked.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (axisLocked.current !== 'h') return
      const dx = e.changedTouches[0].clientX - startX.current
      if (Math.abs(dx) > 60) cb(dx < 0 ? 1 : -1)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [cb])

  return ref
}
