# Societrack Backend (FastAPI)

This backend is **optional but recommended** for long-term scale.

- Keep **Supabase** as your database/auth/storage.
- Use this API for **aggregations**, **exports**, **webhooks**, **rate limiting**, and **server-only secrets**.

## Why this exists

Frontend-to-Supabase is great for CRUD, but at scale you usually want:

- Server-side **dashboard/report aggregations** (fast, cached, minimal data transfer)
- **PDF/Excel** generation with a consistent layout/logo (and no browser memory limits)
- Payment/webhook handling (Razorpay/Stripe) using secrets
- Centralized auth checks + rate limiting

## Setup

1) Create `.env` from `.env.example`.

2) Install & run:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

3) Health check:

- `GET http://localhost:8000/health`

## Authentication

This API expects a Supabase JWT in:

- `Authorization: Bearer <access_token>`

In the frontend, get it via `supabase.auth.getSession()` and pass the access token when calling API routes.

## Endpoints (starter)

- `GET /health`
- `GET /api/dashboard/monthly-income-expense?apartment_id=...&range=all|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/dashboard/recent-transactions?apartment_id=...&limit=20`

These endpoints use the **service role key** to query Postgres efficiently (server-only secret).

## Super admin login & password reset

Super admin uses **Supabase Auth** (email + password). There is **no SMS OTP** in this backend.

- **Login:** `/superadmin` — only someone who knows the super admin email and password can sign in; `users.role` must be `super_admin`.
- **Forgot password:** From `/superadmin`, use **Forgot your password?** — Supabase sends a **reset link to that email**. In **Supabase → Authentication → URL configuration**, add your redirect URL (e.g. `http://localhost:5173/reset-password` for dev and your production `/reset-password`).

