import { describe, it, expect, afterEach, vi } from 'vitest'
import { formatDistanceToNow } from './formatDate'

const NOW = new Date('2026-07-01T12:00:00.000Z').getTime()

function ago(ms: number): Date {
  return new Date(NOW - ms)
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatDistanceToNow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function freeze() {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  }

  it('shows "just now" for sub-minute differences', () => {
    freeze()
    expect(formatDistanceToNow(ago(5 * SEC))).toBe('just now')
    expect(formatDistanceToNow(ago(59 * SEC))).toBe('just now')
  })

  it('shows minutes for sub-hour differences', () => {
    freeze()
    expect(formatDistanceToNow(ago(1 * MIN))).toBe('1m ago')
    expect(formatDistanceToNow(ago(59 * MIN))).toBe('59m ago')
  })

  it('shows hours for sub-day differences', () => {
    freeze()
    expect(formatDistanceToNow(ago(1 * HOUR))).toBe('1h ago')
    expect(formatDistanceToNow(ago(23 * HOUR))).toBe('23h ago')
  })

  it('shows "yesterday" for exactly one day', () => {
    freeze()
    expect(formatDistanceToNow(ago(DAY))).toBe('yesterday')
  })

  it('shows day counts within the past week', () => {
    freeze()
    expect(formatDistanceToNow(ago(3 * DAY))).toBe('3d ago')
    expect(formatDistanceToNow(ago(6 * DAY))).toBe('6d ago')
  })

  it('falls back to a localized date for older timestamps', () => {
    freeze()
    const result = formatDistanceToNow(ago(30 * DAY))
    expect(result).not.toMatch(/ago|just now|yesterday/)
    expect(result.length).toBeGreaterThan(0)
  })
})
