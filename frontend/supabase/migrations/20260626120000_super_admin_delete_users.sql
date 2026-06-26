-- Allow super admin to delete society admin rows from public.users.
-- Requires public.is_super_admin() from 20260413120000_super_admin_rls.sql

DROP POLICY IF EXISTS "super_admin_delete_users" ON public.users;
CREATE POLICY "super_admin_delete_users" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_super_admin());
