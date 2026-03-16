import { Heart, Bookmark } from 'lucide-react'
import type { ReactionType } from '../../types/supabase'

/** Aggregated reaction data for a single recipe. */
export interface ReactionSummary {
  type: ReactionType
  emoji_code?: string | null
  count: number
  /** Whether the current user has already added this reaction. */
  hasReacted: boolean
}

interface ReactionPickerProps {
  reactions: ReactionSummary[]
  onReact: (type: ReactionType, emojiCode?: string) => void
  onUnreact: (type: ReactionType, emojiCode?: string) => void
  disabled?: boolean
}

const QUICK_EMOJIS = ['😋', '🔥', '👌', '🥰']

/**
 * Inline reaction bar with like, bookmark, custom emoji, and quick-add buttons.
 *
 * @example
 * <ReactionPicker
 *   reactions={[{ type: 'like', count: 3, hasReacted: false }]}
 *   onReact={(type) => addReaction(recipeId, type)}
 *   onUnreact={(type) => removeReaction(recipeId, type)}
 * />
 */
export default function ReactionPicker({ reactions, onReact, onUnreact, disabled }: ReactionPickerProps) {
  const like = reactions.find((r) => r.type === 'like')
  const bookmark = reactions.find((r) => r.type === 'bookmark')
  const emojiReactions = reactions.filter((r) => r.type === 'emoji')

  function toggle(type: ReactionType, emojiCode?: string) {
    const match = reactions.find((r) => r.type === type && r.emoji_code === (emojiCode ?? null))
    if (match?.hasReacted) {
      onUnreact(type, emojiCode)
    } else {
      onReact(type, emojiCode)
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Like */}
      <button
        onClick={() => toggle('like')}
        disabled={disabled}
        aria-pressed={like?.hasReacted}
        aria-label={like?.hasReacted ? 'Unlike recipe' : 'Like recipe'}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
          like?.hasReacted
            ? 'bg-red-50 text-red-500'
            : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
        }`}
      >
        <Heart
          size={13}
          strokeWidth={2}
          fill={like?.hasReacted ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
        {(like?.count ?? 0) > 0 && <span>{like!.count}</span>}
      </button>

      {/* Bookmark */}
      <button
        onClick={() => toggle('bookmark')}
        disabled={disabled}
        aria-pressed={bookmark?.hasReacted}
        aria-label={bookmark?.hasReacted ? 'Remove bookmark' : 'Bookmark recipe'}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
          bookmark?.hasReacted
            ? 'bg-green-50 text-green-600'
            : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600'
        }`}
      >
        <Bookmark
          size={13}
          strokeWidth={2}
          fill={bookmark?.hasReacted ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
        {(bookmark?.count ?? 0) > 0 && <span>{bookmark!.count}</span>}
      </button>

      {/* Existing emoji reactions */}
      {emojiReactions.map((r) => (
        <button
          key={r.emoji_code}
          onClick={() => toggle('emoji', r.emoji_code ?? undefined)}
          disabled={disabled}
          aria-pressed={r.hasReacted}
          aria-label={`${r.hasReacted ? 'Remove' : 'Add'} ${r.emoji_code} reaction`}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
            r.hasReacted ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <span aria-hidden="true">{r.emoji_code}</span>
          <span>{r.count}</span>
        </button>
      ))}

      {/* Quick emoji add */}
      <div className="flex items-center gap-0.5 ml-0.5" role="group" aria-label="Add emoji reaction">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact('emoji', emoji)}
            disabled={disabled}
            aria-label={`React with ${emoji}`}
            className="w-7 h-7 flex items-center justify-center rounded-full text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
