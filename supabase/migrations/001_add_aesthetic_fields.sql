ALTER TABLE public.schemes
ADD COLUMN IF NOT EXISTS aesthetic_preferences JSONB DEFAULT '{}'::jsonb;
