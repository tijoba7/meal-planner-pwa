import React from 'react'

interface PageHeaderProps {
  title: string
  /** Optional action buttons / links rendered at the trailing edge. */
  actions?: React.ReactNode
  className?: string
}

/**
 * Standard page heading row.
 * Renders `<h2>` with design-system heading classes + optional trailing actions.
 */
export function PageHeader({ title, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
