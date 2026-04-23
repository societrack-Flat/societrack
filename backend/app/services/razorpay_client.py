import base64
import hashlib
import hmac
import time

import httpx

from app.core.config import settings


def _require_keys() -> None:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RuntimeError("Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)")


def _auth_header() -> dict[str, str]:
    _require_keys()
    raw = f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode("utf-8")
    b64 = base64.b64encode(raw).decode("ascii")
    return {
        "Authorization": f"Basic {b64}",
        "Content-Type": "application/json",
    }


async def create_order(
    amount_paise: int,
    receipt: str,
    notes: dict[str, str],
) -> dict:
    _require_keys()
    rec = (receipt or "r")[:40]
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://api.razorpay.com/v1/orders",
            headers=_auth_header(),
            json={
                "amount": int(amount_paise),
                "currency": "INR",
                "receipt": rec,
                "notes": {str(k): str(v) for k, v in (notes or {}).items()},
            },
        )
        r.raise_for_status()
        return r.json()


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    if not order_id or not payment_id or not signature or not settings.razorpay_key_secret:
        return False
    msg = f"{order_id}|{payment_id}"
    expected = hmac.new(
        settings.razorpay_key_secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def fetch_payment(payment_id: str) -> dict:
    _require_keys()
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"https://api.razorpay.com/v1/payments/{payment_id}",
            headers=_auth_header(),
        )
        r.raise_for_status()
        return r.json()


def unique_receipt() -> str:
    return f"st{int(time.time() * 1000)}"[:40]
