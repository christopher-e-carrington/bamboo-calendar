CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Bamboo Calendar',
  body text NOT NULL,
  tag text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT ON public.push_outbox TO authenticated;
GRANT ALL ON public.push_outbox TO service_role;
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "household reads outbox" ON public.push_outbox FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()));
CREATE INDEX push_outbox_pending_idx ON public.push_outbox (created_at) WHERE sent_at IS NULL;

CREATE TABLE public.event_push_log (
  event_id uuid NOT NULL,
  kind text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, kind)
);
GRANT ALL ON public.event_push_log TO service_role;
ALTER TABLE public.event_push_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

CREATE OR REPLACE FUNCTION public.queue_household_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hh uuid;
  msg text;
  tg text;
  who text;
  rec record;
BEGIN
  rec := COALESCE(NEW, OLD);

  IF TG_TABLE_NAME = 'household_members' THEN
    hh := rec.household_id;
    msg := COALESCE(rec.display_name, 'A new member') || ' joined the household';
    tg := 'member:insert:' || rec.id;
  ELSE
    hh := rec.owner_id;
  END IF;

  IF TG_TABLE_NAME = 'events' THEN
    SELECT name INTO who FROM public.household_profiles WHERE id = rec.profile_id;
    IF TG_OP = 'INSERT' THEN
      msg := COALESCE(who, 'Someone') || '''s event "' || rec.title || '" was added';
      tg := 'event:insert:' || rec.id;
    ELSE
      msg := 'Event "' || COALESCE(rec.title, 'Untitled') || '" was removed';
      tg := 'event:delete:' || rec.id;
    END IF;

  ELSIF TG_TABLE_NAME = 'shopping_items' THEN
    IF TG_OP = 'INSERT' THEN
      msg := '"' || rec.name || '" was added to the shopping list';
      tg := 'shop:insert:' || rec.id;
    ELSIF TG_OP = 'DELETE' THEN
      msg := '"' || COALESCE(rec.name, 'Item') || '" was removed from the shopping list';
      tg := 'shop:delete:' || rec.id;
    ELSE
      IF COALESCE(OLD.done, false) OR NOT COALESCE(NEW.done, false) THEN RETURN NULL; END IF;
      msg := '"' || COALESCE(rec.name, 'Item') || '" was crossed off the shopping list';
      tg := 'shop:check:' || rec.id;
    END IF;

  ELSIF TG_TABLE_NAME = 'tasks' THEN
    SELECT name INTO who FROM public.household_profiles WHERE id = rec.profile_id;
    IF TG_OP = 'INSERT' THEN
      msg := COALESCE(who, 'Someone') || ' added the task "' || COALESCE(rec.title, 'Untitled') || '"';
      tg := 'task:insert:' || rec.id;
    ELSE
      IF COALESCE(OLD.done, false) OR NOT COALESCE(NEW.done, false) THEN RETURN NULL; END IF;
      msg := COALESCE(who, 'Someone') || ' completed the task "' || COALESCE(rec.title, 'Untitled') || '"';
      tg := 'task:done:' || rec.id;
    END IF;

  ELSIF TG_TABLE_NAME = 'goals' THEN
    SELECT name INTO who FROM public.household_profiles WHERE id = rec.profile_id;
    IF TG_OP = 'INSERT' THEN
      msg := COALESCE(who, 'Someone') || ' added the goal "' || COALESCE(rec.title, 'Untitled') || '"';
      tg := 'goal:insert:' || rec.id;
    ELSE
      IF COALESCE(OLD.done, false) OR NOT COALESCE(NEW.done, false) THEN RETURN NULL; END IF;
      msg := COALESCE(who, 'Someone') || ' completed the goal "' || COALESCE(rec.title, 'Untitled') || '"';
      tg := 'goal:complete:' || rec.id;
    END IF;

  ELSIF TG_TABLE_NAME = 'projects' THEN
    SELECT name INTO who FROM public.household_profiles WHERE id = rec.profile_id;
    IF TG_OP = 'INSERT' THEN
      msg := COALESCE(who, 'Someone') || ' added the project "' || COALESCE(rec.title, 'Untitled') || '"';
      tg := 'project:insert:' || rec.id;
    ELSE
      IF OLD.status = 'completed' OR NEW.status IS DISTINCT FROM 'completed' THEN RETURN NULL; END IF;
      msg := COALESCE(who, 'Someone') || ' completed the project "' || COALESCE(rec.title, 'Untitled') || '"';
      tg := 'project:complete:' || rec.id;
    END IF;

  ELSIF TG_TABLE_NAME = 'contacts' THEN
    msg := 'Contact "' || COALESCE(rec.name, 'Someone') || '" was added';
    tg := 'contact:insert:' || rec.id;
  ELSIF TG_TABLE_NAME = 'documents' THEN
    msg := 'Document "' || COALESCE(rec.name, 'Untitled') || '" was added';
    tg := 'doc:insert:' || rec.id;
  ELSIF TG_TABLE_NAME = 'recipes' THEN
    msg := 'Meal "' || COALESCE(rec.name, 'Untitled') || '" was added';
    tg := 'meal:insert:' || rec.id;
  ELSIF TG_TABLE_NAME = 'memories' THEN
    msg := 'Memory "' || COALESCE(rec.title, 'Untitled') || '" was added';
    tg := 'memory:insert:' || rec.id;
  END IF;

  IF msg IS NULL OR hh IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.push_outbox (household_id, body, tag, actor_user_id)
  VALUES (hh, msg, tg, auth.uid());

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE TRIGGER push_events_ins AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_events_del AFTER DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_shopping_ins AFTER INSERT ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_shopping_del AFTER DELETE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_shopping_upd AFTER UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_tasks_ins AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_tasks_upd AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_goals_ins AFTER INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_goals_upd AFTER UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_projects_ins AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_projects_upd AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_contacts_ins AFTER INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_documents_ins AFTER INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_recipes_ins AFTER INSERT ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_memories_ins AFTER INSERT ON public.memories FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();
CREATE TRIGGER push_members_ins AFTER INSERT ON public.household_members FOR EACH ROW EXECUTE FUNCTION public.queue_household_push();