import json
import logging
import uuid
from datetime import date, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.auth import require_user
from app.services.razorpay_client import (
    create_order,
    fetch_order,
    fetch_payment,
    unique_receipt,
    verify_payment_signature,
    verify_webhook_signature,
)
from app.services.supabase_rest import supabase_rest
from app.subscription_plans import APARTMENT_PLAN_NAME_DB, PLAN_ID, get_plan

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments/razorpay", tags=["payments-razorpay"])


@router.get("/_ping")
def razorpay_router_ping() -> dict:
    """Unauthenticated. Use to verify the browser / curl hits this API (not a 405 from another layer)."""
    return {"ok": True, "service": "razorpay"}


def _user_id(claims: dict) -> str:
    uid = claims.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")
    return str(uid)


def _key_configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def _webhook_secret_configured() -> bool:
    return bool(settings.razorpay_webhook_secret)


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


def _postgrest_error_message(response: httpx.Response) -> str | None:
    """Supabase/PostgREST returns JSON with a `message` field on errors."""
    try:
        j = response.json()
        if isinstance(j, dict) and j.get("message"):
            return str(j["message"])
    except Exception:
        pass
    t = (response.text or "").strip()
    return t[:500] if t else None


def _supabase_unavailable_message(exc: Exception) -> str:
    """Safe operator-facing text; never log full JWT. Details go to app logs."""
    if isinstance(exc, httpx.HTTPStatusError):
        sc = exc.response.status_code
        if sc in (401, 403):
            return (
                f"Supabase returned HTTP {sc}. The API must use the service role key: "
                "set SUPABASE_SERVICE_ROLE_KEY in Azure (not the anon key)."
            )
        if sc == 404:
            return (
                f"Supabase returned HTTP 404. Check SUPABASE_URL points to the same project as the app "
                "and that the 'users' table is exposed in PostgREST."
            )
        return f"Supabase request failed (HTTP {sc})."
    if isinstance(exc, httpx.RequestError):
        return "Could not reach Supabase. Check SUPABASE_URL and outbound network from the API host."
    return "Database unavailable"


async def _load_user(user_id: str) -> dict[str, Any] | None:
    try:
        sb = supabase_rest()
    except RuntimeError as e:
        log.error("Supabase not configured: %s", e)
        raise HTTPException(
            status_code=503,
            detail=(
                "Server configuration: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the API "
                "environment (e.g. Azure App Service → Configuration → Application settings), then restart."
            ),
        ) from e
    try:
        rows = await sb.get("users", params={"id": f"eq.{user_id}", "select": "*", "limit": 1})
        return rows[0] if rows else None
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        log.exception("load user: %s", e)
        raise HTTPException(status_code=503, detail=_supabase_unavailable_message(e)) from e
    except Exception as e:
        log.exception("load user: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable") from e


def _order_notes(notes: Any) -> dict[str, str]:
    if not isinstance(notes, dict):
        return {}
    return {str(k): str(v) for k, v in notes.items() if v is not None}


async def _apply_pro_subscription(
    apartment_id: str,
    plan_id: str,
    payment_id: str,
    amount_paise: int,
) -> dict:
    """
    After Razorpay + HMAC (and optional admin) checks: update apartment.
    Idempotent: same pay_id twice is a no-op.
    """
    try:
        plan = get_plan(plan_id)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_id}") from e

    if int(amount_paise) != int(plan["amount_paise"]):
        raise HTTPException(status_code=400, detail="Amount mismatch")

    try:
        sb = supabase_rest()
    except RuntimeError as e:
        log.error("Supabase not configured: %s", e)
        raise HTTPException(
            status_code=503,
            detail=(
                "Server configuration: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the API "
                "environment (e.g. Azure App Service), then restart."
            ),
        ) from e
    try:
        rows = await sb.get(
            "apartments",
            params={"id": f"eq.{apartment_id}", "select": "id,last_razorpay_payment_id", "limit": 1},
        )
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        log.exception("Supabase get apartment: %s", e)
        raise HTTPException(status_code=503, detail=_supabase_unavailable_message(e)) from e
    except Exception as e:
        log.exception("Supabase get apartment: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable") from e

    if not rows:
        raise HTTPException(status_code=404, detail="Apartment not found")
    if str(rows[0].get("last_razorpay_payment_id") or "") == str(payment_id):
        return {
            "success": True,
            "duplicate": True,
            "apartment": rows[0],
            "razorpay_payment_id": payment_id,
        }

    period_end: date = date.today() + timedelta(days=30)
    try:
        updated = await sb.patch(
            "apartments",
            params={"id": f"eq.{apartment_id}"},
            json={
                "plan_name": APARTMENT_PLAN_NAME_DB,
                "subscription_status": "active",
                "flat_limit": plan["flat_limit"],
                "monthly_price": plan["monthly_rupees"],
                "subscription_end_date": period_end.isoformat(),
                "last_razorpay_payment_id": str(payment_id),
            },
        )
    except httpx.HTTPStatusError as e:
        pmsg = _postgrest_error_message(e.response)
        log.exception("Supabase update apartment HTTP %s: %s", e.response.status_code, pmsg or e)
        extra = f" {pmsg}" if pmsg else ""
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not update subscription in the database after a valid payment. "
                f"Check Supabase (run apartment migrations, table public.apartments).{extra}"
            ),
        ) from e
    except httpx.RequestError as e:
        log.exception("Supabase update apartment: %s", e)
        raise HTTPException(
            status_code=503, detail=_supabase_unavailable_message(e) or "Database unavailable"
        ) from e
    except Exception as e:
        log.exception("Supabase update apartment: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Could not update subscription. Contact support with your payment id.",
        ) from e

    if not updated:
        raise HTTPException(status_code=404, detail="Apartment not found")

    row = updated[0] if isinstance(updated, list) else updated
    return {
        "success": True,
        "duplicate": False,
        "apartment": row,
        "razorpay_payment_id": payment_id,
    }


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
        get_plan(body.plan_id)
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

    try:
        order = await fetch_order(body.razorpay_order_id)
    except Exception as e:
        log.exception("Razorpay fetch order: %s", e)
        raise HTTPException(status_code=502, detail="Could not load order from Razorpay") from e

    notes = _order_notes(order.get("notes"))
    if str(notes.get("apartment_id") or "") != str(body.apartment_id):
        raise HTTPException(status_code=400, detail="This payment order is not for this society")
    if str(notes.get("plan_id") or "") != str(body.plan_id):
        raise HTTPException(status_code=400, detail="Plan does not match this order")

    amount_paise = int(pay.get("amount") or 0)

    user_id = _user_id(claims)
    user_row = await _load_user(user_id)
    if not _is_apartment_admin(user_row, body.apartment_id):
        raise HTTPException(status_code=403, detail="Not allowed to activate subscription for this apartment")

    return await _apply_pro_subscription(
        body.apartment_id, body.plan_id, body.razorpay_payment_id, amount_paise
    )


@router.post("/webhook")
async def razorpay_webhook(request: Request) -> dict:
    """
    Razorpay server-to-server. Register URL in the Razorpay dashboard (e.g. payment.captured).
    Requires RAZORPAY_WEBHOOK_SECRET from the same Webhooks screen.
    """
    if not _key_configured():
        raise HTTPException(
            status_code=503, detail="Razorpay is not configured on the server. Add API keys in .env"
        )
    if not _webhook_secret_configured():
        log.warning("RAZORPAY_WEBHOOK_SECRET is not set; webhook is disabled")
        raise HTTPException(
            status_code=503,
            detail="RAZORPAY_WEBHOOK_SECRET is not set. Add the webhook secret from the Razorpay dashboard.",
        )

    body_bytes = await request.body()
    header_sig = (request.headers.get("X-Razorpay-Signature") or "").strip()
    if not header_sig or not verify_webhook_signature(body_bytes, header_sig):
        log.warning("Razorpay webhook: bad signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail="Invalid JSON") from e

    event = str(payload.get("event") or "")
    if event not in ("payment.captured",):
        return {"ok": True, "ignored": event or "no_event"}

    try:
        pay_entity = (payload.get("payload") or {}).get("payment", {}).get("entity", {}) or {}
    except (TypeError, AttributeError):
        return {"ok": True, "ignored": "shape"}

    pay_id = str(pay_entity.get("id") or "")
    order_id = str(pay_entity.get("order_id") or "")
    if not pay_id or not order_id:
        return {"ok": True, "ignored": "no_payment_or_order_id"}

    try:
        pay = await fetch_payment(pay_id)
    except Exception as e:
        log.exception("Razorpay webhook fetch payment: %s", e)
        raise HTTPException(
            status_code=503, detail="Could not load payment from Razorpay. Will retry if applicable."
        ) from e

    st = str(pay.get("status") or "").lower()
    if st != "captured":
        return {"ok": True, "ignored": f"status_{st}"}

    if str(pay.get("order_id") or "") != order_id:
        return {"ok": True, "ignored": "order_mismatch"}

    try:
        order = await fetch_order(order_id)
    except Exception as e:
        log.exception("Razorpay webhook fetch order: %s", e)
        raise HTTPException(
            status_code=503, detail="Could not load order from Razorpay. Will retry if applicable."
        ) from e

    notes = _order_notes(order.get("notes"))
    aid = str(notes.get("apartment_id") or "")
    plan_id = str(notes.get("plan_id") or "")
    if not aid or not plan_id:
        log.warning("Razorpay webhook: order has no apartment_id / plan_id in notes")
        return {"ok": True, "ignored": "order_notes_missing"}

    try:
        uuid.UUID(aid)
    except ValueError:
        return {"ok": True, "ignored": "invalid_apartment_uuid"}

    amount_paise = int(pay.get("amount") or 0)
    out = await _apply_pro_subscription(aid, plan_id, pay_id, amount_paise)
    if out.get("duplicate"):
        return {"ok": True, "duplicate": True, "razorpay_payment_id": pay_id}
    return {"ok": True, "applied": True, "razorpay_payment_id": pay_id}
