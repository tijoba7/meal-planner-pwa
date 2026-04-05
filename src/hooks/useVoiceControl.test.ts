import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVoiceControl } from './useVoiceControl'

type SpeechWindow = Window & {
  SpeechRecognition?: new () => MockRecognition
  webkitSpeechRecognition?: new () => MockRecognition
}

interface MockRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  emitResult: (transcript: string) => void
  emitError: (error: string) => void
  emitEnd: () => void
}

const speechWindow = window as SpeechWindow
const originalSpeechRecognition = speechWindow.SpeechRecognition
const originalWebkitSpeechRecognition = speechWindow.webkitSpeechRecognition

function installSpeechRecognitionMock() {
  const instances: MockRecognition[] = []

  const MockSpeechRecognition = vi.fn(function (this: MockRecognition) {
    this.continuous = false
    this.interimResults = false
    this.lang = 'en-US'
    this.onstart = null
    this.onresult = null
    this.onerror = null
    this.onend = null

    this.start = vi.fn(() => {
      this.onstart?.()
    })

    this.stop = vi.fn(() => {
      this.onend?.()
    })

    this.emitResult = (transcript: string) => {
      this.onresult?.({ results: [[{ transcript }]] })
    }

    this.emitError = (error: string) => {
      this.onerror?.({ error })
    }

    this.emitEnd = () => {
      this.onend?.()
    }

    instances.push(this)
  })

  speechWindow.SpeechRecognition = MockSpeechRecognition as unknown as new () => MockRecognition
  speechWindow.webkitSpeechRecognition = undefined

  return { instances, MockSpeechRecognition }
}

describe('useVoiceControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speechWindow.SpeechRecognition = undefined
    speechWindow.webkitSpeechRecognition = undefined
  })

  afterEach(() => {
    speechWindow.SpeechRecognition = originalSpeechRecognition
    speechWindow.webkitSpeechRecognition = originalWebkitSpeechRecognition
  })

  it('returns unsupported when SpeechRecognition is unavailable', () => {
    const onCommand = vi.fn()
    const { result } = renderHook(() => useVoiceControl({ onCommand }))

    expect(result.current.status).toBe('unsupported')

    act(() => {
      result.current.toggle()
    })

    expect(result.current.status).toBe('unsupported')
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('starts listening and emits command events from transcript matches', async () => {
    const { instances, MockSpeechRecognition } = installSpeechRecognitionMock()
    const onCommand = vi.fn()

    const { result } = renderHook(() => useVoiceControl({ onCommand }))

    act(() => {
      result.current.toggle()
    })

    await waitFor(() => expect(result.current.status).toBe('listening'))
    expect(MockSpeechRecognition).toHaveBeenCalledTimes(1)
    expect(instances).toHaveLength(1)

    act(() => {
      instances[0].emitResult('please go forward to the next instruction')
    })

    await waitFor(() => {
      expect(onCommand).toHaveBeenCalledWith({ type: 'next' })
    })
    expect(result.current.lastTranscript).toBe('please go forward to the next instruction')
  })

  it('handles permission-denied errors from the browser API', async () => {
    const { instances } = installSpeechRecognitionMock()
    const onCommand = vi.fn()

    const { result } = renderHook(() => useVoiceControl({ onCommand }))

    act(() => {
      result.current.toggle()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))

    act(() => {
      instances[0].emitError('not-allowed')
    })

    await waitFor(() => expect(result.current.status).toBe('permission_denied'))
  })

  it('auto-restarts recognition when listening and the session ends', async () => {
    const { instances } = installSpeechRecognitionMock()
    const onCommand = vi.fn()

    const { result } = renderHook(() => useVoiceControl({ onCommand }))

    act(() => {
      result.current.toggle()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))

    act(() => {
      instances[0].emitEnd()
    })

    expect(instances[0].start).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('listening')
  })

  it('stops listening and clears transcript when toggled off', async () => {
    const { instances } = installSpeechRecognitionMock()
    const onCommand = vi.fn()

    const { result } = renderHook(() => useVoiceControl({ onCommand }))

    act(() => {
      result.current.toggle()
    })
    await waitFor(() => expect(result.current.status).toBe('listening'))

    act(() => {
      instances[0].emitResult('repeat')
    })
    await waitFor(() => expect(result.current.lastTranscript).toBe('repeat'))

    act(() => {
      result.current.toggle()
    })

    expect(instances[0].stop).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('idle')
    expect(result.current.lastTranscript).toBe(null)
  })
})
