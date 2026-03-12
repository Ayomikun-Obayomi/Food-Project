from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import init_db, AsyncSessionLocal
from app.api import auth, recipes, search, sync

settings = get_settings()

SEED_RECIPES = [
    {
        "title": "Spicy Miso Ramen",
        "description": "Rich, umami-packed ramen with a spicy miso broth, soft-boiled egg, and tender chashu pork.",
        "ingredients": ["ramen noodles", "miso paste", "pork belly", "soft-boiled egg", "green onions", "nori", "sesame oil", "chili oil", "garlic", "ginger"],
        "instructions": ["Simmer pork broth with miso, garlic, and ginger for 30 min", "Sear sliced pork belly", "Cook ramen noodles", "Assemble bowl with broth, noodles, pork, egg, toppings"],
        "tags": ["ramen", "japanese", "spicy", "comfort food", "noodles"],
        "cuisine": "Japanese",
        "meal_type": "dinner",
        "diet_labels": [],
        "cook_time_minutes": 45,
        "servings": 2,
        "thumbnail_url": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400",
        "is_saved": True,
    },
    {
        "title": "Avocado Toast with Everything Bagel Seasoning",
        "description": "Crispy sourdough topped with creamy smashed avocado, a fried egg, and everything seasoning.",
        "ingredients": ["sourdough bread", "avocado", "egg", "everything bagel seasoning", "lemon juice", "red pepper flakes", "salt"],
        "instructions": ["Toast sourdough", "Smash avocado with lemon and salt", "Fry egg sunny side up", "Top toast with avocado, egg, and seasoning"],
        "tags": ["breakfast", "avocado", "quick", "trendy"],
        "cuisine": "American",
        "meal_type": "breakfast",
        "diet_labels": ["vegetarian"],
        "cook_time_minutes": 10,
        "servings": 1,
        "thumbnail_url": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400",
        "is_saved": True,
    },
    {
        "title": "Thai Basil Chicken (Pad Kra Pao)",
        "description": "Stir-fried ground chicken with holy basil, chili, garlic, and a savory sauce over jasmine rice.",
        "ingredients": ["ground chicken", "thai basil", "garlic", "thai chilies", "soy sauce", "oyster sauce", "fish sauce", "sugar", "jasmine rice", "fried egg"],
        "instructions": ["Cook garlic and chilies in hot oil", "Add ground chicken, stir-fry until cooked", "Add sauces and sugar", "Toss in basil, serve over rice with fried egg"],
        "tags": ["thai", "stir-fry", "spicy", "quick", "weeknight"],
        "cuisine": "Thai",
        "meal_type": "dinner",
        "diet_labels": [],
        "cook_time_minutes": 20,
        "servings": 2,
        "thumbnail_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400",
        "is_saved": True,
    },
    {
        "title": "Classic Margherita Pizza",
        "description": "Simple Neapolitan-style pizza with San Marzano tomatoes, fresh mozzarella, and basil.",
        "ingredients": ["pizza dough", "san marzano tomatoes", "fresh mozzarella", "fresh basil", "olive oil", "salt"],
        "instructions": ["Stretch dough into 12-inch round", "Spread crushed tomatoes", "Add torn mozzarella", "Bake at 500°F for 10-12 min", "Top with fresh basil and olive oil"],
        "tags": ["pizza", "italian", "classic", "vegetarian"],
        "cuisine": "Italian",
        "meal_type": "dinner",
        "diet_labels": ["vegetarian"],
        "cook_time_minutes": 25,
        "servings": 2,
        "thumbnail_url": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400",
        "is_saved": True,
        "is_liked": True,
    },
    {
        "title": "Chicken Shawarma Bowl",
        "description": "Spiced grilled chicken over turmeric rice with pickled onions, hummus, and garlic sauce.",
        "ingredients": ["chicken thighs", "cumin", "paprika", "turmeric", "garlic", "yogurt", "rice", "pickled onions", "hummus", "tahini", "lemon"],
        "instructions": ["Marinate chicken in spices and yogurt 1hr+", "Grill or pan-sear chicken", "Cook turmeric rice", "Assemble bowl with chicken, rice, hummus, pickled onions, and drizzle tahini sauce"],
        "tags": ["shawarma", "bowl", "mediterranean", "meal prep"],
        "cuisine": "Middle Eastern",
        "meal_type": "lunch",
        "diet_labels": ["gluten-free"],
        "cook_time_minutes": 35,
        "servings": 4,
        "thumbnail_url": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400",
        "is_saved": True,
        "is_liked": True,
    },
    {
        "title": "Matcha Overnight Oats",
        "description": "Creamy overnight oats with matcha, chia seeds, and a coconut milk base topped with mango.",
        "ingredients": ["rolled oats", "matcha powder", "chia seeds", "coconut milk", "maple syrup", "vanilla", "mango", "coconut flakes"],
        "instructions": ["Mix oats, matcha, chia, coconut milk, maple syrup, vanilla", "Refrigerate overnight", "Top with diced mango and coconut flakes"],
        "tags": ["breakfast", "overnight oats", "matcha", "meal prep", "healthy"],
        "cuisine": "Fusion",
        "meal_type": "breakfast",
        "diet_labels": ["vegan", "gluten-free"],
        "cook_time_minutes": 5,
        "servings": 1,
        "thumbnail_url": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400",
        "is_saved": True,
    },
    {
        "title": "Korean Fried Chicken Wings",
        "description": "Double-fried crispy wings tossed in a sweet, spicy gochujang glaze.",
        "ingredients": ["chicken wings", "gochujang", "soy sauce", "honey", "garlic", "ginger", "rice vinegar", "cornstarch", "sesame seeds", "green onions"],
        "instructions": ["Coat wings in cornstarch", "Double fry: first at 325°F, then 375°F", "Make gochujang glaze with honey, soy, garlic", "Toss crispy wings in glaze", "Garnish with sesame seeds and green onions"],
        "tags": ["korean", "fried chicken", "wings", "spicy", "appetizer"],
        "cuisine": "Korean",
        "meal_type": "snack",
        "diet_labels": [],
        "cook_time_minutes": 40,
        "servings": 4,
        "thumbnail_url": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400",
        "is_saved": True,
        "is_liked": True,
    },
    {
        "title": "Mediterranean Quinoa Salad",
        "description": "Bright, herby quinoa salad with cucumbers, tomatoes, feta, olives, and lemon vinaigrette.",
        "ingredients": ["quinoa", "cucumber", "cherry tomatoes", "kalamata olives", "feta cheese", "red onion", "parsley", "mint", "lemon juice", "olive oil"],
        "instructions": ["Cook quinoa and cool", "Chop vegetables", "Whisk lemon vinaigrette", "Toss everything together", "Top with crumbled feta"],
        "tags": ["salad", "mediterranean", "healthy", "meal prep", "lunch"],
        "cuisine": "Mediterranean",
        "meal_type": "lunch",
        "diet_labels": ["vegetarian", "gluten-free"],
        "cook_time_minutes": 20,
        "servings": 4,
        "thumbnail_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400",
        "is_saved": True,
    },
]


async def seed_demo_data():
    """Create a demo user and seed recipes on first run."""
    from sqlalchemy import select
    from app.models.models import User, Recipe
    from app.services.auth_service import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "demo@recipe.ai"))
        if result.scalar_one_or_none():
            return

        user = User(
            email="demo@recipe.ai",
            hashed_password=hash_password("demo1234"),
            display_name="Demo Chef",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        for r in SEED_RECIPES:
            recipe = Recipe(user_id=user.id, **r)
            db.add(recipe)
        await db.commit()
        print(f"  Seeded {len(SEED_RECIPES)} demo recipes for demo@recipe.ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_demo_data()
    print("Database ready")
    yield
    print("Shutting down")


app = FastAPI(
    title="Recipe AI Backend",
    description="Semantic recipe search powered by vector embeddings + Claude AI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_origin_regex=r"https://.*\.netlify\.app",  # any Netlify deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(recipes.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
