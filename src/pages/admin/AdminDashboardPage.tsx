export default function AdminDashboardPage() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of admin controls and system status.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          You are in the admin panel. Changes here affect all users.
        </p>
      </div>
    </div>
  )
}
