import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Variant = {
  id: string; name: string; width_mm: number | null; height_mm: number | null;
  paper: string | null; framed: boolean; frame_style: string | null; active: boolean;
  creativehub_product_id: string | null; creativehub_variant_id: string | null; creativehub_sku: string | null;
};
type RemoteVariant = {
  id?: unknown; sku?: unknown; print_width_mm?: unknown; print_height_mm?: unknown;
  is_framed?: unknown; frame_color?: unknown; paper_id?: unknown;
};
type State = "match" | "unverified" | "mismatch" | "retired" | "unlinked" | "product_missing";

function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function expectedFrame(v: string | null): string | null {
  const frame = (v || "").toLowerCase();
  return ["black", "white", "oak"].find((item) => frame.includes(item)) || null;
}
function paperSlug(v: string | null): string | null {
  const p = (v || "").toLowerCase().replaceAll("ü", "u");
  if (!p) return null;
  if (p.includes("german") && p.includes("etching")) return "german-etching";
  if (p.includes("photo rag")) return "photo-rag";
  if (p.includes("pearl")) return "pearl-giclee";
  if (p.includes("baryta")) return "baryta";
  if (p.includes("bamboo")) return "bamboo";
  if (p.includes("cotton") && p.includes("textured")) return "cotton-textured";
  if (p.includes("semi gloss") || p.includes("semi-gloss")) return "semi-gloss";
  if (p.includes("fuji") && p.includes("matt")) return "fuji-matt";
  if (p.includes("fuji") && p.includes("gloss")) return "fuji-gloss";
  if (p.includes("canvas") || p.includes("cezanne")) return "canvas";
  return null;
}
const paperAliases: Record<string, string> = {
  "1": "german-etching", "2": "pearl-giclee", "3": "baryta", "4": "cotton-textured",
  "5": "bamboo", "6": "photo-rag", "7": "semi-gloss", "8": "fuji-matt",
  "9": "fuji-gloss", "136": "canvas",
};
function remotePaper(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? paperAliases[s] || s : null;
}
function compare(local: Variant, remote: RemoteVariant) {
  const issues: string[] = [];
  const unknown: string[] = [];
  if (Number(remote.print_width_mm) !== local.width_mm || Number(remote.print_height_mm) !== local.height_mm) {
    issues.push("Print dimensions differ");
  }
  if (typeof remote.is_framed !== "boolean" || remote.is_framed !== local.framed) {
    issues.push("Framed/unframed setting differs");
  }
  if (local.framed) {
    const frame = expectedFrame(local.frame_style);
    if (!frame) unknown.push("Local frame colour needs review");
    else if (str(remote.frame_color).toLowerCase() !== frame) issues.push("Frame colour differs");
  }
  const paper = paperSlug(local.paper);
  const providerPaper = remotePaper(remote.paper_id);
  if (!paper) unknown.push("Local paper needs review");
  else if (!providerPaper) unknown.push("Supplier paper information is missing");
  else if (providerPaper !== paper) issues.push("Paper type differs");
  if (str(remote.sku) !== str(local.creativehub_sku)) issues.push("SKU differs");
  return { issues, unknown };
}
function canBeSame(local: Variant, remote: RemoteVariant) {
  if (Number(remote.print_width_mm) !== local.width_mm || Number(remote.print_height_mm) !== local.height_mm) return false;
  if (remote.is_framed !== local.framed) return false;
  if (local.framed && expectedFrame(local.frame_style) !== str(remote.frame_color).toLowerCase()) return false;
  const paper = paperSlug(local.paper);
  return !paper || paper === remotePaper(remote.paper_id);
}

export async function GET(request: Request) {
  const __letionMfa = await requireStudioMfa();
  if (!__letionMfa.ok) {
    return NextResponse.json(
      { error: __letionMfa.error },
      { status: __letionMfa.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const session = await createClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Studio sign-in required." }, { status: 401 });
    const db = createAdminClient();
    const { data: member, error: memberError } = await db.from("studio_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (memberError || !member) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const artworkId = new URL(request.url).searchParams.get("artworkId") || "";
    if (!UUID.test(artworkId)) return NextResponse.json({ error: "A valid artwork ID is required." }, { status: 400 });

    const { data: artwork, error: artError } = await db.from("artworks")
      .select("id,title").eq("id", artworkId).maybeSingle();
    if (artError || !artwork) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });
    const [localQuery, syncQuery] = await Promise.all([
      db.from("print_variants")
        .select("id,name,width_mm,height_mm,paper,framed,frame_style,active,creativehub_product_id,creativehub_variant_id,creativehub_sku")
        .eq("artwork_id", artworkId).order("sort_order"),
      db.from("artwork_creativehub_sync").select("product_id,state").eq("artwork_id", artworkId).maybeSingle(),
    ]);
    if (localQuery.error || syncQuery.error) return NextResponse.json({ error: "Could not read local print mappings." }, { status: 500 });
    const variants = (localQuery.data ?? []) as Variant[];
    const defaultProductId = str(syncQuery.data?.product_id);
    const ids = [...new Set(variants.map((v) => str(v.creativehub_product_id)).filter(Boolean))];
    if (defaultProductId && !ids.includes(defaultProductId)) ids.push(defaultProductId);
    if (ids.length > 5) return NextResponse.json({ error: "Too many supplier products linked to one artwork. Review mappings manually." }, { status: 409 });
    const token = process.env.ESCHER_API_TOKEN;
    if (!token) return NextResponse.json({ error: "Creativehub token is not configured." }, { status: 503 });
    const base = (process.env.ESCHER_API_BASE_URL || "https://escher-v2.creativehub.io/v1").replace(/\/$/, "");
    const supplier = new Map<string, RemoteVariant[] | null>();
    await Promise.all(ids.map(async (productId) => {
      // Product IDs come only from the database. Never accept a provider URL from the browser.
      if (!UUID.test(productId)) { supplier.set(productId, null); return; }
      const response = await fetch(`${base}/products/${encodeURIComponent(productId)}/variants`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store", signal: AbortSignal.timeout(20000),
      });
      if (response.status === 404) { supplier.set(productId, null); return; }
      if (!response.ok) throw new Error(`Creativehub returned HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("variants" in data) || !Array.isArray(data.variants)) {
        throw new Error("Creativehub variant format changed");
      }
      supplier.set(productId, data.variants as RemoteVariant[]);
    }));

    const rows: Array<{ id: string; name: string; state: State; active: boolean; issues: string[];
      localSku: string | null; remoteSku: string | null; candidateSku: string | null }> = [];
    for (const local of variants) {
      const productId = str(local.creativehub_product_id) || defaultProductId;
      const variantId = str(local.creativehub_variant_id);
      if (!productId || !variantId) {
        rows.push({ id: local.id, name: local.name, state: "unlinked", active: local.active,
          issues: ["This local print option needs Creativehub linking"], localSku: local.creativehub_sku,
          remoteSku: null, candidateSku: null });
        continue;
      }
      const remote = supplier.get(productId);
      if (!remote) {
        rows.push({ id: local.id, name: local.name, state: "product_missing", active: local.active,
          issues: ["Creativehub product is missing or inaccessible"], localSku: local.creativehub_sku,
          remoteSku: null, candidateSku: null });
        continue;
      }
      const match = remote.find((r) => str(r.id) === variantId);
      if (!match) {
        const candidates = remote.filter((r) => canBeSame(local, r));
        rows.push({ id: local.id, name: local.name, state: "retired", active: local.active,
          issues: ["Saved Creativehub variant ID was not found; do not submit orders until reviewed",
            ...(candidates.length === 1 ? ["One possible replacement exists; re-link manually after checking past orders"] : [])],
          localSku: local.creativehub_sku, remoteSku: null,
          candidateSku: candidates.length === 1 ? str(candidates[0].sku) || null : null });
        continue;
      }
      const result = compare(local, match);
      const state: State = result.issues.length ? "mismatch" : result.unknown.length ? "unverified" : "match";
      rows.push({ id: local.id, name: local.name, state, active: local.active,
        issues: [...result.issues, ...result.unknown], localSku: local.creativehub_sku,
        remoteSku: str(match.sku) || null, candidateSku: null });
    }

    const issueCount = rows.filter((v) => v.state !== "match").length;
    return NextResponse.json({ artworkId, title: artwork.title, checkedAt: new Date().toISOString(),
      syncState: str(syncQuery.data?.state) || null, remoteProductCount: ids.length,
      issueCount, variants: rows,
      note: "Read-only reconciliation. Prices are not compared across currencies. No products, variants, database rows or orders were changed." },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Creativehub mapping reconciliation failed:", error);
    return NextResponse.json({ error: "Creativehub could not verify the print mappings. Check API access and try again." }, { status: 502 });
  }
}
