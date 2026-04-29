import { SupabaseClient } from "@supabase/supabase-js";

export type OrgRole = "owner" | "manager" | "field_worker" | "contractor" | "investor";

export interface OrgContext {
  organizationId: string;
  userId: string;
  role: OrgRole;
  tier: "free" | "pro" | "enterprise";
  locale: string;
}

/**
 * Resolves the active organization context for the authenticated user.
 * Returns null if the user is not authenticated or has no organization.
 */
export async function resolveOrgContext(
  supabase: SupabaseClient
): Promise<OrgContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("org_members")
    .select(`
      role,
      organization_id,
      organizations (
        id,
        tier,
        locale
      )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  const org = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as { id: string; tier: string; locale: string } | null;
  if (!org) return null;

  return {
    organizationId: org.id,
    userId: user.id,
    role: data.role as OrgRole,
    tier: org.tier as "free" | "pro" | "enterprise",
    locale: org.locale ?? "en",
  };
}

/**
 * Ensures org context exists, throwing a structured error response if not.
 * Use in API routes where org context is required.
 */
export async function requireOrgContext(
  supabase: SupabaseClient
): Promise<OrgContext> {
  const ctx = await resolveOrgContext(supabase);
  if (!ctx) {
    throw new Error("UNAUTHORIZED: No organization context found. Please sign in.");
  }
  return ctx;
}

/**
 * Returns all orgs the user is a member of (for org switcher UI).
 */
export async function getUserOrgs(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("org_members")
    .select(`
      role,
      organization_id,
      organizations (
        id,
        name,
        slug,
        tier,
        locale
      )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error || !data) return [];

  return data.map((m) => ({
    ...(m.organizations as unknown as Record<string, unknown>),
    role: m.role,
  }));
}
