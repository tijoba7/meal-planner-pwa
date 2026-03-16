import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  getFriendsStories,
  getMyStories,
  createStory,
  uploadStoryMedia,
  markStoriesViewed,
  type UserStoryGroup,
  type StoryWithAuthor,
} from '../lib/storiesService'
import type { StoryItem } from '../components/social/StoriesBar'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const storyKeys = {
  friends: (userId: string) => ['stories', 'friends', userId] as const,
  my: (userId: string) => ['stories', 'my', userId] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch active stories from friends, grouped by user. */
export function useFriendsStories() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useQuery<UserStoryGroup[]>({
    queryKey: storyKeys.friends(userId),
    queryFn: () => getFriendsStories(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/** Fetch current user's own active stories. */
export function useMyStories() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useQuery<StoryWithAuthor[]>({
    queryKey: storyKeys.my(userId),
    queryFn: () => getMyStories(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/** Convert story groups to the StoryItem shape expected by StoriesBar. */
export function storyGroupsToBarItems(groups: UserStoryGroup[]): StoryItem[] {
  return groups.map((g) => ({
    userId: g.userId,
    profile: g.profile,
    hasNew: g.hasNew,
  }))
}

/** Create a new story, uploading the image file first if provided. */
export function useCreateStoryMutation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      mediaUrl,
      caption,
      linkedRecipeId,
    }: {
      file?: File
      mediaUrl?: string
      caption?: string
      linkedRecipeId?: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      let url = mediaUrl
      if (file) {
        const { url: uploaded, error } = await uploadStoryMedia(user.id, file)
        if (error || !uploaded) throw error ?? new Error('Upload failed')
        url = uploaded
      }

      if (!url) throw new Error('No media provided')

      const { data, error } = await createStory(user.id, url, caption, linkedRecipeId)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      if (!user) return
      qc.invalidateQueries({ queryKey: storyKeys.friends(user.id) })
      qc.invalidateQueries({ queryKey: storyKeys.my(user.id) })
    },
  })
}

/** Mark story IDs as viewed in localStorage and refresh the stories cache. */
export function useMarkStoriesViewedMutation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (storyIds: string[]) => {
      markStoriesViewed(storyIds)
    },
    onSuccess: () => {
      if (!user) return
      qc.invalidateQueries({ queryKey: storyKeys.friends(user.id) })
    },
  })
}
