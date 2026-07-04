import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHousehold } from "@/lib/household-store";

export interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  instructions: string | null;
  prep_time: number | null;
  image_url: string | null;
  created_at: string;
}

export type MealType = "breakfast" | "lunch" | "dinner";

export interface MealPlanItem {
  id: string;
  recipe_id: string | null;
  recipe_name: string;
  day_of_week: number; // 0=Mon..6=Sun
  meal_type: MealType;
  week_start: string; // yyyy-mm-dd
  show_on_calendar: boolean;
  event_id: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  done: boolean;
  source: string;
  store_id: string | null;
  created_at: string;
}

export interface ShoppingStore {
  id: string;
  name: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  low_stock: boolean;
  created_at: string;
}

export function getWeekStart(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // distance back to Monday
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

const sb = supabase as any;

export function useRecipes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["recipes", user?.id];

  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await sb.from("recipes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async (input: Omit<Recipe, "id" | "created_at">) => {
      const { error } = await sb.from("recipes").insert({ ...input, owner_id: user!.id });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { recipes: q.data ?? [], loading: q.isLoading, addRecipe: add.mutateAsync, deleteRecipe: remove.mutateAsync };
}

export function useMealPlan(weekStart: string) {
  const { user } = useAuth();
  const { familyProfile } = useHousehold();
  const qc = useQueryClient();
  const key = ["meal_plan", user?.id, weekStart];

  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<MealPlanItem[]> => {
      const { data, error } = await sb
        .from("meal_plan")
        .select("*")
        .eq("week_start", weekStart);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assign = useMutation({
    mutationFn: async (input: {
      recipe_id: string | null;
      recipe_name: string;
      day_of_week: number;
      meal_type: MealType;
      show_on_calendar: boolean;
    }) => {
      // remove existing slot for that day/meal
      const existing = (q.data ?? []).find(
        (m) => m.day_of_week === input.day_of_week && m.meal_type === input.meal_type,
      );
      if (existing) {
        if (existing.event_id) await sb.from("events").delete().eq("id", existing.event_id);
        await sb.from("meal_plan").delete().eq("id", existing.id);
      }

      let event_id: string | null = null;
      if (input.show_on_calendar && familyProfile) {
        const date = new Date(weekStart + "T00:00:00");
        date.setDate(date.getDate() + input.day_of_week);
        const hour = input.meal_type === "breakfast" ? 8 : input.meal_type === "lunch" ? 12 : 18;
        date.setHours(hour, 0, 0, 0);
        const emoji = input.meal_type === "breakfast" ? "🍳" : input.meal_type === "lunch" ? "🥗" : "🍽️";
        const { data: ev, error: eErr } = await sb
          .from("events")
          .insert({
            owner_id: user!.id,
            profile_id: familyProfile.id,
            profile_ids: [familyProfile.id],
            title: `${emoji} ${input.recipe_name}`,
            start_at: date.toISOString(),
            end_at: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
            notes: `Planned ${input.meal_type}`,
          })
          .select("id")
          .single();
        if (eErr) throw eErr;
        event_id = ev.id;
      }

      const { error } = await sb.from("meal_plan").insert({
        owner_id: user!.id,
        recipe_id: input.recipe_id,
        recipe_name: input.recipe_name,
        day_of_week: input.day_of_week,
        meal_type: input.meal_type,
        week_start: weekStart,
        show_on_calendar: input.show_on_calendar,
        event_id,
      });
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["events", user?.id] });
    },
  });

  const clearSlot = useMutation({
    mutationFn: async (id: string) => {
      const existing = (q.data ?? []).find((m) => m.id === id);
      if (existing?.event_id) await sb.from("events").delete().eq("id", existing.event_id);
      const { error } = await sb.from("meal_plan").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["events", user?.id] });
    },
  });

  return {
    plan: q.data ?? [],
    loading: q.isLoading,
    assignMeal: assign.mutateAsync,
    clearSlot: clearSlot.mutateAsync,
  };
}

export function useShopping() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["shopping", user?.id];

  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<ShoppingItem[]> => {
      const { data, error } = await sb.from("shopping_items").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async (input: { name: string; quantity?: string | null; source?: string; store_id?: string | null }) => {
      const { error } = await sb.from("shopping_items").insert({
        owner_id: user!.id,
        name: input.name,
        quantity: input.quantity ?? null,
        source: input.source ?? "manual",
        store_id: input.store_id ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addMany = useMutation({
    mutationFn: async (items: { name: string; source?: string }[]) => {
      if (!items.length) return;
      const rows = items.map((i) => ({
        owner_id: user!.id,
        name: i.name,
        source: i.source ?? "recipe",
      }));
      const { error } = await sb.from("shopping_items").insert(rows);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await sb.from("shopping_items").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ShoppingItem[]>(key);
      qc.setQueryData<ShoppingItem[]>(key, (old) => (old ?? []).map((x) => (x.id === id ? { ...x, done } : x)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("shopping_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const clearDone = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("shopping_items").delete().eq("done", true);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    items: q.data ?? [],
    loading: q.isLoading,
    addItem: add.mutateAsync,
    addItems: addMany.mutateAsync,
    toggleItem: (id: string, done: boolean) => toggle.mutate({ id, done }),
    deleteItem: remove.mutateAsync,
    clearDone: clearDone.mutateAsync,
  };
}

export function useInventory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["inventory", user?.id];

  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await sb.from("inventory_items").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async (input: { name: string; quantity?: string | null; category?: string | null }) => {
      const { error } = await sb.from("inventory_items").insert({
        owner_id: user!.id,
        name: input.name,
        quantity: input.quantity ?? null,
        category: input.category ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<InventoryItem> }) => {
      const { error } = await sb.from("inventory_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    items: q.data ?? [],
    loading: q.isLoading,
    addItem: add.mutateAsync,
    updateItem: (id: string, patch: Partial<InventoryItem>) => update.mutateAsync({ id, patch }),
    deleteItem: remove.mutateAsync,
  };
}
