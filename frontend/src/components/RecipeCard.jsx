import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './RecipeCard.css'

export default function RecipeCard({ recipe, onClick, onToggle, bookmarkCategories = [], onUpdateMealType, onAddBookmark }) {
  const [showMenu, setShowMenu] = useState(false)
  const [showNewBookmarkInput, setShowNewBookmarkInput] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [newBookmarkValue, setNewBookmarkValue] = useState('')
  const menuRef = useRef(null)
  const btnRef = useRef(null)
  const newBookmarkInputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setShowMenu(false)
        setShowNewBookmarkInput(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  useEffect(() => {
    if (showNewBookmarkInput) newBookmarkInputRef.current?.focus()
  }, [showNewBookmarkInput])

  function handleLike(e) {
    e.stopPropagation()
    onToggle?.(recipe.id, { is_liked: !recipe.is_liked })
  }

  function handleMenuClick(e) {
    e.stopPropagation()
    if (!showMenu && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 6, left: rect.right - 150 })
    }
    setShowMenu(prev => !prev)
  }

  function handleSetBookmark(e, mealType) {
    e.stopPropagation()
    const isCurrentlyIn = (recipe.meal_type || '').toLowerCase() === (mealType || '').toLowerCase()
    onUpdateMealType?.(recipe.id, isCurrentlyIn ? null : mealType)
    setShowMenu(false)
  }

  function handleAddNewBookmark(e) {
    e?.stopPropagation()
    const name = newBookmarkValue.trim()
    if (name) {
      onAddBookmark?.(name)
      onUpdateMealType?.(recipe.id, name)
      setNewBookmarkValue('')
      setShowNewBookmarkInput(false)
      setShowMenu(false)
    }
  }

  function handleOpenNewBookmarkInput(e) {
    e?.stopPropagation()
    setShowNewBookmarkInput(true)
  }

  return (
    <div className="recipe-card" onClick={onClick}>
      <div className="card-image">
        {recipe.thumbnail_url ? (
          <img src={recipe.thumbnail_url} alt={recipe.title} loading="lazy" />
        ) : (
          <div className="card-image-placeholder">🍽️</div>
        )}
        <div className="card-actions">
          {onUpdateMealType && (
            <div className="card-menu-wrap">
              <button
                ref={btnRef}
                className={`card-action-btn card-menu-btn ${recipe.meal_type ? 'active-save' : ''}`}
                onClick={handleMenuClick}
                title={recipe.meal_type ? `Bookmarked in ${recipe.meal_type}` : 'Bookmark'}
                aria-label="Bookmark"
              >
                {recipe.meal_type ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                  </svg>
                )}
              </button>
              {showMenu && createPortal(
                <div
                  ref={menuRef}
                  className="card-menu-dropdown card-menu-dropdown-portal"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
                  <div className="card-menu-label">Bookmark</div>
                  {bookmarkCategories.map(cat => {
                    const isActive = (recipe.meal_type || '').toLowerCase() === cat.toLowerCase()
                    return (
                      <button
                        key={cat}
                        className={`card-menu-item ${isActive ? 'active' : ''}`}
                        onClick={e => handleSetBookmark(e, cat)}
                      >
                        <span className="card-menu-item-label">{cat}</span>
                        {isActive && (
                          <span className="card-menu-item-check" aria-hidden>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {showNewBookmarkInput ? (
                    <div className="card-menu-add-wrap">
                      <input
                        ref={newBookmarkInputRef}
                        type="text"
                        value={newBookmarkValue}
                        onChange={e => setNewBookmarkValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddNewBookmark(e)
                          if (e.key === 'Escape') { setNewBookmarkValue(''); setShowNewBookmarkInput(false) }
                        }}
                        placeholder="New bookmark..."
                        maxLength={24}
                        className="card-menu-add-input"
                      />
                      <button
                        type="button"
                        className="card-menu-add-btn"
                        onClick={handleAddNewBookmark}
                        disabled={!newBookmarkValue.trim()}
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="card-menu-item card-menu-add-trigger"
                      onClick={handleOpenNewBookmarkInput}
                    >
                      + New bookmark
                    </button>
                  )}
                  {recipe.meal_type && (
                    <button
                      className="card-menu-item card-menu-remove"
                      onClick={e => handleSetBookmark(e, null)}
                    >
                      Remove bookmark
                    </button>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}
          <button
            className={`card-action-btn ${recipe.is_liked ? 'active-like' : ''}`}
            onClick={handleLike}
            title={recipe.is_liked ? 'Unlike' : 'Like'}
          >
            {recipe.is_liked ? '❤️' : '🤍'}
          </button>
        </div>
        {recipe.cook_time_minutes && (
          <span className="card-time">{recipe.cook_time_minutes} min</span>
        )}
      </div>

      <div className="card-body">
        <h3 className="card-title">{recipe.title}</h3>
        {recipe.description && (
          <p className="card-desc">{recipe.description}</p>
        )}
        <div className="card-meta">
          {recipe.cuisine && <span className="card-tag cuisine">{recipe.cuisine}</span>}
          {recipe.meal_type && <span className="card-tag meal">{recipe.meal_type}</span>}
          {(recipe.diet_labels || []).map(d => (
            <span key={d} className="card-tag diet">{d}</span>
          ))}
        </div>
        {recipe.similarity_score != null && (
          <div className="card-score">
            <div className="score-bar">
              <div className="score-fill" style={{ width: `${recipe.similarity_score * 100}%` }} />
            </div>
            <span>{Math.round(recipe.similarity_score * 100)}% match</span>
          </div>
        )}
      </div>
    </div>
  )
}
