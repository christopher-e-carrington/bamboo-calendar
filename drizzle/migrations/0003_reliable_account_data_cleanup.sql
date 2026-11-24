CREATE OR REPLACE FUNCTION public.cleanup_account_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_email text;
  claimed_profiles uuid[];
  member_households uuid[];
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Account is required'; END IF;
  SELECT email INTO account_email FROM auth.users WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account does not exist'; END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO claimed_profiles
    FROM public.household_profiles WHERE claimed_user_id = _user_id AND owner_id <> _user_id;
  SELECT coalesce(array_agg(household_id), ARRAY[]::uuid[]) INTO member_households
    FROM public.household_members WHERE user_id = _user_id;

  DELETE FROM public.profile_event_google_sync WHERE household_id = _user_id OR profile_id = ANY(claimed_profiles);
  DELETE FROM public.profile_google_tokens WHERE household_id = _user_id OR profile_id = ANY(claimed_profiles);
  DELETE FROM public.event_google_sync WHERE household_id = _user_id;
  DELETE FROM public.google_calendar_settings WHERE household_id = _user_id;
  DELETE FROM public.journal_entries WHERE owner_id = _user_id OR profile_id = ANY(claimed_profiles);
  DELETE FROM public.reminders WHERE owner_id = _user_id OR created_by = _user_id;
  DELETE FROM public.event_push_log WHERE event_id IN (SELECT id FROM public.events WHERE owner_id = _user_id);
  DELETE FROM public.project_steps WHERE project_id IN (SELECT id FROM public.projects WHERE owner_id = _user_id);
  DELETE FROM public.projects WHERE owner_id = _user_id;
  DELETE FROM public.meal_plan WHERE owner_id = _user_id;
  DELETE FROM public.recipes WHERE owner_id = _user_id;
  DELETE FROM public.shopping_items WHERE owner_id = _user_id;
  DELETE FROM public.shopping_stores WHERE owner_id = _user_id;
  DELETE FROM public.inventory_items WHERE owner_id = _user_id;
  DELETE FROM public.routines WHERE owner_id = _user_id;
  DELETE FROM public.goals WHERE owner_id = _user_id;
  DELETE FROM public.tasks WHERE owner_id = _user_id;
  DELETE FROM public.events WHERE owner_id = _user_id;
  DELETE FROM public.notes WHERE owner_id = _user_id;
  DELETE FROM public.passwords WHERE owner_id = _user_id;
  DELETE FROM public.documents WHERE owner_id = _user_id;
  DELETE FROM public.memories WHERE owner_id = _user_id;
  DELETE FROM public.custom_themes WHERE household_id = _user_id;
  DELETE FROM public.contacts WHERE owner_id = _user_id
    OR (owner_id = ANY(member_households) AND account_email IS NOT NULL AND lower(email) = lower(account_email));
  DELETE FROM public.household_invitations WHERE household_id = _user_id OR accepted_by = _user_id
    OR (account_email IS NOT NULL AND lower(invited_email) = lower(account_email));

  UPDATE public.household_profiles
    SET claimed_user_id = NULL, name = 'Former member', nickname = NULL, birthday = NULL,
        initials = 'FM', pin = NULL, has_pin = false
    WHERE id = ANY(claimed_profiles);
  DELETE FROM public.household_profiles WHERE owner_id = _user_id;
  DELETE FROM public.household_members WHERE household_id = _user_id OR user_id = _user_id;
  DELETE FROM public.push_subscriptions WHERE household_id = _user_id OR user_id = _user_id;
  DELETE FROM public.push_outbox WHERE household_id = _user_id OR actor_user_id = _user_id;
  DELETE FROM public.subscriptions WHERE user_id = _user_id;
  DELETE FROM public.email_unsubscribe_tokens WHERE account_email IS NOT NULL AND lower(email) = lower(account_email);
  DELETE FROM public.email_send_log WHERE account_email IS NOT NULL AND lower(recipient_email) = lower(account_email);
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_account_data(uuid) TO service_role;
COMMENT ON FUNCTION public.cleanup_account_data(uuid) IS 'Server-only transactional cleanup for a verified self-deletion. Shared content remains anonymized when an invited member leaves; other auth accounts are never deleted.';