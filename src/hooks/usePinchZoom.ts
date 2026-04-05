import { useRef, useEffect, useCallback } from 'react'

interface PinchZoomOptions {
  minScale?: number
  maxScale?: number
}

/**
 * Adds pinch-to-zoom to an element ref.
 * Progressive enhancement — the element remains fully usable without touch.
 *
 * Returns a ref to attach to the container element.
 *
 * @example
 * const imgRef = usePinchZoom()
 * <img ref={imgRef} ... />
 */
export function usePinchZoom<T extends HTMLElement>({
  minScale = 1,
  maxScale = 4,
}: PinchZoomOptions = {}) {
  const ref = useRef<T>(null)
  const scale = useRef(1)
  const originX = useRef(0)
  const originY = useRef(0)
  const translateX = useRef(0)
  const translateY = useRef(0)
  const lastDist = useRef<number | null>(null)
  const lastMidX = useRef(0)
  const lastMidY = useRef(0)
  // Track whether we're in a pinch gesture (2 fingers)
  const pinching = useRef(false)

  const applyTransform = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = `translate(${translateX.current}px, ${translateY.current}px) scale(${scale.current})`
    el.style.transformOrigin = `${originX.current}px ${originY.current}px`
  }, [])

  const resetTransform = useCallback(() => {
    scale.current = 1
    translateX.current = 0
    translateY.current = 0
    originX.current = 0
    originY.current = 0
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.25s ease'
    el.style.transform = 'translate(0, 0) scale(1)'
    setTimeout(() => {
      if (el) el.style.transition = ''
    }, 260)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    // Capture as non-null so closures below preserve the type
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const el = ref.current!

    function dist(a: Touch, b: Touch) {
      const dx = a.clientX - b.clientX
      const dy = a.clientY - b.clientY
      return Math.hypot(dx, dy)
    }

    function midpoint(a: Touch, b: Touch) {
      return {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      }
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        pinching.current = true
        const d = dist(e.touches[0], e.touches[1])
        lastDist.current = d
        const mid = midpoint(e.touches[0], e.touches[1])
        const rect = el.getBoundingClientRect()
        lastMidX.current = mid.x - rect.left
        lastMidY.current = mid.y - rect.top
        originX.current = lastMidX.current
        originY.current = lastMidY.current
      } else if (e.touches.length === 1 && scale.current === 1) {
        pinching.current = false
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!pinching.current || e.touches.length !== 2) return
      e.preventDefault()

      const d = dist(e.touches[0], e.touches[1])
      const prev = lastDist.current ?? d
      const ratio = d / prev

      scale.current = Math.min(maxScale, Math.max(minScale, scale.current * ratio))
      lastDist.current = d

      const mid = midpoint(e.touches[0], e.touches[1])
      const rect = el.getBoundingClientRect()
      const midX = mid.x - rect.left
      const midY = mid.y - rect.top

      // Pan along with the pinch midpoint
      translateX.current += midX - lastMidX.current
      translateY.current += midY - lastMidY.current
      lastMidX.current = midX
      lastMidY.current = midY

      applyTransform()
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        pinching.current = false
        lastDist.current = null
        // Snap back to 1× if below threshold
        if (scale.current < 1.05) {
          resetTransform()
        }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [minScale, maxScale, applyTransform, resetTransform])

  return ref
}
