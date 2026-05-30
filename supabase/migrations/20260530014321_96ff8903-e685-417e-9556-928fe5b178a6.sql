
-- Events: multi-profile assignment + yearly recurrence + contact link
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS profile_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','yearly')),
  ADD COLUMN IF NOT EXISTS contact_id uuid;

-- Backfill profile_ids from the existing single profile_id where empty
UPDATE public.events
SET profile_ids = ARRAY[profile_id]
WHERE (profile_ids IS NULL OR array_length(profile_ids, 1) IS NULL) AND profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_profile_ids_gin ON public.events USING GIN (profile_ids);
CREATE INDEX IF NOT EXISTS events_contact_id_idx ON public.events (contact_id);

-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  birthday date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read contacts"   ON public.contacts FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update contacts" ON public.contacts FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete contacts" ON public.contacts FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Trigger: sync a recurring yearly birthday event for the contact
CREATE OR REPLACE FUNCTION public.sync_contact_birthday_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shared_profile uuid;
  start_ts timestamptz;
BEGIN
  -- Remove any existing birthday event for this contact
  DELETE FROM public.events WHERE contact_id = NEW.id;

  IF NEW.birthday IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pick the shared/household profile (sort_order = 0) for the owner
  SELECT id INTO shared_profile
  FROM public.household_profiles
  WHERE owner_id = NEW.owner_id
  ORDER BY sort_order ASC
  LIMIT 1;

  IF shared_profile IS NULL THEN
    RETURN NEW;
  END IF;

  -- Anchor the event at this year's birthday at 9:00 local-ish (UTC)
  start_ts := make_timestamptz(
    EXTRACT(YEAR FROM now())::int,
    EXTRACT(MONTH FROM NEW.birthday)::int,
    EXTRACT(DAY FROM NEW.birthday)::int,
    9, 0, 0
  );

  INSERT INTO public.events (owner_id, profile_id, profile_ids, title, start_at, end_at, notes, recurrence, contact_id)
  VALUES (
    NEW.owner_id,
    shared_profile,
    ARRAY[shared_profile],
    '🎂 ' || NEW.name || '''s birthday',
    start_ts,
    start_ts + interval '1 hour',
    'Birthday for ' || NEW.name,
    'yearly',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_birthday_sync ON public.contacts;
CREATE TRIGGER contacts_birthday_sync
AFTER INSERT OR UPDATE OF birthday, name ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_birthday_event();

-- Trigger: clean up birthday event when contact is deleted
CREATE OR REPLACE FUNCTION public.cleanup_contact_birthday_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.events WHERE contact_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS contacts_birthday_cleanup ON public.contacts;
CREATE TRIGGER contacts_birthday_cleanup
BEFORE DELETE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_contact_birthday_event();
