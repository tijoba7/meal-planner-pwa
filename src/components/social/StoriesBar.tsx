import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import type { Profile } from '../../types/supabase'

export interface StoryItem {
  userId: string
  profile: Pick<Profile, 'display_name' | 'avatar_url'>
  /** True when the current user hasn't viewed this story yet. */
  hasNew: boolean
}

interface StoriesBarProps {
  stories: StoryItem[]
  currentUserProfile?: Pick<Profile, 'display_name' | 'avatar_url'> | null
  onStoryClick?: (userId: string) => void
  onAddStory?: () => void
}

/**
 * Horizontal scrollable stories/reels bar. Renders the current user's "Add
 * story" tile first, then other users with a green ring when they have unseen
 * stories.
 *
 * @example
 * <StoriesBar
 *   stories={stories}
 *   currentUserProfile={profile}
 *   onStoryClick={(id) => openStory(id)}
 *   onAddStory={() => openStoryComposer()}
 * />
 */
export default function StoriesBar({
  stories,
  currentUserProfile,
  onStoryClick,
  onAddStory,
}: StoriesBarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Hide scrollbar cross-browser while keeping it scrollable */}
      <div
        className="flex gap-4 px-4 py-3 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="list"
        aria-label="Stories"
      >
        {/* Your story tile */}
        {currentUserProfile && (
          <div role="listitem">
            <button
              onClick={onAddStory}
              className="flex flex-col items-center gap-1.5 min-w-[56px] group"
              aria-label="Add your story"
            >
              <div className="relative">
                <Avatar profile={currentUserProfile} size="md" />
                <span
                  className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-green-600 dark:bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Plus size={10} strokeWidth={3} className="text-white" />
                </span>
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 text-center truncate leading-tight">
                Your story
              </span>
            </button>
          </div>
        )}

        {/* Other users' stories */}
        {stories.map((story) => (
          <div key={story.userId} role="listitem">
            <button
              onClick={() => onStoryClick?.(story.userId)}
              className="flex flex-col items-center gap-1.5 min-w-[56px] group"
              aria-label={`${story.profile.display_name}'s story${story.hasNew ? ' (new)' : ''}`}
            >
              {/* Ring: green = has new content, gray = all seen */}
              <div
                className={`p-0.5 rounded-full ${
                  story.hasNew
                    ? 'bg-gradient-to-tr from-green-400 to-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <div className="p-0.5 bg-white dark:bg-gray-900 rounded-full">
                  <Avatar profile={story.profile} size="md" />
                </div>
              </div>
              <Link
                to={`/users/${story.userId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-gray-600 dark:text-gray-400 w-14 text-center truncate leading-tight hover:text-green-600 dark:hover:text-green-400 transition-colors"
                tabIndex={-1}
              >
                {story.profile.display_name}
              </Link>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
