import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChefHat,
  GitFork,
  User,
  Heart,
  Bookmark,
  MessageCircle,
  Star,
  Send,
  Trash2,
  Flag,
} from 'lucide-react'
import { getSharedRecipe, forkRecipe, type CloudRecipeWithAuthor } from '../lib/recipeShareService'
import {
  getReactions,
  toggleLike,
  toggleBookmark,
  setEmojiReaction,
  getComments,
  addComment,
  deleteComment,
  getRating,
  upsertRating,
  deleteRating,
  type RecipeReactions,
  type RecipeRating,
  type CommentWithAuthor,
} from '../lib/engagementService'
import { durationToMinutes } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Skeleton from '../components/Skeleton'
import CookingMode from '../components/CookingMode'

// ─── Nutrition helpers (duplicated from RecipeDetailPage to keep bundle splits clean) ─

const NUTRITION_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'proteinContent', label: 'Protein', unit: 'g' },
  { key: 'fatContent', label: 'Fat', unit: 'g' },
  { key: 'carbohydrateContent', label: 'Carbs', unit: 'g' },
  { key: 'fiberContent', label: 'Fiber', unit: 'g' },
]

function parseNutritionValue(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number') return val
  const match = String(val).match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

function hasNutrition(nutrition: Record<string, string | number> | undefined): boolean {
  if (!nutrition) return false
  return NUTRITION_FIELDS.some((f) => parseNutritionValue(nutrition[f.key]) > 0)
}

function parseServings(recipeYield: string): number {
  const match = recipeYield.match(/\d+/)
  return match ? Math.max(1, parseInt(match[0], 10)) : 1
}

function formatAmount(amount: number): string {
  if (amount === 0) return '0'
  const whole = Math.floor(amount)
  const decimal = amount - whole
  if (decimal < 0.01) return String(whole)
  const fractions: [number, string][] = [
    [1 / 8, '1/8'],
    [1 / 6, '1/6'],
    [1 / 4, '1/4'],
    [1 / 3, '1/3'],
    [3 / 8, '3/8'],
    [1 / 2, '1/2'],
    [5 / 8, '5/8'],
    [2 / 3, '2/3'],
    [3 / 4, '3/4'],
    [7 / 8, '7/8'],
  ]
  let bestFrac = ''
  let bestDiff = Infinity
  for (const [val, label] of fractions) {
    const diff = Math.abs(decimal - val)
    if (diff < bestDiff) {
      bestDiff = diff
      bestFrac = label
    }
  }
  if (bestDiff < 0.05) return whole > 0 ? `${whole} ${bestFrac}` : bestFrac
  return amount.toFixed(1).replace(/\.0$/, '')
}

// ─── CommentItem ─────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  currentUserId,
  recipeOwnerId,
  onReply,
  onDelete,
  depth = 0,
}: {
  comment: CommentWithAuthor
  currentUserId?: string
  recipeOwnerId?: string
  onReply: (id: string, authorName: string) => void
  onDelete: (id: string) => void
  depth?: number
}) {
  const toast = useToast()
  const isOwn = currentUserId === comment.user_id
  const isRecipeOwner = currentUserId === recipeOwnerId
  const canModerate = isOwn || isRecipeOwner
  const authorName = comment.profiles?.display_name ?? 'Unknown'
  const isDeleted = comment.deleted_at !== null

  return (
    <div
      className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-100 dark:border-gray-700 pl-3' : ''} mb-3`}
    >
      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{authorName}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(comment.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
        {isDeleted ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">[comment deleted]</p>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
            {comment.body}
          </p>
        )}
        {!isDeleted && currentUserId && (
          <div className="flex items-center gap-3 mt-2">
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id, authorName)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                Reply
              </button>
            )}
            {canModerate && (
              <button
                onClick={() => onDelete(comment.id)}
                aria-label="Delete comment"
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-0.5"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            )}
            {!isOwn && (
              <button
                onClick={() =>
                  toast.success('Report submitted. Thank you for helping keep Mise safe.')
                }
                aria-label="Report comment"
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-0.5"
              >
                <Flag size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      {comment.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          recipeOwnerId={recipeOwnerId}
          onReply={onReply}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharedRecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [item, setItem] = useState<CloudRecipeWithAuthor | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [forking, setForking] = useState(false)
  const [scaledServings, setScaledServings] = useState(1)
  const [cookingMode, setCookingMode] = useState(false)

  // ── Engagement state ────────────────────────────────────────────────────────
  const [reactions, setReactions] = useState<RecipeReactions | null>(null)
  const [rating, setRating] = useState<RecipeRating | null>(null)
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [reactionPending, setReactionPending] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  const EMOJI_OPTIONS = ['😍', '🤤', '👌', '🔥', '💯', '🥗', '🍕', '🌮', '🍜', '🎉']

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      return
    }
    getSharedRecipe(id).then((result) => {
      if (result) {
        setItem(result)
        setScaledServings(parseServings(result.data.recipeYield))
      } else {
        setNotFound(true)
      }
    })
  }, [id])

  // Load engagement data once the recipe is known
  useEffect(() => {
    if (!id) return
    const uid = user?.id
    Promise.all([getReactions(id, uid), getRating(id, uid), getComments(id)]).then(
      ([r, rat, c]) => {
        setReactions(r)
        setRating(rat)
        setComments(c)
      }
    )
  }, [id, user?.id])

  async function handleFork() {
    if (!item || !user) return
    setForking(true)
    try {
      const forked = await forkRecipe(item)
      toast.success(`"${forked.name}" added to your collection!`)
      navigate(`/recipes/${forked.id}`)
    } catch {
      toast.error('Failed to save recipe. Please try again.')
      setForking(false)
    }
  }

  async function handleToggleLike() {
    if (!id || !user || reactionPending) return
    setReactionPending(true)
    const optimisticLiked = !reactions?.userLiked
    setReactions((r) =>
      r
        ? {
            ...r,
            userLiked: optimisticLiked,
            likeCount: r.likeCount + (optimisticLiked ? 1 : -1),
          }
        : r
    )
    const { liked, error } = await toggleLike(id, user.id)
    if (error) {
      // revert
      setReactions((r) =>
        r
          ? {
              ...r,
              userLiked: !optimisticLiked,
              likeCount: r.likeCount + (optimisticLiked ? -1 : 1),
            }
          : r
      )
      toast.error('Failed to update reaction.')
    } else {
      setReactions((r) => (r ? { ...r, userLiked: liked } : r))
    }
    setReactionPending(false)
  }

  async function handleToggleBookmark() {
    if (!id || !user || reactionPending) return
    setReactionPending(true)
    const optimisticBookmarked = !reactions?.userBookmarked
    setReactions((r) =>
      r
        ? {
            ...r,
            userBookmarked: optimisticBookmarked,
            bookmarkCount: r.bookmarkCount + (optimisticBookmarked ? 1 : -1),
          }
        : r
    )
    const { bookmarked, error } = await toggleBookmark(id, user.id)
    if (error) {
      setReactions((r) =>
        r
          ? {
              ...r,
              userBookmarked: !optimisticBookmarked,
              bookmarkCount: r.bookmarkCount + (optimisticBookmarked ? -1 : 1),
            }
          : r
      )
      toast.error('Failed to update reaction.')
    } else {
      setReactions((r) => (r ? { ...r, userBookmarked: bookmarked } : r))
    }
    setReactionPending(false)
  }

  async function handleEmojiSelect(emoji: string) {
    if (!id || !user) return
    const isSame = reactions?.userEmojiCode === emoji
    const newCode = isSame ? null : emoji
    setEmojiPickerOpen(false)
    setReactions((r) =>
      r
        ? {
            ...r,
            userEmojiCode: newCode,
            emojiCount: r.emojiCount + (newCode ? (r.userEmojiCode ? 0 : 1) : -1),
          }
        : r
    )
    const { error } = await setEmojiReaction(id, user.id, newCode)
    if (error) {
      toast.error('Failed to update reaction.')
      // refresh
      getReactions(id, user.id).then(setReactions)
    }
  }

  async function handleRatingClick(score: number) {
    if (!id || !user) return
    if (rating?.userScore === score) {
      // Remove rating
      setRating((r) => (r ? { ...r, userScore: null } : r))
      await deleteRating(id, user.id)
    } else {
      setRating((r) => (r ? { ...r, userScore: score } : r))
      const { error } = await upsertRating(id, user.id, score)
      if (error) {
        toast.error('Failed to save rating.')
        getRating(id, user.id).then(setRating)
      }
    }
    // Refresh aggregate
    getRating(id, user.id).then(setRating)
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !user || !commentBody.trim() || submittingComment) return
    setSubmittingComment(true)
    const { data, error } = await addComment(id, user.id, commentBody, replyTo?.id)
    if (error || !data) {
      toast.error('Failed to post comment.')
    } else {
      setCommentBody('')
      setReplyTo(null)
      // Re-fetch to get threaded structure
      getComments(id).then(setComments)
    }
    setSubmittingComment(false)
  }

  async function handleDeleteComment(commentId: string) {
    if (!id) return
    const { error } = await deleteComment(commentId)
    if (error) {
      toast.error('Failed to delete comment.')
    } else {
      getComments(id).then(setComments)
    }
  }

  function startReply(commentId: string, authorName: string) {
    setReplyTo({ id: commentId, authorName })
    commentInputRef.current?.focus()
  }

  if (notFound) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-500 dark:text-gray-400">
          Recipe not found or you don't have access.
        </p>
        <Link
          to="/discover"
          className="text-green-600 dark:text-green-400 text-sm mt-2 inline-block"
        >
          ← Back to Discover
        </Link>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-4 max-w-2xl mx-auto pb-8" aria-busy="true" aria-label="Loading recipe">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="flex items-start justify-between gap-3 mb-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="w-full h-48 md:h-64 rounded-xl mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-4/5 mb-6" />
        <Skeleton className="h-6 w-28 mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full mb-2" />
        ))}
      </div>
    )
  }

  const recipe = item.data
  const authorName = item.profiles?.display_name ?? recipe.author ?? 'Unknown'
  const isOwner = user?.id === item.author_id

  const prepMins = durationToMinutes(recipe.prepTime)
  const cookMins = durationToMinutes(recipe.cookTime)
  const totalTime = prepMins + cookMins
  const originalServings = parseServings(recipe.recipeYield)
  const scale = originalServings > 0 ? scaledServings / originalServings : 1
  const isScaled = scaledServings !== originalServings

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      {cookingMode && <CookingMode recipe={recipe} onClose={() => setCookingMode(false)} />}

      {/* Back link */}
      <Link
        to="/discover"
        className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-block mb-4"
      >
        ← Discover
      </Link>

      {/* Hero image */}
      {recipe.image && (
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4">
          <img
            src={recipe.image}
            alt={recipe.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{recipe.name}</h2>
        <div className="flex gap-2 shrink-0">
          {recipe.recipeInstructions.length > 0 && (
            <button
              onClick={() => setCookingMode(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
            >
              <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
              Cook
            </button>
          )}
          {/* Fork button — shown to signed-in non-owners */}
          {user && !isOwner && (
            <button
              onClick={handleFork}
              disabled={forking}
              className="flex items-center gap-1.5 text-sm font-medium border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            >
              <GitFork size={14} strokeWidth={2} aria-hidden="true" />
              {forking ? 'Saving…' : 'Fork'}
            </button>
          )}
          {/* Owner: link to their own editable copy */}
          {isOwner && (
            <Link
              to={`/recipes/${item.id}/edit`}
              className="text-sm font-medium text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Author attribution */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <User size={13} aria-hidden="true" />
        <span>
          by{' '}
          <Link
            to={`/users/${item.author_id}`}
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            {authorName}
          </Link>
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScaledServings((s) => Math.max(1, s - 1))}
            disabled={scaledServings <= 1}
            aria-label="Decrease servings"
            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors leading-none select-none"
          >
            −
          </button>
          <span className="text-center">
            <span className="font-medium text-gray-700 dark:text-gray-200">{scaledServings}</span>
            {' servings'}
          </span>
          <button
            onClick={() => setScaledServings((s) => s + 1)}
            aria-label="Increase servings"
            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors leading-none select-none"
          >
            +
          </button>
        </div>
        <span>·</span>
        <span>Prep {prepMins} min</span>
        <span>·</span>
        <span>Cook {cookMins} min</span>
        <span>·</span>
        <span>Total {totalTime} min</span>
      </div>

      {/* Keywords */}
      {recipe.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {recipe.keywords.map((tag) => (
            <span
              key={tag}
              className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {recipe.description && (
        <p className="text-gray-600 dark:text-gray-300 mb-6">{recipe.description}</p>
      )}

      {/* Ingredients */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ingredients</h3>
          {isScaled && (
            <button
              onClick={() => setScaledServings(originalServings)}
              className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
            >
              Reset to {originalServings}
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {recipe.recipeIngredient.map((ing, i) => {
            const scaledAmount = ing.amount * scale
            const showOriginal = isScaled && ing.amount > 0
            return (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {formatAmount(scaledAmount)} {ing.unit}
                  {showOriginal && (
                    <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
                      (was {formatAmount(ing.amount)})
                    </span>
                  )}
                </span>
                <span className="text-gray-600 dark:text-gray-300">{ing.name}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Instructions */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Instructions
        </h3>
        <ol className="space-y-3">
          {recipe.recipeInstructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 bg-green-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed pt-0.5">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Nutrition */}
      {hasNutrition(recipe.nutrition) && (
        <section className="mb-6">
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Nutrition</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              per {scaledServings} serving{scaledServings !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-5 gap-2 text-center">
              {NUTRITION_FIELDS.map(({ key, label, unit }) => {
                const base = parseNutritionValue(recipe.nutrition?.[key])
                if (!base) return null
                const scaled = base * scale
                const display = scaled % 1 === 0 ? String(Math.round(scaled)) : scaled.toFixed(1)
                return (
                  <div key={key}>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
                      {display}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{unit}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Engagement: reactions + rating ──────────────────────────────── */}
      {reactions !== null && (
        <section className="mb-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Like */}
            <button
              onClick={handleToggleLike}
              disabled={!user || reactionPending}
              aria-label={reactions.userLiked ? 'Unlike' : 'Like'}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                reactions.userLiked
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 dark:hover:text-red-400'
              }`}
            >
              <Heart
                size={14}
                fill={reactions.userLiked ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              <span>{reactions.likeCount}</span>
            </button>

            {/* Bookmark */}
            <button
              onClick={handleToggleBookmark}
              disabled={!user || reactionPending}
              aria-label={reactions.userBookmarked ? 'Remove bookmark' : 'Bookmark'}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                reactions.userBookmarked
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-yellow-300 hover:text-yellow-600 dark:hover:text-yellow-400'
              }`}
            >
              <Bookmark
                size={14}
                fill={reactions.userBookmarked ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              <span>{reactions.bookmarkCount}</span>
            </button>

            {/* Emoji reaction */}
            <div className="relative">
              <button
                onClick={() => setEmojiPickerOpen((o) => !o)}
                disabled={!user}
                aria-label="Add emoji reaction"
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                  reactions.userEmojiCode
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-300'
                }`}
              >
                <span>{reactions.userEmojiCode ?? '😊'}</span>
                {reactions.emojiCount > 0 && <span>{reactions.emojiCount}</span>}
              </button>
              {emojiPickerOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 flex flex-wrap gap-1 z-10 w-44">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      onClick={() => handleEmojiSelect(em)}
                      className={`text-xl p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${reactions.userEmojiCode === em ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comment count (scroll anchor) */}
            <button
              onClick={() => commentInputRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 transition-colors"
            >
              <MessageCircle size={14} aria-hidden="true" />
              <span>{comments.length}</span>
            </button>
          </div>
        </section>
      )}

      {/* ── Star rating ──────────────────────────────────────────────────── */}
      {rating !== null && (
        <section className="mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {user ? 'Your rating:' : 'Rating:'}
            </span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRatingClick(star)}
                  disabled={!user}
                  aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  className="p-0.5 transition-transform hover:scale-110 disabled:cursor-default"
                >
                  <Star
                    size={20}
                    className={
                      (rating.userScore ?? 0) >= star
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            {rating.ratingCount > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {rating.avgScore} avg ({rating.ratingCount})
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Comments ─────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Comments{' '}
          {comments.length > 0 && (
            <span className="text-sm font-normal text-gray-400">({comments.length})</span>
          )}
        </h3>

        {comments.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
            No comments yet. Be the first!
          </p>
        )}

        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            currentUserId={user?.id}
            recipeOwnerId={item?.author_id}
            onReply={startReply}
            onDelete={handleDeleteComment}
          />
        ))}

        {/* Comment input */}
        {user ? (
          <form onSubmit={handleSubmitComment} className="mt-4">
            {replyTo && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 mb-1">
                <span>Replying to {replyTo.authorName}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="underline">
                  cancel
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={commentInputRef}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                maxLength={4000}
                className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                disabled={!commentBody.trim() || submittingComment}
                aria-label="Post comment"
                className="self-end bg-green-700 text-white p-2 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                <Send size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            <Link to="/auth/login" className="text-green-600 dark:text-green-400 hover:underline">
              Sign in
            </Link>{' '}
            to leave a comment.
          </p>
        )}
      </section>

      {/* Fork CTA (bottom, for visibility) */}
      {user && !isOwner && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleFork}
            disabled={forking}
            className="w-full flex items-center justify-center gap-2 bg-green-700 text-white text-sm font-medium py-3 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            <GitFork size={16} aria-hidden="true" />
            {forking ? 'Saving to your collection…' : 'Fork to My Collection'}
          </button>
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
            Creates a personal copy you can edit and customize.
          </p>
        </div>
      )}

      {!user && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Sign in to save this recipe to your collection.
          </p>
          <Link
            to="/auth/login"
            className="inline-block bg-green-700 text-white text-sm font-medium px-6 py-2 rounded-xl hover:bg-green-800 transition-colors"
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  )
}
