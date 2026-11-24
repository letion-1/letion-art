import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TWO_LETTERS = /^[A-Z]{2}$/;
const REQUESTED = "Creativehub recommendations requested";

type Obj = Record<string, unknown>;
class SafeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function obj(v: unknown): Obj { return v !== null && typeof v === "object" && !Array.isArray(v) ? v as Obj : {}; }
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const value = Number(v);
  return Number.isFinite(value) ? value : null;
}
async function authorise(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) throw new SafeError("Invalid request origin.", 403);
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new SafeError("Studio sign-in required.", 401);
  const db = createAdminClient();
  const admin = await db.from("studio_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (admin.error || !admin.data) throw new SafeError("Studio administrator access required.", 403);
  return db;
}
async function supplier(path: string, method: "GET" | "POST" = "GET", body?: Obj): Promise<Obj> {
  const token = process.env.ESCHER_API_TOKEN;
  if (!token) throw new SafeError("Creativehub API token is not configured.", 503);
  const base = (process.env.ESCHER_API_BASE_URL || "https://escher-v2.creativehub.io/v1").replace(/\/$/, "");
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const raw = await response.text();
  let parsed: Obj = {};
  try { parsed = raw ? obj(JSON.parse(raw)) : {}; }
  catch { throw new SafeError(`Creativehub returned an unreadable HTTP ${response.status} response.`, 502); }
  if (!response.ok) {
    const details = obj(parsed.detail);
    const reason = str(parsed.message) || str(parsed.reason) || str(parsed.detail) || str(details.message) || str(details.reason);
    const safeReason = reason.replace(/https?:\/\/\S+/g, "[URL]").slice(0, 240);
    throw new SafeError(`Creativehub HTTP ${response.status}${safeReason ? `: ${safeReason}` : "."}`, response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return parsed;
}
async function context(db: ReturnType<typeof createAdminClient>, artworkId: string) {
  if (!UUID.test(artworkId)) throw new SafeError("Valid artwork ID required.");
  const [art, sync, local] = await Promise.all([
    db.from("artworks").select("id,title").eq("id", artworkId).maybeSingle(),
    db.from("artwork_creativehub_sync").select("artwork_id,state,product_id,drop_id,upload_id,last_error").eq("artwork_id", artworkId).maybeSingle(),
    db.from("print_variants").select("id,name,width_mm,height_mm,paper,framed,frame_style,price,currency,active,creativehub_product_id,creativehub_variant_id,creativehub_sku").eq("artwork_id", artworkId),
  ]);
  if (art.error || !art.data) throw new SafeError("Artwork not found.", 404);
  if (sync.error || local.error) throw new SafeError("Could not read Studio print data.", 500);
  return { artwork: art.data, sync: sync.data, local: local.data ?? [] };
}
async function readRemote(productId: string) {
  if (!UUID.test(productId)) throw new SafeError("Saved supplier product ID is invalid.", 409);
  const [product, response] = await Promise.all([
    supplier(`/products/${encodeURIComponent(productId)}`),
    supplier(`/products/${encodeURIComponent(productId)}/variants`),
  ]);
  if (str(product.id) !== productId || !Array.isArray(response.variants)) {
    throw new SafeError("Creativehub returned an unexpected product response. No changes made.", 502);
  }
  const rows = response.variants.map((item: unknown) => obj(item));
  return { product, rows };
}
function publicVariants(rows: Obj[], local: Obj[]) {
  return rows.map((v) => {
    const id = str(v.id);
    const mapped = local.find((item) => str(item.creativehub_variant_id) === id);
    return {
      id, sku: str(v.sku), sizeLabel: str(v.size) || str(v.size_label) || null,
      widthMm: num(v.print_width_mm), heightMm: num(v.print_height_mm),
      framed: v.is_framed === true, frameColor: str(v.frame_color) || null,
      paper: str(v.paper_id) || null, border: str(v.border) || null,
      supplierRetail: num(v.retail_price), supplierRetailCurrency: str(v.price_currency) || null,
      localVariantId: mapped?.id ?? null, localPrice: mapped ? num(mapped.price) : null,
      localCurrency: mapped ? str(mapped.currency) : null,
      localActive: mapped?.active === true,
    };
  });
}
function replyError(error: unknown) {
  if (!(error instanceof SafeError)) console.error("Studio Creativehub supplier planner:", error);
  return NextResponse.json({ error: error instanceof SafeError ? error.message : "Supplier operation failed. Inspect status before retrying." },
    { status: error instanceof SafeError ? error.status : 502, headers: { "Cache-Control": "private, no-store" } });
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
    const db = await authorise(request);
    const id = new URL(request.url).searchParams.get("artworkId") || "";
    const { artwork, sync, local } = await context(db, id);
    if (!sync?.product_id) return NextResponse.json({ artworkTitle: artwork.title, hasProduct: false, syncState: sync?.state ?? "not_started", variants: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const { product, rows } = await readRemote(sync.product_id);
    const locked = str(sync.last_error).includes(REQUESTED);
    return NextResponse.json({
      artworkTitle: artwork.title, hasProduct: true, productId: sync.product_id,
      supplierProductName: str(product.title) || str(product.name) || artwork.title,
      dropId: sync.drop_id, syncState: sync.state, recommendationRequested: locked,
      canRequestRecommendations: rows.length === 0 && Boolean(sync.drop_id) && Boolean(sync.upload_id) && sync.state === "needs_review" && !locked && !local.some(v => v.creativehub_variant_id || v.creativehub_sku || v.active),
      variantCount: rows.length, variants: publicVariants(rows, local as Obj[]),
      note: "This reads the supplier catalogue. Recommendations may change the supplier draft; quotations do not place orders. Studio retail prices are independent of supplier retail prices.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return replyError(error); }
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
    const db = await authorise(request);
    const body = obj(await request.json());
    const artworkId = str(body.artworkId);
    const { sync, local } = await context(db, artworkId);
    if (!sync?.product_id || !UUID.test(sync.product_id)) throw new SafeError("Create or link the Creativehub product before requesting supplier prices.", 409);
    if (body.action === "quote") {
      const variantId = str(body.variantId);
      const country = str(body.country).toUpperCase();
      const qty = body.quantity === undefined ? 1 : num(body.quantity);
      if (!UUID.test(variantId) || !TWO_LETTERS.test(country) || !Number.isInteger(qty) || qty === null || qty < 1 || qty > 50) {
        throw new SafeError("Select a supplier variant, 2-letter delivery country and quantity 1–50.");
      }
      const { rows } = await readRemote(sync.product_id);
      if (!rows.some(v => str(v.id) === variantId)) throw new SafeError("Supplier variant was removed or replaced. Refresh mappings.", 409);
      const quote = await supplier("/orders/quote", "POST", { items: [{ variant_id: variantId, quantity: qty }], delivery_country_code: country });
      return NextResponse.json({
        quoteOnly: true, country, quantity: qty, currency: str(quote.currency),
        productionCost: num(quote.production_cost), deliveryCost: num(quote.delivery_cost),
        addonCost: num(quote.addon_cost), vat: num(quote.total_vat),
        totalInclVat: num(quote.total_incl_vat), totalExclVat: num(quote.total_excl_vat), ddpTotal: num(quote.ddp_total),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.action !== "recommend") throw new SafeError("Unknown supplier operation.");
    if (body.confirmation !== "REQUEST CREATIVEHUB RECOMMENDATIONS") throw new SafeError("Explicit confirmation is required.", 400);
    if (sync.state !== "needs_review" || !sync.drop_id || !UUID.test(sync.drop_id) || !sync.upload_id) {
      throw new SafeError("Product recovery requires a saved draft drop and upload ID. No changes made.", 409);
    }
    if (str(sync.last_error).includes(REQUESTED)) throw new SafeError("Recommendations have already been requested. Review Creativehub before another attempt.", 409);
    if (local.some(v => v.creativehub_variant_id || v.creativehub_sku || v.active)) {
      throw new SafeError("Some local variants are already mapped or active. Stop to avoid changing sold print options.", 409);
    }
    const [{ rows }, supplierDrop] = await Promise.all([
      readRemote(sync.product_id),
      supplier(`/drops/${encodeURIComponent(sync.drop_id)}`),
    ]);
    if (rows.length) throw new SafeError("Supplier already has variants. Review them without regenerating IDs.", 409);
    if (str(supplierDrop.id) !== sync.drop_id || !(supplierDrop.status === 1 || ["1", "draft"].includes(str(supplierDrop.status).toLowerCase()))) {
      throw new SafeError("Creativehub drop is not confirmed as Draft. No recommendations were requested.", 409);
    }
    // Atomic state claim stops simultaneous recommendation writes. A failed/timeout request stays locked for review.
    let update = db.from("artwork_creativehub_sync").update({ state: "creating", last_error: `${REQUESTED}: in progress. Inspect before retrying.`, updated_at: new Date().toISOString() })
      .eq("artwork_id", artworkId).eq("state", "needs_review").eq("product_id", sync.product_id);
    update = sync.last_error === null ? update.is("last_error", null) : update.eq("last_error", sync.last_error);
    const claimed = await update.select("artwork_id").maybeSingle();
    if (claimed.error || !claimed.data) throw new SafeError("Sync state changed. Refresh before requesting recommendations.", 409);
    try {
      // This is a supplier draft WRITE, deliberately initiated only from a separate, confirmed admin action.
      await supplier("/recommendations", "POST", { drop_id: sync.drop_id });
      await db.from("artwork_creativehub_sync").update({ state: "needs_review", last_error: `${REQUESTED}. Await supplier result; inspect the draft before mapping.`, updated_at: new Date().toISOString() })
        .eq("artwork_id", artworkId).eq("state", "creating").eq("product_id", sync.product_id);
      return NextResponse.json({ recommendationRequested: true, message: "Creativehub recommendation request accepted. It can process asynchronously. Check the supplier draft and refresh Manage Prints; no customer order was placed." }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (err) {
      await db.from("artwork_creativehub_sync").update({ state: "needs_review", last_error: `${REQUESTED} but the result is unconfirmed. Inspect supplier draft before retrying.`, updated_at: new Date().toISOString() })
        .eq("artwork_id", artworkId).eq("state", "creating").eq("product_id", sync.product_id);
      throw err;
    }
  } catch (error) { return replyError(error); }
}
