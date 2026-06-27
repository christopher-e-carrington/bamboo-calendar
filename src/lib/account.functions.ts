import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort cascade delete of user-owned data. Most app tables are scoped
    // by owner_id = auth.uid(); auth.users deletion will also cascade where FKs
    // are set ON DELETE CASCADE.
    const ownerTables = [
      "household_invitations",
      "event_google_sync",
      "profile_event_google_sync",
      "profile_google_tokens",
      "google_calendar_settings",
      "custom_themes",
      "notes",
      "passwords",
      "documents",
      "memories",
      "inventory_items",
      "shopping_items",
      "meal_plan",
      "recipes",
      "routines",
      "goals",
      "tasks",
      "events",
      "contacts",
      "household_profiles",
    ] as const;

    for (const table of ownerTables) {
      await supabaseAdmin.from(table as any).delete().eq("owner_id", userId);
    }
    // household_members is keyed by user_id
    await supabaseAdmin.from("household_members").delete().eq("user_id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
