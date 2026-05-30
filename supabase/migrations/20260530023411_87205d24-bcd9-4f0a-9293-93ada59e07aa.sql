
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  ingredients text[] NOT NULL DEFAULT '{}',
  instructions text,
  prep_time int,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read recipes" ON public.recipes FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update recipes" ON public.recipes FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete recipes" ON public.recipes FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.meal_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  recipe_name text NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')),
  week_start date NOT NULL,
  show_on_calendar boolean NOT NULL DEFAULT false,
  event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan TO authenticated;
GRANT ALL ON public.meal_plan TO service_role;
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read meal_plan" ON public.meal_plan FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert meal_plan" ON public.meal_plan FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update meal_plan" ON public.meal_plan FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete meal_plan" ON public.meal_plan FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  quantity text,
  done boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_items TO authenticated;
GRANT ALL ON public.shopping_items TO service_role;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read shopping" ON public.shopping_items FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert shopping" ON public.shopping_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update shopping" ON public.shopping_items FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete shopping" ON public.shopping_items FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  quantity text,
  category text,
  low_stock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read inventory" ON public.inventory_items FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete inventory" ON public.inventory_items FOR DELETE TO authenticated USING (auth.uid() = owner_id);
