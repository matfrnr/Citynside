ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activation_notification_sent BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts have already been welcomed by the earlier client behavior.
-- Preserve that fact even if a user deleted the welcome notification itself.
INSERT INTO public.profiles (id, email, activation_notification_sent)
SELECT id, COALESCE(email, ''), true
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET activation_notification_sent = true;
