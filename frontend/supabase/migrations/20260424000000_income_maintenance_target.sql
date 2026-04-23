-- How a Maintenance payment applies: current month row vs old balance (arrears) on the flat.
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS maintenance_payment_target text;

ALTER TABLE public.income
  ADD CONSTRAINT income_maintenance_payment_target_check
  CHECK (maintenance_payment_target IS NULL OR maintenance_payment_target IN ('current', 'arrears'));

COMMENT ON COLUMN public.income.maintenance_payment_target IS
  'For category Maintenance: current = this month’s bill (sync maintenance row); arrears = reduce flats.pending_maintenance.';
