import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.auth import require_user
from app.services.supabase_rest import supabase_rest

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AdminForgotPasswordIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)


@router.get("/profile")
async def get_user_profile(
    user_id: str,
    _claims=Depends(require_user),
):
    """
    Get user profile by ID.
    """
    sb = supabase_rest()
    
    params = {
        "select": "*",
        "id": f"eq.{user_id}",
    }
    
    try:
        users = await sb.get("users", params=params)
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        return users[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/profile")
async def update_user_profile(
    user_id: str,
    profile_data: dict,
    _claims=Depends(require_user),
):
    """
    Update user profile.
    """
    sb = supabase_rest()
    
    try:
        result = await sb.patch(
            "users",
            params={"id": f"eq.{user_id}"},
            json=profile_data
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        
        return result[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/session")
async def get_session_info(
    _claims=Depends(require_user),
):
    """
    Get current session information.
    """
    return {
        "user_id": _claims.get("sub") if _claims else None,
        "email": _claims.get("email") if _claims else None,
        "role": _claims.get("app_role") if _claims else None,
        "exp": _claims.get("exp") if _claims else None,
    }


@router.post("/admin-request-password-reset")
async def admin_request_password_reset(body: AdminForgotPasswordIn) -> dict:
    """
    Send Supabase password recovery only for society admins (email + password login).
    No auth required; does not reveal whether the email exists.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Server configuration incomplete")

    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    base = settings.public_site_url()
    if not base:
        raise HTTPException(status_code=503, detail="APP_PUBLIC_URL or CORS_ORIGINS must be set on the API")

    # Use site origin only (avoid APP_PUBLIC_URL accidentally including /login)
    from urllib.parse import urlparse

    parsed = urlparse(base if "://" in base else f"https://{base}")
    if parsed.netloc:
        base = f"{parsed.scheme}://{parsed.netloc}"

    redirect_to = f"{base}/reset-password?from=admin"

    try:
        sb = supabase_rest()
        rows = await sb.get(
            "users",
            params={
                "email": f"ilike.{email}",
                "role": "eq.admin",
                "select": "id,email,role",
                "limit": 1,
            },
        )
    except Exception as e:
        log.exception("admin forgot password lookup: %s", e)
        raise HTTPException(status_code=503, detail="Could not verify account") from e

    if not rows:
        return {"ok": True, "message": "If this email is registered as an admin, you will receive a reset link shortly."}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/recover",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    "Content-Type": "application/json",
                },
                json={"email": email, "redirect_to": redirect_to},
            )
            r.raise_for_status()
    except httpx.HTTPStatusError as e:
        log.exception("Supabase recover HTTP %s: %s", e.response.status_code, e.response.text[:300])
        raise HTTPException(status_code=503, detail="Could not send reset email") from e
    except Exception as e:
        log.exception("Supabase recover: %s", e)
        raise HTTPException(status_code=503, detail="Could not send reset email") from e

    return {"ok": True, "message": "If this email is registered as an admin, you will receive a reset link shortly."}
