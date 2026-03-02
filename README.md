# 🍳 Recipe AI Backend

Semantic recipe search backend powered by vector embeddings + Claude AI. Users sync their saved/liked recipes from social media, then search using natural language with AI-powered inline suggestions.

## Stack

- **FastAPI** — async Python API framework
- **PostgreSQL + pgvector** — recipe storage + semantic vector search
- **Redis** — caching + Celery task broker
- **OpenAI embeddings** — `text-embedding-3-small` for recipe vectors
- **Anthropic Claude** — inline search suggestions + recipe extraction from posts
- **Celery** — background social media sync workers

## Project Structure

```
app/
├── main.py                  # FastAPI app entry point
├── core/
│   ├── config.py            # Settings from .env
│   ├── database.py          # Async SQLAlchemy + pgvector init
│   └── cache.py             # Redis cache helpers
├── models/
│   ├── models.py            # SQLAlchemy ORM models
│   └── schemas.py           # Pydantic request/response schemas
├── services/
│   ├── auth_service.py      # JWT auth + password hashing
│   ├── search_service.py    # Embeddings, vector search, AI suggestions
│   └── recipe_service.py    # Recipe CRUD
├── api/
│   ├── auth.py              # POST /register, /login, GET /me
│   ├── recipes.py           # CRUD /recipes
│   ├── search.py            # POST /search, /search/suggest, /search/stream-narrative
│   └── sync.py              # POST /sync/{platform}
└── workers/
    └── sync_worker.py       # Celery tasks for Instagram/TikTok sync
```

## Quick Start

### 1. Clone & configure

```bash
cp .env.example .env
# Fill in your OPENAI_API_KEY, ANTHROPIC_API_KEY, and SECRET_KEY
```

### 2. Start with Docker (recommended)

```bash
docker-compose up
```

This spins up Postgres (with pgvector), Redis, the API server, and the Celery worker.

### 3. Or run locally

```bash
# Start Postgres and Redis separately, then:
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# In a separate terminal, start the worker:
celery -A app.workers.sync_worker worker --loglevel=info -Q social_sync,embeddings
```

### 4. API is live at

- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT token |
| GET | `/api/v1/auth/me` | Current user |

### Recipes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/recipes` | List all recipes |
| POST | `/api/v1/recipes` | Add a recipe |
| GET | `/api/v1/recipes/{id}` | Get single recipe |
| PATCH | `/api/v1/recipes/{id}/flags` | Toggle saved/liked |
| DELETE | `/api/v1/recipes/{id}` | Delete recipe |

### Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/search` | Semantic search |
| POST | `/api/v1/search/suggest` | Inline AI suggestions (debounce ~300ms) |
| POST | `/api/v1/search/stream-narrative` | SSE stream of AI summary |

### Social Sync
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/sync/{platform}` | Kick off sync (instagram/tiktok) |
| GET | `/api/v1/sync/{platform}/status` | Check sync status |

## How Search Works

1. User types a query → frontend debounces 300ms → hits `/search/suggest`
2. Claude looks at a sample of their recipe library and generates 5 completions
3. User picks a suggestion or submits the search → hits `/search`
4. Query is embedded with OpenAI → pgvector cosine similarity search runs
5. Top results returned, ranked by semantic similarity
6. Optional: `/search/stream-narrative` streams a one-line AI summary of results

## Social Sync Notes

Instagram and TikTok both require OAuth approval to access saved/liked content:

- **Instagram**: Apply for Instagram Basic Display API or Creator API. Users must grant `user_media` scope.
- **TikTok**: Apply for TikTok Login Kit. Users must grant `user.info.basic` and `video.list` scopes.

The sync workers in `app/workers/sync_worker.py` are scaffolded with the full pattern — fill in the actual API calls once you have credentials approved.

## Production Checklist

- [ ] Encrypt `access_token` / `refresh_token` in the DB (use Fernet or AWS KMS)
- [ ] Replace `SECRET_KEY` with a strong random value
- [ ] Set `APP_ENV=production` to disable SQL echo
- [ ] Add rate limiting (slowapi or nginx)
- [ ] Add HTTPS via a reverse proxy (nginx/Caddy)
- [ ] Set up Celery beat for scheduled re-syncs
