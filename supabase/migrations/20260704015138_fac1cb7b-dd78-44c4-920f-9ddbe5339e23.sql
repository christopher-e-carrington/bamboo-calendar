
CREATE TABLE public.shopping_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_stores TO authenticated;
GRANT ALL ON public.shopping_stores TO service_role;
ALTER TABLE public.shopping_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stores select" ON public.shopping_stores FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own stores insert" ON public.shopping_stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own stores update" ON public.shopping_stores FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own stores delete" ON public.shopping_stores FOR DELETE TO authenticated USING (auth.uid() = owner_id);

ALTER TABLE public.shopping_items ADD COLUMN store_id UUID REFERENCES public.shopping_stores(id) ON DELETE SET NULL;
