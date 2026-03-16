import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'mise_install_dismissed'
const VISIT_KEY = 'mise_visit_count'
const MIN_VISITS = 2

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canShow, setCanShow] = useState(false)

  useEffect(() => {
    // Increment visit count on mount (each new session counts as a visit)
    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true'
    if (dismissed || visits < MIN_VISITS) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setCanShow(false)
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setCanShow(false)
  }

  return { canShow, install, dismiss }
}
