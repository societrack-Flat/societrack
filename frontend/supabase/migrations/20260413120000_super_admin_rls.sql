-- Super Admin: ensure RLS allows platform-wide reads (and apartment updates on Subscriptions page).
-- Apply with: supabase db push   OR   paste into Supabase SQL Editor and run once.
--
-- Requires: public.users has columns (id uuid PK matching auth.users, role text).

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Apartments: all rows for super admin (dashboard, lists, subscription edits)
DROP POLICY IF EXISTS "super_admin_select_apartments" ON public.apartments;
CREATE POLICY "super_admin_select_apartments"
  ON public.apartments
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_update_apartments" ON public.apartments;
CREATE POLICY "super_admin_update_apartments"
  ON public.apartments
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Flats: counts + maintenance sums (SA Apartments)
DROP POLICY IF EXISTS "super_admin_select_flats" ON public.flats;
CREATE POLICY "super_admin_select_flats"
  ON public.flats
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Users: admin list + subscription admin emails
DROP POLICY IF EXISTS "super_admin_select_users" ON public.users;
CREATE POLICY "super_admin_select_users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Payment history: revenue charts
DROP POLICY IF EXISTS "super_admin_select_payment_history" ON public.payment_history;
CREATE POLICY "super_admin_select_payment_history"
  ON public.payment_history
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());
