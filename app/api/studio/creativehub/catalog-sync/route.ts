import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimatePrintSizes } from "@/lib/studio/estimatePrintSizes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = Record<string, any>;
type ContextVariant = {
  id: string;
  name: string;
  width_mm: number | null;
  height_mm: number | null;
  framed: boolean;
  frame_style: string | null;
  paper: string | null;
  price: number | null;
  currency: string;
  creativehub_variant_id: string | null;
  creativehub_product_id: string | null;
};
type Input = {
  action: "upload_ticket" | "preview" | "link" | "create" | "recover" | "estimate_sizes" | "apply_size_estimates";
  artworkId: string;
  productId?: string;
  selectedIds?: string[];
  gbpPrices?: Record<string, number>;
  border?: "none" | "small" | "large";
  confirmation?: string;
  filename?: string;
  mimeType?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function text(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

async function provider(path: string, method = "GET", payload?: Record<string, unknown>): Promise<Row> {
  const token = process.env.ESCHER_API_TOKEN;
  if (!token) throw new RequestError("ESCHER_API_TOKEN is not configured.", 503);
  const base = (process.env.ESCHER_API_BASE_URL || "https://escher-v2.creativehub.io/v1").replace(/\/$/, "");
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const raw = await response.text();
  let result: Row = {};
  try { result = raw ? JSON.parse(raw) : {}; }
  catch { throw new RequestError("Creativehub returned invalid JSON.", 502); }
  if (!response.ok) {
    // Creativehub often returns structured details (e.g. {detail:{code:"min_resolution"}}).
    // Do not expose signed master URLs or bearer tokens in the Studio UI.
    const detail = result.detail;
    const code = text(result.code) || (detail && typeof detail === "object" ? text((detail as Row).code) : "");
    const reason = typeof detail === "string" ? detail
      : detail && typeof detail === "object" ? text((detail as Row).message) || text((detail as Row).reason) : "";
    const safeReason = (reason || text(result.message)).replace(/https?:\/\/\S+/gi, "[URL omitted]").slice(0, 240);
    const at = `${method} ${path.split("?")[0]}`;
    const explanation = response.status === 413
      ? "Creativehub rejected the print master or request size (413). Check source pixel dimensions: artwork must be at least 2 MP and within Creativehub limits. Do not retry product creation until reviewed."
      : `Creativehub request failed (${response.status}).`;
    throw new RequestError(
      `${explanation} Step: ${at}.${code ? ` Code: ${code}.` : ""}${safeReason ? ` ${safeReason}` : ""}`,
      response.status >= 400 && response.status < 500 ? response.status : 502
    );
  }
  return result;
}

function paperSlug(v: string | null): string {
  const p = (v || "").toLowerCase().replaceAll("ü", "u");
  if (p.includes("etching")) return "german-etching";
  if (p.includes("photo rag")) return "photo-rag";
  if (p.includes("bamboo")) return "bamboo";
  if (p.includes("baryta")) return "baryta";
  if (p.includes("pearl")) return "pearl-giclee";
  throw new RequestError(`Choose a supported Creativehub paper for ${v || "the selected variant"}.`);
}

function frameColor(v: ContextVariant): string | null {
  if (!v.framed) return null;
  const color = (v.frame_style || "").toLowerCase();
  for (const choice of ["black", "white", "oak"]) {
    if (color.includes(choice)) return choice;
  }
  throw new RequestError(`Framed variant ${v.name} needs a Black, White or Oak frame style.`);
}

function identity(v: ContextVariant) {
  if (!v.width_mm || !v.height_mm || v.width_mm < 1 || v.height_mm < 1) {
    throw new RequestError(`Variant ${v.name} needs exact millimetre dimensions.`);
  }
  return `${v.width_mm}:${v.height_mm}:${v.framed ? 1 : 0}:${frameColor(v) || "none"}`;
}

function selectVariants(all: ContextVariant[], ids: unknown): ContextVariant[] {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || new Set(ids).size !== ids.length) {
    throw new RequestError("Choose between 1 and 20 distinct variants.");
  }
  const selected = ids.map((id) => all.find((v) => v.id === id));
  if (selected.some((v) => !v)) throw new RequestError("Some selected variants are missing.");
  const rows = selected as ContextVariant[];
  const keys = rows.map(identity);
  if (new Set(keys).size !== keys.length) {
    throw new RequestError("Two selected variants have the same size/frame identity.");
  }
  rows.forEach((v) => {
    try { paperSlug(v.paper); }
    catch { throw new RequestError(`Print option "${v.name}" needs a supported saved paper. Currently saved: ${v.paper || "NONE"}. Open Edit Artwork, set the Paper field, click Save variant, then reload this page.`); }
  });
  return rows;
}

function getMatches(selected: ContextVariant[], remote: Row[]): Array<{ localId: string; variantId: string; sku: string }> {
  return selected.map((local) => {
    const found = remote.filter((candidate) => {
      const candidateColor = text(candidate.frame_color).toLowerCase();
      return Number(candidate.print_width_mm) === local.width_mm &&
        Number(candidate.print_height_mm) === local.height_mm &&
        Boolean(candidate.is_framed) === local.framed &&
        (!local.framed || candidateColor === frameColor(local));
    });
    if (found.length !== 1 || !UUID.test(text(found[0].id)) || !text(found[0].sku)) {
      throw new RequestError(`Cannot uniquely map Creativehub variant: ${local.name}.`, 409);
    }
    const remotePaper = text(found[0].paper_id).toLowerCase();
    const expectedPaper = paperSlug(local.paper);
    const paperAlias = remotePaper === "1" ? "german-etching" : remotePaper === "6" ? "photo-rag" : remotePaper;
    if (paperAlias && paperAlias !== expectedPaper) {
      throw new RequestError(`Paper mismatch for ${local.name}: Creativehub has ${remotePaper}.`, 409);
    }
    return { localId: local.id, variantId: found[0].id as string, sku: found[0].sku as string };
  });
}

async function saveMappings(
  db: ReturnType<typeof createAdminClient>,
  artworkId: string,
  productId: string,
  selected: ContextVariant[],
  remote: Row[]
) {
  const matches = getMatches(selected, remote);
  // One write per variant. Keep EVERY mapped variant inactive for manual review.
  for (const match of matches) {
    const { error } = await db.from("print_variants").update({
      creativehub_product_id: productId,
      creativehub_variant_id: match.variantId,
      creativehub_sku: match.sku,
      active: false,
    }).eq("id", match.localId).eq("artwork_id", artworkId);
    if (error) throw new RequestError(`Failed to save mapping for ${match.localId}: ${error.message}`, 500);
  }
  return matches;
}

async function authorize(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    throw new RequestError("Invalid request origin.", 403);
  }
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new RequestError("Sign in to Studio.", 401);
  const db = createAdminClient();
  const { data: admin, error } = await db.from("studio_admins")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (error || !admin) throw new RequestError("Admin access required.", 403);
  return db;
}

export async function POST(request: Request) {
  let claimedId: string | null = null;
  let db: ReturnType<typeof createAdminClient> | null = null;
  try {
    db = await authorize(request);
    const body = await request.json() as Input;
    if (!body || !UUID.test(text(body.artworkId))) {
      throw new RequestError("Valid artwork ID is required.");
    }
    const artworkId = body.artworkId;
    const { data: artwork, error: artError } = await db.from("artworks")
      .select("id,title,description,edition_type,edition_size")
      .eq("id", artworkId).maybeSingle();
    if (artError || !artwork) throw new RequestError("Artwork not found.", 404);
    const { data: rows, error: variantsError } = await db.from("print_variants")
      .select("id,name,width_mm,height_mm,framed,frame_style,paper,price,currency,creativehub_variant_id,creativehub_product_id")
      .eq("artwork_id", artworkId).order("sort_order");
    if (variantsError) throw variantsError;
    const variants = (rows || []) as ContextVariant[];
    const { data: sync, error: syncError } = await db.from("artwork_creativehub_sync")
      .select("*").eq("artwork_id", artworkId).maybeSingle();
    if (syncError) throw syncError;

    if (body.action === "preview") {
      return NextResponse.json({ artwork, variants, sync: sync ? {
        state: sync.state, hasMaster: Boolean(sync.master_path), productId: sync.product_id,
        error: sync.last_error,
      } : null });
    }


    if (body.action === "estimate_sizes" || body.action === "apply_size_estimates") {
      if (!sync?.master_path) throw new RequestError("Upload your full-resolution print master first.", 409);
      const { data: stored, error: downloadError } = await db.storage
        .from("print-masters").download(sync.master_path);
      if (downloadError || !stored) throw new RequestError("Cannot read the saved print master.", 409);
      if (stored.size > 50 * 1024 * 1024) throw new RequestError("Print master exceeds this Studio's 50 MB processing limit.", 413);
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(Buffer.from(await stored.arrayBuffer()), {
        limitInputPixels: 300_000_000,
      }).metadata();
      const sideways = [5, 6, 7, 8].includes(metadata.orientation || 1);
      const widthPx = sideways ? metadata.height : metadata.width;
      const heightPx = sideways ? metadata.width : metadata.height;
      if (!widthPx || !heightPx) throw new RequestError("Could not read image pixel dimensions.", 422);
      const estimate = estimatePrintSizes(widthPx, heightPx);
      if (body.action === "estimate_sizes") {
        // No supplier call, no database write. Tier fractions are local estimates.
        return NextResponse.json({ success: true, estimate });
      }
      if (sync.state !== "ready" || sync.product_id || sync.upload_id || sync.drop_id) {
        throw new RequestError("Cannot change dimensions once Creativehub sync has started. Review the existing supplier mapping.", 409);
      }
      if (!estimate.meetsCreativehubMinimum) {
        throw new RequestError(`This master is only ${estimate.megapixels} MP. Creativehub requires at least 2 MP. Upload a higher-resolution original.`, 422);
      }
      if (!estimate.meetsCreativehubStandardMaximum) {
        throw new RequestError(`This master is ${estimate.megapixels} MP, above Creativehub's standard 200 MP upload limit.`, 422);
      }
      // Ensure no existing supplier mapping for this artwork can be changed.
      if (variants.some(v => v.creativehub_variant_id || v.creativehub_product_id)) {
        throw new RequestError("This artwork already has linked variants. Auto-sizing will not change supplier-mapped products.", 409);
      }
      const plan = estimate.suggestions;
      let updated = 0;
      let created = 0;
      // Deliberately preserve all retail prices and papers on existing variants.
      // Disable affected variants until the artist reviews pricing and framing.
      for (const s of plan) {
        const oldRows = variants.filter(v => new RegExp(`^${s.tier}(?:\\s|\\/|$)`, "i").test(v.name.trim()));
        if (oldRows.length) {
          for (const old of oldRows) {
            const { error } = await db.from("print_variants").update({
              width_mm: s.widthMm,
              height_mm: s.heightMm,
              size_label: `${(s.widthMm / 10).toFixed(1)} × ${(s.heightMm / 10).toFixed(1)} cm`,
              active: false,
            }).eq("artwork_id", artworkId).eq("id", old.id)
              .is("creativehub_variant_id", null).is("creativehub_product_id", null);
            if (error) throw new RequestError(`Failed updating ${old.name}: ${error.message}`, 500);
            updated++;
          }
        } else {
          const { error } = await db.from("print_variants").insert({
            artwork_id: artworkId,
            name: `${s.tier} / Print only`,
            size_label: `${(s.widthMm / 10).toFixed(1)} × ${(s.heightMm / 10).toFixed(1)} cm`,
            width_mm: s.widthMm, height_mm: s.heightMm,
            price: null, currency: "EUR", paper: "Hahnemühle Photo Rag", finish: "Giclée",
            framed: false, frame_style: null, framing_details: null,
            creativehub_sku: null, creativehub_product_id: null, creativehub_variant_id: null,
            estimated_fulfilment_cost: null, fulfilment_currency: "GBP",
            active: false, sort_order: variants.length + created + 1,
          });
          if (error) throw new RequestError(`Failed creating ${s.tier}: ${error.message}`, 500);
          created++;
        }
      }
      return NextResponse.json({ success: true, estimate,
        message: `Studio print sizes applied: ${updated} existing option(s) resized, ${created} new option(s) added. All changed options remain disabled. Review frame compatibility, paper and retail prices before Creativehub creation.` });
    }

    if (body.action === "upload_ticket") {
      if (sync && sync.state !== "ready") {
        throw new RequestError("A linked or partially created product cannot have its master replaced.", 409);
      }
      const mime = text(body.mimeType);
      const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/tiff": "tif" } as Record<string, string>)[mime];
      if (!ext) throw new RequestError("Use a print-ready JPG, PNG or TIFF file.");
      const path = `${artworkId}/${crypto.randomUUID()}.${ext}`;
      const { data, error: ticketError } = await db.storage.from("print-masters").createSignedUploadUrl(path);
      if (ticketError || !data) throw new RequestError(ticketError?.message || "Could not prepare master upload.", 500);
      if (sync) {
        const { data: updated, error: saveError } = await db.from("artwork_creativehub_sync")
          .update({ master_path: path, last_error: null, updated_at: new Date().toISOString() })
          .eq("artwork_id", artworkId).eq("state", "ready")
          .select("artwork_id").maybeSingle();
        if (saveError || !updated) throw new RequestError("Sync changed during upload preparation.", 409);
      } else {
        const { error: saveError } = await db.from("artwork_creativehub_sync").insert({
          artwork_id: artworkId, master_path: path, state: "ready",
        });
        if (saveError) throw new RequestError("Another sync operation has started.", 409);
      }
      return NextResponse.json({ path: data.path, token: data.token });
    }

    if (body.action === "recover") {
      if (!sync || sync.state !== "needs_review" || !UUID.test(text(sync.product_id))) {
        throw new RequestError("No recoverable product ID was saved. Inspect Creativehub manually.", 409);
      }
      const ids = Array.isArray(sync.selected_variant_ids) ? sync.selected_variant_ids : [];
      const previous = selectVariants(variants, ids);
      const result = await provider(`/products/${encodeURIComponent(sync.product_id)}/variants`);
      const remote = Array.isArray(result.variants) ? result.variants as Row[] : [];
      const matches = getMatches(previous, remote);
      for (let i = 0; i < previous.length; i++) {
        const current = previous[i];
        if (current.creativehub_variant_id && current.creativehub_variant_id !== matches[i].variantId) {
          throw new RequestError(`Existing mapping conflicts for ${current.name}. Manual review required.`, 409);
        }
      }
      await saveMappings(db, artworkId, sync.product_id, previous, remote);
      const { error } = await db.from("artwork_creativehub_sync").update({
        state: "linked", last_error: null, updated_at: new Date().toISOString(),
      }).eq("artwork_id", artworkId).eq("state", "needs_review");
      if (error) throw error;
      return NextResponse.json({ success: true, productId: sync.product_id,
        message: "Product recovered and mapped. Variants remain disabled until reviewed." });
    }

    const selected = selectVariants(variants, body.selectedIds);
    if (selected.some((v) => v.creativehub_variant_id || v.creativehub_product_id)) {
      throw new RequestError("One or more selected variants are already mapped. Do not overwrite them.", 409);
    }

    if (body.action === "link") {
      const productId = text(body.productId);
      if (!UUID.test(productId)) throw new RequestError("Enter a valid existing Creativehub product ID.");
      if (sync && sync.state !== "ready") {
        throw new RequestError("This artwork already has a sync in progress or linked. Review it before linking.", 409);
      }
      const response = await provider(`/products/${encodeURIComponent(productId)}/variants`);
      const candidates = Array.isArray(response.variants) ? response.variants as Row[] : [];
      const matches = getMatches(selected, candidates);
      // Acquire an exclusive sync claim before touching local mappings.
      if (sync) {
        const { data: claim, error: claimError } = await db.from("artwork_creativehub_sync")
          .update({ state: "creating", selected_variant_ids: selected.map((v) => v.id), updated_at: new Date().toISOString() })
          .eq("artwork_id", artworkId).eq("state", "ready")
          .select("artwork_id").maybeSingle();
        if (claimError || !claim) throw new RequestError("Another sync operation has started.", 409);
      } else {
        const { error: insertError } = await db.from("artwork_creativehub_sync")
          .insert({ artwork_id: artworkId, state: "creating", selected_variant_ids: selected.map((v) => v.id) });
        if (insertError) throw new RequestError("Another sync operation has started.", 409);
      }
      claimedId = artworkId;
      // Disable customer selection before saving mappings.
      for (const v of selected) {
        const { error } = await db.from("print_variants").update({ active: false })
          .eq("artwork_id", artworkId).eq("id", v.id);
        if (error) throw error;
      }
      await saveMappings(db, artworkId, productId, selected, candidates);
      const { error } = await db.from("artwork_creativehub_sync").upsert({
        artwork_id: artworkId, product_id: productId, state: "linked", last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "artwork_id" });
      if (error) throw error;
      return NextResponse.json({ success: true, productId, matches, message: "Existing product linked. Variants are disabled until reviewed." });
    }

    if (body.action !== "create") throw new RequestError("Unknown action.");
    if (body.confirmation !== "CREATE CREATIVEHUB PRODUCT") {
      throw new RequestError("Confirm the new Creativehub product creation.");
    }
    if (!sync || sync.state !== "ready" || !text(sync.master_path)) {
      throw new RequestError("Upload a print-ready master first, or review the previous sync.", 409);
    }
    const values = body.gbpPrices || {};
    const prices = selected.map((v) => {
      const price = Number(values[v.id]);
      if (!Number.isFinite(price) || price < 1 || price > 100000) {
        throw new RequestError(`Provide a valid Creativehub GBP retail price for ${v.name}.`);
      }
      return Math.round(price * 100) / 100;
    });
    const border = body.border || "small";
    if (!["none", "small", "large"].includes(border)) throw new RequestError("Invalid print border.");
    // Preflight before locking the sync state or making ANY supplier request.
    // Creativehub rejects print artwork below 2 megapixels with HTTP 413.
    const { data: createMaster, error: createMasterError } = await db.storage
      .from("print-masters").download(sync.master_path);
    if (createMasterError || !createMaster) throw new RequestError("The saved print master is unavailable. Upload it again before creating a product.", 409);
    const createSharp = (await import("sharp")).default;
    const createMetadata = await createSharp(Buffer.from(await createMaster.arrayBuffer()), {
      limitInputPixels: 300_000_000,
    }).metadata();
    if (!createMetadata.width || !createMetadata.height) throw new RequestError("Cannot read print master dimensions.", 422);
    if (createMetadata.width * createMetadata.height > 200_000_000) {
      throw new RequestError("The print master exceeds Creativehub's standard 200 MP limit. Prepare a compliant export first.", 422);
    }
    if (createMetadata.width * createMetadata.height < 2_000_000) {
      throw new RequestError(`The print master is ${(createMetadata.width * createMetadata.height / 1_000_000).toFixed(2)} MP. Creativehub requires at least 2 MP. Upload a genuine higher-resolution original before creating a product.`, 422);
    }
    // Atomic database claim: only one request can begin provider creation.
    const { data: claim, error: claimError } = await db.from("artwork_creativehub_sync")
      .update({ state: "creating", selected_variant_ids: selected.map((v) => v.id), last_error: null, updated_at: new Date().toISOString() })
      .eq("artwork_id", artworkId).eq("state", "ready")
      .select("artwork_id,master_path").maybeSingle();
    if (claimError) throw claimError;
    if (!claim) throw new RequestError("This artwork is already being synchronized.", 409);
    claimedId = artworkId;

    // Never allow checkout to use incomplete new supplier mappings.
    for (const v of selected) {
      const { error } = await db.from("print_variants").update({ active: false })
        .eq("id", v.id).eq("artwork_id", artworkId);
      if (error) throw error;
    }
    const { data: signed, error: signedError } = await db.storage.from("print-masters")
      .createSignedUrl(claim.master_path, 60 * 60 * 24);
    if (signedError || !signed) throw new RequestError("Print master is unavailable in storage.", 409);

    const uploaded = await provider("/uploads/ref", "POST", {
      url: signed.signedUrl, image_type: "artwork", name: `${artwork.title} print master`,
    });
    if (!text(uploaded.id)) throw new Error("Creativehub did not return upload ID.");
    await db.from("artwork_creativehub_sync").update({ upload_id: uploaded.id })
      .eq("artwork_id", artworkId);

    const drop = await provider("/drops", "POST", {
      title: `LETION ART / ${artwork.title}`.slice(0, 200), create_early_access_page: false,
    });
    if (!text(drop.id)) throw new Error("Creativehub did not return drop ID.");
    await db.from("artwork_creativehub_sync").update({ drop_id: drop.id })
      .eq("artwork_id", artworkId);

    const product = await provider(`/drops/${encodeURIComponent(drop.id)}/products`, "POST", {
      upload_id: uploaded.id, title: artwork.title, description: artwork.description || "",
      is_limited_edition: text(artwork.edition_type).toLowerCase().includes("limited"),
      ...(text(artwork.edition_type).toLowerCase().includes("limited")
        ? { edition_size: Number(artwork.edition_size) > 0 ? Number(artwork.edition_size) : 50 }
        : {}),
    });
    if (!text(product.id)) throw new Error("Creativehub did not return product ID.");
    await db.from("artwork_creativehub_sync").update({ product_id: product.id })
      .eq("artwork_id", artworkId);

    await provider(`/drops/${encodeURIComponent(drop.id)}/products/${encodeURIComponent(product.id)}/variants`, "PUT", {
      variants: selected.map((v, index) => ({
        size_label: v.name, print_width_mm: v.width_mm, print_height_mm: v.height_mm,
        price_gbp: prices[index], is_framed: v.framed,
        ...(v.framed ? { frame_color: frameColor(v) } : {}),
        border, paper_id: paperSlug(v.paper),
      })),
    });
    const remoteResult = await provider(`/products/${encodeURIComponent(product.id)}/variants`);
    const remote = Array.isArray(remoteResult.variants) ? remoteResult.variants as Row[] : [];
    const matches = getMatches(selected, remote);
    await saveMappings(db, artworkId, product.id, selected, remote);
    const { error: finalError } = await db.from("artwork_creativehub_sync").update({
      state: "linked", last_error: null, updated_at: new Date().toISOString(),
    }).eq("artwork_id", artworkId);
    if (finalError) throw finalError;
    return NextResponse.json({ success: true, productId: product.id, matches,
      message: "Product created and linked. Review disabled variants and test quotes before enabling sales." });
  } catch (error) {
    if (claimedId && db) {
      // A provider write could have succeeded despite a network timeout.
      // Block retries. An admin must inspect the Creativehub account first.
      await db.from("artwork_creativehub_sync").update({
        state: "needs_review", last_error: "Creation requires manual review. Do not retry blindly.",
        updated_at: new Date().toISOString(),
      }).eq("artwork_id", claimedId);
    }
    console.error("Creativehub catalogue sync:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Creativehub sync failed.",
    }, { status: error instanceof RequestError ? error.status : 500 });
  }
}
