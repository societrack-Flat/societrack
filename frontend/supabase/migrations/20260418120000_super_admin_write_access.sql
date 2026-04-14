-- Super Admin: INSERT/UPDATE/DELETE on tenant tables (same visibility as platform-wide SELECT).
-- Requires public.is_super_admin() from 20260413120000_super_admin_rls.sql
-- Apply in Supabase SQL Editor if migrations are not auto-applied.

-- Flats
DROP POLICY IF EXISTS "super_admin_insert_flats" ON public.flats;
CREATE POLICY "super_admin_insert_flats" ON public.flats FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_flats" ON public.flats;
CREATE POLICY "super_admin_update_flats" ON public.flats FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_flats" ON public.flats;
CREATE POLICY "super_admin_delete_flats" ON public.flats FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Income
DROP POLICY IF EXISTS "super_admin_insert_income" ON public.income;
CREATE POLICY "super_admin_insert_income" ON public.income FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_income" ON public.income;
CREATE POLICY "super_admin_update_income" ON public.income FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_income" ON public.income;
CREATE POLICY "super_admin_delete_income" ON public.income FOR DELETE TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_select_income" ON public.income;
CREATE POLICY "super_admin_select_income" ON public.income FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Expenses
DROP POLICY IF EXISTS "super_admin_insert_expenses" ON public.expenses;
CREATE POLICY "super_admin_insert_expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_expenses" ON public.expenses;
CREATE POLICY "super_admin_update_expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_expenses" ON public.expenses;
CREATE POLICY "super_admin_delete_expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_select_expenses" ON public.expenses;
CREATE POLICY "super_admin_select_expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Maintenance
DROP POLICY IF EXISTS "super_admin_insert_maintenance" ON public.maintenance;
CREATE POLICY "super_admin_insert_maintenance" ON public.maintenance FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_maintenance" ON public.maintenance;
CREATE POLICY "super_admin_update_maintenance" ON public.maintenance FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_maintenance" ON public.maintenance;
CREATE POLICY "super_admin_delete_maintenance" ON public.maintenance FOR DELETE TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_select_maintenance" ON public.maintenance;
CREATE POLICY "super_admin_select_maintenance" ON public.maintenance FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Announcements
DROP POLICY IF EXISTS "super_admin_insert_announcements" ON public.announcements;
CREATE POLICY "super_admin_insert_announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_announcements" ON public.announcements;
CREATE POLICY "super_admin_update_announcements" ON public.announcements FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_announcements" ON public.announcements;
CREATE POLICY "super_admin_delete_announcements" ON public.announcements FOR DELETE TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_select_announcements" ON public.announcements;
CREATE POLICY "super_admin_select_announcements" ON public.announcements FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Viewer settings (per apartment)
DROP POLICY IF EXISTS "super_admin_insert_viewer_settings" ON public.viewer_settings;
CREATE POLICY "super_admin_insert_viewer_settings" ON public.viewer_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_update_viewer_settings" ON public.viewer_settings;
CREATE POLICY "super_admin_update_viewer_settings" ON public.viewer_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_delete_viewer_settings" ON public.viewer_settings;
CREATE POLICY "super_admin_delete_viewer_settings" ON public.viewer_settings FOR DELETE TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "super_admin_select_viewer_settings" ON public.viewer_settings;
CREATE POLICY "super_admin_select_viewer_settings" ON public.viewer_settings FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Allow super admin to update society admin rows (e.g. notes); auth passwords use Supabase Auth / reset email
DROP POLICY IF EXISTS "super_admin_update_users" ON public.users;
CREATE POLICY "super_admin_update_users" ON public.users FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
