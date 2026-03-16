import { Lock, Users, Globe } from 'lucide-react'
import type { RecipeVisibility } from '../../types/supabase'

interface VisibilityBadgeProps {
  visibility: RecipeVisibility
  className?: string
}

const CONFIG: Record<RecipeVisibility, { icon: typeof Lock; label: string; classes: string }> = {
  private: { icon: Lock, label: 'Private', classes: 'bg-gray-100 text-gray-500' },
  friends: { icon: Users, label: 'Friends', classes: 'bg-green-50 text-green-700' },
  public: { icon: Globe, label: 'Public', classes: 'bg-green-100 text-green-800' },
}

/**
 * Small inline badge indicating who can see a recipe.
 *
 * @example
 * <VisibilityBadge visibility="friends" />
 */
export default function VisibilityBadge({ visibility, className = '' }: VisibilityBadgeProps) {
  const { icon: Icon, label, classes } = CONFIG[visibility]
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${classes} ${className}`}
    >
      <Icon size={10} strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  )
}
