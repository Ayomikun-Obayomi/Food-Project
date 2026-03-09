import { useState, useRef, useEffect, useCallback } from 'react'
import { getSuggestions } from '../api'
import './SearchBar.css'

const hasSpeech = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

export default function SearchBar({ onSearch, onSelectRecipe, onAddRecipe, onUploadRecipe }) {
  const [query, setQuery] = useState('')
  const [recipes, setRecipes] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [listening, setListening] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const timerRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const addMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setShowAddMenu(false)
      }
    }
    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddMenu])

  useEffect(() => {
    if (query.length < 2) {
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

  const toggleVoice = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onstart = () => setListening(true)

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setQuery(transcript)
      if (e.results[0]?.isFinal) {
        onSearch(transcript)
      }
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognition.start()
  }, [listening, onSearch])

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-input-wrap">
        <div className="search-add-wrap" ref={addMenuRef}>
          <button
            type="button"
            className={`search-add-trigger ${showAddMenu ? 'open' : ''}`}
            onClick={() => setShowAddMenu(prev => !prev)}
            title="Add recipe"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {showAddMenu && (
            <div className="add-menu">
              <button className="add-menu-item" onMouseDown={() => { setShowAddMenu(false); onAddRecipe?.() }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Create recipe
              </button>
              <button className="add-menu-item" onMouseDown={() => { setShowAddMenu(false); onUploadRecipe?.() }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload recipe
              </button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder='Search recipes... "spicy noodles"'
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => recipes.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={handleKeyDown}
        />
        <div className="search-actions">
          {loading && <div className="search-spinner" />}
          {query ? (
            <button
              type="button"
              className="search-action-btn search-clear-btn"
              onClick={() => { setQuery(''); setRecipes([]); onSearch(''); inputRef.current?.focus() }}
              title="Clear"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : (
            <>
              {hasSpeech && (
                <button
                  type="button"
                  className={`search-action-btn ${listening ? 'listening' : ''}`}
                  onClick={toggleVoice}
                  title={listening ? 'Stop listening' : 'Voice search'}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="9" width="2.5" height="6" rx="1.25" fill="currentColor" />
                    <rect x="8.5" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" />
                    <rect x="13" y="7" width="2.5" height="10" rx="1.25" fill="currentColor" />
                    <rect x="17.5" y="9" width="2.5" height="6" rx="1.25" fill="currentColor" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
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
