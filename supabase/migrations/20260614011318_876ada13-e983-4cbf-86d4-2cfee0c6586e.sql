CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view notes"
  ON public.notes FOR SELECT TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can insert notes"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can update notes"
  ON public.notes FOR UPDATE TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()))
  WITH CHECK (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can delete notes"
  ON public.notes FOR DELETE TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
