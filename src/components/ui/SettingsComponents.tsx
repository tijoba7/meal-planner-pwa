// Shared compound components used by SettingsPage and admin pages.

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1">
      {children}
    </h2>
  )
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
      {children}
    </div>
  )
}

export function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>
}

export function RowLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-0.5">{children}</p>
}

export function RowDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 dark:text-gray-500">{children}</p>
}

export function Toggle({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  'aria-label': string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-green-700' : 'bg-gray-200 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
