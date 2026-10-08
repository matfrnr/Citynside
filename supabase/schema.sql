-- ==============================================================================
-- Schema Supabase pour Citynside (Cytinside)
-- Table : analyses (persistance des analyses de quartiers et favoris par utilisateur)
-- ==============================================================================

-- 1. Création de la table 'analyses'
CREATE TABLE IF NOT EXISTS public.analyses (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL DEFAULT '',
  neighborhood_name TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lon DOUBLE PRECISION NOT NULL DEFAULT 0,
  global_score NUMERIC NOT NULL DEFAULT 0,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  pois JSONB NOT NULL DEFAULT '[]'::jsonb,
  impressions JSONB,
  risk_assessment JSONB,
  air_quality JSONB,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour accélérer les requêtes par utilisateur et date
CREATE INDEX IF NOT EXISTS analyses_user_id_idx ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON public.analyses(created_at DESC);

-- 2. Activation du Row Level Security (RLS)
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- 3. Politiques RLS (chaque utilisateur accède uniquement à ses propres données)
DROP POLICY IF EXISTS "Users can view own analyses" ON public.analyses;
CREATE POLICY "Users can view own analyses" ON public.analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analyses" ON public.analyses;
CREATE POLICY "Users can insert own analyses" ON public.analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own analyses" ON public.analyses;
CREATE POLICY "Users can update own analyses" ON public.analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own analyses" ON public.analyses;
CREATE POLICY "Users can delete own analyses" ON public.analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Droits d'accès PostgreSQL indispensables pour PostgREST (Supabase JS)
GRANT ALL ON TABLE public.analyses TO authenticated;
GRANT ALL ON TABLE public.analyses TO anon;
GRANT ALL ON TABLE public.analyses TO service_role;

-- 5. Activer le Realtime pour synchronisation instantanée entre appareils
ALTER PUBLICATION supabase_realtime ADD TABLE public.analyses;

-- ==============================================================================
-- Table : profiles (synchronisation multi-appareils du profil en BDD)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  full_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  agency TEXT DEFAULT 'Agence immobilière',
  agency_city TEXT DEFAULT '',
  known_device_ids TEXT[] NOT NULL DEFAULT '{}',
  home_quick_access TEXT[] NOT NULL DEFAULT ARRAY['new-analysis', 'history', 'favorites', 'comparison']::TEXT[],
  activation_notification_sent BOOLEAN NOT NULL DEFAULT false,
  role TEXT DEFAULT 'Agent immobilier',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Notifications persistantes par utilisateur
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('analysis', 'report', 'territory', 'system')),
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal', 'attention', 'important')),
  source_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE ON TABLE public.notifications TO authenticated;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT DELETE ON TABLE public.notifications TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Personnalisation des rapports, persistée par utilisateur et par analyse
CREATE TABLE IF NOT EXISTS public.report_customizations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id TEXT NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  included_sections JSONB NOT NULL DEFAULT '{"scores":true,"sources":true,"impressions":true}'::jsonb,
  strengths TEXT NOT NULL DEFAULT '',
  reservations TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, analysis_id)
);
CREATE INDEX IF NOT EXISTS report_customizations_analysis_id_idx ON public.report_customizations(analysis_id);
ALTER TABLE public.report_customizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own report customizations" ON public.report_customizations;
CREATE POLICY "Users can view own report customizations" ON public.report_customizations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own report customizations" ON public.report_customizations;
CREATE POLICY "Users can insert own report customizations" ON public.report_customizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own report customizations" ON public.report_customizations;
CREATE POLICY "Users can update own report customizations" ON public.report_customizations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own report customizations" ON public.report_customizations;
CREATE POLICY "Users can delete own report customizations" ON public.report_customizations FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.report_customizations TO authenticated;
