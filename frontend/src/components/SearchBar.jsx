import { useState, useRef, useEffect } from 'react'
import { getSuggestions } from '../api'
import './SearchBar.css'

export default function SearchBar({ onSearch, onSelectRecipe }) {
  const [query, setQuery] = useState('')
  const [recipes, setRecipes] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (query.length < 1) {
      setRecipes([])
      setShowDropdown(false)
      return
    }

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await getSuggestions(query)
        setRecipes(data.recipes || [])
        setShowDropdown(true)
        setActiveIndex(-1)
      } catch {
        setRecipes([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timerRef.current)
  }, [query])

  function handleSubmit(e) {
    e.preventDefault()
    setShowDropdown(false)
    if (query.trim()) onSearch(query)
  }

  function pickRecipe(recipe) {
    setShowDropdown(false)
    onSelectRecipe?.(recipe)
  }

  function handleKeyDown(e) {
    if (!showDropdown || recipes.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % recipes.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev - 1 + recipes.length) % recipes.length)
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pickRecipe(recipes[activeIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder='Search your recipes... "spicy noodles"'
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => recipes.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={handleKeyDown}
        />
        {loading && <div className="search-spinner" />}
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => { setQuery(''); setRecipes([]); onSearch(''); inputRef.current?.focus() }}
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && recipes.length > 0 && (
        <div className="suggest-dropdown">
          {recipes.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`suggest-recipe ${activeIndex === i ? 'active' : ''}`}
              onMouseDown={() => pickRecipe(r)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="suggest-recipe-thumb">
                {r.thumbnail_url
                  ? <img src={r.thumbnail_url} alt="" />
                  : <span className="suggest-recipe-placeholder">🍽️</span>
                }
              </div>
              <div className="suggest-recipe-info">
                <span className="suggest-recipe-title">{r.title}</span>
                <span className="suggest-recipe-meta">
                  {r.cuisine && <span>{r.cuisine}</span>}
                  {r.meal_type && <span>{r.meal_type}</span>}
                </span>
              </div>
              {r.cook_time_minutes && (
                <span className="suggest-recipe-time">{r.cook_time_minutes}m</span>
              )}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}
