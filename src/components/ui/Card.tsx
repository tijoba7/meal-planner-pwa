import React from 'react'

interface CardProps {
  /** Extra Tailwind classes */
  className?: string
  /** Make the whole card a hover/focus target */
  onClick?: () => void
  children: React.ReactNode
}

/**
 * Base card surface.
 * bg-white rounded-xl border border-gray-200 — the canonical Mise card shell.
 * Pass onClick to get hover-shadow pointer interaction.
 */
export function Card({ className = '', onClick, children }: CardProps) {
  const interactive = onClick !== undefined
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${interactive ? 'hover:shadow-sm transition-shadow cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.()
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  className?: string
  children: React.ReactNode
}

/** Pinned card header — gray-50 bg with bottom border, typical for section headers. */
export function CardHeader({ className = '', children }: CardHeaderProps) {
  return (
    <div
      className={`px-4 py-2 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700 rounded-t-xl ${className}`}
    >
      {children}
    </div>
  )
}

interface CardBodyProps {
  className?: string
  children: React.ReactNode
}

/** Standard p-4 card content area. */
export function CardBody({ className = '', children }: CardBodyProps) {
  return <div className={`p-4 ${className}`}>{children}</div>
}
