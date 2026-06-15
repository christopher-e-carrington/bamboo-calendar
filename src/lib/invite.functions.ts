import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SignupSchema = z.object({
  token: z.string().min(10).max(200),
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

export const signupFromInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify the invitation token is real, pending, and not expired.
    const { data: invRows, error: invErr } = await supabaseAdmin
      .from("household_invitations")
      .select("id, status, expires_at")
      .eq("token", data.token)
      .limit(1);
    if (invErr) throw new Error(invErr.message);
    const inv = invRows?.[0];
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("This invitation has already been used");
    if (new Date(inv.expires_at).getTime() < Date.now())
      throw new Error("This invitation has expired");

    // Create the user pre-confirmed so they can immediately sign in
    // without an email round-trip. If the user already exists, fall through
    // and let the client sign in with the provided password.
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr && !/already (registered|exists)/i.test(createErr.message)) {
      throw new Error(createErr.message);
    }

    return { ok: true };
  });
