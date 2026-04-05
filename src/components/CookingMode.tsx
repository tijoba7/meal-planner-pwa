import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, UtensilsCrossed, Timer, Sparkles, Mic, MicOff } from 'lucide-react'
import type { Recipe } from '../types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useAuth } from '../contexts/AuthContext'
import { upsertRating } from '../lib/engagementService'
import StarRating from './ui/StarRating'
import { useVoiceControl } from '../hooks/useVoiceControl'

// Detect time phrases like "10 minutes", "1 hour 30 minutes", "45 seconds"
const TIME_PATTERN =
  /\b(\d+)\s*(hour|hr|h)s?\s*(?:and\s*)?(?:(\d+)\s*(minute|min|m)s?)?|\b(\d+)\s*(minute|min|m)s?|\b(\d+)\s*(second|sec|s)s?\b/gi

interface ParsedTimer {
  label: string
  totalSeconds: number
  startIndex: number
  endIndex: number
}

function parseTimers(text: string): ParsedTimer[] {
  const timers: ParsedTimer[] = []
  const re = new RegExp(TIME_PATTERN.source, 'gi')
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    let totalSeconds = 0
    const label = match[0]

    if (match[1] && match[3]) {
      totalSeconds = parseInt(match[1]) * 3600 + parseInt(match[3]) * 60
    } else if (match[1]) {
      totalSeconds = parseInt(match[1]) * 3600
    } else if (match[5]) {
      totalSeconds = parseInt(match[5]) * 60
    } else if (match[7]) {
      totalSeconds = parseInt(match[7])
    }

    if (totalSeconds > 0 && totalSeconds <= 86400) {
      timers.push({ label, totalSeconds, startIndex: match.index, endIndex: match.index + match[0].length })
    }
  }

  // Deduplicate overlapping matches (keep first)
  const deduped: ParsedTimer[] = []
  for (const t of timers) {
    if (!deduped.some((d) => d.startIndex < t.endIndex && t.startIndex < d.endIndex)) {
      deduped.push(t)
    }
  }
  return deduped
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface ActiveTimer {
  id: string
  label: string
  totalSeconds: number
  remaining: number
  running: boolean
  done: boolean
}

type TimerVoiceAction = 'start_first' | 'pause_all' | null

interface StepTimersProps {
  text: string
  voiceAction: TimerVoiceAction
  onTimerDone: (label: string) => void
}

function StepTimers({ text, voiceAction, onTimerDone }: StepTimersProps) {
  const detectedTimers = parseTimers(text)
  const [timers, setTimers] = useState<ActiveTimer[]>([])
  const onTimerDoneRef = useRef(onTimerDone)
  useEffect(() => { onTimerDoneRef.current = onTimerDone }, [onTimerDone])

  // Reset when step changes
  useEffect(() => {
    setTimers([])
  }, [text])

  // Countdown tick
  useEffect(() => {
    const hasRunning = timers.some((t) => t.running && !t.done)
    if (!hasRunning) return
    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.running || t.done) return t
          const next = t.remaining - 1
          const finished = next <= 0
          if (finished) onTimerDoneRef.current(t.label)
          return { ...t, remaining: Math.max(0, next), done: finished, running: !finished }
        })
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [timers])

  // Voice action handler
  useEffect(() => {
    if (!voiceAction) return
    if (voiceAction === 'start_first') {
      setTimers((prev) => {
        const activeIds = new Set(prev.map((t) => t.id))
        const firstUnstarted = detectedTimers.find((p) => !activeIds.has(`${p.startIndex}-${p.totalSeconds}`))
        if (!firstUnstarted) return prev
        const id = `${firstUnstarted.startIndex}-${firstUnstarted.totalSeconds}`
        return [
          ...prev,
          { id, label: firstUnstarted.label, totalSeconds: firstUnstarted.totalSeconds, remaining: firstUnstarted.totalSeconds, running: true, done: false },
        ]
      })
    } else if (voiceAction === 'pause_all') {
      setTimers((prev) => prev.map((t) => (t.running ? { ...t, running: false } : t)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceAction])

  if (detectedTimers.length === 0) return null

  function startTimer(parsed: ParsedTimer) {
    const id = `${parsed.startIndex}-${parsed.totalSeconds}`
    setTimers((prev) => {
      if (prev.some((t) => t.id === id)) return prev
      return [
        ...prev,
        { id, label: parsed.label, totalSeconds: parsed.totalSeconds, remaining: parsed.totalSeconds, running: true, done: false },
      ]
    })
  }

  function toggleTimer(id: string) {
    setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, running: !t.running } : t)))
  }

  function resetTimer(id: string) {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, remaining: t.totalSeconds, running: false, done: false } : t))
    )
  }

  const activeTimerIds = new Set(timers.map((t) => t.id))

  return (
    <div className="mt-4 space-y-2">
      {detectedTimers.map((parsed) => {
        const id = `${parsed.startIndex}-${parsed.totalSeconds}`
        const active = timers.find((t) => t.id === id)
        return (
          <div key={id} className="flex items-center gap-3">
            {!activeTimerIds.has(id) ? (
              <button
                onClick={() => startTimer(parsed)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                <Timer size={14} strokeWidth={2} aria-hidden="true" />
                Timer for {parsed.label}
              </button>
            ) : active ? (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${active.done ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-800 border-gray-600 text-white'}`}
              >
                <Timer size={14} strokeWidth={2} aria-hidden="true" />
                <span className="font-mono text-base font-semibold min-w-[4ch]">
                  {active.done ? 'Done!' : formatTime(active.remaining)}
                </span>
                {!active.done && (
                  <button
                    onClick={() => toggleTimer(id)}
                    className="text-xs text-gray-300 hover:text-white transition-colors ml-1"
                  >
                    {active.running ? 'Pause' : 'Resume'}
                  </button>
                )}
                <button
                  onClick={() => resetTimer(id)}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// Fallback copy (MEA-220 spec)
const VOICE_ERROR_MESSAGES: Record<string, string> = {
  permission_denied: 'Voice control needs microphone access. Navigate using the buttons or arrow keys.',
  error: 'Voice control encountered an error. Use the buttons or arrow keys to navigate.',
  unsupported: 'Voice control is not supported in this browser. Use the buttons or arrow keys to navigate.',
}

interface CookingModeProps {
  recipe: Recipe
  onClose: () => void
}

export default function CookingMode({ recipe, onClose }: CookingModeProps) {
  const { user } = useAuth()
  const steps = recipe.recipeInstructions
  const [stepIndex, setStepIndex] = useState(0)
  const [repeatKey, setRepeatKey] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const [showRatingPrompt, setShowRatingPrompt] = useState(false)
  const [ratingScore, setRatingScore] = useState<number | null>(null)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [timerVoiceAction, setTimerVoiceAction] = useState<TimerVoiceAction>(null)
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null)
  const voiceFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)

  // Show brief feedback label after a voice command fires
  function showFeedback(text: string) {
    if (voiceFeedbackTimer.current) clearTimeout(voiceFeedbackTimer.current)
    setVoiceFeedback(text)
    voiceFeedbackTimer.current = setTimeout(() => setVoiceFeedback(null), 2000)
  }

  // Voice command handler
  const handleVoiceCommand = useCallback(
    ({ type }: { type: string }) => {
      switch (type) {
        case 'next':
          setStepIndex((i) => Math.min(i + 1, steps.length - 1))
          showFeedback('Next step')
          break
        case 'prev':
          setStepIndex((i) => Math.max(i - 1, 0))
          showFeedback('Previous step')
          break
        case 'repeat':
          setRepeatKey((k) => k + 1)
          showFeedback('Repeating step')
          break
        case 'show_ingredients':
          setShowIngredients(true)
          showFeedback('Showing ingredients')
          break
        case 'hide_ingredients':
          setShowIngredients(false)
          showFeedback('Hiding ingredients')
          break
        case 'start_timer':
          setTimerVoiceAction('start_first')
          showFeedback('Starting timer')
          // Reset so the same command can fire again next step
          setTimeout(() => setTimerVoiceAction(null), 0)
          break
        case 'pause_timer':
          setTimerVoiceAction('pause_all')
          showFeedback('Pausing timer')
          setTimeout(() => setTimerVoiceAction(null), 0)
          break
        case 'exit':
          onClose()
          break
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps.length, onClose]
  )

  const { status: voiceStatus, toggle: toggleVoice } = useVoiceControl({ onCommand: handleVoiceCommand })

  // Request notification permission once (for timer done alerts)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  function handleTimerDone(label: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Timer done — ${label}`, {
        body: `Your ${label} timer is complete!`,
        icon: '/pwa-192x192.png',
        tag: `cooking-timer-${label}`,
      })
    }
  }

  async function handleRate(score: number) {
    setRatingScore(score)
    if (user) {
      await upsertRating(recipe.id, user.id, score)
    }
    setRatingSubmitted(true)
    setTimeout(onClose, 1200)
  }

  const step = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  // Wake Lock
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((lock) => { wakeLockRef.current = lock })
        .catch(() => {})
    }
    return () => { wakeLockRef.current?.release().catch(() => {}) }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setStepIndex((i) => Math.min(i + 1, steps.length - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setStepIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [steps.length, onClose])

  if (!step) return null

  const voiceListening = voiceStatus === 'listening'
  const voiceAvailable = voiceStatus !== 'unsupported'
  const voiceErrorMsg = voiceStatus === 'permission_denied' || voiceStatus === 'error'
    ? VOICE_ERROR_MESSAGES[voiceStatus]
    : null

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-gray-950 text-white z-50 flex flex-col animate-fade-in relative"
      role="dialog"
      aria-modal="true"
      aria-label="Cooking mode"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-medium">
            Step {stepIndex + 1} of {steps.length}
          </span>
          <div className="hidden sm:flex gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${i === stepIndex ? 'bg-green-500' : i < stepIndex ? 'bg-green-800' : 'bg-gray-700'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIngredients((v) => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${showIngredients ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            aria-pressed={showIngredients}
          >
            <UtensilsCrossed size={14} strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Ingredients</span>
          </button>

          {/* Mic toggle — hidden when unsupported */}
          {voiceAvailable && (
            <button
              onClick={toggleVoice}
              aria-label={voiceListening ? 'Stop voice control' : 'Start voice control'}
              aria-pressed={voiceListening}
              title={
                voiceStatus === 'permission_denied'
                  ? VOICE_ERROR_MESSAGES.permission_denied
                  : voiceListening
                  ? 'Voice control active — say "Next", "Back", "Repeat", etc.'
                  : 'Enable voice control'
              }
              className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                voiceStatus === 'permission_denied'
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : voiceListening
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {voiceStatus === 'permission_denied' ? (
                <MicOff size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Mic size={16} strokeWidth={2} aria-hidden="true" />
              )}
              {/* Pulse ring when listening */}
              {voiceListening && (
                <span className="absolute inset-0 rounded-lg animate-pulse bg-green-500/30 pointer-events-none" />
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1.5"
            aria-label="Exit cooking mode"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Voice error banner */}
      {voiceErrorMsg && (
        <div className="px-4 py-2 bg-amber-900/40 border-b border-amber-800/50 text-amber-300 text-xs text-center shrink-0">
          {voiceErrorMsg}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step content */}
        <div className="flex-1 flex flex-col justify-center px-6 py-8 overflow-y-auto">
          <div key={`${stepIndex}-${repeatKey}`} className="max-w-2xl mx-auto w-full animate-fade-in-up">
            {/* Step badge */}
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-10 h-10 bg-green-700 text-white rounded-full text-lg font-bold">
                {stepIndex + 1}
              </span>
            </div>

            {/* Step text */}
            <p className="text-2xl sm:text-3xl leading-relaxed text-gray-100 font-light">
              {step.text}
            </p>

            {/* Timers */}
            <StepTimers
              text={step.text}
              voiceAction={timerVoiceAction}
              onTimerDone={handleTimerDone}
            />

            {/* Navigation hint — visible on first step only */}
            {isFirst && steps.length > 1 && (
              <p className="mt-8 text-xs text-gray-600 select-none">
                Swipe or use arrow keys to move between steps
                {voiceAvailable && ' · Say "Next" or "Back" for hands-free'}
              </p>
            )}
          </div>
        </div>

        {/* Ingredients panel */}
        {showIngredients && (
          <div className="w-64 shrink-0 border-l border-gray-800 overflow-y-auto bg-gray-900 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-semibold text-gray-200">Ingredients</p>
            </div>
            <ul className="p-4 space-y-2 flex-1 overflow-y-auto">
              {recipe.recipeIngredient.map((ing, i) => (
                <li key={i} className="text-sm text-gray-300 leading-snug">
                  <span className="font-medium text-white">
                    {ing.amount > 0
                      ? `${ing.amount % 1 === 0 ? ing.amount : ing.amount} ${ing.unit}`.trim()
                      : ing.unit || ''}
                  </span>{' '}
                  {ing.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 shrink-0">
        <div
          className="h-1 bg-green-500 transition-all duration-300"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Voice feedback toast */}
      {voiceFeedback && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-800/90 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none animate-fade-in-up z-20">
          <Mic size={13} strokeWidth={2} aria-hidden="true" className="text-green-400 shrink-0" />
          {voiceFeedback}
        </div>
      )}

      {/* Rating prompt overlay */}
      {showRatingPrompt && (
        <div className="absolute inset-0 bg-gray-950/90 flex items-center justify-center z-10 animate-fade-in">
          <div className="bg-gray-900 rounded-2xl p-8 mx-4 w-full max-w-sm text-center shadow-2xl">
            {ratingSubmitted ? (
              <div className="py-4">
                <div className="flex justify-center mb-2">
                  <Sparkles size={32} className="text-green-400" aria-hidden="true" />
                </div>
                <p className="text-white font-semibold text-lg">Thanks for rating!</p>
                <StarRating value={ratingScore} readOnly size="lg" />
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-1">
                  <UtensilsCrossed size={28} className="text-gray-300" aria-hidden="true" />
                </div>
                <h3 className="text-white font-bold text-xl mb-1">How was it?</h3>
                <p className="text-gray-400 text-sm mb-6">Rate {recipe.name}</p>
                <div className="flex justify-center mb-6">
                  <StarRating value={ratingScore} onChange={handleRate} size="lg" />
                </div>
                <button
                  onClick={onClose}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Skip
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-gray-800 shrink-0">
        <button
          onClick={() => setStepIndex((i) => Math.max(i - 1, 0))}
          disabled={isFirst}
          aria-label="Previous step"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="text-sm text-gray-500 sm:hidden">
          {stepIndex + 1} / {steps.length}
        </div>

        {isLast ? (
          <button
            onClick={() => setShowRatingPrompt(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white transition-colors font-medium"
          >
            Finish
          </button>
        ) : (
          <button
            onClick={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))}
            aria-label="Next step"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white transition-colors font-medium"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
