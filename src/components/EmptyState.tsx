import React from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  /** A Lucide icon component (e.g. BookOpen) or any React element to show as the illustration. */
  icon?: React.ElementType
  /** Alternatively, pass a pre-rendered illustration node. */
  illustration?: React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
}

export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
}: EmptyStateProps) {
  const graphic =
    illustration ??
    (icon
      ? React.createElement(icon, { size: 36, strokeWidth: 1.5, className: 'text-green-400' })
      : null)
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div
        className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-5"
        aria-hidden="true"
      >
        {graphic}
      </div>
      <p className="text-base font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link
              to={action.href}
              className="bg-green-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-green-900 transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="bg-green-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-green-900 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
