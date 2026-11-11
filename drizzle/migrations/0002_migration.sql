CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.household_profiles ADD COLUMN IF NOT EXISTS has_pin boolean NOT NULL DEFAULT false;
UPDATE public.household_profiles SET has_pin = (pin IS NOT NULL AND pin <> '');
UPDATE public.household_profiles SET pin = extensions.crypt(pin, extensions.gen_salt('bf')) WHERE pin IS NOT NULL AND pin <> '' AND pin !~ '^\$2';
COMMENT ON COLUMN public.household_profiles.pin IS 'Hashed PIN; never readable by clients. Use set_profile_pin / verify_profile_pin.';

REVOKE SELECT, UPDATE, INSERT ON public.household_profiles FROM anon, authenticated;
GRANT SELECT (id, owner_id, name, role, color, initials, sort_order, created_at, birthday, nickname, claimed_user_id, has_pin) ON public.household_profiles TO authenticated;
GRANT UPDATE (name, role, color, initials, sort_order, birthday, nickname, claimed_user_id) ON public.household_profiles TO authenticated;
GRANT INSERT (id, owner_id, name, role, color, initials, sort_order, created_at, birthday, nickname, claimed_user_id) ON public.household_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.set_profile_pin(_profile uuid, _pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.household_profiles WHERE id = _profile;
  IF p IS NULL OR NOT public.is_household_member(p.owner_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p.claimed_user_id IS NOT NULL AND p.claimed_user_id <> auth.uid() AND p.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only this person or the household owner can change this PIN';
  END IF;
  IF _pin IS NULL OR _pin = '' THEN
    UPDATE public.household_profiles SET pin = NULL, has_pin = false WHERE id = _profile;
  ELSE
    IF _pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
    UPDATE public.household_profiles SET pin = crypt(_pin, gen_salt('bf')), has_pin = true WHERE id = _profile;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_profile_pin(_profile uuid, _pin text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.household_profiles WHERE id = _profile;
  IF p IS NULL OR NOT public.is_household_member(p.owner_id, auth.uid()) THEN RETURN false; END IF;
  IF p.pin IS NULL THEN RETURN true; END IF;
  RETURN p.pin = crypt(coalesce(_pin, ''), p.pin);
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_profile_pin(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_profile_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_profile_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_profile_pin(uuid, text) TO authenticated;