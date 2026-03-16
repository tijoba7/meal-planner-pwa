/**
 * Push notification utilities for Mise.
 *
 * Handles:
 *  - Requesting notification permission
 *  - Subscribing the browser to a push endpoint via VAPID
 *  - Serialising the subscription for upload to the backend
 *
 * The VAPID public key must be set via VITE_VAPID_PUBLIC_KEY.
 * If it is absent the app still works; push features are simply unavailable.
 *
 * Server-side setup:
 *   Generate a VAPID key pair once with `npx web-push generate-vapid-keys`.
 *   Store the private key on your push server / Supabase Edge Function.
 *   Store the public key as VITE_VAPID_PUBLIC_KEY in the environment.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Convert a base64url VAPID public key to a Uint8Array for the Web Push API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

/** True when the current environment supports push notifications. */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

/** Current Notification permission state. */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

/**
 * Subscribe the browser to push notifications.
 *
 * Returns the serialised PushSubscription that should be sent to your server
 * to enable server-initiated pushes, or null when:
 *   - Push is not supported (missing VAPID key or browser support)
 *   - The user has denied notifications
 *   - The service worker is not yet registered
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return null

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return null

  try {
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing

    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Uint8Array satisfies BufferSource at runtime but TypeScript's DOM types do not
      // expose this relationship directly — the double cast is the SDK-required workaround.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    })
  } catch {
    return null
  }
}

/**
 * Unsubscribe the browser from push notifications.
 * Returns true on success, false if there was no subscription or it failed.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false
    return subscription.unsubscribe()
  } catch {
    return false
  }
}
