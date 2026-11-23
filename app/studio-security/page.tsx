import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import StudioMfaSetup from "./StudioMfaSetup";

export const dynamic = "force-dynamic";

export default async function StudioSecurityPage() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) redirect("/studio/login");
  const admin = await createAdminClient().from("studio_admins")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (admin.error || !admin.data) redirect("/");

  return (
    <main className="min-h-screen bg-[#f5f2ed] px-5 py-16 text-[#1b1b1b]">
      <div className="mx-auto max-w-xl rounded-sm border border-black/10 bg-white p-7 shadow-sm md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">LETION ART · Studio</p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Account security</h1>
        <p className="mt-3 text-sm leading-7 text-black/65">
          Protect this Studio account with an authenticator app. You will need a fresh six-digit code
          when signing in to manage artwork, prices, orders and Creativehub production.
        </p>
        <StudioMfaSetup />
        <Link href="/studio" className="mt-8 inline-block text-sm underline underline-offset-4">
          Return to Studio
        </Link>
      </div>
    </main>
  );
}
