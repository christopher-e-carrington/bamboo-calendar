
-- =========================================================
-- household_members
-- =========================================================
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helper: is _user a member of the household _household,
-- OR is _user the household creator (household_id == their user id)?
CREATE OR REPLACE FUNCTION public.is_household_member(_household uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _household = _user
      OR EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = _household AND user_id = _user
      );
$$;

GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated, anon;

-- Members can read rows linking them, or rows where they are the household creator.
CREATE POLICY "Members read membership rows"
ON public.household_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR household_id = auth.uid());

-- Only the creator can add members directly.
CREATE POLICY "Creator inserts members"
ON public.household_members FOR INSERT TO authenticated
WITH CHECK (household_id = auth.uid());

-- Members can remove themselves; creator can remove anyone.
CREATE POLICY "Member leaves or creator removes"
ON public.household_members FOR DELETE TO authenticated
USING (user_id = auth.uid() OR household_id = auth.uid());

-- Members can update their own display_name; creator can update any row.
CREATE POLICY "Member updates own or creator updates any"
ON public.household_members FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR household_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR household_id = auth.uid());


-- =========================================================
-- household_invitations
-- =========================================================
CREATE TABLE public.household_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  invited_email text,
  invited_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_invitations TO authenticated;
GRANT ALL ON public.household_invitations TO service_role;

ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

-- Only the household creator can manage their invitations.
CREATE POLICY "Creator reads invitations"
ON public.household_invitations FOR SELECT TO authenticated
USING (household_id = auth.uid());

CREATE POLICY "Creator inserts invitations"
ON public.household_invitations FOR INSERT TO authenticated
WITH CHECK (household_id = auth.uid());

CREATE POLICY "Creator updates invitations"
ON public.household_invitations FOR UPDATE TO authenticated
USING (household_id = auth.uid()) WITH CHECK (household_id = auth.uid());

CREATE POLICY "Creator deletes invitations"
ON public.household_invitations FOR DELETE TO authenticated
USING (household_id = auth.uid());

-- Public lookup by token (no broad SELECT exposure)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  household_id uuid,
  invited_email text,
  invited_name text,
  status text,
  expires_at timestamptz,
  household_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    i.id,
    i.household_id,
    i.invited_email,
    i.invited_name,
    i.status,
    i.expires_at,
    (
      SELECT name FROM public.household_profiles
      WHERE owner_id = i.household_id
      ORDER BY sort_order ASC
      LIMIT 1
    ) AS household_name
  FROM public.household_invitations i
  WHERE i.token = _token
    AND i.status = 'pending'
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- Accept invitation: invitee must be authenticated. Creates membership,
-- contact, and household profile in the inviter's household.
CREATE OR REPLACE FUNCTION public.accept_invitation(
  _token text,
  _name text,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _birthday date DEFAULT NULL,
  _email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  INSERT INTO public.household_profiles (owner_id, name, role, color, initials, sort_order)
  VALUES (inv.household_id, trim(_name), 'member', '#A7C29A', init, next_order);

  UPDATE public.household_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = uid
    WHERE id = inv.id;

  RETURN inv.household_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text, text, text, date, text) TO authenticated;


-- =========================================================
-- Replace RLS on all household-scoped tables to allow members
-- =========================================================

-- contacts
DROP POLICY IF EXISTS "Owners read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Owners insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Owners update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Owners delete contacts" ON public.contacts;
CREATE POLICY "Members read contacts" ON public.contacts FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- events
DROP POLICY IF EXISTS "Owners read events" ON public.events;
DROP POLICY IF EXISTS "Owners insert events" ON public.events;
DROP POLICY IF EXISTS "Owners update events" ON public.events;
DROP POLICY IF EXISTS "Owners delete events" ON public.events;
CREATE POLICY "Members read events" ON public.events FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update events" ON public.events FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete events" ON public.events FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- tasks
DROP POLICY IF EXISTS "Owners read tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners delete tasks" ON public.tasks;
CREATE POLICY "Members read tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- goals
DROP POLICY IF EXISTS "Owners read goals" ON public.goals;
DROP POLICY IF EXISTS "Owners insert goals" ON public.goals;
DROP POLICY IF EXISTS "Owners update goals" ON public.goals;
DROP POLICY IF EXISTS "Owners delete goals" ON public.goals;
CREATE POLICY "Members read goals" ON public.goals FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update goals" ON public.goals FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete goals" ON public.goals FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- household_profiles
DROP POLICY IF EXISTS "Owners read profiles" ON public.household_profiles;
DROP POLICY IF EXISTS "Owners insert profiles" ON public.household_profiles;
DROP POLICY IF EXISTS "Owners update profiles" ON public.household_profiles;
DROP POLICY IF EXISTS "Owners delete profiles" ON public.household_profiles;
CREATE POLICY "Members read profiles" ON public.household_profiles FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert profiles" ON public.household_profiles FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update profiles" ON public.household_profiles FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete profiles" ON public.household_profiles FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- inventory_items
DROP POLICY IF EXISTS "Owners read inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Owners insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Owners update inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Owners delete inventory" ON public.inventory_items;
CREATE POLICY "Members read inventory" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete inventory" ON public.inventory_items FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- meal_plan
DROP POLICY IF EXISTS "Owners read meal_plan" ON public.meal_plan;
DROP POLICY IF EXISTS "Owners insert meal_plan" ON public.meal_plan;
DROP POLICY IF EXISTS "Owners update meal_plan" ON public.meal_plan;
DROP POLICY IF EXISTS "Owners delete meal_plan" ON public.meal_plan;
CREATE POLICY "Members read meal_plan" ON public.meal_plan FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert meal_plan" ON public.meal_plan FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update meal_plan" ON public.meal_plan FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete meal_plan" ON public.meal_plan FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- recipes
DROP POLICY IF EXISTS "Owners read recipes" ON public.recipes;
DROP POLICY IF EXISTS "Owners insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Owners update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Owners delete recipes" ON public.recipes;
CREATE POLICY "Members read recipes" ON public.recipes FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update recipes" ON public.recipes FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete recipes" ON public.recipes FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- shopping_items
DROP POLICY IF EXISTS "Owners read shopping" ON public.shopping_items;
DROP POLICY IF EXISTS "Owners insert shopping" ON public.shopping_items;
DROP POLICY IF EXISTS "Owners update shopping" ON public.shopping_items;
DROP POLICY IF EXISTS "Owners delete shopping" ON public.shopping_items;
CREATE POLICY "Members read shopping" ON public.shopping_items FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert shopping" ON public.shopping_items FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update shopping" ON public.shopping_items FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete shopping" ON public.shopping_items FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));

-- memories
DROP POLICY IF EXISTS "Owners read memories" ON public.memories;
DROP POLICY IF EXISTS "Owners insert memories" ON public.memories;
DROP POLICY IF EXISTS "Owners update memories" ON public.memories;
DROP POLICY IF EXISTS "Owners delete memories" ON public.memories;
CREATE POLICY "Members read memories" ON public.memories FOR SELECT TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members insert memories" ON public.memories FOR INSERT TO authenticated WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members update memories" ON public.memories FOR UPDATE TO authenticated USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Members delete memories" ON public.memories FOR DELETE TO authenticated USING (public.is_household_member(owner_id, auth.uid()));
