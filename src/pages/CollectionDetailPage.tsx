import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Library, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import {
  useCollection,
  useUpdateCollection,
  useDeleteCollection,
  useAddRecipeToCollection,
  useRemoveRecipeFromCollection,
} from '../hooks/useCollections'
import { useRecipes } from '../hooks/useRecipes'
import { durationToMinutes } from '../lib/db'
import RecipeImage from '../components/RecipeImage'
import EmptyState from '../components/EmptyState'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: collection, isLoading } = useCollection(id ?? '')
  const { data: allRecipes = [] } = useRecipes()
  const updateCollectionMutation = useUpdateCollection()
  const deleteCollectionMutation = useDeleteCollection()
  const addToCollectionMutation = useAddRecipeToCollection()
  const removeFromCollectionMutation = useRemoveRecipeFromCollection()

  const [showAddRecipes, setShowAddRecipes] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [showEditName, setShowEditName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!isLoading && !collection) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Link
          to="/collections"
          className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium mb-4"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Collections
        </Link>
        <p className="text-gray-500 dark:text-gray-400">Collection not found.</p>
      </div>
    )
  }

  if (isLoading || !collection) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    )
  }

  const collectionRecipes = allRecipes.filter((r) => collection.recipeIds.includes(r.id))
  const addableRecipes = allRecipes.filter((r) => {
    if (collection.recipeIds.includes(r.id)) return false
    if (!addSearch.trim()) return true
    return r.name.toLowerCase().includes(addSearch.toLowerCase())
  })

  async function handleRemoveRecipe(recipeId: string) {
    await removeFromCollectionMutation.mutateAsync({ collectionId: collection!.id, recipeId })
  }

  async function handleAddRecipe(recipeId: string) {
    await addToCollectionMutation.mutateAsync({ collectionId: collection!.id, recipeId })
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    await updateCollectionMutation.mutateAsync({
      collectionId: collection!.id,
      data: { name: editName.trim(), description: editDescription.trim() || undefined },
    })
    setShowEditName(false)
  }

  async function handleDelete() {
    await deleteCollectionMutation.mutateAsync(collection!.id)
    navigate('/collections', { replace: true })
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      <Link
        to="/collections"
        className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Collections
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <Library
              size={20}
              strokeWidth={1.75}
              className="text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">
              {collection.name}
            </h2>
            {collection.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {collection.description}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {collection.recipeIds.length} recipe{collection.recipeIds.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setEditName(collection.name)
              setEditDescription(collection.description ?? '')
              setShowEditName(true)
            }}
            aria-label="Edit collection"
            className="text-sm font-medium text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <Pencil size={14} aria-hidden="true" className="inline mr-1" />
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete collection"
            className="text-sm font-medium text-red-500 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} aria-hidden="true" className="inline mr-1" />
            Delete
          </button>
        </div>
      </div>

      {/* Add recipes button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recipes</h3>
        <button
          onClick={() => {
            setShowAddRecipes(true)
            setAddSearch('')
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add recipes
        </button>
      </div>

      {/* Recipe list */}
      {collectionRecipes.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No recipes yet"
          description="Add recipes to this collection to organize your cookbook."
          action={{
            label: 'Add recipes',
            onClick: () => {
              setShowAddRecipes(true)
              setAddSearch('')
            },
          }}
        />
      ) : (
        <ul className="space-y-3">
          {collectionRecipes.map((recipe) => {
            const prepMins = durationToMinutes(recipe.prepTime)
            const cookMins = durationToMinutes(recipe.cookTime)
            return (
              <li key={recipe.id} className="relative">
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
                >
                  {(recipe.imageThumbnailUrl || recipe.image) && (
                    <RecipeImage
                      src={recipe.imageThumbnailUrl ?? recipe.image}
                      alt={recipe.name}
                      className="w-16 h-16 shrink-0 rounded-lg"
                    />
                  )}
                  <div className="flex-1 min-w-0 pr-8">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                      {recipe.name}
                    </h4>
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
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => handleRemoveRecipe(recipe.id)}
                  aria-label={`Remove "${recipe.name}" from collection`}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add recipes modal — portal to escape flex stacking context on mobile */}
      {showAddRecipes && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Add Recipes</h3>
              <button
                onClick={() => setShowAddRecipes(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <input
                type="search"
                placeholder="Search recipes…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {addableRecipes.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                  {addSearch.trim()
                    ? 'No matching recipes.'
                    : 'All your recipes are already in this collection.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {addableRecipes.map((recipe) => (
                    <li key={recipe.id}>
                      <button
                        onClick={() => handleAddRecipe(recipe.id)}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        {(recipe.imageThumbnailUrl || recipe.image) && (
                          <RecipeImage
                            src={recipe.imageThumbnailUrl ?? recipe.image}
                            alt={recipe.name}
                            className="w-10 h-10 shrink-0 rounded-lg"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {recipe.name}
                          </p>
                          {recipe.keywords.length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {recipe.keywords.join(', ')}
                            </p>
                          )}
                        </div>
                        <Check
                          size={16}
                          className="shrink-0 text-green-600 dark:text-green-400 opacity-0"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowAddRecipes(false)}
                className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Edit name/description modal — portal to escape flex stacking context on mobile */}
      {showEditName && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Edit Collection</h3>
              <button
                onClick={() => setShowEditName(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Description <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="edit-description"
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditName(false)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim() || updateCollectionMutation.isPending}
                  className="flex-1 bg-green-700 text-white font-semibold py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateCollectionMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete confirmation — portal to escape flex stacking context on mobile */}
      {confirmDelete && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-collection-title"
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl">
            <h4
              id="delete-collection-title"
              className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2"
            >
              Delete collection?
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This removes the collection but won't delete any recipes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
