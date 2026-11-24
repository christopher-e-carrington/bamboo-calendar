CREATE TABLE public.household_subscription_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enforcement_enabled boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.household_subscription_settings TO service_role;
ALTER TABLE public.household_subscription_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_store_entitlements (
  household_id uuid PRIMARY KEY,
  store text NOT NULL CHECK (store IN ('apple', 'google')),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'grace', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  will_renew boolean NOT NULL DEFAULT true,
  verified_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.household_store_entitlements TO service_role;
ALTER TABLE public.household_store_entitlements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_access_allowances (
  household_id uuid PRIMARY KEY,
  reason text NOT NULL CHECK (reason = 'personal_preview'),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.household_access_allowances TO service_role;
ALTER TABLE public.household_access_allowances ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.get_my_household_subscription()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  household uuid;
  entitlement public.household_store_entitlements%ROWTYPE;
  allowance public.household_access_allowances%ROWTYPE;
  enforce boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  SELECT household_id INTO household FROM public.household_members
    WHERE user_id = caller ORDER BY created_at ASC LIMIT 1;
  household := coalesce(household, caller);
  SELECT enforcement_enabled INTO enforce FROM public.household_subscription_settings WHERE id = true;
  SELECT * INTO entitlement FROM public.household_store_entitlements WHERE household_id = household;
  SELECT * INTO allowance FROM public.household_access_allowances WHERE household_id = household;
  RETURN jsonb_build_object(
    'householdId', household, 'isOwner', household = caller,
    'enforcementEnabled', coalesce(enforce, false),
    'personalAccess', allowance.household_id IS NOT NULL AND (allowance.expires_at IS NULL OR allowance.expires_at > now()),
    'store', entitlement.store, 'status', entitlement.status,
    'expiresAt', entitlement.expires_at, 'willRenew', coalesce(entitlement.will_renew, false),
    'verifiedAt', entitlement.verified_at, 'checkedAt', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_household_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_household_subscription() TO authenticated, service_role;
COMMENT ON TABLE public.household_store_entitlements IS 'Store-verified household access only. Populate from trusted Apple/Google/RevenueCat verification, never client purchase claims. Legacy Stripe subscriptions do not confer access.';
COMMENT ON TABLE public.household_access_allowances IS 'Server-managed personal preview access; no privileges on household data are conferred and existing membership checks still apply.';
COMMENT ON TABLE public.household_subscription_settings IS 'Preparation-stage default is unrestricted. Do not enable until verified store billing and data-access enforcement are connected and tested.';

CREATE OR REPLACE FUNCTION public.cleanup_account_data(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE account_email text; claimed_profiles uuid[]; member_households uuid[];
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
  DELETE FROM public.contacts WHERE owner_id = _user_id OR (owner_id = ANY(member_households) AND account_email IS NOT NULL AND lower(email) = lower(account_email));
  DELETE FROM public.household_invitations WHERE household_id = _user_id OR accepted_by = _user_id OR (account_email IS NOT NULL AND lower(invited_email) = lower(account_email));
  UPDATE public.household_profiles SET claimed_user_id = NULL, name = 'Former member', nickname = NULL, birthday = NULL, initials = 'FM', pin = NULL, has_pin = false WHERE id = ANY(claimed_profiles);
  DELETE FROM public.household_profiles WHERE owner_id = _user_id;
  DELETE FROM public.household_members WHERE household_id = _user_id OR user_id = _user_id;
  DELETE FROM public.push_subscriptions WHERE household_id = _user_id OR user_id = _user_id;
  DELETE FROM public.push_outbox WHERE household_id = _user_id OR actor_user_id = _user_id;
  DELETE FROM public.household_store_entitlements WHERE household_id = _user_id;
  DELETE FROM public.household_access_allowances WHERE household_id = _user_id;
  DELETE FROM public.subscriptions WHERE user_id = _user_id;
  DELETE FROM public.email_unsubscribe_tokens WHERE account_email IS NOT NULL AND lower(email) = lower(account_email);
  DELETE FROM public.email_send_log WHERE account_email IS NOT NULL AND lower(recipient_email) = lower(account_email);
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_account_data(uuid) TO service_role;