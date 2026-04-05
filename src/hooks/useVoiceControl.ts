import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceStatus = 'unsupported' | 'idle' | 'listening' | 'permission_denied' | 'error'

export type VoiceCommandType =
  | 'next'
  | 'prev'
  | 'repeat'
  | 'show_ingredients'
  | 'hide_ingredients'
  | 'start_timer'
  | 'pause_timer'
  | 'exit'

export interface VoiceCommand {
  type: VoiceCommandType
}

interface UseVoiceControlOptions {
  onCommand: (cmd: VoiceCommand) => void
}

interface SpeechRecognitionResultLike {
  0: { transcript: string }
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultLike[]
}

interface SpeechRecognitionErrorEventLike {
  error: string
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

// Voice command vocabulary (MEA-220 spec). Longer phrases first within each
// command so the includes() check prefers specific matches over substrings.
const COMMANDS: { type: VoiceCommandType; phrases: string[] }[] = [
  { type: 'next', phrases: ['next step', 'go forward', 'continue', 'next'] },
  { type: 'prev', phrases: ['previous step', 'go back', 'previous', 'back'] },
  { type: 'repeat', phrases: ['say again', 'repeat'] },
  { type: 'show_ingredients', phrases: ['show ingredients', 'ingredients'] },
  { type: 'hide_ingredients', phrases: ['hide ingredients', 'close ingredients'] },
  { type: 'start_timer', phrases: ['start timer', 'set timer'] },
  { type: 'pause_timer', phrases: ['pause timer', 'pause'] },
  { type: 'exit', phrases: ['stop cooking', 'exit', 'done'] },
]

function matchCommand(transcript: string): VoiceCommandType | null {
  const normalized = transcript.toLowerCase().trim()
  for (const cmd of COMMANDS) {
    for (const phrase of cmd.phrases) {
      if (normalized === phrase || normalized.includes(phrase)) {
        return cmd.type
      }
    }
  }
  return null
}

export function useVoiceControl({ onCommand }: UseVoiceControlOptions) {
  const speechWindow = typeof window !== 'undefined' ? (window as SpeechRecognitionWindow) : null
  const speechRecognitionClass =
    speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition ?? null

  const [status, setStatus] = useState<VoiceStatus>(speechRecognitionClass ? 'idle' : 'unsupported')
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const enabledRef = useRef(false)
  const onCommandRef = useRef(onCommand)

  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  const stop = useCallback(() => {
    enabledRef.current = false
    recognitionRef.current?.stop()
    setStatus('idle')
    setLastTranscript(null)
  }, [])

  const start = useCallback(() => {
    if (!speechRecognitionClass) return

    const recognition = new speechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => setStatus('listening')

    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      const transcript = (e.results[e.results.length - 1][0].transcript as string).trim()
      setLastTranscript(transcript)
      const type = matchCommand(transcript)
      if (type) {
        onCommandRef.current({ type })
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      if (e.error === 'not-allowed') {
        enabledRef.current = false
        setStatus('permission_denied')
      } else if (e.error !== 'no-speech') {
        // no-speech is normal between commands — not an error
        setStatus('error')
      }
    }

    recognition.onend = () => {
      if (enabledRef.current) {
        // Auto-restart to maintain hands-free continuous listening
        try {
          recognition.start()
        } catch {
          /* recognition already started */
        }
      } else {
        setStatus('idle')
      }
    }

    recognitionRef.current = recognition
    enabledRef.current = true
    try {
      recognition.start()
    } catch {
      setStatus('error')
    }
  }, [speechRecognitionClass])

  const toggle = useCallback(() => {
    if (status === 'unsupported') return
    if (status === 'listening') {
      stop()
    } else {
      start()
    }
  }, [status, start, stop])

  // Release recognition on unmount
  useEffect(() => {
    return () => {
      enabledRef.current = false
      recognitionRef.current?.stop()
    }
  }, [])

  return { status, lastTranscript, toggle }
}
