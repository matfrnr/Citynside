-- Une seule session applicative active par compte.
CREATE TABLE IF NOT EXISTS public.citynside_active_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.citynside_active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own active session" ON public.citynside_active_sessions;
CREATE POLICY "Users can view own active session" ON public.citynside_active_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own active session" ON public.citynside_active_sessions;
CREATE POLICY "Users can insert own active session" ON public.citynside_active_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND session_id = (auth.jwt() ->> 'session_id')::uuid);

DROP POLICY IF EXISTS "Users can update own active session" ON public.citynside_active_sessions;
CREATE POLICY "Users can update own active session" ON public.citynside_active_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND session_id = (auth.jwt() ->> 'session_id')::uuid);

DROP POLICY IF EXISTS "Users can delete own active session" ON public.citynside_active_sessions;
CREATE POLICY "Users can delete own active session" ON public.citynside_active_sessions
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id AND session_id = (auth.jwt() ->> 'session_id')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.citynside_active_sessions TO authenticated;
REVOKE ALL ON TABLE public.citynside_active_sessions FROM anon;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'citynside_active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.citynside_active_sessions;
  END IF;
END $$;
