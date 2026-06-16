CREATE OR REPLACE FUNCTION public.accept_invitation(_token text, _name text, _phone text DEFAULT NULL::text, _address text DEFAULT NULL::text, _birthday date DEFAULT NULL::date, _email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv record;
  uid uuid := auth.uid();
  next_order int;
  init text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv FROM public.household_invitations
    WHERE token = _token AND status = 'pending' AND expires_at > now();
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role, display_name)
  VALUES (inv.household_id, uid, 'member', trim(_name))
  ON CONFLICT (household_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO public.contacts (owner_id, name, email, phone, address, birthday)
  VALUES (inv.household_id, trim(_name), COALESCE(_email, inv.invited_email), _phone, _address, _birthday);

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO next_order
    FROM public.household_profiles WHERE owner_id = inv.household_id;

  init := upper(substring(regexp_replace(trim(_name), '[^A-Za-z]', '', 'g') from 1 for 2));
  IF init IS NULL OR length(init) = 0 THEN init := 'NM'; END IF;

  INSERT INTO public.household_profiles (owner_id, name, role, color, initials, sort_order, birthday)
  VALUES (inv.household_id, trim(_name), 'shared', '#A7C29A', init, next_order, _birthday);

  UPDATE public.household_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = uid
    WHERE id = inv.id;

  RETURN inv.household_id;
END;
$function$;