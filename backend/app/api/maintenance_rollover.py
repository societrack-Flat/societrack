"""
Close a month: move unpaid maintenance for that month into flats.pending_maintenance
and remove maintenance rows for that month so the next view starts clean.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.auth import require_user
from app.services.supabase_rest import supabase_rest

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


def _user_id(claims: dict) -> str:
    uid = claims.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    return str(uid)


async def _load_user(user_id: str) -> dict[str, Any] | None:
    sb = supabase_rest()
    rows = await sb.get("users", params={"id": f"eq.{user_id}", "select": "*", "limit": 1})
    return rows[0] if rows else None


def _is_apartment_admin(user_row: dict | None, apartment_id: str) -> bool:
    if not user_row:
        return False
    if str(user_row.get("apartment_id") or "") != str(apartment_id):
        return False
    return str(user_row.get("role") or "").lower() == "admin"


def _monthly_charges(flat: dict) -> float:
    return float(flat.get("monthly_maintenance") or 0) + float(flat.get("other_maintenance") or 0)


def _carry_to_pending(flat: dict, row: dict | None) -> float:
    """
    Extra amount to add to flat.pending after closing the month, matching the UI idea:
    - no row: carry monthly+other (arrears already in pending).
    - paid row: 0
    - pending row: amount minus paid; if the row amount is full (includes arrears), avoid double-counting p0.
    """
    p0 = max(0, float(flat.get("pending_maintenance") or 0))
    m = max(0, _monthly_charges(flat))
    if not row:
        return round(m, 2)

    st = (row.get("status") or "").lower()
    if st == "paid":
        return 0.0

    cap = p0 + m
    raw = float(row.get("amount") or 0)
    if raw == 0 or raw != raw:  # NaN
        raw = cap
    paid = max(0, float(row.get("paid_amount") or 0))
    if raw <= m + 0.01:
        return round(max(0, raw - paid), 2)
    return round(max(0, raw - paid - p0), 2)


class RolloverIn(BaseModel):
    apartment_id: str = Field(..., description="Apartment UUID")
    close_year: int = Field(..., ge=2000, le=2200)
    close_month: int = Field(..., ge=1, le=12)


async def _run_rollover(body: RolloverIn) -> dict[str, Any]:
    try:
        uuid.UUID(body.apartment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid apartment_id") from e

    sb = supabase_rest()
    apt = await sb.get("apartments", params={"id": f"eq.{body.apartment_id}", "select": "id,created_by", "limit": 1})
    if not apt:
        raise HTTPException(status_code=404, detail="Apartment not found")

    flats = await sb.get(
        "flats",
        params={
            "apartment_id": f"eq.{body.apartment_id}",
            "select": "*",
        },
    )
    flat_ids = [f["id"] for f in (flats or [])]
    if not flat_ids:
        return {"ok": True, "apartment_id": body.apartment_id, "flats_updated": 0, "rows_deleted": 0}

    rows = await sb.get(
        "maintenance",
        params={
            "apartment_id": f"eq.{body.apartment_id}",
            "year": f"eq.{body.close_year}",
            "month": f"eq.{body.close_month}",
            "select": "*",
        },
    )
    by_flat = {r["flat_id"]: r for r in (rows or []) if r.get("flat_id")}

    updated = 0
    for flat in flats or []:
        fid = flat["id"]
        p0 = max(0, float(flat.get("pending_maintenance") or 0))
        carry = _carry_to_pending(flat, by_flat.get(fid))
        new_p = round(p0 + carry, 2)
        if new_p != p0:
            await sb.patch("flats", params={"id": f"eq.{fid}"}, json={"pending_maintenance": new_p})
            updated += 1

    deleted = 0
    for r in rows or []:
        rid = r.get("id")
        if not rid:
            continue
        await sb.delete("maintenance", params={"id": f"eq.{rid}"})
        deleted += 1

    return {
        "ok": True,
        "apartment_id": body.apartment_id,
        "flats_updated": updated,
        "rows_deleted": deleted,
        "close_year": body.close_year,
        "close_month": body.close_month,
    }


@router.post("/rollover")
async def rollover_user(body: RolloverIn, claims: dict = Depends(require_user)) -> dict[str, Any]:
    user_id = _user_id(claims)
    user_row = await _load_user(user_id)
    if not _is_apartment_admin(user_row, body.apartment_id):
        raise HTTPException(status_code=403, detail="Not allowed to run maintenance rollover for this apartment")
    return await _run_rollover(body)


@router.post("/rollover-cron")
async def rollover_cron(
    body: RolloverIn,
    x_maintenance_rollover_secret: str | None = Header(default=None, alias="X-Maintenance-Rollover-Secret"),
) -> dict[str, Any]:
    if not settings.maintenance_rollover_secret or x_maintenance_rollover_secret != settings.maintenance_rollover_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing rollover secret")
    return await _run_rollover(body)
