
-- 1. Add birthday to household_profiles
ALTER TABLE public.household_profiles ADD COLUMN IF NOT EXISTS birthday date;

-- 2. Attach the existing contacts birthday sync functions as triggers
DROP TRIGGER IF EXISTS trg_contacts_birthday_sync ON public.contacts;
CREATE TRIGGER trg_contacts_birthday_sync
AFTER INSERT OR UPDATE OF birthday, name ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_birthday_event();

DROP TRIGGER IF EXISTS trg_contacts_birthday_cleanup ON public.contacts;
CREATE TRIGGER trg_contacts_birthday_cleanup
BEFORE DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.cleanup_contact_birthday_event();

-- 3. Create profile birthday sync (events anchored to the profile itself)
CREATE OR REPLACE FUNCTION public.sync_profile_birthday_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts timestamptz;
BEGIN
  -- Remove any existing birthday event tied to this profile
  DELETE FROM public.events
    WHERE owner_id = NEW.owner_id
      AND profile_id = NEW.id
      AND recurrence = 'yearly'
      AND title LIKE '🎂 %';

  IF NEW.birthday IS NULL THEN
    RETURN NEW;
  END IF;

  start_ts := make_timestamptz(
    EXTRACT(YEAR FROM now())::int,
    EXTRACT(MONTH FROM NEW.birthday)::int,
    EXTRACT(DAY FROM NEW.birthday)::int,
    9, 0, 0
  );

  INSERT INTO public.events (owner_id, profile_id, profile_ids, title, start_at, end_at, notes, recurrence)
  VALUES (
    NEW.owner_id,
    NEW.id,
    ARRAY[NEW.id],
    '🎂 ' || NEW.name || '''s birthday',
    start_ts,
    start_ts + interval '1 hour',
    'Birthday for ' || NEW.name,
    'yearly'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_birthday_sync ON public.household_profiles;
CREATE TRIGGER trg_profile_birthday_sync
AFTER INSERT OR UPDATE OF birthday, name ON public.household_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_birthday_event();

-- 4. Backfill: ensure existing contacts with a birthday get an event
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM public.contacts WHERE birthday IS NOT NULL LOOP
    PERFORM 1;
    -- Re-run the sync logic by performing a no-op update
    UPDATE public.contacts SET birthday = birthday WHERE id = c.id;
  END LOOP;
END $$;
