import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// No supplier API call is made here. This endpoint only checks Stripe and
// updates the payment status in Supabase after verifying the existing order.
export async function POST(request: Request) {
  try {
    const auth = await createClient();
    const { data: { user }, error: userError } = await auth.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Sign in to Studio first." }, { status: 401 });
    }

    const db = createAdminClient();
    const { data: admin, error: adminError } = await db
      .from("studio_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError || !admin) {
      return NextResponse.json({ error: "Studio administrator access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const orderId = body?.orderId;
    if (typeof orderId !== "string" || !uuidPattern.test(orderId)) {
      return NextResponse.json({ error: "Valid order ID required." }, { status: 400 });
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .select(`
        id, order_number, status, currency, total_amount,
        shipping_address, customer_name, customer_email,
        stripe_checkout_session_id
      `)
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (order.status === "paid") {
      return NextResponse.json({ success: true, message: "Order already marked paid.", orderNumber: order.order_number });
    }
    if (order.status !== "pending" && order.status !== "payment_failed") {
      return NextResponse.json({ error: `Order is ${order.status}; it cannot be reconciled.` }, { status: 409 });
    }

    const sessionId = order.stripe_checkout_session_id;
    if (!sessionId || !/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      return NextResponse.json({ error: "No valid Stripe Checkout Session is associated with this order." }, { status: 409 });
    }

    // Read Stripe's authoritative payment state. Never trust the browser's
    // success URL or a client-provided amount as proof of payment.
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      session.id !== sessionId ||
      session.metadata?.order_id !== order.id ||
      session.mode !== "payment"
    ) {
      return NextResponse.json({ error: "Stripe session does not belong to this order." }, { status: 409 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        error: `Stripe has not confirmed payment (status: ${session.payment_status}).`,
      }, { status: 409 });
    }

    const expectedAmount = Math.round(Number(order.total_amount) * 100);
    if (
      !Number.isSafeInteger(expectedAmount) || expectedAmount < 1 ||
      session.amount_total !== expectedAmount ||
      session.currency?.toLowerCase() !== String(order.currency).toLowerCase()
    ) {
      return NextResponse.json({ error: "Stripe amount or currency does not match this order." }, { status: 409 });
    }

    const paymentIntent = typeof session.payment_intent === "string"
      ? session.payment_intent : session.payment_intent?.id ?? null;
    const savedAddress = order.shipping_address as { name?: string | null } | null;
    const update: Record<string, unknown> = {
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent,
      customer_email: session.customer_details?.email ?? session.customer_email ?? order.customer_email ?? null,
      customer_name: session.customer_details?.name ?? savedAddress?.name ?? order.customer_name ?? null,
    };
    if (session.customer_details?.address) {
      update.billing_address = session.customer_details.address;
    }

    // CAS prevents concurrent webhook/admin reconciliation from changing a
    // paid/refunded order twice. Shipping, order items and fulfillment are intact.
    const { data: updated, error: updateError } = await db
      .from("orders")
      .update(update)
      .eq("id", order.id)
      .eq("status", order.status)
      .select("order_number,status,customer_email,fulfilment_status")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      const { data: current } = await db
        .from("orders").select("status").eq("id", order.id).maybeSingle();
      if (current?.status === "paid") {
        return NextResponse.json({ success: true, message: "Order was already reconciled by the webhook.", orderNumber: order.order_number });
      }
      return NextResponse.json({ error: "Order changed during reconciliation. Refresh and check." }, { status: 409 });
    }

    console.log("ADMIN RECONCILED STRIPE PAYMENT:", { orderNumber: updated.order_number, status: updated.status });
    return NextResponse.json({ success: true, message: "Payment verified with Stripe and Studio order updated.", order: updated });
  } catch (error) {
    console.error("Studio payment reconciliation failed:", error);
    return NextResponse.json({ error: "Payment verification failed. Review Vercel function logs." }, { status: 500 });
  }
}
