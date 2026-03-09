"""
Search service — uses OpenAI embeddings + pgvector in production,
falls back to keyword search + canned suggestions in dev-lite mode.
"""
import asyncio
import json
import math
import re
import random
from typing import List, Optional, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.cache import cache_get, cache_set
from app.models.models import Recipe, SearchHistory

settings = get_settings()

_has_openai = bool(settings.openai_api_key)
_has_anthropic = bool(settings.anthropic_api_key)
_is_postgres = "postgresql" in settings.database_url

_openai_client = None
_anthropic_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        _anthropic_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


# ── Image identification ──────────────────────────────────────────────────────

async def identify_food_from_image(image_b64: str, media_type: str = "image/jpeg") -> str:
    """Use Claude vision to identify food in an image and return a search query."""
    if _has_anthropic:
        client = _get_anthropic_client()
        message = await client.messages.create(
            model=settings.chat_model,
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Identify the food or dish in this image. "
                            "Reply with ONLY a short search query (2-6 words) "
                            "describing the dish, cuisine, and key ingredients. "
                            "No explanation, just the search terms."
                        ),
                    },
                ],
            }],
        )
        return message.content[0].text.strip()

    return "food dish"


# ── Embeddings ────────────────────────────────────────────────────────────────

async def embed_text(text_input: str) -> List[float]:
    """Generate an embedding vector. Returns empty list if no OpenAI key."""
    if not _has_openai:
        return []

    cache_key = f"embed:{hash(text_input)}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    client = _get_openai_client()
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=text_input,
    )
    vector = response.data[0].embedding
    await cache_set(cache_key, vector, ttl=3600)
    return vector


def _recipe_to_embed_text(recipe: dict) -> str:
    """Convert recipe fields into a single string for embedding."""
    parts = [
        recipe.get("title", ""),
        recipe.get("description", ""),
        " ".join(recipe.get("tags", []) or []),
        " ".join(recipe.get("ingredients", []) or []),
        recipe.get("cuisine", ""),
        recipe.get("meal_type", ""),
        " ".join(recipe.get("diet_labels", []) or []),
    ]
    return " ".join(p for p in parts if p).strip()


async def embed_recipe(recipe_data: dict) -> List[float]:
    """Embed a recipe for storage. Returns empty list when no API key."""
    embed_str = _recipe_to_embed_text(recipe_data)
    return await embed_text(embed_str)


# ── Vector / keyword search ──────────────────────────────────────────────────

def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _recipe_row_to_dict(r) -> dict:
    return {
        "id": str(r.id),
        "title": r.title,
        "description": r.description,
        "ingredients": r.ingredients,
        "instructions": r.instructions,
        "tags": r.tags,
        "cuisine": r.cuisine,
        "meal_type": r.meal_type,
        "diet_labels": r.diet_labels,
        "cook_time_minutes": r.cook_time_minutes,
        "servings": r.servings,
        "source_platform": r.source_platform,
        "source_url": r.source_url,
        "thumbnail_url": r.thumbnail_url,
        "is_saved": r.is_saved,
        "is_liked": r.is_liked,
        "created_at": r.created_at,
    }


_NOISE_WORDS = {
    "show", "me", "all", "the", "my", "find", "get", "give",
    "some", "any", "a", "an", "of", "with", "for", "and",
    "dishes", "dish", "food", "foods", "recipe", "recipes",
    "meal", "meals", "stuff", "things", "options",
}

_FLAVOR_DESCRIPTORS = {
    "spicy":    ["chili", "pepper", "hot sauce", "sriracha", "cayenne", "jalapeño",
                 "habanero", "gochujang", "wasabi", "chipotle", "red pepper flakes", "hot"],
    "sweet":    ["sugar", "honey", "maple", "chocolate", "caramel", "vanilla",
                 "cinnamon", "dessert", "cake", "pastry", "fruit", "berry", "molasses"],
    "savory":   ["garlic", "onion", "soy sauce", "umami", "mushroom", "herb",
                 "thyme", "rosemary", "broth", "roasted", "braised", "parmesan"],
    "sour":     ["lemon", "lime", "vinegar", "citrus", "tamarind", "yogurt",
                 "pickle", "fermented", "kimchi", "sauerkraut"],
    "tangy":    ["lemon", "lime", "vinegar", "citrus", "mustard", "tamarind",
                 "yogurt", "buttermilk", "pickle"],
    "creamy":   ["cream", "cheese", "butter", "coconut milk", "yogurt", "alfredo",
                 "béchamel", "ricotta", "mascarpone", "avocado"],
    "crispy":   ["fried", "baked", "crunchy", "breaded", "tempura", "panko",
                 "toasted", "crackling", "fritter"],
    "smoky":    ["smoked", "barbecue", "bbq", "charred", "grilled", "chipotle",
                 "paprika", "mesquite", "bacon"],
    "fresh":    ["salad", "raw", "herb", "mint", "basil", "cilantro", "cucumber",
                 "tomato", "arugula", "ceviche"],
    "rich":     ["butter", "cream", "chocolate", "cheese", "braised", "stew",
                 "risotto", "truffle", "gravy", "ragu"],
    "light":    ["salad", "steamed", "poached", "broth", "grilled", "raw",
                 "low-calorie", "fresh", "citrus"],
    "hearty":   ["stew", "soup", "casserole", "pot pie", "braised", "bean",
                 "lentil", "chili", "roast", "meat"],
    "zesty":    ["lemon", "lime", "orange", "ginger", "chili", "cilantro",
                 "garlic", "pepper"],
    "bitter":   ["dark chocolate", "coffee", "kale", "arugula", "radicchio",
                 "broccoli rabe", "grapefruit", "turmeric"],
    "mild":     ["butter", "rice", "potato", "bread", "chicken", "tofu",
                 "steamed", "plain", "simple"],
    "comfort":  ["mac and cheese", "soup", "stew", "casserole", "pot pie",
                 "pasta", "mashed", "grilled cheese", "fried chicken"],
    "healthy":  ["salad", "steamed", "grilled", "lean", "vegetable", "quinoa",
                 "whole grain", "low-fat", "fresh", "green"],
}


async def _parse_query_filters(
    db: AsyncSession,
    user_id: str,
    query: str,
    explicit_filters: Optional[dict],
) -> tuple:
    """
    Parse natural language queries into structured filters.

    "show me all Italian dishes"      → cuisine=Italian, leftover=""
    "quick breakfast under 30 min"    → meal_type=breakfast, max_cook_time=30, leftover="quick"
    "vegetarian lunch"                → diet=vegetarian, meal_type=lunch, leftover=""
    "spicy chicken"                   → no filters extracted, leftover="spicy chicken"
    """
    filters = dict(explicit_filters or {})

    result = await db.execute(
        select(
            Recipe.cuisine, Recipe.meal_type, Recipe.diet_labels,
        )
        .where(Recipe.user_id == user_id)
    )
    rows = result.all()

    known_cuisines = {r.cuisine.lower(): r.cuisine for r in rows if r.cuisine}
    known_meals = {r.meal_type.lower(): r.meal_type for r in rows if r.meal_type}
    known_diets = {}
    for r in rows:
        for d in (r.diet_labels or []):
            known_diets[d.lower()] = d

    words = query.lower().split()
    remaining = []

    time_match = re.search(r'under\s+(\d+)\s*(?:min|minutes?|m)\b', query, re.IGNORECASE)
    if time_match and "max_cook_time" not in filters:
        filters["max_cook_time"] = int(time_match.group(1))
        query = query[:time_match.start()] + query[time_match.end():]
        words = query.lower().split()

    for word in words:
        if word in _NOISE_WORDS:
            continue

        if word in known_cuisines and "cuisine" not in filters:
            filters["cuisine"] = known_cuisines[word]
        elif word in known_meals and "meal_type" not in filters:
            filters["meal_type"] = known_meals[word]
        elif word in known_diets and "diet_labels" not in filters:
            filters["diet_labels"] = [known_diets[word]]
        else:
            bigram_matched = False
            for i, w in enumerate(words):
                if w == word and i + 1 < len(words):
                    bigram = f"{word} {words[i+1]}"
                    if bigram in known_cuisines and "cuisine" not in filters:
                        filters["cuisine"] = known_cuisines[bigram]
                        bigram_matched = True
                        break
                    if bigram in known_diets and "diet_labels" not in filters:
                        filters["diet_labels"] = [known_diets[bigram]]
                        bigram_matched = True
                        break
            if not bigram_matched:
                remaining.append(word)

    leftover = " ".join(remaining).strip()
    return leftover, filters


async def vector_search(
    db: AsyncSession,
    user_id: str,
    query: str,
    limit: int = 10,
    filters: Optional[dict] = None,
) -> List[dict]:
    """
    Search the user's recipe library with natural language understanding.

    Parses queries like "show me all Italian dishes" into structured filters,
    then runs the appropriate search strategy:
    - Postgres + OpenAI key → pgvector cosine similarity
    - SQLite  + OpenAI key → in-Python cosine similarity on embedding_json
    - No OpenAI key        → keyword ILIKE fallback
    """
    leftover, merged_filters = await _parse_query_filters(db, user_id, query, filters)

    search_query = leftover if leftover else query

    if _has_openai and _is_postgres:
        return await _pgvector_search(db, user_id, search_query, limit, merged_filters or None)
    if _has_openai:
        return await _embedding_search_sqlite(db, user_id, search_query, limit, merged_filters or None)
    return await _keyword_search(db, user_id, search_query, limit, merged_filters or None)


async def _pgvector_search(
    db: AsyncSession,
    user_id: str,
    query: str,
    limit: int,
    filters: Optional[dict],
) -> List[dict]:
    query_vector = await embed_text(query)
    vector_str = f"[{','.join(str(v) for v in query_vector)}]"

    filter_clauses = ["user_id = :user_id", "embedding IS NOT NULL"]
    params: dict = {"user_id": user_id, "limit": limit, "vector": vector_str}

    if filters:
        if filters.get("cuisine"):
            filter_clauses.append("cuisine = :cuisine")
            params["cuisine"] = filters["cuisine"]
        if filters.get("meal_type"):
            filter_clauses.append("meal_type = :meal_type")
            params["meal_type"] = filters["meal_type"]
        if filters.get("max_cook_time"):
            filter_clauses.append("cook_time_minutes <= :max_cook_time")
            params["max_cook_time"] = filters["max_cook_time"]
        if filters.get("diet_labels"):
            filter_clauses.append("diet_labels @> :diet_labels")
            params["diet_labels"] = filters["diet_labels"]

    where_clause = " AND ".join(filter_clauses)

    sql = text(f"""
        SELECT
            id, title, description, ingredients, instructions, tags, cuisine,
            meal_type, diet_labels, cook_time_minutes, servings,
            source_platform, source_url, thumbnail_url,
            is_saved, is_liked, created_at,
            1 - (embedding <=> :vector::vector) AS similarity_score
        FROM recipes
        WHERE {where_clause}
        ORDER BY embedding <=> :vector::vector
        LIMIT :limit
    """)

    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [dict(row) for row in rows]


async def _embedding_search_sqlite(
    db: AsyncSession,
    user_id: str,
    query: str,
    limit: int,
    filters: Optional[dict],
) -> List[dict]:
    """Compute cosine similarity in Python against embedding_json column."""
    query_vector = await embed_text(query)
    if not query_vector:
        return await _keyword_search(db, user_id, query, limit, filters)

    q = select(Recipe).where(
        Recipe.user_id == user_id,
        Recipe.embedding_json.isnot(None),
    )
    if filters:
        if filters.get("cuisine"):
            q = q.where(Recipe.cuisine == filters["cuisine"])
        if filters.get("meal_type"):
            q = q.where(Recipe.meal_type == filters["meal_type"])
        if filters.get("max_cook_time"):
            q = q.where(Recipe.cook_time_minutes <= filters["max_cook_time"])

    result = await db.execute(q)
    recipes = result.scalars().all()

    scored = []
    for r in recipes:
        stored = r.embedding_json
        if isinstance(stored, str):
            stored = json.loads(stored)
        sim = _cosine_similarity(query_vector, stored or [])
        scored.append((r, sim))

    scored.sort(key=lambda x: x[1], reverse=True)

    return [
        {**_recipe_row_to_dict(r), "similarity_score": round(sim, 3)}
        for r, sim in scored[:limit]
    ]


def _apply_filters(q, filters: Optional[dict]):
    if not filters:
        return q
    if filters.get("cuisine"):
        q = q.where(Recipe.cuisine == filters["cuisine"])
    if filters.get("meal_type"):
        q = q.where(Recipe.meal_type == filters["meal_type"])
    if filters.get("max_cook_time"):
        q = q.where(Recipe.cook_time_minutes <= filters["max_cook_time"])
    return q


def _build_word_condition(word: str, Recipe, cast, String, or_):
    """Build an OR condition for a single word, expanding flavor descriptors."""
    terms = [word]
    if word in _FLAVOR_DESCRIPTORS:
        terms.extend(_FLAVOR_DESCRIPTORS[word])

    patterns = [f"%{t}%" for t in terms]
    conditions = []
    for pat in patterns:
        conditions.extend([
            Recipe.title.ilike(pat),
            Recipe.description.ilike(pat),
            Recipe.cuisine.ilike(pat),
            Recipe.meal_type.ilike(pat),
            cast(Recipe.tags, String).ilike(pat),
            cast(Recipe.ingredients, String).ilike(pat),
            cast(Recipe.diet_labels, String).ilike(pat),
        ])
    return or_(*conditions)


async def _keyword_search(
    db: AsyncSession,
    user_id: str,
    query: str,
    limit: int,
    filters: Optional[dict],
) -> List[dict]:
    """
    Keyword search — splits multi-word queries so each word matches independently,
    and expands flavor descriptors (spicy, sweet, savory, etc.) into related terms.
    """
    from sqlalchemy import cast, String, or_, and_

    q = select(Recipe).where(Recipe.user_id == user_id)

    clean_query = query.strip()
    words = [w for w in clean_query.lower().split() if w and w not in _NOISE_WORDS]
    has_keywords = len(words) > 0

    if has_keywords:
        word_conditions = [
            _build_word_condition(w, Recipe, cast, String, or_)
            for w in words
        ]
        q = q.where(and_(*word_conditions))

    q = _apply_filters(q, filters)
    q = q.limit(limit)

    result = await db.execute(q)
    recipes = result.scalars().all()

    if has_keywords:
        scored = _rank_keyword_results(recipes, words)
    else:
        scored = [(r, 0.95) for r in recipes]

    return [
        {**_recipe_row_to_dict(r), "similarity_score": score}
        for r, score in scored[:limit]
    ]


def _rank_keyword_results(recipes, words: list) -> List[tuple]:
    """Rank by how well words match the title vs other fields."""
    scored = []
    for r in recipes:
        title_lower = (r.title or "").lower()
        desc_lower = (r.description or "").lower()
        all_text = f"{title_lower} {desc_lower} {(r.cuisine or '').lower()} " \
                   f"{json.dumps(r.tags or []).lower()} {json.dumps(r.ingredients or []).lower()}"

        title_hits = sum(1 for w in words if w in title_lower or
                         any(syn in title_lower for syn in _FLAVOR_DESCRIPTORS.get(w, [])))
        total_hits = sum(1 for w in words if w in all_text or
                         any(syn in all_text for syn in _FLAVOR_DESCRIPTORS.get(w, [])))

        if title_hits == len(words):
            score = 0.99
        elif title_hits > 0:
            score = 0.90 + (0.05 * title_hits / len(words))
        elif total_hits == len(words):
            score = 0.85
        else:
            score = 0.75
        scored.append((r, round(score, 3)))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


# ── Live suggest ──────────────────────────────────────────────────────────────

async def _library_suggestions(
    db: AsyncSession,
    user_id: str,
    partial_query: str,
    limit: int,
) -> List[str]:
    """
    Build search suggestions from the user's actual recipe data.
    Pulls matching titles, cuisines, tags, and meal types — no AI needed.
    """
    from sqlalchemy import cast, String, or_

    pattern = f"%{partial_query.lower()}%"
    result = await db.execute(
        select(
            Recipe.title, Recipe.cuisine, Recipe.meal_type,
            Recipe.tags, Recipe.diet_labels,
        )
        .where(Recipe.user_id == user_id)
        .where(or_(
            Recipe.title.ilike(pattern),
            Recipe.cuisine.ilike(pattern),
            Recipe.meal_type.ilike(pattern),
            cast(Recipe.tags, String).ilike(pattern),
            cast(Recipe.diet_labels, String).ilike(pattern),
        ))
        .limit(30)
    )
    rows = result.all()

    seen = set()
    suggestions = []
    pq = partial_query.lower()

    for r in rows:
        if r.cuisine and pq in r.cuisine.lower() and r.cuisine.lower() not in seen:
            suggestions.append(r.cuisine)
            seen.add(r.cuisine.lower())

        if r.meal_type and pq in r.meal_type.lower() and r.meal_type.lower() not in seen:
            suggestions.append(r.meal_type)
            seen.add(r.meal_type.lower())

        for tag in (r.tags or []):
            if pq in tag.lower() and tag.lower() not in seen:
                suggestions.append(tag)
                seen.add(tag.lower())

        for label in (r.diet_labels or []):
            if pq in label.lower() and label.lower() not in seen:
                suggestions.append(label)
                seen.add(label.lower())

    return suggestions[:limit]


async def live_suggest(
    partial_query: str,
    user_id: str,
    db: AsyncSession,
    recipe_limit: int = 4,
    suggestion_limit: int = 3,
) -> dict:
    """
    Inline suggest — fires after 1 character typed.
    Runs recipe search + text suggestions in parallel.

    - recipes:     real recipe objects from the user's library (like Spotify song rows)
    - suggestions: broader search terms from their library data, or Claude-generated
    """
    cache_key = f"live_suggest:{user_id}:{partial_query.lower().strip()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    async def _recipe_hits() -> List[dict]:
        results = await vector_search(db, user_id, partial_query, limit=recipe_limit)
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "thumbnail_url": r.get("thumbnail_url"),
                "cook_time_minutes": r.get("cook_time_minutes"),
                "cuisine": r.get("cuisine"),
                "meal_type": r.get("meal_type"),
                "diet_labels": r.get("diet_labels"),
                "is_saved": r.get("is_saved", True),
                "is_liked": r.get("is_liked", False),
                "similarity_score": r.get("similarity_score"),
            }
            for r in results
        ]

    async def _text_suggestions() -> List[str]:
        if _has_anthropic:
            try:
                return await _ai_suggestions(db, user_id, partial_query, suggestion_limit)
            except Exception:
                pass
        return await _library_suggestions(db, user_id, partial_query, suggestion_limit)

    recipes, suggestions = await asyncio.gather(
        _recipe_hits(),
        _text_suggestions(),
        return_exceptions=False,
    )

    result_payload = {"recipes": recipes, "suggestions": suggestions}
    await cache_set(cache_key, result_payload, ttl=90)
    return result_payload


async def _ai_suggestions(
    db: AsyncSession,
    user_id: str,
    partial_query: str,
    limit: int,
) -> List[str]:
    result = await db.execute(
        select(Recipe.title, Recipe.cuisine, Recipe.meal_type, Recipe.diet_labels)
        .where(Recipe.user_id == user_id)
        .limit(60)
    )
    sample = result.all()
    recipe_context = "\n".join(
        f"- {r.title} ({r.cuisine or '?'}, {r.meal_type or 'any meal'})"
        for r in sample
    )

    prompt = f"""You are powering the search bar of a personal recipe app.
The user has typed: "{partial_query}"

Recipes in their library (sample):
{recipe_context}

Generate exactly {limit} short search suggestions that would help them
discover recipes in their library they might want right now.
Think: meal type expansions, ingredient combos, dietary filters, time constraints.
Each suggestion on its own line. No bullets, no numbering. Max 6 words each.
Only output the suggestions."""

    client = _get_anthropic_client()
    message = await client.messages.create(
        model=settings.chat_model,
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}],
    )
    text_out = message.content[0].text
    return [s.strip() for s in text_out.strip().split("\n") if s.strip()][:limit]


# ── Web recipe suggestions ────────────────────────────────────────────────────

async def suggest_web_recipes(query: str, limit: int = 5) -> List[dict]:
    """Use Claude to suggest recipes from general knowledge when library has no matches."""
    if not _has_anthropic:
        return []

    client = _get_anthropic_client()
    prompt = f"""The user searched for: "{query}"
Their personal recipe library had no close matches.

Suggest exactly {limit} real recipes they might be looking for.
Return JSON array only, no explanation. Each object: {{"title": "...", "description": "one sentence", "cuisine": "...", "cook_time_minutes": number}}"""

    try:
        message = await client.messages.create(
            model=settings.chat_model,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        text_out = message.content[0].text.strip()
        if text_out.startswith("```"):
            text_out = text_out.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text_out)
    except Exception:
        return []


# ── Streaming narrative ───────────────────────────────────────────────────────

async def stream_search_narrative(
    query: str,
    recipes: List[dict],
) -> AsyncGenerator[str, None]:
    """Stream a short AI-generated summary of search results."""
    titles = [r.get("title", "") for r in recipes[:5]]

    if _has_anthropic:
        client = _get_anthropic_client()
        prompt = f"""The user searched for: "{query}"
The top matching recipes found are: {", ".join(titles)}

Write ONE short, friendly sentence (max 20 words) summarizing what was found.
Be conversational and specific. Don't say "I found" - start with what was found."""

        async with client.messages.stream(
            model=settings.chat_model,
            max_tokens=80,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text_chunk in stream.text_stream:
                yield text_chunk
    else:
        summary = f"Found {len(recipes)} recipes matching \"{query}\""
        if titles:
            summary += f", including {titles[0]}"
        for word in summary.split():
            yield word + " "


# ── History ───────────────────────────────────────────────────────────────────

async def save_search_history(
    db: AsyncSession,
    user_id: str,
    query: str,
    result_count: int,
) -> None:
    history = SearchHistory(
        user_id=user_id,
        query=query,
        result_count=result_count,
    )
    db.add(history)
    await db.commit()
