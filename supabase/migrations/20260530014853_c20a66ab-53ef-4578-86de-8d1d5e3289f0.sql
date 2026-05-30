
-- Tasks: add tier, expand recurrence options
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'daily';
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_tier_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_tier_check
  CHECK (tier = ANY (ARRAY['daily','weekly','monthly','quarterly','yearly']));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence = ANY (ARRAY['none','daily','weekly','monthly','quarterly','yearly']));

-- Goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  title text NOT NULL,
  tier text NOT NULL DEFAULT 'monthly',
  target integer NOT NULL DEFAULT 1,
  progress integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goals_tier_check CHECK (tier = ANY (ARRAY['daily','weekly','monthly','quarterly','yearly'])),
  CONSTRAINT goals_target_check CHECK (target > 0),
  CONSTRAINT goals_progress_check CHECK (progress >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read goals" ON public.goals FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update goals" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete goals" ON public.goals FOR DELETE TO authenticated USING (auth.uid() = owner_id);
