import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ensure the signed-in user has a workspace; returns its id. */
export const ensureWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureOrgForUser } = await import("@/lib/org-provision.server");
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return { orgId: await ensureOrgForUser(context.userId, email) };
  });
