import { useState, type FormEvent } from 'react'
import { CornerDownRight, Send } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import type { Profile } from '../../types/supabase'

export interface CommentData {
  id: string
  body: string
  createdAt: string
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
  replies?: CommentData[]
  deletedAt?: string | null
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface CommentItemProps {
  comment: CommentData
  depth?: number
  onReply?: (parentId: string) => void
}

function CommentItem({ comment, depth = 0, onReply }: CommentItemProps) {
  const deleted = !!comment.deletedAt
  return (
    <div className={depth > 0 ? 'ml-9 pl-3 border-l-2 border-gray-100' : ''}>
      <div className="flex items-start gap-2.5 py-3">
        <Avatar profile={comment.author} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {comment.author.display_name}
            </span>
            <span className="text-xs text-gray-400">{relativeTime(comment.createdAt)}</span>
          </div>
          {deleted ? (
            <p className="text-sm text-gray-400 italic mt-0.5">This comment was deleted.</p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
              {comment.body}
            </p>
          )}
          {!deleted && depth === 0 && onReply && (
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 mt-1.5 text-xs text-gray-400 hover:text-green-600 transition-colors"
            >
              <CornerDownRight size={11} strokeWidth={2} aria-hidden="true" />
              Reply
            </button>
          )}
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  )
}

interface CommentThreadProps {
  comments: CommentData[]
  currentUserProfile?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
  /** Called when the user submits a comment. parentId is set for replies. */
  onSubmit?: (body: string, parentId?: string) => Promise<void>
  isLoading?: boolean
}

/**
 * Threaded comment list with inline compose input.
 *
 * @example
 * <CommentThread
 *   comments={comments}
 *   currentUserProfile={profile}
 *   onSubmit={async (body, parentId) => await postComment(recipeId, body, parentId)}
 * />
 */
export default function CommentThread({
  comments,
  currentUserProfile,
  onSubmit,
  isLoading,
}: CommentThreadProps) {
  const [replyToId, setReplyToId] = useState<string | undefined>()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim() || !onSubmit) return
    setSubmitting(true)
    try {
      await onSubmit(draft.trim(), replyToId)
      setDraft('')
      setReplyToId(undefined)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <div
            className="w-6 h-6 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin"
            aria-label="Loading comments"
          />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No comments yet. Be the first!</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={(id) => setReplyToId(id)}
            />
          ))}
        </div>
      )}

      {/* Compose */}
      {onSubmit && currentUserProfile && (
        <form
          onSubmit={handleSubmit}
          className="flex items-start gap-2.5 pt-4 border-t border-gray-100 mt-2"
        >
          <Avatar profile={currentUserProfile} size="sm" />
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 transition-colors">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyToId ? 'Write a reply…' : 'Add a comment…'}
              className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
              disabled={submitting}
              aria-label={replyToId ? 'Write a reply' : 'Add a comment'}
            />
            {replyToId && (
              <button
                type="button"
                onClick={() => setReplyToId(undefined)}
                className="text-xs text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!draft.trim() || submitting}
              aria-label="Post comment"
              className="shrink-0 text-green-600 hover:text-green-700 disabled:opacity-40 transition-colors"
            >
              <Send size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
