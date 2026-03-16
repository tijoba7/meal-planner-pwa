import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Rss, Search, Heart, Star, LayoutGrid, List, TrendingUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { CloudRecipeWithAuthor } from '../lib/recipeShareService'
import { durationToMinutes } from '../lib/db'
import {
  usePublicFeed,
  useFriendsFeed,
  useTrendingFeed,
  useEngagementStats,
} from '../hooks/useFeed'
import Skeleton from '../components/Skeleton'

// ─── Category chips ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: '🍝 Pasta', value: 'pasta' },
  { label: '🥗 Salads', value: 'salad' },
  { label: '🍜 Soups', value: 'soup' },
  { label: '🍖 Meat', value: 'meat' },
  { label: '🐟 Seafood', value: 'seafood' },
  { label: '🥩 Grilling', value: 'grilling' },
  { label: '🧁 Desserts', value: 'desserts' },
  { label: '🥞 Breakfast', value: 'breakfast' },
  { label: '🌮 Mexican', value: 'mexican' },
  { label: '🍣 Asian', value: 'asian' },
  { label: '🍕 Italian', value: 'italian' },
]

function CategoryChips({
  selected,
  onChange,
}: {
  selected: string
  onChange: (value: string) => void
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      role="group"
      aria-label="Filter by category"
    >
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          aria-pressed={selected === cat.value}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            selected === cat.value
              ? 'bg-green-700 border-green-700 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}

// ─── Recipe cards ─────────────────────────────────────────────────────────────

function RecipeListCard({
  item,
  likeCount,
  avgRating,
}: {
  item: CloudRecipeWithAuthor
  likeCount?: number
  avgRating?: number | null
}) {
  const recipe = item.data
  const prepMins = durationToMinutes(recipe.prepTime)
  const cookMins = durationToMinutes(recipe.cookTime)
  const authorName = item.profiles?.display_name ?? 'Unknown'

  return (
    <li>
      <Link
        to={`/shared/${item.id}`}
        className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
      >
        {recipe.image && (
          <img
            src={recipe.imageThumbnailUrl ?? recipe.image}
            alt={recipe.name}
            className="w-16 h-16 shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-tight">
              {recipe.name}
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {prepMins + cookMins} min
            </span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">by {authorName}</p>
          {recipe.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {recipe.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{recipe.recipeYield} servings</span>
            <span>·</span>
            <span>prep {prepMins}m</span>
            <span>·</span>
            <span>cook {cookMins}m</span>
            {likeCount != null && likeCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Heart size={10} className="text-red-400" fill="currentColor" aria-hidden="true" />
                  {likeCount}
                </span>
              </>
            )}
            {avgRating != null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Star
                    size={10}
                    className="text-yellow-400"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                  {avgRating}
                </span>
              </>
            )}
          </div>
          {recipe.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.keywords.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  )
}

function RecipeGridCard({ item }: { item: CloudRecipeWithAuthor }) {
  const recipe = item.data
  const authorName = item.profiles?.display_name ?? 'Unknown'

  return (
    <li>
      <Link
        to={`/shared/${item.id}`}
        className="block group rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
      >
        <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {recipe.image ? (
            <img
              src={recipe.imageThumbnailUrl ?? recipe.image}
              alt={recipe.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
              <span className="text-3xl" role="img" aria-label="Recipe">
                🍽️
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
            {recipe.name}
          </h3>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 truncate">
            by {authorName}
          </p>
        </div>
      </Link>
    </li>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <li className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <Skeleton className="w-16 h-16 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-10 shrink-0" />
        </div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </li>
  )
}

function GridSkeleton() {
  return (
    <li className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-3 space-y-1.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </li>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-4" aria-label="Loading more recipes">
      <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─── Trending section ─────────────────────────────────────────────────────────

function TrendingSection() {
  const { data: trendingItems = [], isLoading } = useTrendingFeed()
  const trendingIds = trendingItems.map((i) => i.id)
  const { data: engagementMap = {} } = useEngagementStats(trendingIds)

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-green-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Trending this week
          </h3>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <GridSkeleton key={i} />
          ))}
        </ul>
      </div>
    )
  }

  if (trendingItems.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-green-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Trending this week
        </h3>
      </div>
      <ul className="grid grid-cols-2 gap-3" aria-label="Trending recipes">
        {trendingItems.slice(0, 6).map((item) => {
          const eng = engagementMap[item.id]
          return (
            <li key={item.id}>
              <Link
                to={`/shared/${item.id}`}
                className="block group rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                  {item.data.image ? (
                    <img
                      src={item.data.imageThumbnailUrl ?? item.data.image}
                      alt={item.data.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                      <span className="text-3xl" role="img" aria-label="Recipe">
                        🍽️
                      </span>
                    </div>
                  )}
                  {/* Engagement badge */}
                  {eng && (eng.likeCount > 0 || eng.commentCount > 0) && (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      <Heart size={9} fill="currentColor" aria-hidden="true" />
                      {eng.likeCount}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight line-clamp-1">
                    {item.data.name}
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5 truncate">
                    by {item.profiles?.display_name ?? 'Unknown'}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'explore' | 'feed'

export default function DiscoverPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('explore')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [gridView, setGridView] = useState(false)

  // Sentinel refs for infinite scroll
  const exploreSentinelRef = useRef<HTMLDivElement>(null)
  const feedSentinelRef = useRef<HTMLDivElement>(null)

  // ── Explore (public feed) ─────────────────────────────────────────────────

  const {
    data: exploreData,
    isLoading: exploreLoading,
    isError: exploreError,
    fetchNextPage: fetchMoreExplore,
    hasNextPage: exploreHasMore,
    isFetchingNextPage: exploreFetchingMore,
  } = usePublicFeed()

  const exploreItems = exploreData?.pages.flat() ?? []
  const exploreIds = exploreItems.map((i) => i.id)
  const { data: exploreEngagement = {} } = useEngagementStats(exploreIds)

  // ── Friends feed ──────────────────────────────────────────────────────────

  const {
    data: feedData,
    isLoading: feedLoading,
    isError: feedError,
    fetchNextPage: fetchMoreFeed,
    hasNextPage: feedHasMore,
    isFetchingNextPage: feedFetchingMore,
  } = useFriendsFeed()

  const feedItems = feedData?.pages.flat() ?? []

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredExplore = useMemo(() => {
    if (!query && !category) return exploreItems
    return exploreItems.filter((item) => {
      const r = item.data
      if (query.trim()) {
        const q = query.toLowerCase()
        const matchesSearch =
          r.name?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.keywords?.some((k) => k.toLowerCase().includes(q))
        if (!matchesSearch) return false
      }
      if (category) {
        const matchesCategory = r.keywords?.some((k) => k.toLowerCase().includes(category))
        if (!matchesCategory) return false
      }
      return true
    })
  }, [exploreItems, query, category])

  // ── Infinite scroll ───────────────────────────────────────────────────────

  const loadMoreExplore = useCallback(() => {
    if (exploreHasMore && !exploreFetchingMore) fetchMoreExplore()
  }, [exploreHasMore, exploreFetchingMore, fetchMoreExplore])

  const loadMoreFeed = useCallback(() => {
    if (feedHasMore && !feedFetchingMore) fetchMoreFeed()
  }, [feedHasMore, feedFetchingMore, fetchMoreFeed])

  useEffect(() => {
    if (activeTab !== 'explore' || !exploreSentinelRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreExplore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(exploreSentinelRef.current)
    return () => observer.disconnect()
  }, [loadMoreExplore, activeTab])

  useEffect(() => {
    if (activeTab !== 'feed' || !feedSentinelRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreFeed()
      },
      { rootMargin: '200px' }
    )
    observer.observe(feedSentinelRef.current)
    return () => observer.disconnect()
  }, [loadMoreFeed, activeTab])

  // ── Render ────────────────────────────────────────────────────────────────

  const tabClass = (tab: Tab) =>
    `flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-green-600 text-green-700 dark:text-green-400 dark:border-green-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Discover</h2>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Discover sections"
        className="flex border-b border-gray-200 dark:border-gray-700 mb-4"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'explore'}
          aria-controls="discover-tab-explore"
          id="discover-tab-btn-explore"
          className={tabClass('explore')}
          onClick={() => setActiveTab('explore')}
        >
          <Compass size={15} aria-hidden="true" />
          Explore
        </button>
        {user && (
          <button
            role="tab"
            aria-selected={activeTab === 'feed'}
            aria-controls="discover-tab-feed"
            id="discover-tab-btn-feed"
            className={tabClass('feed')}
            onClick={() => setActiveTab('feed')}
          >
            <Rss size={15} aria-hidden="true" />
            Friends
          </button>
        )}
      </div>

      {/* ── Explore tab ─────────────────────────────────────────────────── */}
      {activeTab === 'explore' && (
        <div id="discover-tab-explore" role="tabpanel" aria-labelledby="discover-tab-btn-explore">
          {/* Trending section — shown when no filter active */}
          {!query && !category && <TrendingSection />}

          {/* Category chips */}
          <div className="mb-3">
            <CategoryChips
              selected={category}
              onChange={(v) => {
                setCategory(v)
                setQuery('')
              }}
            />
          </div>

          {/* Search bar + view toggle */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search public recipes..."
                aria-label="Search public recipes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0">
              <button
                onClick={() => setGridView(false)}
                aria-pressed={!gridView}
                aria-label="List view"
                className={`p-2 transition-colors ${
                  !gridView
                    ? 'bg-green-700 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <List size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => setGridView(true)}
                aria-pressed={gridView}
                aria-label="Grid view"
                className={`p-2 transition-colors border-l border-gray-200 dark:border-gray-600 ${
                  gridView
                    ? 'bg-green-700 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <LayoutGrid size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {exploreError ? (
            <p className="text-sm text-red-500 text-center py-8">Failed to load public recipes.</p>
          ) : exploreLoading ? (
            gridView ? (
              <div role="status" aria-busy="true" aria-label="Loading public recipes">
                <ul className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <GridSkeleton key={i} />
                  ))}
                </ul>
              </div>
            ) : (
              <div role="status" aria-busy="true" aria-label="Loading public recipes">
                <ul className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </ul>
              </div>
            )
          ) : filteredExplore.length === 0 ? (
            <div className="text-center py-16">
              <Compass size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {query || category
                  ? 'No public recipes match your filters.'
                  : 'No public recipes yet.'}
              </p>
            </div>
          ) : gridView ? (
            <>
              <ul className="grid grid-cols-2 gap-3" aria-live="polite">
                {filteredExplore.map((item) => (
                  <RecipeGridCard key={item.id} item={item} />
                ))}
              </ul>
              {!query && !category && (
                <div ref={exploreSentinelRef}>
                  {exploreFetchingMore && <LoadingSpinner />}
                  {!exploreHasMore && exploreItems.length > 0 && (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                      All public recipes loaded
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <ul className="space-y-3" aria-live="polite">
                {filteredExplore.map((item) => {
                  const eng = exploreEngagement[item.id]
                  return (
                    <RecipeListCard
                      key={item.id}
                      item={item}
                      likeCount={eng?.likeCount}
                      avgRating={eng?.avgRating}
                    />
                  )
                })}
              </ul>
              {!query && !category && (
                <div ref={exploreSentinelRef}>
                  {exploreFetchingMore && <LoadingSpinner />}
                  {!exploreHasMore && exploreItems.length > 0 && (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                      All public recipes loaded
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Friends feed tab ─────────────────────────────────────────────── */}
      {activeTab === 'feed' && user && (
        <div id="discover-tab-feed" role="tabpanel" aria-labelledby="discover-tab-btn-feed">
          {feedError ? (
            <p className="text-sm text-red-500 text-center py-8">Failed to load friends feed.</p>
          ) : feedLoading ? (
            <div role="status" aria-busy="true" aria-label="Loading friends feed">
              <ul className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </ul>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="text-center py-16">
              <Rss size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No recipes from friends yet. Add friends to see their shared recipes here.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-3" aria-live="polite">
                {feedItems.map((item) => (
                  <RecipeListCard key={item.id} item={item} />
                ))}
              </ul>
              <div ref={feedSentinelRef}>
                {feedFetchingMore && <LoadingSpinner />}
                {!feedHasMore && feedItems.length > 0 && (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                    All friends' recipes loaded
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
