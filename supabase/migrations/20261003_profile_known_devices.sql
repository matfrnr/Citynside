ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS known_device_ids TEXT[] NOT NULL DEFAULT '{}';
