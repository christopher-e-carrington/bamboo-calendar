
CREATE TABLE public.routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.household_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'daily',
  tier TEXT NOT NULL DEFAULT 'daily',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view routines"
  ON public.routines FOR SELECT TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can insert routines"
  ON public.routines FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can update routines"
  ON public.routines FOR UPDATE TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()))
  WITH CHECK (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can delete routines"
  ON public.routines FOR DELETE TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_routines_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
