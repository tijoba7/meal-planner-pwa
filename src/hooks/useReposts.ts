import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  getFriendsReposts,
  createRepost,
  deleteRepost,
  uploadRepostImage,
  type RepostWithAuthor,
} from '../lib/repostService'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const repostKeys = {
  friends: (userId: string) => ['reposts', 'friends', userId] as const,
}

// ─── Feed hook ───────────────────────────────────────────────────────────────

/**
 * Fetch reposts from friends for the feed. Returns a flat list that
 * can be interleaved with recipe posts by created_at timestamp.
 */
export function useFriendsReposts() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useQuery({
    queryKey: repostKeys.friends(userId),
    queryFn: () => getFriendsReposts(userId, 0, 50),
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Create a repost with optional image upload.
 * Invalidates the reposts cache on success.
 */
export function useCreateRepostMutation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recipeId,
      caption,
      imageFile,
    }: {
      recipeId: string
      caption?: string
      imageFile?: File
    }) => {
      let imageUrl: string | undefined
      if (imageFile && user) {
        const upload = await uploadRepostImage(user.id, imageFile)
        if (upload.error) throw upload.error
        imageUrl = upload.url ?? undefined
      }
      const result = await createRepost(user!.id, recipeId, caption, imageUrl)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reposts'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

/** Delete a repost. Invalidates cache on success. */
export function useDeleteRepostMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (repostId: string) => deleteRepost(repostId).then((r) => {
      if (r.error) throw r.error
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reposts'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export type { RepostWithAuthor }
