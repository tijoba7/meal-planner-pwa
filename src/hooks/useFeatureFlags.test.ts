import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/appSettingsService', () => ({
  APP_SETTING_KEYS: {
    FEATURES_SOCIAL: 'features.social',
    FEATURES_GROUPS: 'features.groups',
    FEATURES_DISCOVER: 'features.discover',
    SCRAPING_API_KEY: 'scraping.api_key',
    SCRAPING_PROVIDER: 'scraping.provider',
    SCRAPING_MODEL: 'scraping.model',
    SCRAPING_RATE_LIMIT: 'scraping.rate_limit',
    DEFAULTS_DIETARY: 'defaults.dietary_preferences',
    DEFAULTS_NOTIF_PUSH: 'defaults.notifications.push_enabled',
    DEFAULTS_NOTIF_REMINDERS: 'defaults.notifications.meal_plan_reminders',
  },
  getAppSettingBoolean: vi.fn(),
}))

import { FeatureFlagsProvider, useFeatureFlags } from './useFeatureFlags'
import { getAppSettingBoolean } from '../lib/appSettingsService'

const mockGetSetting = vi.mocked(getAppSettingBoolean)

function wrapper({ children }: { children: ReactNode }) {
  return createElement(FeatureFlagsProvider, null, children)
}

beforeEach(() => {
  mockGetSetting.mockReset()
})

// ─── useFeatureFlags ──────────────────────────────────────────────────────────

describe('useFeatureFlags', () => {
  it('returns all flags as true before settings have loaded', () => {
    // Promise that never resolves — flags stay at default
    mockGetSetting.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })
    expect(result.current).toEqual({ social: true, groups: true, discover: true })
  })

  it('applies loaded flags from appSettingsService', async () => {
    mockGetSetting
      .mockResolvedValueOnce(false) // features.social
      .mockResolvedValueOnce(true)  // features.groups
      .mockResolvedValueOnce(false) // features.discover

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    await waitFor(() => expect(result.current.social).toBe(false))
    expect(result.current).toEqual({ social: false, groups: true, discover: false })
  })

  it('defaults to true when a setting returns null (not configured by admin)', async () => {
    mockGetSetting.mockResolvedValue(null)

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    await waitFor(() => expect(mockGetSetting).toHaveBeenCalledTimes(3))
    expect(result.current).toEqual({ social: true, groups: true, discover: true })
  })

  it('keeps all-enabled defaults when appSettingsService throws', async () => {
    mockGetSetting.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    // Allow the rejected promise to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(result.current).toEqual({ social: true, groups: true, discover: true })
  })

  it('can disable all three flags independently', async () => {
    mockGetSetting
      .mockResolvedValueOnce(false) // social
      .mockResolvedValueOnce(false) // groups
      .mockResolvedValueOnce(false) // discover

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    await waitFor(() => expect(result.current.discover).toBe(false))
    expect(result.current).toEqual({ social: false, groups: false, discover: false })
  })

  it('enables all flags when all settings return true', async () => {
    mockGetSetting.mockResolvedValue(true)

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    await waitFor(() => expect(mockGetSetting).toHaveBeenCalledTimes(3))
    expect(result.current).toEqual({ social: true, groups: true, discover: true })
  })
})
