
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  created_by UUID NOT NULL,
  message TEXT NOT NULL,
  recipient_profile_ids UUID[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{app}',
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivery_status JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can create reminders"
  ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(owner_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Household members can update reminders"
  ON public.reminders FOR UPDATE TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()))
  WITH CHECK (public.is_household_member(owner_id, auth.uid()));

CREATE POLICY "Household members can delete reminders"
  ON public.reminders FOR DELETE TO authenticated
  USING (public.is_household_member(owner_id, auth.uid()));

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX reminders_owner_send_at_idx
  ON public.reminders (owner_id, send_at);

CREATE INDEX reminders_pending_idx
  ON public.reminders (send_at)
  WHERE sent_at IS NULL;
