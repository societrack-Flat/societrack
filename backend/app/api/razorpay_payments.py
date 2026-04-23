import logging
import uuid
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.auth import require_user
from app.services.razorpay_client import create_order, fetch_payment, unique_receipt, verify_payment_signature
from app.services.supabase_rest import supabase_rest
from app.subscription_plans import PLAN_ID, get_plan

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments/razorpay", tags=["payments-razorpay"])


def _user_id(claims: dict) -> str:
    uid = claims.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    return str(uid)


def _key_configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


class CreateOrderIn(BaseModel):
    plan_id: str = Field(default=PLAN_ID, description="Subscription plan id")
    apartment_id: str = Field(..., description="Apartment UUID")


class CreateOrderOut(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    plan_id: str


class VerifyIn(BaseModel):
    plan_id: str = PLAN_ID
    apartment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def _is_apartment_admin(user_row: dict, apartment_id: str) -> bool:
    if not user_row:
        return False
    if str(user_row.get("apartment_id") or "") != str(apartment_id):
        return False
    return str(user_row.get("role") or "").lower() == "admin"


async def _load_user(user_id: str) -> dict[str, Any] | None:
    try:
        sb = supabase_rest()
        rows = await sb.get("users", params={"id": f"eq.{user_id}", "select": "*", "limit": 1})
        return rows[0] if rows else None
    except Exception as e:
        log.exception("load user: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable") from e


@router.post("/create-order", response_model=CreateOrderOut)
async def create_razorpay_order(body: CreateOrderIn, claims: dict = Depends(require_user)) -> CreateOrderOut:
    if not _key_configured():
        raise HTTPException(
            status_code=503,
            detail="Razorpay is not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the API .env",
        )
    try:
        uuid.UUID(body.apartment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid apartment_id") from e

    try:
        plan = get_plan(body.plan_id)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan_id}") from e

    user_id = _user_id(claims)
    user_row = await _load_user(user_id)
    if not _is_apartment_admin(user_row, body.apartment_id):
        raise HTTPException(status_code=403, detail="Not allowed to subscribe for this apartment")

    try:
        order = await create_order(
            plan["amount_paise"],
            unique_receipt(),
            {
                "apartment_id": body.apartment_id,
                "plan_id": body.plan_id,
                "user_id": user_id,
            },
        )
    except Exception as e:
        log.exception("Razorpay create order: %s", e)
        raise HTTPException(
            status_code=502,
            detail=str(e) if str(e) else "Could not create payment order. Try again later.",
        ) from e

    return CreateOrderOut(
        order_id=order.get("id", ""),
        amount=int(order.get("amount", 0) or 0),
        currency=str(order.get("currency") or "INR"),
        key_id=settings.razorpay_key_id,
        plan_id=body.plan_id,
    )


@router.post("/verify", response_model=dict)
async def verify_and_activate(body: VerifyIn, claims: dict = Depends(require_user)) -> dict:
    if not _key_configured():
        raise HTTPException(status_code=503, detail="Razorpay is not configured on the server")
    try:
        uuid.UUID(body.apartment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid apartment_id") from e

    try:
        plan = get_plan(body.plan_id)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan_id}") from e

    if not verify_payment_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    try:
        pay = await fetch_payment(body.razorpay_payment_id)
    except Exception as e:
        log.exception("Razorpay fetch payment: %s", e)
        raise HTTPException(status_code=502, detail="Could not verify payment with Razorpay") from e

    status = str(pay.get("status") or "").lower()
    if status not in ("captured", "authorized"):
        raise HTTPException(status_code=400, detail=f"Payment not successful (status={status})")

    if str(pay.get("order_id") or "") != str(body.razorpay_order_id):
        raise HTTPException(status_code=400, detail="Order id mismatch on payment record")

    amount_paise = int(pay.get("amount") or 0)
    if amount_paise != plan["amount_paise"]:
        raise HTTPException(status_code=400, detail="Amount mismatch")

    user_id = _user_id(claims)
    user_row = await _load_user(user_id)
    if not _is_apartment_admin(user_row, body.apartment_id):
        raise HTTPException(status_code=403, detail="Not allowed to activate subscription for this apartment")

    period_end: date = date.today() + timedelta(days=30)
    try:
        sb = supabase_rest()
        updated = await sb.patch(
            "apartments",
            params={"id": f"eq.{body.apartment_id}"},
            json={
                "plan_name": "societrack_pro",
                "subscription_status": "active",
                "flat_limit": plan["flat_limit"],
                "monthly_price": plan["monthly_rupees"],
                "subscription_end_date": period_end.isoformat(),
            },
        )
    except Exception as e:
        log.exception("Supabase update apartment: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Could not update subscription. Contact support with your payment id.",
        ) from e

    if not updated:
        raise HTTPException(status_code=404, detail="Apartment not found")

    return {
        "success": True,
        "apartment": updated[0] if isinstance(updated, list) else updated,
        "razorpay_payment_id": body.razorpay_payment_id,
    }
