import { useState } from 'react'
import { createRecipe } from '../api'
import './AddRecipe.css'

export default function AddRecipe({ onClose, onAdded }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    ingredients: '',
    instructions: '',
    tags: '',
    cuisine: '',
    meal_type: '',
    cook_time_minutes: '',
    servings: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        ingredients: form.ingredients ? form.ingredients.split('\n').map(s => s.trim()).filter(Boolean) : [],
        instructions: form.instructions ? form.instructions.split('\n').map(s => s.trim()).filter(Boolean) : [],
        tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        cuisine: form.cuisine.trim() || null,
        meal_type: form.meal_type || null,
        cook_time_minutes: form.cook_time_minutes ? parseInt(form.cook_time_minutes) : null,
        servings: form.servings ? parseInt(form.servings) : null,
      }
      const recipe = await createRecipe(data)
      onAdded(recipe)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="add-body">
          <h2>Add Recipe</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder="Grandma's chicken soup"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="A warm, comforting soup that tastes like home..."
                rows={2}
              />
            </div>

            <div className="form-row two-col">
              <div className="input-group">
                <label>Cuisine</label>
                <input
                  type="text"
                  value={form.cuisine}
                  onChange={e => update('cuisine', e.target.value)}
                  placeholder="Italian"
                />
              </div>
              <div className="input-group">
                <label>Meal Type</label>
                <select value={form.meal_type} onChange={e => update('meal_type', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
            </div>

            <div className="form-row two-col">
              <div className="input-group">
                <label>Cook Time (min)</label>
                <input
                  type="number"
                  value={form.cook_time_minutes}
                  onChange={e => update('cook_time_minutes', e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="input-group">
                <label>Servings</label>
                <input
                  type="number"
                  value={form.servings}
                  onChange={e => update('servings', e.target.value)}
                  placeholder="4"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Ingredients (one per line)</label>
              <textarea
                value={form.ingredients}
                onChange={e => update('ingredients', e.target.value)}
                placeholder={"2 cups flour\n1 tsp salt\n3 eggs"}
                rows={4}
              />
            </div>

            <div className="input-group">
              <label>Instructions (one step per line)</label>
              <textarea
                value={form.instructions}
                onChange={e => update('instructions', e.target.value)}
                placeholder={"Preheat oven to 350°F\nMix dry ingredients\nCombine and bake 25 min"}
                rows={4}
              />
            </div>

            <div className="input-group">
              <label>Tags (comma separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => update('tags', e.target.value)}
                placeholder="comfort food, soup, easy"
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Adding...' : 'Add Recipe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
