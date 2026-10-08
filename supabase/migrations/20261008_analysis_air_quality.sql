ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS air_quality JSONB;
