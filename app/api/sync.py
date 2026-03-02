from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import User, SocialAccount
from app.models.schemas import SyncRequest, SyncStatus
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/sync", tags=["social sync"])

SUPPORTED_PLATFORMS = {"instagram", "tiktok"}


@router.post("/{platform}", response_model=dict)
async def trigger_sync(
    platform: str,
    body: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Platform '{platform}' not supported")

    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == platform,
        )
    )
    account = result.scalar_one_or_none()

    if account:
        account.access_token = body.access_token
        account.refresh_token = body.refresh_token
    else:
        account = SocialAccount(
            user_id=current_user.id,
            platform=platform,
            platform_user_id="pending",
            access_token=body.access_token,
            refresh_token=body.refresh_token,
        )
        db.add(account)

    await db.commit()

    return {"task_id": "dev-mock-task", "status": "queued", "platform": platform}


@router.get("/{platform}/status")
async def sync_status(
    platform: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == current_user.id,
            SocialAccount.platform == platform,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No account connected for this platform")

    return SyncStatus(
        platform=platform,
        status="completed" if account.synced_at else "never_synced",
        recipes_synced=0,
        last_synced=account.synced_at,
        error=None,
    )
