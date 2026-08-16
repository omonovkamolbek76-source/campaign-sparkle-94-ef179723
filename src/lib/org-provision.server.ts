/** Server-only helper that guarantees every authenticated user has a workspace. */
export async function ensureOrgForUser(userId: string, email?: string | null): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: member } = await supabaseAdmin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (member?.org_id) {
    await supabaseAdmin.from("profiles").upsert({ id: userId, default_org_id: member.org_id });
    return member.org_id as string;
  }

  const base = (email?.split("@")[0] || "workspace").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const slug = `${base || "workspace"}-${userId.slice(0, 8)}`;
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .insert({ name: email ? `${base}'s workspace` : "My workspace", slug })
    .select("id")
    .single();
  if (error || !org) throw new Error(error?.message ?? "Could not create workspace");

  await supabaseAdmin.from("org_members").insert({ org_id: org.id, user_id: userId, role: "owner" });
  await supabaseAdmin.from("profiles").upsert({ id: userId, default_org_id: org.id });

  return org.id as string;
}
