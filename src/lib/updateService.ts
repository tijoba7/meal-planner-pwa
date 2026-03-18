/**
 * Update check service — compares local version against GitHub releases.
 */

const GITHUB_REPO = 'tijoba7/meal-planner-pwa'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

export const APP_VERSION = __APP_VERSION__

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  releaseUrl: string | null
  releaseNotes: string | null
  publishedAt: string | null
  error: string | null
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const base: UpdateInfo = {
    currentVersion: APP_VERSION,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
    releaseNotes: null,
    publishedAt: null,
    error: null,
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      if (res.status === 404) {
        return { ...base, error: 'No releases published yet.' }
      }
      return { ...base, error: `GitHub API returned ${res.status}` }
    }

    const data = await res.json()
    const latestTag: string = data.tag_name ?? ''
    const latestVersion = latestTag.replace(/^v/, '')

    return {
      ...base,
      latestVersion,
      updateAvailable: latestVersion !== APP_VERSION && latestVersion > APP_VERSION,
      releaseUrl: data.html_url ?? null,
      releaseNotes: data.body ?? null,
      publishedAt: data.published_at ?? null,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ...base, error: `Failed to check for updates: ${msg}` }
  }
}
