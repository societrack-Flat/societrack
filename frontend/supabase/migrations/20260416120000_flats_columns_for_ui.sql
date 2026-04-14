-- Ensure public.flats has every column the admin Flats UI reads/writes.
-- Run in Supabase SQL Editor if migrations are not auto-applied.

ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS monthly_maintenance numeric(12, 2);
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS pending_maintenance numeric(12, 2) DEFAULT 0;
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS other_maintenance numeric(12, 2) DEFAULT 0;
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS resident_name text;
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS resident_phone text;
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS resident_email text;
ALTER TABLE public.flats ADD COLUMN IF NOT EXISTS is_occupied boolean DEFAULT true;
