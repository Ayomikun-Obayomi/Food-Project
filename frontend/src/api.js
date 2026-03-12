const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1';

let token = (() => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
})();

export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  } catch (_) {}
}

export function getToken() {
  return token;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    window.location.reload();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function register(email, password, display_name) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name }),
  });
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  return request('/auth/me');
}

export async function getRecipes(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/recipes?${query}`);
}

export async function getRecipe(id) {
  return request(`/recipes/${id}`);
}

export async function createRecipe(data) {
  return request('/recipes', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteRecipe(id) {
  return request(`/recipes/${id}`, { method: 'DELETE' });
}

export async function toggleFlags(id, flags) {
  const query = new URLSearchParams(flags).toString();
  return request(`/recipes/${id}/flags?${query}`, { method: 'PATCH' });
}

export async function searchRecipes(query, filters = {}) {
  return request('/search', {
    method: 'POST',
    body: JSON.stringify({ query, ...filters }),
  });
}

export async function getSuggestions(partial_query, recipe_limit = 4, suggestion_limit = 3) {
  return request('/search/suggest', {
    method: 'POST',
    body: JSON.stringify({ partial_query, recipe_limit, suggestion_limit }),
  });
}

export async function imageSearch(file) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}/search/image`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    setToken(null);
    window.location.reload();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}
