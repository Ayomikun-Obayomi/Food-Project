from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.models import User
from app.models.schemas import RecipeCreate, RecipeOut, MealTypeUpdate
from app.services.auth_service import get_current_user
from app.services import recipe_service

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.post("", response_model=RecipeOut, status_code=201)
async def add_recipe(
    data: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually add a recipe (also used internally by the sync worker)."""
    recipe = await recipe_service.create_recipe(db, str(current_user.id), data)
    return recipe


@router.get("", response_model=List[RecipeOut])
async def list_recipes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    saved_only: bool = Query(False),
    liked_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all recipes in the user's library with optional filters."""
    recipes = await recipe_service.get_user_recipes(
        db, str(current_user.id), skip, limit, saved_only, liked_only
    )
    return recipes


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = await recipe_service.get_recipe(db, str(recipe_id), str(current_user.id))
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.patch("/{recipe_id}/flags", response_model=RecipeOut)
async def update_flags(
    recipe_id: UUID,
    is_saved: Optional[bool] = None,
    is_liked: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle saved/liked status on a recipe."""
    recipe = await recipe_service.update_recipe_flags(
        db, str(recipe_id), str(current_user.id), is_saved, is_liked
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.patch("/{recipe_id}/meal-type", response_model=RecipeOut)
async def update_meal_type(
    recipe_id: UUID,
    body: MealTypeUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save recipe to a category (meal_type) or remove from category."""
    recipe = await recipe_service.update_recipe_meal_type(
        db, str(recipe_id), str(current_user.id), body.meal_type
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await recipe_service.delete_recipe(db, str(recipe_id), str(current_user.id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Recipe not found")
