import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import RecipeFormPage from './pages/RecipeFormPage'
import PlannerPage from './pages/PlannerPage'
import ShoppingListPage from './pages/ShoppingListPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/new" element={<RecipeFormPage />} />
        <Route path="recipes/:id" element={<RecipeDetailPage />} />
        <Route path="recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="shopping" element={<ShoppingListPage />} />
      </Route>
    </Routes>
  )
}
