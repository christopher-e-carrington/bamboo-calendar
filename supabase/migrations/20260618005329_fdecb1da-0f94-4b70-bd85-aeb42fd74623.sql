CREATE TABLE public.custom_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  colors jsonb NOT NULL,
  background_image_url text,
  card_opacity numeric NOT NULL DEFAULT 1 CHECK (card_opacity >= 0 AND card_opacity <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_themes TO authenticated;
GRANT ALL ON public.custom_themes TO service_role;

ALTER TABLE public.custom_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members select themes" ON public.custom_themes
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members insert themes" ON public.custom_themes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "household members update themes" ON public.custom_themes
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members delete themes" ON public.custom_themes
  FOR DELETE TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE INDEX custom_themes_household_idx ON public.custom_themes(household_id);