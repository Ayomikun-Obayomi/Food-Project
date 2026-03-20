import './RecipeDetail.css'

export default function RecipeDetail({ recipe, onClose, onDelete, onToggle }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        {recipe.thumbnail_url && (
          <div className="detail-hero">
            <img src={recipe.thumbnail_url} alt={recipe.title} />
          </div>
        )}

        <div className="detail-body">
          <div className="detail-header">
            <h2>{recipe.title}</h2>
            <div className="detail-actions">
              <button
                className={`detail-btn ${recipe.is_liked ? 'liked' : ''}`}
                onClick={() => onToggle(recipe.id, { is_liked: !recipe.is_liked })}
              >
                {recipe.is_liked ? '❤️ Liked' : '🤍 Like'}
              </button>
            </div>
          </div>

          {recipe.description && (
            <p className="detail-desc">{recipe.description}</p>
          )}

          <div className="detail-meta-row">
            {recipe.cuisine && <span className="detail-chip">{recipe.cuisine}</span>}
            {recipe.meal_type && <span className="detail-chip">{recipe.meal_type}</span>}
            {recipe.cook_time_minutes && <span className="detail-chip">⏱ {recipe.cook_time_minutes} min</span>}
            {recipe.servings && <span className="detail-chip">🍽 {recipe.servings} servings</span>}
            {(recipe.diet_labels || []).map(d => (
              <span key={d} className="detail-chip diet">{d}</span>
            ))}
          </div>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="detail-section">
              <h3>Ingredients</h3>
              <ul className="ingredients-list">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>{ing}</li>
                ))}
              </ul>
            </div>
          )}

          {recipe.instructions && recipe.instructions.length > 0 && (
            <div className="detail-section">
              <h3>Instructions</h3>
              <ol className="instructions-list">
                {recipe.instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="detail-section">
              <h3>Tags</h3>
              <div className="detail-tags">
                {recipe.tags.map(t => (
                  <span key={t} className="tag-pill">{t}</span>
                ))}
              </div>
            </div>
          )}

          {recipe.source_url && (
            <a className="detail-source" href={recipe.source_url} target="_blank" rel="noopener noreferrer">
              View original post →
            </a>
          )}

          <div className="detail-footer">
            <button className="btn-danger" onClick={() => onDelete(recipe.id)}>
              Delete Recipe
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
