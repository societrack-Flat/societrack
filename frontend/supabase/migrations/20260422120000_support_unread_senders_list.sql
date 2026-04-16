-- Superadmin bell: list admins who have unread pings (for dropdown + deep-link).

CREATE OR REPLACE FUNCTION public.support_unread_senders_for_superadmin()
RETURNS TABLE (
  apartment_id uuid,
  admin_name text,
  admin_email text,
  unread_count bigint,
  last_message_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.apartment_id,
    COALESCE(
      (SELECT u.name FROM public.users u WHERE u.apartment_id = t.apartment_id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1),
      (SELECT u.email FROM public.users u WHERE u.apartment_id = t.apartment_id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1),
      'Admin'
    )::text AS admin_name,
    COALESCE(
      (SELECT u.email FROM public.users u WHERE u.apartment_id = t.apartment_id AND u.role = 'admin' ORDER BY u.id ASC LIMIT 1),
      ''
    )::text AS admin_email,
    COUNT(m.id) AS unread_count,
    MAX(m.created_at) AS last_message_at
  FROM public.support_threads t
  INNER JOIN public.support_messages m ON m.thread_id = t.id AND m.sender_role = 'admin'
  WHERE (t.support_last_read_at IS NULL OR m.created_at > t.support_last_read_at)
  GROUP BY t.apartment_id
  HAVING COUNT(m.id) > 0
  ORDER BY MAX(m.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.support_unread_senders_for_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_unread_senders_for_superadmin() TO authenticated;
