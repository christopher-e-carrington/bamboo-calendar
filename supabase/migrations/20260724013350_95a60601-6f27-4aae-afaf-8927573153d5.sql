
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  profile_id UUID,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  mood TEXT,
  location TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  weather TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household can view journal entries"
  ON public.journal_entries FOR SELECT
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household can insert journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household can update journal entries"
  ON public.journal_entries FOR UPDATE
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household can delete journal entries"
  ON public.journal_entries FOR DELETE
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE INDEX idx_journal_entries_owner_date ON public.journal_entries(owner_id, entry_date DESC);
CREATE INDEX idx_journal_entries_content ON public.journal_entries USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'') || ' ' || coalesce(location,'')));

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
