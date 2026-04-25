-- Run this in the Supabase SQL Editor if /api/payments/razorpay/verify returns 503 after a successful
-- Razorpay payment. The API PATCHes these columns on public.apartments.
-- Safe to re-run: uses IF NOT EXISTS for each new column.

alter table public.apartments add column if not exists plan_name text;
alter table public.apartments add column if not exists subscription_status text;
alter table public.apartments add column if not exists flat_limit int;
alter table public.apartments add column if not exists monthly_price numeric;
alter table public.apartments add column if not exists subscription_end_date date;
alter table public.apartments add column if not exists last_razorpay_payment_id text;

-- If you prefer `plan_name = 'societrack_pro'` in the database, extend the CHECK instead of relying
-- on API using `premium` (see backend `APARTMENT_PLAN_NAME_DB`):
--   alter table public.apartments drop constraint if exists apartments_plan_name_check;
--   alter table public.apartments add constraint apartments_plan_name_check
--     check (plan_name in ('free','free_trial','basic','standard','premium','societrack_pro'));
