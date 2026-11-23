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

// Refresh only supplier display photos. Never import the print master URL.
// Existing public-photo choices are preserved by stable Creativehub variant ID.
async function syncDisplayPhotos(db: Awaited<ReturnType<typeof adminDb>>, artworkId: string,
  productId: string, product: Rec, variants: unknown[]) {
  const photoDb = db.from("studio_creativehub_product_photos");
  const old = await photoDb.select("photo_key,is_public,sort_order")
    .eq("artwork_id", artworkId);
  if (old.error) return `Product photos were not refreshed: ${old.error.message}`;
  const previous = new Map<string, { is_public: boolean; sort_order: number }>(
    (old.data || []).map((p: { photo_key: string; is_public: boolean; sort_order: number }) =>
      [p.photo_key, { is_public: p.is_public, sort_order: p.sort_order }])
  );
  const choices: Array<{ photo_key: string; photo_type: string; image_url: string;
    caption: string; supplier_variant_id: string | null }> = [];
  const preview = safeUrl(product.artwork_preview_medium_url) || safeUrl(product.artwork_thumbnail_url);
  if (preview) choices.push({ photo_key: "artwork-preview", photo_type: "artwork_preview",
    image_url: preview, caption: "Artwork preview", supplier_variant_id: null });
  for (const raw of variants) {
    const v = rec(raw); const id = str(v.id); const url = safeUrl(v.visualised_product_url);
    if (!UUID.test(id) || !url) continue;
    choices.push({ photo_key: `variant:${id}`, photo_type: "supplier_mockup",
      image_url: url, caption: `${str(v.size) || str(v.size_label) || "Print"} · ${v.is_framed === true ? "Framed " + (str(v.frame_color) || "print") : "Unframed"}`,
      supplier_variant_id: id });
  }
  if (choices.length > 100) return "Creativehub returned too many photos. Review the photo gallery separately.";
  const rows = choices.map((photo, index) => ({ ...photo, artwork_id: artworkId,
    product_id: productId, refreshed_at: new Date().toISOString(),
    is_public: previous.get(photo.photo_key)?.is_public ?? false,
    sort_order: previous.get(photo.photo_key)?.sort_order ?? index + 1 }));
  if (rows.length) {
    const saved = await photoDb.upsert(rows, { onConflict: "artwork_id,photo_key" });
    if (saved.error) return `Product photos were not refreshed: ${saved.error.message}`;
  }
  const keys = choices.map(v => v.photo_key);
  const stale = (old.data || []).filter(v => !keys.includes(v.photo_key)).map(v => v.photo_key);
  if (stale.length) {
    const hidden = await photoDb.update({ is_public: false })
      .eq("artwork_id", artworkId).in("photo_key", stale);
    if (hidden.error) return `Retired product photos could not be hidden: ${hidden.error.message}`;
  }
  return null;
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
    if (input.action === "enableShop") {
      const id = str(input.productId);
      if (!UUID.test(id)) throw new ErrorReply("Choose a Creativehub product.");
      const result = await db.rpc("studio_make_imported_prints_available", {
        p_product_id: id,
      });
      if (result.error) throw new ErrorReply(result.error.message, 409);
      const outcome = rec(result.data);
      return NextResponse.json({ success: true,
        artworkId: str(outcome.artworkId), activeOptions: Number(outcome.activeOptions) || 0,
        note: "Shop print availability updated. No Creativehub production order submitted." },
        { headers: { "Cache-Control": "private, no-store" } });
    }
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
    const outcome = rec(result.data);
    const artworkId = str(outcome.artworkId);
    const photoWarning = UUID.test(artworkId)
      ? await syncDisplayPhotos(db, artworkId, productId, product, variants)
      : "No linked artwork ID was returned for product photo refresh.";
    // The supplier provides GBP retail values. Bring missing website prices
    // into EUR using the same Frankfurter reference source as Studio's FX tool.
    // Never overwrite an existing EUR price, and never publish on import alone.
    let priceSync: Rec | null = null;
    let priceWarning: string | null = null;
    if (UUID.test(artworkId)) {
      try {
        const fx = await fetch("https://api.frankfurter.dev/v2/rate/gbp/eur", {
          headers: { Accept: "application/json" }, cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (!fx.ok) throw new Error(`Exchange-rate source returned HTTP ${fx.status}`);
        const reference: unknown = await fx.json();
        const item = rec(reference);
        const rate = Number(item.rate);
        if (!Number.isFinite(rate) || rate < 0.5 || rate > 3) throw new Error("Invalid GBP to EUR rate");
        const day = str(item.date);
        const converted = await db.rpc("studio_prepare_imported_print_prices", {
          p_artwork_id: artworkId, p_product_id: productId, p_rate: rate,
          p_reference_date: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
        });
        if (converted.error) throw new Error(converted.error.message);
        priceSync = rec(converted.data);
      } catch (err) {
        priceWarning = "Creativehub supplier details synced, but EUR pricing could not be prepared: " +
          (err instanceof Error ? err.message : "FX lookup failed") + ". Retry Sync when the rate service is available.";
      }
    }
    return NextResponse.json({ success: true, result: result.data, photoWarning, priceSync, priceWarning,
      product: present(product, variants, artworkId),
      note: "Creativehub supplier details synchronized. Existing EUR prices preserved; supplier display photos refreshed. Website selling follows Available as Print." },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
