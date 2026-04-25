-- Run this in the Supabase SQL Editor if /api/payments/razorpay/verify returns 503 after a successful
-- Razorpay payment. The API PATCHes these columns on public.apartments.
-- Safe to re-run: uses IF NOT EXISTS for each new column.

alter table public.apartments add column if not exists plan_name text;
alter table public.apartments add column if not exists subscription_status text;
alter table public.apartments add column if not exists flat_limit int;
alter table public.apartments add column if not exists monthly_price numeric;
alter table public.apartments add column if not exists subscription_end_date date;
alter table public.apartments add column if not exists last_razorpay_payment_id text;
