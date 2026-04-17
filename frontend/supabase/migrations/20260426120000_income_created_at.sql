-- Stable sort for income list: latest transaction date first; same day, newest row first.
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Backfill legacy rows: one timestamp per row (same calendar date → order by id)
UPDATE public.income i
SET created_at = sub.ts
FROM (
  SELECT
    id,
    (date::text || 'T12:00:00Z')::timestamptz
      + (row_number() OVER (PARTITION BY apartment_id, date ORDER BY id) * interval '1 microsecond') AS ts
  FROM public.income
  WHERE created_at IS NULL
) AS sub
WHERE i.id = sub.id;

ALTER TABLE public.income ALTER COLUMN created_at SET DEFAULT now();
