import React from 'react'

type BadgeVariant = 'default' | 'green' | 'blue' | 'red' | 'amber' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  /** Extra Tailwind classes */
  className?: string
  children: React.ReactNode
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  green:   'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  blue:    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  red:     'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  amber:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  gray:    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

/**
 * Inline badge / pill.
 * Use for tags, categories, status indicators.
 */
export function Badge({ variant = 'default', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
