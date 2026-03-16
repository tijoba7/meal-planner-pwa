import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Library, Plus, X } from 'lucide-react'
import { getCollections, createCollection, deleteCollection } from '../lib/db'
import type { Collection } from '../types'
import EmptyState from '../components/EmptyState'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    getCollections().then((c) => {
      setCollections(c)
      setLoading(false)
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    const collection = await createCollection({
      name,
      description: newDescription.trim() || undefined,
      recipeIds: [],
    })
    setCollections((prev) => [collection, ...prev])
    setNewName('')
    setNewDescription('')
    setCreating(false)
    setShowCreate(false)
  }

  async function handleDelete(collectionId: string) {
    await deleteCollection(collectionId)
    setCollections((prev) => prev.filter((c) => c.id !== collectionId))
    setConfirmDeleteId(null)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Collections</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          New Collection
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No collections yet"
          description={'Group your recipes into custom cookbooks like "Weeknight Dinners" or "Holiday Baking".'}
          action={{ label: 'Create your first collection', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <ul className="space-y-3">
          {collections.map((collection) => (
            <li key={collection.id} className="relative">
              <Link
                to={`/collections/${collection.id}`}
                className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                  <Library size={20} strokeWidth={1.75} className="text-green-600 dark:text-green-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{collection.description}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {collection.recipeIds.length} recipe{collection.recipeIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => setConfirmDeleteId(collection.id)}
                aria-label={`Delete collection "${collection.name}"`}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Create collection modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">New Collection</h3>
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setNewDescription('') }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label htmlFor="collection-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  id="collection-name"
                  type="text"
                  placeholder="e.g. Weeknight Dinners"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  required
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="collection-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="collection-description"
                  type="text"
                  placeholder="A short description…"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewName(''); setNewDescription('') }}
                  className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || creating}
                  className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Delete collection?</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This removes the collection but won't delete any recipes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
