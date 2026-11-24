import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
type JsonObject = Record<string, unknown>;
function record(value: unknown): JsonObject { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function string(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function number(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d{1,4})?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1000000 ? n : null;
}
function response(error: string, status: number, extra: JsonObject = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "private, no-store" } });
}
class Failed extends Error { constructor(message: string, public code = 400) { super(message); } }

async function authorize(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) throw new Failed("Invalid origin", 403);
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Failed("Studio sign-in required", 401);
  const db = createAdminClient();
  const admin = await db.from("studio_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (admin.error || !admin.data) throw new Failed("Admin access required", 403);
  return db;
}

type DBVariant = {
  id: string; name: string; size_label: string | null; width_mm: number | null; height_mm: number | null;
  framed: boolean; frame_style: string | null; price: number | null; currency: string; active: boolean;
  creativehub_product_id: string | null; creativehub_variant_id: string | null; creativehub_sku: string | null;
};
type Row = {
  id: string; name: string; sku: string; size: string; framed: boolean;
  frame: string | null; gbpRetail: number | null; supplierCurrency: string;
  priceEur: number | null; active: boolean; issue: string | null;
  match: boolean;
};
async function overview(db: ReturnType<typeof createAdminClient>, artworkId: string) {
  const artResult = await db.from("artworks")
    .select("id,title,published,prints_available")
    .eq("id", artworkId).maybeSingle();
  if (artResult.error || !artResult.data) throw new Failed("Artwork not found", 404);
  const art = artResult.data;
  const importResult = await db.from("creativehub_draft_imports")
    .select("product_id,variants_json")
    .eq("linked_artwork_id", artworkId).maybeSingle();
  if (importResult.error || !importResult.data) throw new Failed("No Creativehub import snapshot for this artwork", 404);
  const productId = string(importResult.data.product_id);
  if (!UUID.test(productId)) throw new Failed("Missing imported Creativehub product ID", 409);
  const source = Array.isArray(importResult.data.variants_json) ? importResult.data.variants_json : [];
  const sourceById = new Map<string, JsonObject>();
  for (const raw of source) {
    const variant = record(raw);
    const id = string(variant.id);
    if (UUID.test(id)) sourceById.set(id, variant);
  }
  const variantResult = await db.from("print_variants")
    .select("id,artwork_id,name,size_label,width_mm,height_mm,paper,framed,frame_style,price,currency,active,creativehub_product_id,creativehub_variant_id,creativehub_sku,sort_order")
    .eq("artwork_id", artworkId).order("sort_order", { ascending: true }).limit(200);
  if (variantResult.error) throw new Failed("Couldn't load print variants: " + variantResult.error.message, 500);
  if ((variantResult.data || []).length === 200) throw new Failed("Too many variants. Pagination review required", 409);
  const variants = (variantResult.data || []) as DBVariant[];
  const rows: Row[] = variants.map(pv => {
    const variantId = string(pv.creativehub_variant_id);
    const sourceVariant = sourceById.get(variantId);
    const matching = !!sourceVariant && string(pv.creativehub_product_id) === productId &&
      string(sourceVariant.sku) === string(pv.creativehub_sku) && !!string(pv.creativehub_sku);
    const amount = matching ? number(sourceVariant?.retail_price) : null;
    const currency = matching ? string(sourceVariant?.price_currency).toUpperCase() : "";
    const issue = !matching ? "SKU / supplier snapshot mapping does not match" :
      currency !== "GBP" ? "Supplier currency is not GBP" :
      amount === null ? "Supplier retail price missing or invalid" : null;
    return {
      id: pv.id, name: string(pv.name), sku: string(pv.creativehub_sku),
      size: string(pv.size_label) || string(sourceVariant?.size) || `${Number(pv.width_mm)/10} × ${Number(pv.height_mm)/10} cm`,
      framed: !!pv.framed, frame: pv.frame_style,
      gbpRetail: amount, supplierCurrency: currency,
      priceEur: pv.price === null ? null : Number(pv.price),
      active: !!pv.active, issue, match: matching,
    };
  });
  // Supply anomalies are advisory. Never turn a flagged variant on automatically.
  const bySize = new Map<string, Row[]>();
  for (const row of rows) {
    const source = sourceById.get(string(variants.find(pv => pv.id === row.id)?.creativehub_variant_id));
    const width = Number(source?.print_width_mm);
    const height = Number(source?.print_height_mm);
    const sizeKey = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? `${width}x${height}` : row.size.replace(/\s*\/\s*framed/i, "").trim();
    const group = bySize.get(sizeKey) || [];
    group.push(row);
    bySize.set(sizeKey, group);
  }
  for (const group of bySize.values()) {
    const unframed = group.filter(r => !r.framed && r.gbpRetail !== null);
    const framed = group.filter(r => r.framed && r.gbpRetail !== null);
    if (unframed.length && framed.length && Math.min(...framed.map(x => x.gbpRetail!)) < Math.max(...unframed.map(x => x.gbpRetail!))) {
      for (const row of group) row.issue = [row.issue, "Framed price is below unframed price for the same size; verify supplier listing"].filter(Boolean).join("; ");
    }
  }
  return { artwork: art, productId, rows };
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
    const db = await authorize(request);
    const artworkId = new URL(request.url).searchParams.get("artworkId") || "";
    if (!UUID.test(artworkId)) throw new Failed("Invalid artwork ID");
    return NextResponse.json(await overview(db, artworkId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return response(error instanceof Error ? error.message : "Pricing unavailable", error instanceof Failed ? error.code : 500);
  }
}

export async function POST(request: Request) {
  const __letionMfa = await requireStudioMfa();
  if (!__letionMfa.ok) {
    return NextResponse.json(
      { error: __letionMfa.error },
      { status: __letionMfa.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const db = await authorize(request);
    const body = record(await request.json());
    const artworkId = string(body.artworkId);
    if (!UUID.test(artworkId)) throw new Failed("Invalid artwork ID");
    const data = await overview(db, artworkId);
    if (string(body.title) !== data.artwork.title) throw new Failed("Artwork title confirmation mismatch", 409);
    const byId = new Map(data.rows.map(row => [row.id, row]));
    if (body.action === "prices") {
      if (!Array.isArray(body.prices) || body.prices.length < 1 || body.prices.length > 60) throw new Failed("Select between 1 and 60 price updates");
      const seen = new Set<string>();
      const updates: { id: string; eur: number }[] = [];
      for (const raw of body.prices) {
        const change = record(raw);
        const id = string(change.id);
        const row = byId.get(id);
        const eur = number(change.eur);
        const expectedGbp = number(change.expectedGbp);
        if (!row || !UUID.test(id) || seen.has(id) || row.issue || row.gbpRetail === null || row.supplierCurrency !== "GBP" ||
            Math.abs(row.gbpRetail - (expectedGbp ?? 0)) > 0.0001 || eur === null || eur < 1 || eur > 100000 ||
            row.priceEur !== null || row.active) throw new Failed("One of the selected variants is already priced, active, flagged, or does not match its GBP source; review again", 409);
        seen.add(id);
        updates.push({ id, eur: Math.round(eur * 100) / 100 });
      }
      let saved = 0;
      for (const entry of updates) {
        const result = await db.from("print_variants")
          .update({ price: entry.eur, currency: "EUR" })
          .eq("id", entry.id).eq("artwork_id", artworkId).eq("active", false)
          .is("price", null).select("id");
        if (result.error || (result.data || []).length !== 1) {
          return response("Price save paused because a row was changed or unavailable. Already saved prices remain drafts; reload and review the rest.", 409, { saved });
        }
        saved++;
      }
      return NextResponse.json({ saved, salesEnabled: false, note: "Prices saved as EUR drafts. No print variants were enabled." });
    }
    if (body.action === "enable") {
      if (body.verified !== true || string(body.confirmation) !== `ENABLE ${data.artwork.title} PRINTS`) throw new Failed("Supplier verification and typed confirmation required", 409);
      if (!data.artwork.published) throw new Failed("Publish the artwork on LETION ART before enabling prints", 409);
      if (!Array.isArray(body.variantIds) || body.variantIds.length < 1 || body.variantIds.length > 60) throw new Failed("Choose variants to enable", 400);
      const selected = body.variantIds.map(string);
      if (new Set(selected).size !== selected.length) throw new Failed("Duplicate variant ID");
      for (const id of selected) {
        const row = byId.get(id);
        if (!row || !row.match || row.issue || !row.gbpRetail || row.supplierCurrency !== "GBP" || !row.priceEur || row.priceEur < 1 || !row.sku) {
          throw new Failed("Selected variant missing a reviewed EUR price or has a supplier mismatch / pricing anomaly", 409);
        }
      }
      let enabled = 0;
      for (const id of selected) {
        const row = byId.get(id)!;
        if (row.active) { enabled++; continue; }
        const result = await db.from("print_variants").update({ active: true })
          .eq("id", id).eq("artwork_id", artworkId).eq("active", false)
          .eq("currency", "EUR").gt("price", 0).select("id");
        if (result.error || (result.data || []).length !== 1) {
          return response("Activation paused. Print sale flag was not turned on; recheck the options before trying again.", 409, { enabled });
        }
        enabled++;
      }
      const art = await db.from("artworks").update({ prints_available: true }).eq("id", artworkId).eq("published", true).select("id");
      if (art.error || (art.data || []).length !== 1) throw new Failed("Print options updated but artwork sales flag was not enabled; open Artwork Editor to review", 409);
      return NextResponse.json({ enabled, salesEnabled: true, note: "Selected variants enabled locally; no supplier production orders were sent." });
    }
    throw new Failed("Unsupported action");
  } catch (error) {
    return response(error instanceof Error ? error.message : "Pricing update failed", error instanceof Failed ? error.code : 500);
  }
}
