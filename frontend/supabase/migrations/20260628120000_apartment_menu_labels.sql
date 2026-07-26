-- Custom sidebar/page labels per apartment (e.g. Flats -> Hostel).
-- NULL means use the default label in the app.

ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS flats_menu_label text,
  ADD COLUMN IF NOT EXISTS maintenance_menu_label text;

COMMENT ON COLUMN public.apartments.flats_menu_label IS
  'Optional custom label for the Flats section (sidebar + page title). NULL = "Flats".';

COMMENT ON COLUMN public.apartments.maintenance_menu_label IS
  'Optional custom label for the Maintenance section (sidebar + page title). NULL = "Maintenance".';
