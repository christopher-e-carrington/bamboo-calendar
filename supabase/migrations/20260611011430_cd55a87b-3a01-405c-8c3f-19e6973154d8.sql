
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  doc_date DATE,
  details TEXT,
  notes TEXT,
  file_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read documents" ON public.documents FOR SELECT USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert documents" ON public.documents FOR INSERT WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update documents" ON public.documents FOR UPDATE USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete documents" ON public.documents FOR DELETE USING (public.is_household_member(owner_id, auth.uid()));
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.passwords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  site_name TEXT NOT NULL,
  url TEXT,
  username TEXT,
  password TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passwords TO authenticated;
GRANT ALL ON public.passwords TO service_role;
ALTER TABLE public.passwords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read passwords" ON public.passwords FOR SELECT USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert passwords" ON public.passwords FOR INSERT WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update passwords" ON public.passwords FOR UPDATE USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete passwords" ON public.passwords FOR DELETE USING (public.is_household_member(owner_id, auth.uid()));
CREATE TRIGGER update_passwords_updated_at BEFORE UPDATE ON public.passwords FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
