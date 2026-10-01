ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_quick_access TEXT[] NOT NULL
  DEFAULT ARRAY['new-analysis', 'history', 'favorites', 'comparison']::TEXT[];
