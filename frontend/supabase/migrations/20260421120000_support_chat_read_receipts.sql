-- Read receipts + RPCs for unread counts (bell) and marking threads read.

ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS admin_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_last_read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_support_thread_read(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_apartment uuid;
BEGIN
  SELECT apartment_id INTO t_apartment FROM public.support_threads WHERE id = p_thread_id;
  IF t_apartment IS NULL THEN
    RAISE EXCEPTION 'thread not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin') THEN
    UPDATE public.support_threads SET support_last_read_at = now() WHERE id = p_thread_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND apartment_id = t_apartment
  ) THEN
    UPDATE public.support_threads SET admin_last_read_at = now() WHERE id = p_thread_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'not allowed';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_support_thread_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_unread_count_admin(p_apartment_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  lr timestamptz;
  c integer;
BEGIN
  IF p_apartment_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND apartment_id = p_apartment_id
  ) THEN
    RETURN 0;
  END IF;

  SELECT t.id, t.admin_last_read_at INTO tid, lr
  FROM public.support_threads t
  WHERE t.apartment_id = p_apartment_id;

  IF tid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer INTO c
  FROM public.support_messages m
  WHERE m.thread_id = tid
    AND m.sender_role = 'super_admin'
    AND (lr IS NULL OR m.created_at > lr);

  RETURN COALESCE(c, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.support_unread_count_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_unread_count_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_unread_count_superadmin()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer INTO c
  FROM public.support_messages m
  INNER JOIN public.support_threads t ON m.thread_id = t.id
  WHERE m.sender_role = 'admin'
    AND (t.support_last_read_at IS NULL OR m.created_at > t.support_last_read_at);

  RETURN COALESCE(c, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.support_unread_count_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_unread_count_superadmin() TO authenticated;
