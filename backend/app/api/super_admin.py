"""Super admin operations (service role + caller must be super_admin in public.users)."""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.services.auth import require_user
from app.services.supabase_rest import supabase_rest

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/super-admin", tags=["super-admin"])


async def _require_super_admin(claims: dict) -> str:
    uid = claims.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")
    sb = supabase_rest()
    rows = await sb.get("users", params={"id": f"eq.{uid}", "select": "id,role", "limit": 1})
    if not rows or str(rows[0].get("role") or "").lower() != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return str(uid)


@router.delete("/admin-users/{user_id}")
async def delete_admin_user(user_id: str, claims: dict = Depends(require_user)) -> dict:
    """Remove a society admin login (auth + public.users row). Apartment data is kept."""
    await _require_super_admin(claims)

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Server configuration incomplete")

    sb = supabase_rest()
    rows = await sb.get(
        "users",
        params={"id": f"eq.{user_id}", "select": "id,role,email", "limit": 1},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    target = rows[0]
    if str(target.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=400, detail="Only society admin accounts can be deleted here")

    try:
        await sb.patch("users", params={"id": f"eq.{user_id}"}, json={"apartment_id": None})
    except Exception as e:
        log.exception("clear admin apartment_id: %s", e)
        raise HTTPException(status_code=503, detail="Could not update user") from e

    auth_deleted = False
    base = settings.supabase_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.delete(
                f"{base}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
            if r.status_code in (200, 204, 404):
                auth_deleted = True
            else:
                log.warning(
                    "Supabase auth delete returned %s (non-fatal): %s",
                    r.status_code, r.text[:300],
                )
    except Exception as e:
        log.warning("Supabase auth delete failed (non-fatal): %s", e)

    try:
        await sb.delete("users", params={"id": f"eq.{user_id}"})
    except Exception as e:
        log.exception("delete users row: %s", e)
        raise HTTPException(status_code=503, detail="Could not remove user profile") from e

    return {
        "ok": True,
        "deleted_user_id": user_id,
        "email": target.get("email"),
        "auth_deleted": auth_deleted,
    }
