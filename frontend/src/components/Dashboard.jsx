import { useState, useEffect, useRef, useMemo } from 'react'
import { getRecipes, getRecipe, searchRecipes, deleteRecipe, toggleFlags, imageSearch } from '../api'
import SearchBar from './SearchBar'
import RecipeCard from './RecipeCard'
import RecipeDetail from './RecipeDetail'
import AddRecipe from './AddRecipe'
import './Dashboard.css'

function FilterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  )
}

export default function Dashboard({ user, onLogout }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all') // all, saved, liked
  const [searchResults, setSearchResults] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilter, setActiveFilter] = useState(null)
  const [subFilter, setSubFilter] = useState(null)
  const profileRef = useRef(null)
  const filterRef = useRef(null)
  const fileUploadRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  useEffect(() => {
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilterDrawer(false)
      }
    }
    if (showFilterDrawer) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterDrawer])

  async function loadRecipes() {
    setLoading(true)
    try {
      const data = await getRecipes()
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

  async function handleImageSearch(file) {
    setLoading(true)
    try {
      const data = await imageSearch(file)
      setSearchResults(data)
      setSearchQuery(data.query || 'Image search')
    } catch (err) {
      console.error('Image search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const savedCount = recipes.filter(r => r.is_saved).length
  const likedCount = recipes.filter(r => r.is_liked).length

  const mealCategories = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

  const baseRecipes = view === 'liked' ? recipes.filter(r => r.is_liked) : recipes

  const mealRecipes = useMemo(() => {
    if (!activeFilter) return baseRecipes
    const key = activeFilter.toLowerCase()
    return baseRecipes.filter(r => (r.meal_type || '').toLowerCase() === key)
  }, [baseRecipes, activeFilter])

  const subFilters = useMemo(() => {
    if (!activeFilter) return []
    const list = []
    const seen = new Set()

    const quickCount = mealRecipes.filter(r => r.cook_time_minutes && r.cook_time_minutes <= 15).length
    const under30Count = mealRecipes.filter(r => r.cook_time_minutes && r.cook_time_minutes <= 30).length
    if (quickCount > 0) list.push({ label: 'Quick & Easy', field: 'quick' })
    if (under30Count > quickCount) list.push({ label: 'Under 30 min', field: 'under30' })

    for (const r of mealRecipes) {
      if (r.cuisine && !seen.has(r.cuisine)) {
        seen.add(r.cuisine)
        list.push({ label: r.cuisine, field: 'cuisine' })
      }
    }
    for (const r of mealRecipes) {
      for (const d of (r.diet_labels || [])) {
        if (!seen.has(d)) {
          seen.add(d)
          list.push({ label: d, field: 'diet' })
        }
      }
    }
    return list
  }, [activeFilter, mealRecipes])

  let displayRecipes = searchResults ? searchResults.recipes : mealRecipes
  if (!searchResults && subFilter) {
    const sf = subFilters.find(f => f.label === subFilter)
    if (sf) {
      displayRecipes = displayRecipes.filter(r => {
        if (sf.field === 'quick') return r.cook_time_minutes && r.cook_time_minutes <= 15
        if (sf.field === 'under30') return r.cook_time_minutes && r.cook_time_minutes <= 30
        if (sf.field === 'cuisine') return r.cuisine === sf.label
        if (sf.field === 'diet') return (r.diet_labels || []).includes(sf.label)
        return true
      })
    }
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-logo">🍳</span>
          <h1>Recipe AI</h1>
        </div>
        <div className="dash-header-center">
          <SearchBar
            onSearch={handleSearch}
            onSelectRecipe={handleSelectSuggestedRecipe}
            onAddRecipe={() => setShowAddRecipe(true)}
            onUploadRecipe={() => fileUploadRef.current?.click()}
          />
        </div>
        <div className="dash-profile" ref={profileRef}>
          <button
            className="dash-profile-btn"
            onClick={() => setShowProfileMenu(prev => !prev)}
          >
            <span className="dash-avatar">
              {(user.display_name || user.email || '?')[0].toUpperCase()}
            </span>
          </button>
          {showProfileMenu && (
            <div className="profile-menu">
              <div className="profile-menu-header">
                <span className="profile-menu-avatar">
                  {(user.display_name || user.email || '?')[0].toUpperCase()}
                </span>
                <div className="profile-menu-info">
                  <span className="profile-menu-name">{user.display_name || 'Chef'}</span>
                  <span className="profile-menu-email">{user.email}</span>
                </div>
              </div>
              <div className="profile-menu-divider" />
              <button className="profile-menu-item" onClick={onLogout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="dash-main">

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
          <>
            <div className="toolbar-row">
              {view === 'all' && (
                <>
                  <div className="filter-chips filter-chips-desktop">
                    {activeFilter ? (
                      <>
                        <button
                          className="filter-chip active"
                          onClick={() => { setActiveFilter(null); setSubFilter(null) }}
                        >
                          <span className="filter-chip-x">&times;</span>
                          {activeFilter}
                        </button>
                        {subFilters.map(sf => (
                          <button
                            key={sf.label}
                            className={`filter-chip sub ${subFilter === sf.label ? 'active' : ''}`}
                            onClick={() => setSubFilter(subFilter === sf.label ? null : sf.label)}
                          >
                            {sf.label}
                          </button>
                        ))}
                      </>
                    ) : (
                      mealCategories.map(meal => (
                        <button
                          key={meal}
                          className="filter-chip"
                          onClick={() => setActiveFilter(meal)}
                        >
                          {meal}
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    className="filter-icon-btn"
                    onClick={() => setShowFilterDrawer(true)}
                    aria-label="Open filters"
                  >
                    <FilterIcon />
                    {activeFilter && <span className="filter-icon-badge" />}
                  </button>
                </>
              )}
              <div className="view-tabs">
                {[
                  { key: 'all', label: 'All Recipes', count: recipes.length },
                  { key: 'liked', label: 'Favorites', count: likedCount },
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`view-tab ${view === tab.key ? 'active' : ''}`}
                    onClick={() => { setView(tab.key); setActiveFilter(null); setSubFilter(null) }}
                  >
                    {tab.label}
                    <span className="tab-count">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
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

        {searchResults?.web_results?.length > 0 && (
          <div className="web-results">
            <h3 className="web-results-title">Explore from the web</h3>
            <div className="web-results-grid">
              {searchResults.web_results.map((w, i) => (
                <div key={i} className="web-result-card">
                  <h4>{w.title}</h4>
                  <p>{w.description}</p>
                  <div className="web-result-meta">
                    {w.cuisine && <span>{w.cuisine}</span>}
                    {w.cook_time_minutes && <span>{w.cook_time_minutes} min</span>}
                  </div>
                </div>
              ))}
            </div>
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

      <input
        ref={fileUploadRef}
        type="file"
        accept="image/*,.json,.txt"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && file.type.startsWith('image/')) {
            handleImageSearch(file)
          }
          e.target.value = ''
        }}
      />

      {showAddRecipe && (
        <AddRecipe
          onClose={() => setShowAddRecipe(false)}
          onAdded={(recipe) => {
            setRecipes(prev => [recipe, ...prev])
            setShowAddRecipe(false)
          }}
        />
      )}

      {showFilterDrawer && (
        <div className="filter-drawer-overlay" onClick={() => setShowFilterDrawer(false)}>
          <div className="filter-drawer" ref={filterRef} onClick={e => e.stopPropagation()}>
            <div className="filter-drawer-handle" />
            <div className="filter-drawer-header">
              <h3>Filters</h3>
              <button className="filter-drawer-close" onClick={() => setShowFilterDrawer(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="filter-drawer-body">
              <div className="filter-drawer-section">
                <label className="filter-drawer-label">Meal type</label>
                <div className="filter-drawer-chips">
                  {mealCategories.map(meal => (
                    <button
                      key={meal}
                      className={`filter-chip ${activeFilter === meal ? 'active' : ''}`}
                      onClick={() => setActiveFilter(activeFilter === meal ? null : meal)}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilter && subFilters.length > 0 && (
                <div className="filter-drawer-section">
                  <label className="filter-drawer-label">Refine</label>
                  <div className="filter-drawer-chips">
                    {subFilters.map(sf => (
                      <button
                        key={sf.label}
                        className={`filter-chip sub ${subFilter === sf.label ? 'active' : ''}`}
                        onClick={() => setSubFilter(subFilter === sf.label ? null : sf.label)}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeFilter && (
                <button
                  className="btn-ghost filter-drawer-clear"
                  onClick={() => { setActiveFilter(null); setSubFilter(null); setShowFilterDrawer(false) }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
