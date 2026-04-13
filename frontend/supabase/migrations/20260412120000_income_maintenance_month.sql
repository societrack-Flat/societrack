-- Optional: maintenance period label for income rows (e.g. "2026-04" for April 2026)
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS maintenance_month text;
