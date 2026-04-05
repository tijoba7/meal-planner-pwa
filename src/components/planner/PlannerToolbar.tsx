import { History, LayoutTemplate, Sparkles } from 'lucide-react'

interface PlannerToolbarProps {
  templatesCount: number
  onHistoryClick: () => void
  onTemplatesClick: () => void
  onSuggestClick: () => void
}

export default function PlannerToolbar({
  templatesCount,
  onHistoryClick,
  onTemplatesClick,
  onSuggestClick,
}: PlannerToolbarProps) {
  return (
    <div className="flex justify-end gap-2 mb-4">
      <button
        onClick={onHistoryClick}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <History size={13} strokeWidth={2} aria-hidden="true" />
        History
      </button>
      <button
        onClick={onTemplatesClick}
        className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 border border-green-700 dark:border-green-500 px-2.5 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
      >
        <LayoutTemplate size={13} strokeWidth={2} aria-hidden="true" />
        Templates{templatesCount > 0 && ` (${templatesCount})`}
      </button>
      <button
        onClick={onSuggestClick}
        className="flex items-center gap-1.5 text-xs font-medium text-purple-700 dark:text-purple-400 border border-purple-400 dark:border-purple-500 px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
        aria-label="What should I cook?"
      >
        <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
        Suggest
      </button>
    </div>
  )
}
