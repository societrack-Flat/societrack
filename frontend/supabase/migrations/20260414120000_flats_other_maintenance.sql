-- Optional charges tracked per flat (parking, water, etc.) — surfaced on dashboard totals.
ALTER TABLE public.flats
  ADD COLUMN IF NOT EXISTS other_maintenance numeric(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.flats.other_maintenance IS 'Non-monthly maintenance / other recurring charges for this flat (₹).';
