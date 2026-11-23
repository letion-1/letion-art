
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;
type Context = { params: Promise<{ id: string }> };

type Address = {
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postcode?: string;
  state?: string;
  country?: string;
};

class ProviderError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }
  return Number(value);
}

function safeTrackingUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function creativehub(
  path: string,
  method = "GET",
  payload?: Json
): Promise<Json> {
  const token = process.env.ESCHER_API_TOKEN;
  if (!token) {
    throw new Error("Creativehub token is not configured on Vercel.");
  }

  const base = (
    process.env.ESCHER_API_BASE_URL ||
    "https://escher-v2.creativehub.io/v1"
  ).replace(/\/$/, "");

  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const raw = await response.text();
  let result: Json = {};

  try {
    if (raw) result = JSON.parse(raw) as Json;
  } catch {
    throw new ProviderError(
      "Creativehub returned an invalid response.",
      502
    );
  }

  if (!response.ok) {
    const message =
      str(result.message) ||
      str(result.detail) ||
      `Creativehub returned HTTP ${response.status}.`;

    throw new ProviderError(message, response.status);
  }

  return result;
}

async function requireAdmin() {
  const auth = await createClient();

  const {
    data: { user },
    error,
  } = await auth.auth.getUser();

  if (error || !user) return false;

  // Separate second-factor check for the financially sensitive supplier API.
  // Do not turn on enforcement until MFA enrollment has been tested.
  if (process.env.STUDIO_REQUIRE_MFA === "true") {
    const { data: assurance, error: assuranceError } =
      await auth.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") return false;
  }

  const db = createAdminClient();

  const { data: admin, error: adminError } = await db
    .from("studio_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return !adminError && !!admin;
}

async function loadOrder(id: string) {
  const db = createAdminClient();

  const { data: order, error: orderError } = await db
    .from("orders")
    .select(`
      id,order_number,status,fulfilment_status,currency,total_amount,
      shipping_amount,shipping_address,customer_email,creativehub_order_id,
      stripe_checkout_session_id
    `)
    .eq("id", id)
    .single();

  if (orderError || !order) {
    throw new ProviderError("Order not found.", 404);
  }

  const { data: items, error: itemsError } = await db
    .from("order_items")
    .select("creativehub_variant_id,quantity")
    .eq("order_id", id);

  if (itemsError || !items?.length) {
    throw new Error("Order items are missing.");
  }

  const lines = items.map((item) => {
    if (!item.creativehub_variant_id) {
      throw new ProviderError(
        "An order item is not mapped to Creativehub.",
        409
      );
    }

    const quantity = Number(item.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      throw new ProviderError(
        "An order item has an invalid quantity.",
        409
      );
    }

    return {
      variant_id: String(item.creativehub_variant_id),
      quantity,
    };
  });

  if (lines.length > 20) {
    throw new ProviderError(
      "Creativehub supports up to 20 lines.",
      409
    );
  }

  const address = (order.shipping_address || {}) as Address;

  if (!/^[A-Z]{2}$/.test(str(address.country).toUpperCase())) {
    throw new ProviderError(
      "Order has no valid destination country.",
      409
    );
  }

  return { db, order, lines, address };
}

function trackedStatus(value: unknown): string {
  const status = str(value).toLowerCase();

  if (status.includes("delivered")) return "delivered";
  if (status === "dispatched" || status === "shipped") {
    return "shipped";
  }
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("fail")) return "failed";

  if (
    status === "partially_dispatched" ||
    status.includes("production") ||
    status.includes("print") ||
    status.includes("process")
  ) {
    return "in_production";
  }

  return "submitted";
}

async function storeProviderOrder(
  id: string,
  providerId: string,
  snapshot: Json
) {
  const db = createAdminClient();

  const { error } = await db
    .from("orders")
    .update({
      creativehub_order_id: providerId,
      creativehub_status: str(snapshot.status) || "submitted",
      creativehub_snapshot: snapshot,
      fulfilment_status: "submitted",
      fulfilment_cost: Number.isFinite(
        amount(snapshot.total_incl_vat)
      )
        ? amount(snapshot.total_incl_vat)
        : null,
      fulfilment_currency: str(snapshot.currency) || null,
      fulfilment_last_error: null,
      submitted_for_fulfilment_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("fulfilment_status", "queued");

  if (error) throw error;
}

export async function POST(request: Request, context: Context) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json(
        { error: "Studio administrator authentication required." },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin");

    if (
      origin &&
      new URL(origin).host !== new URL(request.url).host
    ) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      action?: string;
      confirmation?: string;
    };

    const { db, order, lines, address } = await loadOrder(id);
    const reference = str(order.stripe_checkout_session_id);

    // 1. Supplier quotation, no production charge.
    if (body.action === "quote") {
      const quote = await creativehub("/orders/quote", "POST", {
        items: lines,
        delivery_country_code: str(address.country).toUpperCase(),
      });

      await db
        .from("orders")
        .update({ creativehub_quote_snapshot: quote })
        .eq("id", id);

      return NextResponse.json({ success: true, quote });
    }

    // 2. Refresh production and shipping.
    if (body.action === "refresh") {
      const providerId = str(order.creativehub_order_id);

      if (!providerId) {
        throw new ProviderError(
          "No Creativehub order ID yet.",
          409
        );
      }

      const snapshot = await creativehub(
        `/orders/${encodeURIComponent(providerId)}`
      );

      const tracking =
        snapshot.tracking && typeof snapshot.tracking === "object"
          ? (snapshot.tracking as Json)
          : {};

      const shipments = Array.isArray(snapshot.shipments)
        ? snapshot.shipments
        : [];

      const first =
        shipments.length &&
        shipments[0] &&
        typeof shipments[0] === "object"
          ? (shipments[0] as Json)
          : {};

      const status = trackedStatus(snapshot.status);

      const change: Json = {
        creativehub_status: str(snapshot.status),
        creativehub_snapshot: snapshot,
        fulfilment_status: status,
      };

      const carrier =
        str(tracking.carrier) || str(first.carrier);

      const number =
        str(tracking.tracking_number) ||
        str(first.tracking_number);

      const url =
        safeTrackingUrl(tracking.tracking_url) ||
        safeTrackingUrl(first.tracking_url);

      if (carrier) change.carrier = carrier;
      if (number) change.tracking_number = number;
      if (url) change.tracking_url = url;

      if (status === "shipped") {
        change.shipped_at =
          str(snapshot.dispatched_at) ||
          new Date().toISOString();
      }

      if (status === "delivered") {
        change.delivered_at = new Date().toISOString();
      }

      const { error } = await db
        .from("orders")
        .update(change)
        .eq("id", id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        status,
        carrier,
        tracking_number: number,
        tracking_url: url,
      });
    }

    // 3. Recover a submission where the provider may
    // have accepted the order but our database didn't.
    if (body.action === "recover") {
      if (
        order.fulfilment_status !== "queued" ||
        order.creativehub_order_id
      ) {
        throw new ProviderError(
          "Recovery only applies to an unlinked queued submission.",
          409
        );
      }

      if (!reference) {
        throw new ProviderError(
          "Stripe reference is missing.",
          409
        );
      }

      const list = await creativehub(
        "/orders?limit=200&offset=0"
      );

      const matches = (
        Array.isArray(list.orders) ? list.orders : []
      )
        .filter(
          (entry): entry is Json =>
            entry !== null && typeof entry === "object"
        )
        .filter(
          (entry) => entry.external_reference === reference
        );

      if (matches.length !== 1) {
        return NextResponse.json({
          success: false,
          message:
            matches.length === 0
              ? "No matching order found in the newest 200 Creativehub orders. Keep submission locked and review Creativehub manually."
              : "Multiple matching orders found. Manual investigation required.",
        });
      }

      const providerId =
        str(matches[0].id) ||
        str(matches[0].order_id);

      if (!providerId) {
        throw new ProviderError(
          "Creativehub result has no ID.",
          502
        );
      }

      const detail = await creativehub(
        `/orders/${encodeURIComponent(providerId)}`
      );

      if (detail.external_reference !== reference) {
        throw new ProviderError(
          "Creativehub order reference mismatch.",
          409
        );
      }

      await storeProviderOrder(id, providerId, detail);

      return NextResponse.json({
        success: true,
        providerOrderId: providerId,
      });
    }

    if (body.action !== "submit") {
      return NextResponse.json(
        { error: "Unknown action." },
        { status: 400 }
      );
    }

    // 4. Real production: explicit, guarded and manual.
    if (body.confirmation !== "PLACE PRINT ORDER") {
      throw new ProviderError(
        "Type PLACE PRINT ORDER to confirm a real supplier charge.",
        400
      );
    }

    if (
      process.env.ALLOW_CREATIVEHUB_LIVE_FULFILMENT !== "true" ||
      !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
    ) {
      throw new ProviderError(
        "Production is locked while Stripe is in test mode.",
        409
      );
    }

    if (
      order.status !== "paid" ||
      order.fulfilment_status !== "not_submitted" ||
      order.creativehub_order_id
    ) {
      throw new ProviderError(
        "Only an unsubmitted paid order can be sent to Creativehub.",
        409
      );
    }

    if (!reference.startsWith("cs_live_")) {
      throw new ProviderError(
        "This order came from Stripe test mode.",
        409
      );
    }

    const session = await stripe.checkout.sessions.retrieve(reference);

    if (
      !session.livemode ||
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.metadata?.order_id !== id ||
      session.currency?.toUpperCase() !==
        String(order.currency).toUpperCase() ||
      session.amount_total !==
        Math.round(Number(order.total_amount) * 100)
    ) {
      throw new ProviderError(
        "Stripe payment verification failed; production blocked.",
        409
      );
    }

    // Re-quote immediately before submitting.
    const quote = await creativehub("/orders/quote", "POST", {
      items: lines,
      delivery_country_code: str(address.country).toUpperCase(),
    });

    // Prevent excessive supplier charges.
    const cap = Number(process.env.CREATIVEHUB_MAX_ORDER_COST);
    const capCurrency = str(
      process.env.CREATIVEHUB_MAX_ORDER_CURRENCY
    ).toUpperCase();

    if (
      !Number.isFinite(cap) ||
      cap <= 0 ||
      str(quote.currency).toUpperCase() !== capCurrency ||
      !Number.isFinite(amount(quote.total_incl_vat)) ||
      amount(quote.total_incl_vat) > cap
    ) {
      throw new ProviderError(
        "Creativehub quote exceeds the configured supplier spending limit or uses a different currency.",
        409
      );
    }

    if (
      !str(address.name) ||
      !str(address.line1) ||
      !str(address.city)
    ) {
      throw new ProviderError(
        "Customer delivery address is incomplete.",
        409
      );
    }

    // Claim the order in Supabase before making a real
    // supplier request. Only one request can win.
    const { data: claimed, error: claimError } = await db
      .from("orders")
      .update({
        fulfilment_status: "queued",
        fulfilment_claimed_at: new Date().toISOString(),
        creativehub_quote_snapshot: quote,
        fulfilment_last_error: null,
      })
      .eq("id", id)
      .eq("status", "paid")
      .eq("fulfilment_status", "not_submitted")
      .is("creativehub_order_id", null)
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;

    if (!claimed) {
      throw new ProviderError(
        "This order has already been claimed for fulfilment.",
        409
      );
    }

    try {
      // REAL CHARGE: never automatically retry this request.
      const created = await creativehub("/orders", "POST", {
        items: lines,
        delivery_name: str(address.name),
        delivery_line1: str(address.line1),
        ...(str(address.line2)
          ? { delivery_line2: str(address.line2) }
          : {}),
        delivery_city: str(address.city),
        ...(str(address.postcode)
          ? { delivery_postcode: str(address.postcode) }
          : {}),
        ...(str(address.state)
          ? { delivery_county: str(address.state) }
          : {}),
        delivery_country_code:
          str(address.country).toUpperCase(),
        ...(str(order.customer_email)
          ? { delivery_email: str(order.customer_email) }
          : {}),
        ...(str(address.phone)
          ? { delivery_phone: str(address.phone) }
          : {}),
        external_reference: reference,
      });

      const providerId = str(created.order_id);

      if (!providerId) {
        throw new Error(
          "Creativehub did not return an order ID. Do not retry before checking Creativehub."
        );
      }

      await storeProviderOrder(id, providerId, created);

      return NextResponse.json({
        success: true,
        providerOrderId: providerId,
      });
    } catch (error) {
      // On an uncertain response, keep the order locked.
      // Do not accidentally place the same order twice.
      await db
        .from("orders")
        .update({
          fulfilment_last_error:
            "Submission requires manual verification; do not retry without checking Creativehub.",
        })
        .eq("id", id)
        .eq("fulfilment_status", "queued");

      throw error;
    }
  } catch (error) {
    console.error("Creativehub fulfilment error:", error);

    const status =
      error instanceof ProviderError &&
      error.status >= 400 &&
      error.status < 500
        ? error.status
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Creativehub action failed.",
      },
      { status }
    );
  }
}
