import './RecipeCard.css'

export default function RecipeCard({ recipe, onClick, onToggle }) {
  function handleLike(e) {
    e.stopPropagation()
    onToggle(recipe.id, { is_liked: !recipe.is_liked })
  }

  function handleSave(e) {
    e.stopPropagation()
    onToggle(recipe.id, { is_saved: !recipe.is_saved })
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
          <button
            className={`card-action-btn ${recipe.is_liked ? 'active-like' : ''}`}
            onClick={handleLike}
            title={recipe.is_liked ? 'Unlike' : 'Like'}
          >
            {recipe.is_liked ? '❤️' : '🤍'}
          </button>
          <button
            className={`card-action-btn ${recipe.is_saved ? 'active-save' : ''}`}
            onClick={handleSave}
            title={recipe.is_saved ? 'Unsave' : 'Save'}
          >
            {recipe.is_saved ? '🔖' : '📑'}
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
