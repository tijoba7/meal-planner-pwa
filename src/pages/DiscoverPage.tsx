import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Rss, Search, Globe, Heart, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'
import { getPublicFeed, getFriendsFeed, type CloudRecipeWithAuthor } from '../lib/recipeShareService'
import { getEngagementStats, type EngagementStats } from '../lib/engagementService'
import { durationToMinutes } from '../lib/db'
import Skeleton from '../components/Skeleton'

// ─── Recipe card ──────────────────────────────────────────────────────────────

function RecipeCard({ item, engagement }: { item: CloudRecipeWithAuthor; engagement?: EngagementStats }) {
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
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-tight">{recipe.name}</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{prepMins + cookMins} min</span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">by {authorName}</p>
          {recipe.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{recipe.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{recipe.recipeYield} servings</span>
            <span>·</span>
            <span>prep {prepMins}m</span>
            <span>·</span>
            <span>cook {cookMins}m</span>
            {engagement && engagement.likeCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Heart size={10} className="text-red-400" fill="currentColor" aria-hidden="true" />
                  {engagement.likeCount}
                </span>
              </>
            )}
            {engagement && engagement.avgRating !== null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Star size={10} className="text-yellow-400" fill="currentColor" aria-hidden="true" />
                  {engagement.avgRating}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'explore' | 'feed'

export default function DiscoverPage() {
  const { user } = useAuth()
  const supAvailable = isSupabaseAvailable()

  const [activeTab, setActiveTab] = useState<Tab>('explore')
  const [query, setQuery] = useState('')
  const [exploreItems, setExploreItems] = useState<CloudRecipeWithAuthor[]>([])
  const [feedItems, setFeedItems] = useState<CloudRecipeWithAuthor[]>([])
  const [exploreLoading, setExploreLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [exploreError, setExploreError] = useState<string | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementStats>>({})

  useEffect(() => {
    if (!supAvailable) return
    setExploreLoading(true)
    setExploreError(null)
    getPublicFeed()
      .then((items) => {
        setExploreItems(items)
        if (items.length > 0) {
          getEngagementStats(items.map((i) => i.id)).then((stats) =>
            setEngagementMap((m) => ({ ...m, ...stats }))
          )
        }
      })
      .catch(() => setExploreError('Failed to load public recipes.'))
      .finally(() => setExploreLoading(false))
  }, [supAvailable])

  useEffect(() => {
    if (!supAvailable || !user) return
    setFeedLoading(true)
    setFeedError(null)
    getFriendsFeed(user.id)
      .then((items) => {
        setFeedItems(items)
        if (items.length > 0) {
          getEngagementStats(items.map((i) => i.id)).then((stats) =>
            setEngagementMap((m) => ({ ...m, ...stats }))
          )
        }
      })
      .catch(() => setFeedError('Failed to load friends feed.'))
      .finally(() => setFeedLoading(false))
  }, [supAvailable, user])

  if (!supAvailable) {
    return (
      <div className="p-4 max-w-2xl mx-auto py-16 text-center">
        <Globe size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Connect to Supabase to discover shared recipes.
        </p>
      </div>
    )
  }

  const filteredExplore = query.trim()
    ? exploreItems.filter((item) => {
        const r = item.data
        const q = query.toLowerCase()
        return (
          r.name?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.keywords?.some((k) => k.toLowerCase().includes(q))
        )
      })
    : exploreItems

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
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button className={tabClass('explore')} onClick={() => setActiveTab('explore')}>
          <Compass size={15} aria-hidden="true" />
          Explore
        </button>
        {user && (
          <button className={tabClass('feed')} onClick={() => setActiveTab('feed')}>
            <Rss size={15} aria-hidden="true" />
            Friends
          </button>
        )}
      </div>

      {/* Explore tab */}
      {activeTab === 'explore' && (
        <>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search public recipes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {exploreError ? (
            <p className="text-sm text-red-500 text-center py-8">{exploreError}</p>
          ) : exploreLoading ? (
            <ul className="space-y-3" aria-busy="true" aria-label="Loading public recipes">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </ul>
          ) : filteredExplore.length === 0 ? (
            <div className="text-center py-16">
              <Compass size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {query ? `No public recipes match "${query}".` : 'No public recipes yet.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3" aria-live="polite">
              {filteredExplore.map((item) => (
                <RecipeCard key={item.id} item={item} engagement={engagementMap[item.id]} />
              ))}
            </ul>
          )}
        </>
      )}

      {/* Friends feed tab */}
      {activeTab === 'feed' && user && (
        <>
          {feedError ? (
            <p className="text-sm text-red-500 text-center py-8">{feedError}</p>
          ) : feedLoading ? (
            <ul className="space-y-3" aria-busy="true" aria-label="Loading friends feed">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </ul>
          ) : feedItems.length === 0 ? (
            <div className="text-center py-16">
              <Rss size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No recipes from friends yet. Add friends to see their shared recipes here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3" aria-live="polite">
              {feedItems.map((item) => (
                <RecipeCard key={item.id} item={item} engagement={engagementMap[item.id]} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
