-- Personnalisation des rapports, persistée par utilisateur et par analyse.
CREATE TABLE IF NOT EXISTS public.report_customizations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id TEXT NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  included_sections JSONB NOT NULL DEFAULT '{"scores":true,"sources":true,"impressions":true}'::jsonb,
  strengths TEXT NOT NULL DEFAULT '',
  reservations TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS report_customizations_analysis_id_idx
  ON public.report_customizations(analysis_id);

ALTER TABLE public.report_customizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own report customizations" ON public.report_customizations;
CREATE POLICY "Users can view own report customizations"
  ON public.report_customizations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own report customizations" ON public.report_customizations;
CREATE POLICY "Users can insert own report customizations"
  ON public.report_customizations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own report customizations" ON public.report_customizations;
CREATE POLICY "Users can update own report customizations"
  ON public.report_customizations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own report customizations" ON public.report_customizations;
CREATE POLICY "Users can delete own report customizations"
  ON public.report_customizations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.report_customizations TO authenticated;
