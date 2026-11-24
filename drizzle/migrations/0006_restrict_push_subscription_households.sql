DELETE FROM public.push_subscriptions s WHERE NOT public.is_household_member(s.household_id, s.user_id);
DROP POLICY IF EXISTS "own push subs" ON public.push_subscriptions;
CREATE POLICY "own push subs" ON public.push_subscriptions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.is_household_member(household_id, auth.uid()));