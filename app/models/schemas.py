from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: UUID4
    email: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Recipes ───────────────────────────────────────────────────────────────────

class RecipeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    ingredients: Optional[List[str]] = []
    instructions: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    cuisine: Optional[str] = None
    meal_type: Optional[str] = None
    diet_labels: Optional[List[str]] = []
    cook_time_minutes: Optional[int] = None
    servings: Optional[int] = None
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_saved: bool = True
    is_liked: bool = False


class RecipeOut(BaseModel):
    id: UUID4
    title: str
    description: Optional[str]
    ingredients: Optional[List[str]]
    instructions: Optional[List[str]] = None
    tags: Optional[List[str]]
    cuisine: Optional[str]
    meal_type: Optional[str]
    diet_labels: Optional[List[str]]
    cook_time_minutes: Optional[int]
    servings: Optional[int]
    source_platform: Optional[str]
    source_url: Optional[str]
    thumbnail_url: Optional[str]
    is_saved: bool
    is_liked: bool
    created_at: datetime
    similarity_score: Optional[float] = None  # populated during search

    class Config:
        from_attributes = True


# ── Search ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    cuisine: Optional[str] = None
    meal_type: Optional[str] = None
    diet_labels: Optional[List[str]] = None
    max_cook_time: Optional[int] = None


class WebRecipeSuggestion(BaseModel):
    title: str
    description: str
    cuisine: Optional[str] = None
    cook_time_minutes: Optional[int] = None

class SearchResult(BaseModel):
    recipes: List[RecipeOut]
    suggestions: Optional[List[str]] = []
    web_results: Optional[List[WebRecipeSuggestion]] = []
    total: int
    query: Optional[str] = None


class RecipeSuggestion(BaseModel):
    """Lightweight recipe preview shown inline in the search dropdown."""
    id: UUID4
    title: str
    thumbnail_url: Optional[str] = None
    cook_time_minutes: Optional[int] = None
    cuisine: Optional[str] = None
    meal_type: Optional[str] = None
    diet_labels: Optional[List[str]] = None
    is_saved: bool = True
    is_liked: bool = False
    similarity_score: Optional[float] = None

    class Config:
        from_attributes = True


class SuggestRequest(BaseModel):
    partial_query: str        # fires after just 1 character typed
    recipe_limit: int = 4     # real recipe hits from their library
    suggestion_limit: int = 3 # AI smart suggestions for broader searches


class SuggestResponse(BaseModel):
    recipes: List[RecipeSuggestion]   # actual recipes from their library
    suggestions: List[str]            # AI-generated broader search ideas


# ── Social Sync ───────────────────────────────────────────────────────────────

class SyncRequest(BaseModel):
    platform: str  # instagram, tiktok, pinterest
    access_token: str
    refresh_token: Optional[str] = None


class SyncStatus(BaseModel):
    platform: str
    status: str            # pending, running, completed, failed
    recipes_synced: int
    last_synced: Optional[datetime]
    error: Optional[str]
