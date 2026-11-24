import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountDeletionConfirmation } from "@/lib/account-deletion";

export const getAccountDeletionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profiles, error } = await context.supabase.from("household_profiles")
      .select("id").eq("owner_id", context.userId).limit(1);
    if (error) throw new Error("Could not check your household");
    const { data, error: userError } = await context.supabase.auth.getUser();
    if (userError || !data.user) throw new Error("Please sign in again");
    return { hasOwnedHousehold: (profiles?.length ?? 0) > 0, appleLinked: data.user.identities?.some((identity) => identity.provider === "apple") ?? false };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(accountDeletionConfirmation)
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: verified, error: verifyError } = await context.supabase.auth.getUser();
    if (verifyError || verified.user?.id !== userId) throw new Error("Please sign in again");
    const appleLinked = verified.user.identities?.some((identity) => identity.provider === "apple") ?? false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { purgeAccountUploads, completeAccountDeletion } = await import("@/lib/account-deletion");
    await completeAccountDeletion({
      removeUploads: () => purgeAccountUploads({
        list: async (bucket, prefix, offset) => {
          const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw new Error("Could not check uploaded files");
          return (data ?? []).map((entry) => ({ name: entry.name, id: entry.id ?? null }));
        },
        remove: async (bucket, paths) => {
          const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
          if (error) throw new Error("Could not remove uploaded files");
        },
      }, userId),
      removeRecords: async () => {
        const { error } = await supabaseAdmin.rpc("cleanup_account_data", { _user_id: userId });
        if (error) { console.error("Account cleanup failed", error.code, error.message); throw new Error("Could not finish account cleanup"); }
      },
      removeSignIn: async () => {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error("Could not remove your sign-in account");
      },
    });
    return { ok: true, appleLinked };
  });
