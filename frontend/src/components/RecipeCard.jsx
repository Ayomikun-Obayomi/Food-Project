import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './RecipeCard.css'

export default function RecipeCard({
  recipe,
  onClick,
  onToggle,
  bookmarkCategories = [],
  onUpdateMealType,
  onAddBookmark,
  isBookmarkEditable,
  onRenameBookmark,
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [showNewBookmarkInput, setShowNewBookmarkInput] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [newBookmarkValue, setNewBookmarkValue] = useState('')
  const [editingMenuBookmark, setEditingMenuBookmark] = useState(null)
  const [editMenuBookmarkValue, setEditMenuBookmarkValue] = useState('')
  const menuRef = useRef(null)
  const btnRef = useRef(null)
  const newBookmarkInputRef = useRef(null)
  const editMenuBookmarkInputRef = useRef(null)
  const menuBookmarkClickTimerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      const t = e.target
      if (!(t instanceof Node)) return
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setShowMenu(false)
      setShowNewBookmarkInput(false)
    }
    if (showMenu) {
      /* Capture phase so this runs before other handlers; closes on any outside click */
      document.addEventListener('mousedown', handleClickOutside, true)
      return () => document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [showMenu])

  useEffect(() => {
    if (showNewBookmarkInput) newBookmarkInputRef.current?.focus()
  }, [showNewBookmarkInput])

  useEffect(() => {
    if (editingMenuBookmark) editMenuBookmarkInputRef.current?.focus()
  }, [editingMenuBookmark])

  useEffect(() => {
    if (!showMenu) {
      if (menuBookmarkClickTimerRef.current) {
        clearTimeout(menuBookmarkClickTimerRef.current)
        menuBookmarkClickTimerRef.current = null
      }
      setEditingMenuBookmark(null)
      setEditMenuBookmarkValue('')
    }
  }, [showMenu])

  useEffect(() => () => {
    if (menuBookmarkClickTimerRef.current) clearTimeout(menuBookmarkClickTimerRef.current)
  }, [])

  function handleLike(e) {
    e.stopPropagation()
    onToggle?.(recipe.id, { is_liked: !recipe.is_liked })
  }

  function handleMenuClick(e) {
    e.stopPropagation()
    if (!showMenu && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      /* Right edge of menu lines up with bookmark button (CSS translateX(-100%) on portal) */
      setMenuPos({ top: rect.bottom + 8, left: rect.right })
    }
    setShowMenu(prev => !prev)
  }

  function applyBookmarkMealType(mealType) {
    const isCurrentlyIn = (recipe.meal_type || '').toLowerCase() === (mealType || '').toLowerCase()
    onUpdateMealType?.(recipe.id, isCurrentlyIn ? null : mealType, recipe.meal_type)
    setShowMenu(false)
  }

  function handleSetBookmark(e, mealType) {
    e.stopPropagation()
    applyBookmarkMealType(mealType)
  }

  /** Single-click assigns bookmark; double-click (custom) opens rename — same pattern as “new bookmark”. */
  function handleBookmarkRowClick(cat, editable, e) {
    e.stopPropagation()
    if (!editable) {
      applyBookmarkMealType(cat)
      return
    }
    if (e.detail === 2) {
      if (menuBookmarkClickTimerRef.current) {
        clearTimeout(menuBookmarkClickTimerRef.current)
        menuBookmarkClickTimerRef.current = null
      }
      setEditingMenuBookmark(cat)
      setEditMenuBookmarkValue(cat)
      return
    }
    if (e.detail === 1) {
      menuBookmarkClickTimerRef.current = setTimeout(() => {
        menuBookmarkClickTimerRef.current = null
        applyBookmarkMealType(cat)
      }, 280)
    }
  }

  function handleAddNewBookmark(e) {
    e?.preventDefault()
    e?.stopPropagation()
    const name = newBookmarkValue.trim()
    if (name) {
      onAddBookmark?.(name)
      onUpdateMealType?.(recipe.id, name, recipe.meal_type)
      setNewBookmarkValue('')
      setShowNewBookmarkInput(false)
      setShowMenu(false)
    }
  }

  function handleOpenNewBookmarkInput(e) {
    e?.stopPropagation()
    setShowNewBookmarkInput(true)
  }

  async function handleSaveMenuBookmarkRename(e) {
    e?.preventDefault()
    e?.stopPropagation()
    const oldName = editingMenuBookmark
    if (!oldName || !onRenameBookmark) return
    const ok = await onRenameBookmark(oldName, editMenuBookmarkValue.trim())
    if (ok !== false) {
      setEditingMenuBookmark(null)
      setEditMenuBookmarkValue('')
      setShowMenu(false)
    }
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
                    const editable = typeof isBookmarkEditable === 'function' && isBookmarkEditable(cat)
                    if (editingMenuBookmark === cat) {
                      return (
                        <div
                          key={cat}
                          className="card-menu-add-wrap"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            ref={editMenuBookmarkInputRef}
                            type="text"
                            value={editMenuBookmarkValue}
                            onChange={e => setEditMenuBookmarkValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.stopPropagation()
                                void handleSaveMenuBookmarkRename(e)
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditingMenuBookmark(null)
                                setEditMenuBookmarkValue('')
                              }
                            }}
                            maxLength={24}
                            placeholder="Bookmark name"
                            className="card-menu-add-input"
                            aria-label="Rename bookmark"
                          />
                          <button
                            type="button"
                            className="card-menu-add-btn"
                            onClick={handleSaveMenuBookmarkRename}
                          >
                            Done
                          </button>
                        </div>
                      )
                    }
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`card-menu-item ${isActive ? 'active' : ''}`}
                        onClick={e => handleBookmarkRowClick(cat, editable, e)}
                        title={editable ? 'Double-click to rename' : undefined}
                      >
                        <span className="card-menu-item-label">{cat}</span>
                        {isActive && (
                          <span className="card-menu-item-check" aria-hidden>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.stopPropagation()
                            handleAddNewBookmark(e)
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            setNewBookmarkValue('')
                            setShowNewBookmarkInput(false)
                          }
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
            className={`card-action-btn card-like-btn ${recipe.is_liked ? 'active-like' : ''}`}
            onClick={handleLike}
            title={recipe.is_liked ? 'Unlike' : 'Like'}
            aria-label={recipe.is_liked ? 'Unlike' : 'Like'}
          >
            {recipe.is_liked ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            )}
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
