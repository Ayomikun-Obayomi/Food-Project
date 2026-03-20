from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.models.models import Recipe
from app.models.schemas import RecipeCreate
from app.services.search_service import embed_recipe


async def create_recipe(
    db: AsyncSession,
    user_id: str,
    data: RecipeCreate,
    generate_embedding: bool = True,
) -> Recipe:
    recipe_dict = data.model_dump()
    embedding = None
    if generate_embedding:
        embedding = await embed_recipe(recipe_dict)

    recipe = Recipe(
        user_id=user_id,
        embedding_json=embedding or None,
        **recipe_dict,
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)
    return recipe


async def get_recipe(db: AsyncSession, recipe_id: str, user_id: str) -> Optional[Recipe]:
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_recipes(
    db: AsyncSession,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    saved_only: bool = False,
    liked_only: bool = False,
) -> List[Recipe]:
    query = select(Recipe).where(Recipe.user_id == user_id)
    if saved_only:
        query = query.where(Recipe.is_saved == True)
    if liked_only:
        query = query.where(Recipe.is_liked == True)
    query = query.offset(skip).limit(limit).order_by(Recipe.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def delete_recipe(db: AsyncSession, recipe_id: str, user_id: str) -> bool:
    result = await db.execute(
        delete(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def update_recipe_flags(
    db: AsyncSession, recipe_id: str, user_id: str, is_saved: bool = None, is_liked: bool = None
) -> Optional[Recipe]:
    updates = {}
    if is_saved is not None:
        updates["is_saved"] = is_saved
    if is_liked is not None:
        updates["is_liked"] = is_liked

    if not updates:
        return await get_recipe(db, recipe_id, user_id)

    await db.execute(
        update(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user_id)
        .values(**updates)
    )
    await db.commit()
    return await get_recipe(db, recipe_id, user_id)


async def update_recipe_meal_type(
    db: AsyncSession, recipe_id: str, user_id: str, meal_type: Optional[str] = None
) -> Optional[Recipe]:
    """Update a recipe's meal_type (category). Pass None to remove from category."""
    await db.execute(
        update(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user_id)
        .values(meal_type=meal_type)
    )
    await db.commit()
    return await get_recipe(db, recipe_id, user_id)
