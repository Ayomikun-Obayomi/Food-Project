import asyncio
import base64

from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.core.database import get_db
from app.models.models import User
from app.models.schemas import SearchRequest, SearchResult, SuggestRequest, SuggestResponse, RecipeOut, WebRecipeSuggestion
from app.services.auth_service import get_current_user
from app.services.search_service import (
    vector_search,
    live_suggest,
    stream_search_narrative,
    save_search_history,
    identify_food_from_image,
    suggest_web_recipes,
)

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResult)
async def search_recipes(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Main search endpoint — performs semantic vector search against the user's recipes.
    Optionally filters by meal type, diet labels, or max cook time.
    """
    filters = {}
    if body.cuisine:
        filters["cuisine"] = body.cuisine
    if body.meal_type:
        filters["meal_type"] = body.meal_type
    if body.diet_labels:
        filters["diet_labels"] = body.diet_labels
    if body.max_cook_time:
        filters["max_cook_time"] = body.max_cook_time

    recipes = await vector_search(
        db=db,
        user_id=str(current_user.id),
        query=body.query,
        limit=body.limit,
        filters=filters or None,
    )

    asyncio.create_task(
        save_search_history(db, str(current_user.id), body.query, len(recipes))
    )

    web_results = []
    has_good_matches = any(
        r.get("similarity_score", 0) > 0.8 for r in recipes
    )
    if len(recipes) < 3 or not has_good_matches:
        web_suggestions = await suggest_web_recipes(body.query, limit=5)
        web_results = [WebRecipeSuggestion(**w) for w in web_suggestions]

    return SearchResult(
        recipes=[RecipeOut(**r) for r in recipes],
        web_results=web_results,
        total=len(recipes),
    )


@router.post("/suggest", response_model=SuggestResponse)
async def suggest_live(
    body: SuggestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Live inline suggest — fires after just 1 character typed.
    Frontend should debounce ~200ms before calling.

    Returns:
    - recipes: real recipe objects from the user's library (title, thumbnail, cook time, cuisine)
    - suggestions: 3 AI-generated smart search ideas grounded in their library

    Dropdown layout suggestion:
      ┌─────────────────────────────────┐
      │ 🍳 Spicy Tuna Pasta     20 min  │  ← recipe hit
      │ 🍳 Korean Spicy Chicken  35 min │  ← recipe hit
      │ ─────────────────────────────── │
      │ 🔍 spicy meals under 30 min     │  ← AI suggestion
      │ 🔍 spicy Thai noodles           │  ← AI suggestion
      └─────────────────────────────────┘
    """
    # Trigger on 1 character — but bail on just whitespace
    if not body.partial_query.strip():
        return SuggestResponse(recipes=[], suggestions=[])

    result = await live_suggest(
        partial_query=body.partial_query.strip(),
        user_id=str(current_user.id),
        db=db,
        recipe_limit=body.recipe_limit,
        suggestion_limit=body.suggestion_limit,
    )

    return SuggestResponse(
        recipes=result["recipes"],
        suggestions=result["suggestions"],
    )


@router.post("/image", response_model=SearchResult)
async def search_by_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Image search — upload a photo of food, AI identifies it,
    then searches the user's recipe library for matches.
    """
    contents = await file.read()
    b64 = base64.standard_b64encode(contents).decode("utf-8")
    media_type = file.content_type or "image/jpeg"

    description = await identify_food_from_image(b64, media_type)

    recipes = await vector_search(
        db=db,
        user_id=str(current_user.id),
        query=description,
        limit=10,
    )

    asyncio.create_task(
        save_search_history(db, str(current_user.id), f"[image] {description}", len(recipes))
    )

    return SearchResult(
        recipes=[RecipeOut(**r) for r in recipes],
        total=len(recipes),
        query=description,
    )


@router.post("/stream-narrative")
async def stream_search_summary(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Streaming endpoint — returns a short AI-generated sentence about the results.
    Use Server-Sent Events on the frontend to display as it streams in.
    """
    recipes = await vector_search(
        db=db,
        user_id=str(current_user.id),
        query=body.query,
        limit=5,
    )

    async def event_generator():
        async for chunk in stream_search_narrative(body.query, recipes):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
