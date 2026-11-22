import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Rec = Record<string, unknown>;
function rec(v: unknown): Rec { return !!v && typeof v === "object" && !Array.isArray(v) ? v as Rec : {}; }
function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function safeUrl(v: unknown) { const u=str(v); return /^https:\/\//i.test(u) ? u : null; }
class ErrorReply extends Error { constructor(message: string, public status = 400) { super(message); } }

async function adminDb(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) throw new ErrorReply("Invalid request origin.", 403);
  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) throw new ErrorReply("Studio sign-in required.", 401);
  const db = createAdminClient();
  const { data: admin, error } = await db.from("studio_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error || !admin) throw new ErrorReply("Admin membership required.", 403);
  return db;
}

async function provider(endpoint: string): Promise<Rec> {
  const token = process.env.ESCHER_API_TOKEN;
  if (!token) throw new ErrorReply("ESCHER_API_TOKEN not configured on the server.", 503);
  const base = (process.env.ESCHER_API_BASE_URL || "https://escher-v2.creativehub.io/v1").replace(/\/$/, "");
  const response = await fetch(base + endpoint, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new ErrorReply(`Creativehub returned invalid JSON (HTTP ${response.status}).`, 502); }
  if (!response.ok) throw new ErrorReply(`Creativehub lookup returned HTTP ${response.status}.`, 502);
  return rec(body);
}

async function productDetail(id: string) {
  if (!UUID.test(id)) throw new ErrorReply("Invalid supplier product ID.");
  const [productRaw, variantRaw] = await Promise.all([
    provider(`/products/${encodeURIComponent(id)}`),
    provider(`/products/${encodeURIComponent(id)}/variants`),
  ]);
  const product = str(productRaw.id) === id ? productRaw : rec(productRaw.product);
  if (str(product.id) !== id) throw new ErrorReply("Creativehub returned an unexpected product ID.", 502);
  const variants = variantRaw.variants;
  if (!Array.isArray(variants)) throw new ErrorReply("Creativehub returned no usable variant list.", 502);
  return { product, variants };
}

function present(product: Rec, variants: unknown[], artworkId: string | null) {
  return {
    id: str(product.id), name: str(product.name) || str(product.title),
    description: str(product.description), artworkUrl: safeUrl(product.artwork_url),
    previewUrl: safeUrl(product.artwork_preview_medium_url) || safeUrl(product.artwork_thumbnail_url),
    thumbnailUrl: safeUrl(product.artwork_thumbnail_url),
    coaType: product.coa_type ?? null, coaTemplate: str(product.coa_template) || null,
    printInsertId: str(product.print_insert_id) || null,
    linkedArtworkId: artworkId,
    variants: variants.map((raw) => {
      const v = rec(raw);
      return {
        id: str(v.id), sku: str(v.sku), size: str(v.size) || str(v.size_label),
        widthMm: Number(v.print_width_mm) || null, heightMm: Number(v.print_height_mm) || null,
        paper: str(v.paper_id) || null, framed: v.is_framed === true,
        frameColor: str(v.frame_color) || null, frameType: str(v.frame_type) || null,
        supplierRetail: v.retail_price ?? null, supplierCurrency: str(v.price_currency) || null,
        editionSize: v.edition_size ?? null, border: str(v.border) || null,
        productShotUrl: safeUrl(v.visualised_product_url),
      };
    }),
  };
}

function errorResponse(error: unknown) {
  if (!(error instanceof ErrorReply)) console.error("Creativehub draft import:", error);
  return NextResponse.json({ error: error instanceof ErrorReply ? error.message : "Import could not be completed. No Creativehub changes were attempted." },
    { status: error instanceof ErrorReply ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  try {
    const db = await adminDb(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("productId") || "";
    if (id) {
      const { product, variants } = await productDetail(id);
      const mirror = await db.from("creativehub_draft_imports").select("linked_artwork_id").eq("product_id", id).maybeSingle();
      if (mirror.error) throw new ErrorReply("Run the supplied Supabase SQL migration before importing drafts.", 503);
      return NextResponse.json({ product: present(product, variants, mirror.data?.linked_artwork_id ?? null) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const offset = Number(params.get("offset") || "0");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new ErrorReply("Invalid product offset.");
    const remote = await provider(`/products?limit=50&offset=${offset}`);
    const products = Array.isArray(remote.products) ? remote.products.map(rec) : null;
    if (!products) throw new ErrorReply("Unexpected Creativehub product catalogue response.", 502);
    const ids = products.map(v => str(v.id)).filter(id => UUID.test(id));
    const imported = ids.length ? await db.from("creativehub_draft_imports").select("product_id,linked_artwork_id").in("product_id", ids) : { data: [], error: null };
    if (imported.error) throw new ErrorReply("Run the supplied Supabase SQL migration before importing drafts.", 503);
    const mapping = new Map((imported.data ?? []).map(v => [v.product_id, v.linked_artwork_id]));
    return NextResponse.json({
      products: products.filter(v => UUID.test(str(v.id))).map(v => ({
        id: str(v.id), name: str(v.name) || str(v.title),
        thumbnailUrl: safeUrl(v.artwork_thumbnail_url) || safeUrl(v.artwork_preview_medium_url),
        variantCount: Number(v.variant_count) || 0, linkedArtworkId: mapping.get(str(v.id)) || null,
      })),
      nextOffset: products.length === 50 ? offset + 50 : null,
      note: "The supplier product list does not expose reliable per-product Draft status; selected products are imported as UNPUBLISHED website drafts."
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const db = await adminDb(request);
    const input = rec(await request.json());
    if (input.confirmation !== "IMPORT CREATIVEHUB DRAFT") throw new ErrorReply("Type the exact import confirmation.");
    const productId = str(input.productId);
    if (!UUID.test(productId)) throw new ErrorReply("Select a Creativehub product.");
    const existingArtworkId = str(input.existingArtworkId) || null;
    const collectionId = str(input.collectionId) || null;
    if (existingArtworkId && !UUID.test(existingArtworkId)) throw new ErrorReply("Invalid existing artwork selection.");
    if (!existingArtworkId && (!collectionId || !UUID.test(collectionId))) throw new ErrorReply("Choose a collection for a new website draft.");
    const { product, variants } = await productDetail(productId);
    const result = await db.rpc("studio_import_creativehub_draft", {
      p_product_id: productId, p_product: product, p_variants: variants,
      p_existing_artwork_id: existingArtworkId, p_collection_id: collectionId,
    });
    if (result.error) throw new ErrorReply(result.error.message, 409);
    return NextResponse.json({ success: true, result: result.data, note: "Imported as an unpublished, inactive website draft. No supplier products or orders created." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
