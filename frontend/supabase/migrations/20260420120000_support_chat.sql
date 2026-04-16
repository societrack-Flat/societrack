-- Admin ↔ Super Admin support chat (threads per apartment, messages in Postgres + Realtime).

CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id uuid NOT NULL REFERENCES public.apartments (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_threads_apartment_unique UNIQUE (apartment_id)
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'admin',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_body_len CHECK (char_length(body) > 0 AND char_length(body) <= 8000),
  CONSTRAINT support_messages_sender_role_chk CHECK (sender_role IN ('admin', 'super_admin', 'resident', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread_created
  ON public.support_messages (thread_id, created_at);

CREATE OR REPLACE FUNCTION public.support_messages_set_sender_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  IF NEW.sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'sender must be current user';
  END IF;
  SELECT role INTO r FROM public.users WHERE id = NEW.sender_id;
  IF r IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  NEW.sender_role := r;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_support_messages_set_role ON public.support_messages;
CREATE TRIGGER tr_support_messages_set_role
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_messages_set_sender_role();

CREATE OR REPLACE FUNCTION public.support_touch_thread_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.support_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_support_messages_touch_thread ON public.support_messages;
CREATE TRIGGER tr_support_messages_touch_thread
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_touch_thread_updated_at();

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_threads_select" ON public.support_threads;
CREATE POLICY "support_threads_select" ON public.support_threads
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.apartment_id = support_threads.apartment_id
    )
  );

DROP POLICY IF EXISTS "support_threads_insert" ON public.support_threads;
CREATE POLICY "support_threads_insert" ON public.support_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.apartment_id = support_threads.apartment_id
    )
  );

DROP POLICY IF EXISTS "support_messages_select" ON public.support_messages;
CREATE POLICY "support_messages_select" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.support_threads t
      INNER JOIN public.users u ON u.id = auth.uid()
      WHERE t.id = support_messages.thread_id
        AND u.role = 'admin'
        AND u.apartment_id = t.apartment_id
    )
  );

DROP POLICY IF EXISTS "support_messages_insert" ON public.support_messages;
CREATE POLICY "support_messages_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.support_threads t
        INNER JOIN public.users u ON u.id = auth.uid()
        WHERE t.id = support_messages.thread_id
          AND u.role = 'admin'
          AND u.apartment_id = t.apartment_id
      )
    )
  );

-- Realtime: new message inserts broadcast to subscribers (safe if re-run)
DO $rl$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$rl$;

GRANT SELECT, INSERT ON public.support_threads TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
