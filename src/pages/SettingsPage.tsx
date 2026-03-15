export default function SettingsPage() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Data</h3>
          <p className="text-sm text-gray-400">All data is stored locally in your browser. No account required.</p>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Export</h3>
          <p className="text-sm text-gray-400">Data export coming soon.</p>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">About</h3>
          <p className="text-sm text-gray-400">Mise — Everything in its place. A local-first meal planner and recipe store.</p>
        </div>
      </div>
    </div>
  )
}
