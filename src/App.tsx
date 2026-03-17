import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminProvider } from './contexts/AdminContext'
import { AuthProvider } from './contexts/AuthContext'
import { MigrationProvider } from './contexts/MigrationContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { SyncProvider } from './contexts/SyncContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { FeatureFlagsProvider, useFeatureFlags } from './hooks/useFeatureFlags'
import ErrorBoundary from './components/ErrorBoundary'
import AdminRoute from './components/AdminRoute'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
// FeedPage is on the critical path (home) — keep as eager import
import FeedPage from './pages/FeedPage'

// All other routes are lazy-loaded
const RecipesPage = lazy(() => import('./pages/RecipesPage'))
const RecipeDetailPage = lazy(() => import('./pages/RecipeDetailPage'))
const RecipeFormPage = lazy(() => import('./pages/RecipeFormPage'))
const RecipeImportPage = lazy(() => import('./pages/RecipeImportPage'))
const PlannerPage = lazy(() => import('./pages/PlannerPage'))
const ShoppingListPage = lazy(() => import('./pages/ShoppingListPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const InvitePage = lazy(() => import('./pages/InvitePage'))
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'))
const SharedRecipeDetailPage = lazy(() => import('./pages/SharedRecipeDetailPage'))
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'))
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const PantryPage = lazy(() => import('./pages/PantryPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
// FeedPage is already eagerly imported above
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminScrapingPage = lazy(() => import('./pages/admin/AdminScrapingPage'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'))

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// Renders children when the feature flag is enabled, otherwise redirects home.
function FeatureRoute({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <Navigate to="/" replace />
  return <>{children}</>
}

// Separate component so it can consume FeatureFlagsContext (provider is above it).
function AppRoutes() {
  const { social, groups, discover } = useFeatureFlags()

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth pages — full-screen, outside the main Layout */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Main app — requires authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FeatureRoute enabled={social}><FeedPage /></FeatureRoute>} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/new" element={<RecipeFormPage />} />
          <Route path="recipes/import" element={<RecipeImportPage />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="meal-plan" element={<PlannerPage />} />
          <Route path="shopping" element={<ShoppingListPage />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="users/:userId" element={<PublicProfilePage />} />
          <Route path="friends" element={<FeatureRoute enabled={social}><FriendsPage /></FeatureRoute>} />
          <Route path="invite/:token" element={<InvitePage />} />
          <Route path="discover" element={<FeatureRoute enabled={discover}><DiscoverPage /></FeatureRoute>} />
          <Route path="feed" element={<FeatureRoute enabled={social}><FeedPage /></FeatureRoute>} />
          <Route path="shared/:id" element={<SharedRecipeDetailPage />} />
          <Route path="groups" element={<FeatureRoute enabled={groups}><GroupsPage /></FeatureRoute>} />
          <Route path="groups/:id" element={<FeatureRoute enabled={groups}><GroupDetailPage /></FeatureRoute>} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:id" element={<CollectionDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="messages" element={<FeatureRoute enabled={social}><MessagesPage /></FeatureRoute>} />
          <Route path="messages/:userId" element={<FeatureRoute enabled={social}><MessagesPage /></FeatureRoute>} />
          <Route path="help" element={<HelpPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin panel — requires auth + admin role */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="scraping" element={<AdminScrapingPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        {/* Top-level catch-all (e.g. /auth/unknown) */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SyncProvider>
            <MigrationProvider>
              <ProfileProvider>
                <AdminProvider>
                  <FeatureFlagsProvider>
                    <ErrorBoundary>
                      <AppRoutes />
                    </ErrorBoundary>
                  </FeatureFlagsProvider>
                </AdminProvider>
              </ProfileProvider>
            </MigrationProvider>
          </SyncProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
