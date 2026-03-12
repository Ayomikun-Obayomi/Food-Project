#!/usr/bin/env python3
"""
Run the API locally with SQLite (no Docker needed).
Usage: python run_dev.py
"""
import subprocess
import sys

if __name__ == "__main__":
    print("Starting Recipe AI API on http://localhost:8000")
    print("API docs: http://localhost:8000/docs")
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
        cwd=".",
        env={**__import__("os").environ, "DATABASE_URL": "sqlite+aiosqlite:///./dev.db"},
    )
