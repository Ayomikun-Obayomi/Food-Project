import { useState, useEffect } from 'react'
import { getRecipes, getRecipe, searchRecipes, deleteRecipe, toggleFlags } from '../api'
import SearchBar from './SearchBar'
import RecipeCard from './RecipeCard'
import RecipeDetail from './RecipeDetail'
import AddRecipe from './AddRecipe'
import './Dashboard.css'

export default function Dashboard({ user, onLogout }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all') // all, saved, liked
  const [searchResults, setSearchResults] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showAddRecipe, setShowAddRecipe] = useState(false)

  async function loadRecipes() {
    setLoading(true)
    try {
      const params = {}
      if (view === 'saved') params.saved_only = true
      if (view === 'liked') params.liked_only = true
      const data = await getRecipes(params)
      setRecipes(data)
    } catch (err) {
      console.error('Failed to load recipes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSearchResults(null)
    setSearchQuery('')
    loadRecipes()
  }, [view])

  async function handleSearch(query) {
    if (!query.trim()) {
      setSearchResults(null)
      setSearchQuery('')
      return
    }
    setSearchQuery(query)
    setLoading(true)
    try {
      const data = await searchRecipes(query)
      setSearchResults(data)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteRecipe(id)
      setRecipes(prev => prev.filter(r => r.id !== id))
      if (searchResults) {
        setSearchResults(prev => ({
          ...prev,
          recipes: prev.recipes.filter(r => r.id !== id),
        }))
      }
      setSelectedRecipe(null)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleToggle(id, flags) {
    try {
      const updated = await toggleFlags(id, flags)
      const update = list => list.map(r => r.id === id ? updated : r)
      setRecipes(update)
      if (searchResults) {
        setSearchResults(prev => ({ ...prev, recipes: update(prev.recipes) }))
      }
      if (selectedRecipe?.id === id) setSelectedRecipe(updated)
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }

  async function handleSelectSuggestedRecipe(suggestedRecipe) {
    try {
      const full = await getRecipe(suggestedRecipe.id)
      setSelectedRecipe(full)
    } catch {
      setSelectedRecipe(suggestedRecipe)
    }
  }

  const displayRecipes = searchResults ? searchResults.recipes : recipes

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-logo">🍳</span>
          <h1>Recipe AI</h1>
        </div>
        <div className="dash-header-right">
          <span className="dash-user">
            {user.display_name || user.email}
          </span>
          <button className="btn-ghost" onClick={onLogout}>Sign Out</button>
        </div>
      </header>

      <main className="dash-main">
        <SearchBar onSearch={handleSearch} onSelectRecipe={handleSelectSuggestedRecipe} />

        {searchQuery && searchResults && (
          <div className="search-info">
            <p>
              {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for
              <strong> &ldquo;{searchQuery}&rdquo;</strong>
            </p>
            <button className="btn-ghost" onClick={() => { setSearchResults(null); setSearchQuery('') }}>
              Clear
            </button>
          </div>
        )}

        {!searchQuery && (
          <div className="view-tabs">
            {['all', 'saved', 'liked'].map(v => (
              <button
                key={v}
                className={`view-tab ${view === v ? 'active' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'all' ? 'All Recipes' : v === 'saved' ? 'Saved' : 'Liked'}
              </button>
            ))}
            <button className="btn-add" onClick={() => setShowAddRecipe(true)}>
              + Add Recipe
            </button>
          </div>
        )}

        {loading ? (
          <div className="dash-loading">
            <div className="loading-spinner" />
          </div>
        ) : displayRecipes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">🍽️</p>
            <p>No recipes found</p>
            <p className="empty-hint">
              {searchQuery ? 'Try a different search' : 'Add some recipes to get started'}
            </p>
          </div>
        ) : (
          <div className="recipe-grid">
            {displayRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => setSelectedRecipe(recipe)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </main>

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />
      )}

      {showAddRecipe && (
        <AddRecipe
          onClose={() => setShowAddRecipe(false)}
          onAdded={(recipe) => {
            setRecipes(prev => [recipe, ...prev])
            setShowAddRecipe(false)
          }}
        />
      )}
    </div>
  )
}
