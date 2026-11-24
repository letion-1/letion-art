import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://escher-v2.creativehub.io/v1";
const LIMIT = 100;
type RemoteProduct = { id?: unknown; name?: unknown; variant_count?: unknown };

export async function GET(request: Request) {
  const __letionMfa = await requireStudioMfa();
  if (!__letionMfa.ok) {
    return NextResponse.json(
      { error: __letionMfa.error },
      { status: __letionMfa.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to Studio." }, { status: 401 });
    const admin = createAdminClient();
    const { data: membership, error } = await admin.from("studio_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (error || !membership) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const url = new URL(request.url);
    const rawOffset = url.searchParams.get("offset") ?? "0";
    if (!/^(0|[1-9][0-9]*)$/.test(rawOffset) || Number(rawOffset) > 100000) {
      return NextResponse.json({ error: "Invalid product offset." }, { status: 400 });
    }
    const offset = Number(rawOffset);
    const token = process.env.ESCHER_API_TOKEN;
    if (!token) return NextResponse.json({ error: "Creativehub API token is not configured." }, { status: 503 });
    const base = (process.env.ESCHER_API_BASE_URL || BASE).replace(/\/$/, "");
    const response = await fetch(`${base}/products?limit=${LIMIT}&offset=${offset}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return NextResponse.json({ error: `Creativehub product lookup failed (HTTP ${response.status}).` }, { status: 502 });
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("products" in body) || !Array.isArray(body.products)) {
      return NextResponse.json({ error: "Creativehub returned an unexpected product list." }, { status: 502 });
    }
    const products = (body.products as RemoteProduct[])
      .filter((row) => row && typeof row.id === "string" && typeof row.name === "string")
      .map((row) => ({ id: row.id as string, name: row.name as string, variantCount: Number(row.variant_count) || 0 }));
    return NextResponse.json({ products, nextOffset: body.products.length === LIMIT ? offset + LIMIT : null },
      { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Creativehub read-only product lookup failed:", err);
    return NextResponse.json({ error: "Unable to load Creativehub products." }, { status: 502 });
  }
}
