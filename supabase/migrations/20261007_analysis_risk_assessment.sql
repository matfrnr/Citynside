ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS risk_assessment JSONB;
