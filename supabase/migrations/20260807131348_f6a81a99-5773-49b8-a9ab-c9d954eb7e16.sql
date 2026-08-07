DROP POLICY IF EXISTS "own stores select" ON public.shopping_stores;
DROP POLICY IF EXISTS "own stores insert" ON public.shopping_stores;
DROP POLICY IF EXISTS "own stores update" ON public.shopping_stores;
DROP POLICY IF EXISTS "own stores delete" ON public.shopping_stores;

CREATE POLICY "Members read stores" ON public.shopping_stores FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert stores" ON public.shopping_stores FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update stores" ON public.shopping_stores FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete stores" ON public.shopping_stores FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

ALTER TABLE public.shopping_stores REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_stores;