ALTER TABLE public.custom_themes
  ADD COLUMN IF NOT EXISTS sidebar_color text,
  ADD COLUMN IF NOT EXISTS sidebar_opacity numeric;