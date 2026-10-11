ALTER TABLE public.profiles
  ALTER COLUMN home_quick_access
  SET DEFAULT ARRAY['new-analysis', 'comparison', 'client-dossiers', 'favorites']::TEXT[];
