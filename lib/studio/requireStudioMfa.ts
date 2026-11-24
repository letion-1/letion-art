import { createClient } from "@/lib/supabase/server";

/**
 * Check the actual request's authenticated user and AAL2 JWT,
 * then reuse the database's existing is_studio_admin() rule.
 * Never use a service-role client to evaluate the caller's MFA status.
 */
export async function requireStudioMfa(): Promise<
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: "Studio sign-in required." };
  }

  const { data: claimData, error: claimError } = await supabase.auth.getClaims();
  const claims = claimData?.claims as { aal?: string; sub?: string } | undefined;
  if (claimError || !claims || claims.sub !== user.id || claims.aal !== "aal2") {
    return { ok: false, status: 403, error: "Studio authenticator verification required." };
  }

  const { data: allowed, error: policyError } = await supabase.rpc("is_studio_admin");
  if (policyError || allowed !== true) {
    return { ok: false, status: 403, error: "Studio administrator access required." };
  }
  return { ok: true };
}
