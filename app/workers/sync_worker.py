"""
Celery background workers for syncing recipes from social platforms.
Run with: celery -A app.workers.sync_worker worker --loglevel=info
"""
from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "recipe_sync",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.sync_worker.sync_instagram": {"queue": "social_sync"},
        "app.workers.sync_worker.sync_tiktok": {"queue": "social_sync"},
        "app.workers.sync_worker.embed_recipe_batch": {"queue": "embeddings"},
    },
)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_instagram(self, user_id: str, access_token: str):
    """
    Fetch saved/liked posts from Instagram Graph API and extract recipes.
    
    NOTE: Instagram's API has strict access requirements.
    You'll need Instagram Basic Display API or Creator API approval.
    This is a scaffold showing the pattern — fill in actual API calls.
    """
    import asyncio
    from sqlalchemy.orm import Session
    from app.core.database import AsyncSessionLocal
    from app.services.recipe_service import create_recipe
    from app.models.schemas import RecipeCreate
    import httpx

    async def _run():
        # Step 1: Fetch saved media from Instagram Graph API
        async with httpx.AsyncClient() as client:
            # Get saved posts
            resp = await client.get(
                "https://graph.instagram.com/me/saved",
                params={
                    "fields": "id,caption,media_url,timestamp,permalink",
                    "access_token": access_token,
                    "limit": 50,
                },
            )
            if resp.status_code != 200:
                raise Exception(f"Instagram API error: {resp.text}")
            
            posts = resp.json().get("data", [])

        # Step 2: For each post, use Claude to extract recipe info from caption
        from anthropic import Anthropic
        ai = Anthropic(api_key=settings.anthropic_api_key)

        async with AsyncSessionLocal() as db:
            for post in posts:
                caption = post.get("caption", "")
                if not caption or len(caption) < 50:
                    continue  # Skip posts with minimal text

                # Ask Claude to parse the recipe from the caption
                extraction_prompt = f"""Extract recipe information from this Instagram caption.
Return a JSON object with these fields (use null if not found):
title, description, ingredients (array), instructions (array), tags (array),
cuisine, meal_type, diet_labels (array), cook_time_minutes (int), servings (int)

Caption:
{caption[:2000]}

Return only the JSON, no explanation."""

                response = ai.messages.create(
                    model=settings.chat_model,
                    max_tokens=1000,
                    messages=[{"role": "user", "content": extraction_prompt}],
                )

                import json
                try:
                    recipe_data = json.loads(response.content[0].text)
                    if not recipe_data.get("title"):
                        continue

                    recipe_create = RecipeCreate(
                        **{k: v for k, v in recipe_data.items() if v is not None},
                        source_platform="instagram",
                        source_url=post.get("permalink"),
                        source_post_id=post.get("id"),
                        thumbnail_url=post.get("media_url"),
                        is_saved=True,
                    )
                    await create_recipe(db, user_id, recipe_create)
                except (json.JSONDecodeError, Exception) as e:
                    print(f"Failed to parse recipe from post {post.get('id')}: {e}")
                    continue

    asyncio.get_event_loop().run_until_complete(_run())
    return {"status": "completed", "user_id": user_id}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_tiktok(self, user_id: str, access_token: str):
    """
    Fetch liked/saved videos from TikTok and extract recipes.
    TikTok requires Content Posting API or Research API access.
    This is a scaffold — fill in actual API calls.
    """
    # Pattern is the same as Instagram:
    # 1. Hit TikTok API for liked videos
    # 2. Extract recipe data from video descriptions using Claude
    # 3. Store in database with embeddings
    pass


@celery_app.task
def embed_recipe_batch(recipe_ids: list[str]):
    """
    Regenerate embeddings for a batch of recipes.
    Useful when you want to re-embed after an embedding model upgrade.
    """
    import asyncio
    from app.core.database import AsyncSessionLocal
    from app.models.models import Recipe
    from app.services.search_service import embed_recipe
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as db:
            for recipe_id in recipe_ids:
                result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
                recipe = result.scalar_one_or_none()
                if not recipe:
                    continue
                recipe_dict = {
                    "title": recipe.title,
                    "description": recipe.description,
                    "tags": recipe.tags or [],
                    "ingredients": recipe.ingredients or [],
                    "cuisine": recipe.cuisine,
                    "meal_type": recipe.meal_type,
                    "diet_labels": recipe.diet_labels or [],
                }
                recipe.embedding = await embed_recipe(recipe_dict)
                await db.commit()

    asyncio.get_event_loop().run_until_complete(_run())
