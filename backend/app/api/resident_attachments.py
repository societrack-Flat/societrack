import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.supabase_rest import supabase_rest

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resident", tags=["resident"])


class ResidentAttachmentUrlIn(BaseModel):
    viewer_username: str = Field(..., min_length=1, max_length=120)
    viewer_password: str = Field(..., min_length=1, max_length=200)
    attachment_path: str = Field(..., min_length=1, max_length=500)


def _path_belongs_to_apartment(attachment_path: str, apartment_id: str) -> bool:
    path = attachment_path.lstrip("/")
    allowed_prefixes = (
        f"income/{apartment_id}/",
        f"expenses/{apartment_id}/",
    )
    return any(path.startswith(prefix) for prefix in allowed_prefixes)


async def _attachment_linked_to_apartment(sb, attachment_path: str, apartment_id: str) -> bool:
    for table in ("income", "expenses"):
        rows = await sb.get(
            table,
            params={
                "apartment_id": f"eq.{apartment_id}",
                "attachment_url": f"eq.{attachment_path}",
                "select": "id",
                "limit": 1,
            },
        )
        if rows:
            return True
    return False


async def _create_signed_attachment_url(attachment_path: str, expires_in: int = 3600) -> str:
    path = attachment_path.lstrip("/")
    encoded = quote(path, safe="/")
    sign_url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/attachments/{encoded}"

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            sign_url,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": expires_in},
        )
        r.raise_for_status()
        data = r.json()

    signed = data.get("signedURL") or data.get("signedUrl")
    if not signed:
        raise HTTPException(status_code=502, detail="Could not create attachment link")

    if signed.startswith("http"):
        return signed
    base = settings.supabase_url.rstrip("/")
    if signed.startswith("/object/"):
        return f"{base}/storage/v1{signed}"
    if signed.startswith("/storage/v1/"):
        return f"{base}{signed}"
    if signed.startswith("/"):
        return f"{base}/storage/v1{signed}"
    return f"{base}/storage/v1/object/sign/attachments/{encoded}?{signed}"


@router.post("/attachment-url")
async def resident_attachment_url(body: ResidentAttachmentUrlIn) -> dict:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Server configuration incomplete")

    username = body.viewer_username.strip()
    password = body.viewer_password
    attachment_path = body.attachment_path.strip()

    try:
        sb = supabase_rest()
        rows = await sb.get(
            "viewer_settings",
            params={
                "viewer_username": f"eq.{username}",
                "viewer_password": f"eq.{password}",
                "select": "apartment_id,allow_income_view,allow_expense_view",
                "limit": 1,
            },
        )
    except Exception as e:
        log.exception("resident attachment viewer lookup: %s", e)
        raise HTTPException(status_code=503, detail="Could not verify resident access") from e

    if not rows:
        raise HTTPException(status_code=401, detail="Invalid resident credentials")

    viewer = rows[0]
    apartment_id = viewer.get("apartment_id")
    if not apartment_id:
        raise HTTPException(status_code=403, detail="Resident access not configured")

    if not _path_belongs_to_apartment(attachment_path, apartment_id):
        raise HTTPException(status_code=403, detail="Attachment not allowed for this society")

    path_lower = attachment_path.lower()
    if path_lower.startswith("income/") and not viewer.get("allow_income_view"):
        raise HTTPException(status_code=403, detail="Income attachments are not enabled")
    if path_lower.startswith("expenses/") and not viewer.get("allow_expense_view"):
        raise HTTPException(status_code=403, detail="Expense attachments are not enabled")

    try:
        if not await _attachment_linked_to_apartment(sb, attachment_path, apartment_id):
            raise HTTPException(status_code=404, detail="Attachment not found")
        signed_url = await _create_signed_attachment_url(attachment_path)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("resident signed url: %s", e)
        raise HTTPException(status_code=503, detail="Could not open attachment") from e

    return {"url": signed_url}
