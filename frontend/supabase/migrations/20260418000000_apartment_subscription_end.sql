-- Paid subscription period end (set after successful Razorpay payment; 30-day windows).
alter table public.apartments
  add column if not exists subscription_end_date date;

comment on column public.apartments.subscription_end_date is
  'End date of current paid period (inclusive of benefits until this date).';
