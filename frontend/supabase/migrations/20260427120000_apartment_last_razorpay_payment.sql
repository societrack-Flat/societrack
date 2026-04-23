-- Idempotent Razorpay: same pay_id from verify + webhook does not double-extend subscription
alter table public.apartments
  add column if not exists last_razorpay_payment_id text;

comment on column public.apartments.last_razorpay_payment_id is
  'Last applied Razorpay payment id; prevents duplicate application from verify + webhooks.';
