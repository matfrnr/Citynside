ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_preferences JSONB NOT NULL
    DEFAULT '{"startView":"home","sidebarCollapsed":false,"hideMapControlsByDefault":true,"mapZoom":13,"reduceMotion":false,"defaultScoreProfile":"none","defaultCategoryFilter":null,"distanceUnit":"meters"}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_report_customization JSONB NOT NULL
    DEFAULT '{"includedSections":{"scores":true,"sources":true,"impressions":true,"risks":false},"strengths":"","reservations":""}'::jsonb;

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id TEXT NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  turns JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS assistant_conversations_updated_idx
  ON public.assistant_conversations(user_id, updated_at DESC);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own assistant conversations" ON public.assistant_conversations;
CREATE POLICY "Users can view own assistant conversations" ON public.assistant_conversations
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own assistant conversations" ON public.assistant_conversations;
CREATE POLICY "Users can insert own assistant conversations" ON public.assistant_conversations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own assistant conversations" ON public.assistant_conversations;
CREATE POLICY "Users can update own assistant conversations" ON public.assistant_conversations
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid())
  ) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own assistant conversations" ON public.assistant_conversations;
CREATE POLICY "Users can delete own assistant conversations" ON public.assistant_conversations
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assistant_conversations TO authenticated;
