import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds; won't refetch on window focus
      // unless stale.
      staleTime: 30_000,
      // Keep inactive query data for 5 minutes before garbage collection.
      gcTime: 5 * 60_000,
      // Retry once on failure (network blip). Dexie fallback handles the rest.
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      // No retries on mutations — writes to Supabase either succeed or show an
      // error; there is no offline write queue.
      retry: false,
    },
  },
})
