import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { usePullToRefresh, useSwipeWeek } from './usePlannerGestures'

type TouchPoint = { clientX: number; clientY: number }

function dispatchTouch(
  target: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  {
    touches = [],
    changedTouches = [],
  }: {
    touches?: TouchPoint[]
    changedTouches?: TouchPoint[]
  }
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: touches,
    configurable: true,
  })
  Object.defineProperty(event, 'changedTouches', {
    value: changedTouches,
    configurable: true,
  })
  target.dispatchEvent(event)
}

function PullToRefreshHarness({ onRefresh }: { onRefresh: () => void }) {
  const { pulling, pullProgress, containerRef } = usePullToRefresh(onRefresh)

  return (
    <div
      ref={containerRef}
      data-testid="pull-zone"
      data-pulling={pulling ? 'true' : 'false'}
      data-progress={String(pullProgress)}
    />
  )
}

function SwipeWeekHarness({ onSwipe }: { onSwipe: (delta: -1 | 1) => void }) {
  const ref = useSwipeWeek(onSwipe)
  return <div ref={ref} data-testid="swipe-zone" />
}

describe('usePullToRefresh', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
      configurable: true,
    })
  })

  it('triggers refresh after a downward pull above threshold', async () => {
    const onRefresh = vi.fn()
    render(<PullToRefreshHarness onRefresh={onRefresh} />)
    const zone = screen.getByTestId('pull-zone')

    act(() => {
      dispatchTouch(zone, 'touchstart', { touches: [{ clientX: 0, clientY: 100 }] })
      dispatchTouch(zone, 'touchmove', { touches: [{ clientX: 0, clientY: 190 }] })
    })

    await waitFor(() => {
      expect(zone).toHaveAttribute('data-pulling', 'true')
      expect(Number(zone.getAttribute('data-progress'))).toBeGreaterThanOrEqual(1)
    })

    act(() => {
      dispatchTouch(zone, 'touchend', {
        changedTouches: [{ clientX: 0, clientY: 190 }],
      })
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(zone).toHaveAttribute('data-pulling', 'false')
      expect(zone).toHaveAttribute('data-progress', '0')
    })
  })

  it('does not trigger refresh when page is scrolled', () => {
    Object.defineProperty(window, 'scrollY', {
      value: 24,
      writable: true,
      configurable: true,
    })

    const onRefresh = vi.fn()
    render(<PullToRefreshHarness onRefresh={onRefresh} />)
    const zone = screen.getByTestId('pull-zone')

    act(() => {
      dispatchTouch(zone, 'touchstart', { touches: [{ clientX: 0, clientY: 100 }] })
      dispatchTouch(zone, 'touchmove', { touches: [{ clientX: 0, clientY: 220 }] })
      dispatchTouch(zone, 'touchend', {
        changedTouches: [{ clientX: 0, clientY: 220 }],
      })
    })

    expect(onRefresh).not.toHaveBeenCalled()
  })
})

describe('useSwipeWeek', () => {
  it('calls onSwipe(1) for a left swipe', () => {
    const onSwipe = vi.fn()
    render(<SwipeWeekHarness onSwipe={onSwipe} />)
    const zone = screen.getByTestId('swipe-zone')

    act(() => {
      dispatchTouch(zone, 'touchstart', { touches: [{ clientX: 200, clientY: 100 }] })
      dispatchTouch(zone, 'touchmove', { touches: [{ clientX: 120, clientY: 102 }] })
      dispatchTouch(zone, 'touchend', {
        changedTouches: [{ clientX: 120, clientY: 102 }],
      })
    })

    expect(onSwipe).toHaveBeenCalledWith(1)
    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('ignores vertical swipes', () => {
    const onSwipe = vi.fn()
    render(<SwipeWeekHarness onSwipe={onSwipe} />)
    const zone = screen.getByTestId('swipe-zone')

    act(() => {
      dispatchTouch(zone, 'touchstart', { touches: [{ clientX: 100, clientY: 200 }] })
      dispatchTouch(zone, 'touchmove', { touches: [{ clientX: 96, clientY: 110 }] })
      dispatchTouch(zone, 'touchend', {
        changedTouches: [{ clientX: 96, clientY: 110 }],
      })
    })

    expect(onSwipe).not.toHaveBeenCalled()
  })
})
