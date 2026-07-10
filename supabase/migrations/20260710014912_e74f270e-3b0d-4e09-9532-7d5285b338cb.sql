
-- Make stripe_subscription_id nullable (RC-only subs won't have one)
ALTER TABLE public.subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN price_id DROP NOT NULL;

-- Drop existing unique constraint on stripe_subscription_id so multiple NULLs are allowed
-- (Postgres allows multiple NULLs in unique constraints, so we can leave the existing unique — verify)
-- The original schema declared it unique. Keep it; NULLs are allowed multiple times.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id text,
  ADD COLUMN IF NOT EXISTS entitlement text,
  ADD COLUMN IF NOT EXISTS store_transaction_id text;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_source_check CHECK (source IN ('stripe','revenuecat')),
  ADD CONSTRAINT subscriptions_platform_check CHECK (platform IN ('web','ios','android','stripe','promotional','amazon','mac_app_store'));

-- Idempotency for RevenueCat webhook upserts: unique per RC user + entitlement + environment
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_rc_unique
  ON public.subscriptions (revenuecat_app_user_id, entitlement, environment)
  WHERE source = 'revenuecat';

CREATE INDEX IF NOT EXISTS idx_subscriptions_rc_user
  ON public.subscriptions (revenuecat_app_user_id)
  WHERE revenuecat_app_user_id IS NOT NULL;

-- Update helper to include RC subscriptions
CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'
)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
    AND environment = check_env
    AND (
      (status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.household_is_premium(_household uuid, _env text DEFAULT 'sandbox')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _household
      AND environment = _env
      AND (
        (status IN ('active', 'trialing', 'past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$$;
