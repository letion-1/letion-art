import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    const session = await createClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to Studio." }, { status: 401 });
    const db = createAdminClient();
    const { data: admin, error: adminError } = await db.from("studio_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const input = await request.json() as { artworkId?: unknown; confirmation?: unknown };
    const id = typeof input.artworkId === "string" ? input.artworkId : "";
    const confirmation = typeof input.confirmation === "string" ? input.confirmation : "";
    if (!UUID.test(id)) return NextResponse.json({ error: "Invalid artwork ID." }, { status: 400 });
    const result = await db.rpc("studio_delete_artwork_guarded", { p_artwork_id: id, p_confirmation: confirmation });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 409 });
    return NextResponse.json({ deleted: result.data === true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Guarded Studio artwork deletion failed:", error);
    return NextResponse.json({ error: "Could not delete artwork. No supplier operations were attempted." }, { status: 500 });
  }
}
