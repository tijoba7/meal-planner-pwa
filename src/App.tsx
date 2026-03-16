import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { MigrationProvider } from './contexts/MigrationContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { SyncProvider } from './contexts/SyncContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import RecipesPage from './pages/RecipesPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RecipeFormPage from './pages/RecipeFormPage'
import RecipeImportPage from './pages/RecipeImportPage'
import PlannerPage from './pages/PlannerPage'
import ShoppingListPage from './pages/ShoppingListPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import PublicProfilePage from './pages/PublicProfilePage'
import FriendsPage from './pages/FriendsPage'
import InvitePage from './pages/InvitePage'
import DiscoverPage from './pages/DiscoverPage'
import SharedRecipeDetailPage from './pages/SharedRecipeDetailPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import CollectionsPage from './pages/CollectionsPage'
import CollectionDetailPage from './pages/CollectionDetailPage'
import NotificationsPage from './pages/NotificationsPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthProvider>
      <SyncProvider>
      <MigrationProvider>
      <ProfileProvider>
        <ErrorBoundary>
        <Routes>
          {/* Auth pages — full-screen, outside the main Layout */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignUpPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          {/* Main app */}
          <Route path="/" element={<Layout />}>
            <Route index element={<RecipesPage />} />
            <Route path="recipes/new" element={<RecipeFormPage />} />
            <Route path="recipes/import" element={<RecipeImportPage />} />
            <Route path="recipes/:id" element={<RecipeDetailPage />} />
            <Route path="recipes/:id/edit" element={<RecipeFormPage />} />
            <Route path="meal-plan" element={<PlannerPage />} />
            <Route path="shopping" element={<ShoppingListPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="users/:userId" element={<PublicProfilePage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="invite/:token" element={<InvitePage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="shared/:id" element={<SharedRecipeDetailPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:id" element={<GroupDetailPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="collections/:id" element={<CollectionDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Top-level catch-all (e.g. /auth/unknown) */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </ProfileProvider>
      </MigrationProvider>
      </SyncProvider>
    </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}
