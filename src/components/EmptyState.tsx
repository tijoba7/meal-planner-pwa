import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
        <Icon size={36} strokeWidth={1.5} className="text-green-400 dark:text-green-500" aria-hidden="true" />
      </div>
      <p className="text-base font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link
              to={action.href}
              className="bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
