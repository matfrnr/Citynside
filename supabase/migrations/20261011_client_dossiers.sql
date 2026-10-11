-- Dossiers privés par utilisateur, avec les analyses associées au projet client.
CREATE TABLE IF NOT EXISTS public.client_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  project TEXT NOT NULL DEFAULT '',
  priorities TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  analysis_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_dossiers_user_updated_idx
  ON public.client_dossiers(user_id, updated_at DESC);

ALTER TABLE public.client_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own client dossiers" ON public.client_dossiers;
CREATE POLICY "Users can view own client dossiers" ON public.client_dossiers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own client dossiers" ON public.client_dossiers;
CREATE POLICY "Users can insert own client dossiers" ON public.client_dossiers
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(client_dossiers.analysis_ids) AS linked(analysis_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.analyses AS a
        WHERE a.id = linked.analysis_id AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own client dossiers" ON public.client_dossiers;
CREATE POLICY "Users can update own client dossiers" ON public.client_dossiers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(client_dossiers.analysis_ids) AS linked(analysis_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.analyses AS a
        WHERE a.id = linked.analysis_id AND a.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own client dossiers" ON public.client_dossiers;
CREATE POLICY "Users can delete own client dossiers" ON public.client_dossiers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_dossiers TO authenticated;
REVOKE ALL ON TABLE public.client_dossiers FROM anon;
