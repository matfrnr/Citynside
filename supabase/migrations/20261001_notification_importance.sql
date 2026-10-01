ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'normal';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_importance_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_importance_check
      CHECK (importance IN ('normal', 'attention', 'important'));
  END IF;
END $$;

UPDATE public.notifications
SET importance = CASE
  WHEN kind = 'territory' THEN 'attention'
  WHEN title ILIKE '%profil modifié%' OR title ILIKE '%compte a bien été activé%' THEN 'important'
  ELSE 'normal'
END;
