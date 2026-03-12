# Local Development Setup

## Quick Start

### 1. Start the backend (required for login & data)

```bash
# Option A: Docker (recommended)
docker compose up -d

# Option B: Manual (requires Postgres + Redis running)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173** (or 5174/5175 if that port is in use — check the terminal output).

### 3. Open in browser

Go to the URL shown in the terminal (e.g. `http://localhost:5173` or `http://localhost:5175`).

You should see:
- **Login screen** first — use `demo@recipe.ai` / `demo1234` to log in (backend must be running)
- **Dashboard** after login — recipes, search, filters

## Troubleshooting

**Blank page / nothing showing?**
- Check the browser URL — use the exact port from the `npm run dev` output
- Open DevTools (F12) → Console tab — look for red errors
- Ensure the backend is running — the app needs it for login and data

**"Request failed" or network errors?**
- Backend must be running on port 8000
- Run `docker compose up -d` or `uvicorn app.main:app --reload --port 8000`

**Dark/empty-looking page?**
- The app uses a dark theme; content may be subtle
- Try scrolling or checking if you're on the login screen first
