from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from cachetools import TTLCache

from app.services.auth import require_user
from app.services.supabase_rest import supabase_rest


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_cache = TTLCache(maxsize=1024, ttl=30)  # short cache to smooth spikes


def _parse_date(s: str | None) -> str | None:
    if not s:
        return None
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")


@router.get("/recent-transactions")
async def recent_transactions(
    apartment_id: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    _claims=Depends(require_user),
):
    """
    Returns merged income+expense transactions ordered by date desc.
    """
    cache_key = ("recent", apartment_id, limit)
    if cache_key in _cache:
        return _cache[cache_key]

    sb = supabase_rest()

    income = await sb.get(
        "income",
        params={
            "select": "id,date,amount,category,description,payment_mode,reference_number,flat_id",
            "apartment_id": f"eq.{apartment_id}",
            "order": "date.desc",
            "limit": str(limit),
        },
    )
    expenses = await sb.get(
        "expenses",
        params={
            "select": "id,date,amount,category,description,payment_mode,reference_number,vendor_name",
            "apartment_id": f"eq.{apartment_id}",
            "order": "date.desc",
            "limit": str(limit),
        },
    )

    merged = []
    for r in income or []:
        merged.append(
            {
                "type": "income",
                "id": r.get("id"),
                "title": r.get("description") or r.get("category") or "Income",
                "amount": float(r.get("amount") or 0),
                "date": r.get("date"),
                "payment_mode": r.get("payment_mode"),
            }
        )
    for r in expenses or []:
        merged.append(
            {
                "type": "expense",
                "id": r.get("id"),
                "title": r.get("description") or r.get("category") or r.get("vendor_name") or "Expense",
                "amount": float(r.get("amount") or 0),
                "date": r.get("date"),
                "payment_mode": r.get("payment_mode"),
            }
        )

    merged.sort(key=lambda x: (x.get("date") or ""), reverse=True)
    merged = merged[:limit]

    payload = {"items": merged}
    _cache[cache_key] = payload
    return payload


@router.get("/monthly-income-expense")
async def monthly_income_expense(
    apartment_id: str = Query(...),
    range: str = Query("all", pattern="^(all|month|custom)$"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    _claims=Depends(require_user),
):
    """
    Returns month buckets with totals for Income vs Expenses.

    Note: This uses PostgREST to fetch only needed columns and aggregates in memory.
    For very large datasets, migrate this into a Postgres view/materialized view or RPC.
    """
    f = _parse_date(from_date)
    t = _parse_date(to_date)

    if range == "custom" and (not f or not t):
        raise HTTPException(status_code=400, detail="Custom range requires from and to dates")

    today = date.today()
    if range == "month":
        f = today.replace(day=1).isoformat()
        # exclusive upper bound = first day of next month
        if today.month == 12:
            t = date(today.year + 1, 1, 1).isoformat()
        else:
            t = date(today.year, today.month + 1, 1).isoformat()

    cache_key = ("monthly", apartment_id, range, f, t)
    if cache_key in _cache:
        return _cache[cache_key]

    sb = supabase_rest()
    income_params = {
        "select": "date,amount",
        "apartment_id": f"eq.{apartment_id}",
        "limit": "50000",
    }
    expense_params = {
        "select": "date,amount",
        "apartment_id": f"eq.{apartment_id}",
        "limit": "50000",
    }
    if f:
        income_params["date"] = f"gte.{f}"
        expense_params["date"] = f"gte.{f}"
    if t:
        income_params["date"] = (income_params.get("date", "") + f"&lt.{t}").strip("&")
        expense_params["date"] = (expense_params.get("date", "") + f"&lt.{t}").strip("&")

    # PostgREST doesn't support multiple operators in one param easily via this helper.
    # So we pass them as raw query string by using httpx params mapping trick:
    # We'll build manually here by doing two calls: gte and lt as separate keys.
    # To keep it simple, we do only gte/lt if present using dedicated keys.
    income_params = {
        "select": "date,amount",
        "apartment_id": f"eq.{apartment_id}",
        "limit": "50000",
        **({"date": f"gte.{f}"} if f else {}),
        **({"date": f"lt.{t}"} if (t and not f) else {}),
    }
    expense_params = {
        "select": "date,amount",
        "apartment_id": f"eq.{apartment_id}",
        "limit": "50000",
        **({"date": f"gte.{f}"} if f else {}),
        **({"date": f"lt.{t}"} if (t and not f) else {}),
    }

    income_rows = await sb.get("income", params=income_params)
    expense_rows = await sb.get("expenses", params=expense_params)

    def month_key(d: str) -> str:
        # expects YYYY-MM-DD
        return d[:7]

    buckets: dict[str, dict[str, float]] = {}
    for r in income_rows or []:
        d = r.get("date")
        if not d:
            continue
        k = month_key(d)
        buckets.setdefault(k, {"income": 0.0, "expense": 0.0})
        buckets[k]["income"] += float(r.get("amount") or 0)
    for r in expense_rows or []:
        d = r.get("date")
        if not d:
            continue
        k = month_key(d)
        buckets.setdefault(k, {"income": 0.0, "expense": 0.0})
        buckets[k]["expense"] += float(r.get("amount") or 0)

    months = sorted(buckets.keys())
    items = [{"month": m, **buckets[m]} for m in months]
    payload = {"items": items}
    _cache[cache_key] = payload
    return payload

