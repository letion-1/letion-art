import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DraftImporter from "./DraftImporter";

export const dynamic = "force-dynamic";
export default async function DraftImportPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/studio/login");
  const db = createAdminClient();
  const member = await db.from("studio_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (member.error || !member.data) notFound();
  const [artworks, collections] = await Promise.all([
    db.from("artworks").select("id,title").order("title").limit(1000),
    db.from("collections").select("id,title").order("title").limit(1000),
  ]);
  if (artworks.error || collections.error) throw new Error("Could not load Studio artwork or collection choices.");
  return <DraftImporter artworks={artworks.data ?? []} collections={collections.data ?? []} />;
}
