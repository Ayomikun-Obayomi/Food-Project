from sqlalchemy import (
    Column, String, Text, Float, Integer, DateTime, Boolean,
    ForeignKey, JSON, func
)
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base


def new_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    display_name = Column(String(100))
    avatar_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    social_accounts = relationship("SocialAccount", back_populates="user")
    recipes = relationship("Recipe", back_populates="user")
    search_history = relationship("SearchHistory", back_populates="user")


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    platform = Column(String(50), nullable=False)
    platform_user_id = Column(String(255), nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True))
    scopes = Column(JSON)
    synced_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="social_accounts")


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)

    title = Column(String(500), nullable=False)
    description = Column(Text)
    ingredients = Column(JSON)
    instructions = Column(JSON)
    tags = Column(JSON)
    cuisine = Column(String(100))
    meal_type = Column(String(50))
    diet_labels = Column(JSON)
    cook_time_minutes = Column(Integer)
    servings = Column(Integer)

    source_platform = Column(String(50))
    source_url = Column(String(1000))
    source_post_id = Column(String(255))
    thumbnail_url = Column(String(1000))
    is_saved = Column(Boolean, default=True)
    is_liked = Column(Boolean, default=False)

    # Embedding stored as JSON array for SQLite compat (pgvector Vector col in prod)
    embedding_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="recipes")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    query = Column(String(500), nullable=False)
    result_count = Column(Integer, default=0)
    clicked_recipe_id = Column(String(36), ForeignKey("recipes.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="search_history")
