CREATE TABLE public.google_calendar_settings (
  household_id uuid PRIMARY KEY,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_settings TO authenticated;
GRANT ALL ON public.google_calendar_settings TO service_role;
ALTER TABLE public.google_calendar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household members manage google settings"
  ON public.google_calendar_settings FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));
CREATE TRIGGER google_calendar_settings_updated_at BEFORE UPDATE ON public.google_calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_google_sync (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  household_id uuid NOT NULL,
  google_event_id text NOT NULL,
  google_calendar_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('push','import')),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX event_google_sync_gid_idx
  ON public.event_google_sync(household_id, google_calendar_id, google_event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_google_sync TO authenticated;
GRANT ALL ON public.event_google_sync TO service_role;
ALTER TABLE public.event_google_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household members manage event sync"
  ON public.event_google_sync FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));