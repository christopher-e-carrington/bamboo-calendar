CREATE OR REPLACE FUNCTION public.queue_household_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      RETURN NULL;
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