-- Per-profile Google Calendar OAuth tokens & sync settings
CREATE TABLE public.profile_google_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.household_profiles(id) ON DELETE CASCADE,
  household_id uuid NOT NULL,
  google_email text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scope text,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_google_tokens TO authenticated;
GRANT ALL ON public.profile_google_tokens TO service_role;

ALTER TABLE public.profile_google_tokens ENABLE ROW LEVEL SECURITY;

-- Only household members can see/manage tokens for profiles in their household
CREATE POLICY "household members view profile google tokens"
  ON public.profile_google_tokens FOR SELECT
  TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members insert profile google tokens"
  ON public.profile_google_tokens FOR INSERT
  TO authenticated
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members update profile google tokens"
  ON public.profile_google_tokens FOR UPDATE
  TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members delete profile google tokens"
  ON public.profile_google_tokens FOR DELETE
  TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE TRIGGER trg_pgt_updated_at
  BEFORE UPDATE ON public.profile_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-profile event sync mapping (replaces household-wide event_google_sync for new pushes)
CREATE TABLE public.profile_event_google_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.household_profiles(id) ON DELETE CASCADE,
  household_id uuid NOT NULL,
  google_event_id text NOT NULL,
  google_calendar_id text NOT NULL,
  direction text NOT NULL DEFAULT 'push',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_event_google_sync TO authenticated;
GRANT ALL ON public.profile_event_google_sync TO service_role;

ALTER TABLE public.profile_event_google_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members view profile event sync"
  ON public.profile_event_google_sync FOR SELECT
  TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members insert profile event sync"
  ON public.profile_event_google_sync FOR INSERT
  TO authenticated
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members update profile event sync"
  ON public.profile_event_google_sync FOR UPDATE
  TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

CREATE POLICY "household members delete profile event sync"
  ON public.profile_event_google_sync FOR DELETE
  TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));

CREATE INDEX idx_pegs_event ON public.profile_event_google_sync(event_id);
CREATE INDEX idx_pegs_profile ON public.profile_event_google_sync(profile_id);