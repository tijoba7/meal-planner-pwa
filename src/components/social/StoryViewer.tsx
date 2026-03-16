import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChefHat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '../ProfileCard'
import type { UserStoryGroup } from '../../lib/storiesService'

const STORY_DURATION = 5000 // ms

interface StoryViewerProps {
  groups: UserStoryGroup[]
  initialGroupIndex?: number
  onClose: () => void
  onStoryViewed?: (storyId: string) => void
}

/**
 * Full-screen story viewer overlay.
 *
 * - Tap left/right (or arrow keys) to navigate within a user's stories
 * - Swipe left/right to move between users
 * - Auto-advances after STORY_DURATION ms
 * - Closes when all stories have been viewed
 */
export default function StoryViewer({
  groups,
  initialGroupIndex = 0,
  onClose,
  onStoryViewed,
}: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex)
  const [storyIdx, setStoryIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  const progressRef = useRef(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  // Prevent container onClick from double-firing after a touch event
  const touchHandled = useRef(false)

  const group = groups[groupIdx]
  const story = group?.stories[storyIdx]

  // ── Navigation ────────────────────────────────────────────────────────────

  const resetProgress = () => {
    progressRef.current = 0
    setProgress(0)
  }

  const goNext = useCallback(() => {
    resetProgress()
    setStoryIdx((si) => {
      const nextSi = si + 1
      if (nextSi < (groups[groupIdx]?.stories.length ?? 0)) return nextSi
      // Advance to next group
      setGroupIdx((gi) => {
        const nextGi = gi + 1
        if (nextGi < groups.length) return nextGi
        // All groups exhausted — close
        onClose()
        return gi
      })
      return 0
    })
  }, [groupIdx, groups, onClose])

  const goPrev = useCallback(() => {
    resetProgress()
    setStoryIdx((si) => {
      if (si > 0) return si - 1
      // Go to previous group's last story
      setGroupIdx((gi) => {
        if (gi > 0) {
          const prevGroup = groups[gi - 1]
          // We set storyIdx to last story of prev group after groupIdx updates
          setTimeout(() => setStoryIdx(prevGroup.stories.length - 1), 0)
          return gi - 1
        }
        return gi
      })
      return si
    })
  }, [groups])

  const goNextGroup = useCallback(() => {
    resetProgress()
    setGroupIdx((gi) => {
      if (gi < groups.length - 1) return gi + 1
      onClose()
      return gi
    })
    setStoryIdx(0)
  }, [groups.length, onClose])

  const goPrevGroup = useCallback(() => {
    resetProgress()
    setGroupIdx((gi) => (gi > 0 ? gi - 1 : gi))
    setStoryIdx(0)
  }, [])

  // Reset story index when group changes
  useEffect(() => {
    setStoryIdx(0)
    resetProgress()
  }, [groupIdx])

  // ── Auto-advance timer ────────────────────────────────────────────────────

  useEffect(() => {
    if (!story) return
    const TICK = 50
    const interval = setInterval(() => {
      progressRef.current += TICK / STORY_DURATION
      if (progressRef.current >= 1) {
        progressRef.current = 1
        goNext()
      } else {
        setProgress(progressRef.current)
      }
    }, TICK)
    return () => clearInterval(interval)
  }, [story, goNext])

  // ── Notify viewed ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (story?.id) onStoryViewed?.(story.id)
  }, [story?.id, onStoryViewed])

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  // ── Touch / pointer handling ──────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dx > 10 && dx > dy) isSwiping.current = true
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)

    touchHandled.current = true
    setTimeout(() => {
      touchHandled.current = false
    }, 500)

    if (isSwiping.current && Math.abs(dx) > 50 && Math.abs(dx) > dy) {
      if (dx < 0) goNextGroup()
      else goPrevGroup()
    } else if (!isSwiping.current) {
      // Tap — navigate within the current group
      const x = e.changedTouches[0].clientX
      if (x < window.innerWidth / 2) goPrev()
      else goNext()
    }
    isSwiping.current = false
  }

  // Desktop click tap navigation (suppressed on touch devices via touchHandled flag)
  function handleContainerClick(e: React.MouseEvent) {
    if (touchHandled.current) return
    if ((e.target as Element).closest('button, a')) return
    const x = e.clientX
    if (x < window.innerWidth / 2) goPrev()
    else goNext()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!group || !story) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${group.profile.display_name}'s story`}
    >
      <div
        className="relative w-full h-full max-w-lg mx-auto overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleContainerClick}
      >
        {/* Media */}
        <img
          key={story.id}
          src={story.media_url}
          alt={story.caption ?? `${group.profile.display_name}'s story`}
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Progress bars */}
        <div
          className="absolute top-0 inset-x-0 flex gap-1 px-2 pt-3 pointer-events-none"
          aria-hidden="true"
        >
          {group.stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 bg-white/30 overflow-hidden rounded-full">
              <div
                className="h-full bg-white"
                style={{
                  width:
                    i < storyIdx ? '100%' : i === storyIdx ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Author row */}
        <div className="absolute top-7 inset-x-0 flex items-center gap-3 px-4 pointer-events-none">
          <Link
            to={`/users/${group.userId}`}
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="pointer-events-auto shrink-0"
          >
            <Avatar profile={group.profile} size="sm" />
          </Link>
          <div className="flex-1 min-w-0 pointer-events-auto">
            <Link
              to={`/users/${group.userId}`}
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="block text-sm font-semibold text-white truncate hover:underline"
            >
              {group.profile.display_name}
            </Link>
            <p className="text-xs text-white/70">{formatTimeAgo(story.created_at)}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="pointer-events-auto p-1.5 text-white/80 hover:text-white transition-colors"
            aria-label="Close story"
          >
            <X size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Caption + recipe link */}
        <div
          className="absolute bottom-0 inset-x-0 px-4 pb-10 pointer-events-none"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
        >
          {story.caption && (
            <p className="text-sm text-white font-medium leading-snug mb-3 drop-shadow">
              {story.caption}
            </p>
          )}
          {story.linked_recipe_id && (
            <Link
              to={`/shared/${story.linked_recipe_id}`}
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="pointer-events-auto inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-2 rounded-full border border-white/30 hover:bg-white/30 transition-colors"
            >
              <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
              View recipe
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
