
import { after, NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is missing.");

    return NextResponse.json(
      { error: "Webhook configuration missing." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret
    );
  } catch (error) {
    console.error("STRIPE SIGNATURE ERROR:", error);

    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 }
    );
  }

  console.log("STRIPE EVENT RECEIVED:", {
    id: event.id,
    type: event.type,
  });

  // Acknowledge promptly. Processing runs after the response.
  after(async () => {
    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await handlePaidSession(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case "checkout.session.async_payment_failed":
          await handleFailedSession(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        default:
          break;
      }
    } catch (error) {
      console.error("STRIPE BACKGROUND PROCESSING ERROR:", {
        eventId: event.id,
        eventType: event.type,
        error,
      });
    }
  });

  return NextResponse.json({ received: true });
}

function getPaymentIntentId(
  session: Stripe.Checkout.Session
): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}

async function handlePaidSession(
  session: Stripe.Checkout.Session
) {
  if (session.payment_status !== "paid") {
    console.log("Payment not settled yet:", session.id);
    return;
  }

  if (session.mode !== "payment") {
    throw new Error("Unexpected Checkout Session mode.");
  }

  const orderId = session.metadata?.order_id;

  if (!orderId) {
    throw new Error("Stripe session missing order_id metadata.");
  }

  const db = createAdminClient();

  const { data: order, error: lookupError } = await db
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      currency,
      total_amount,
      shipping_address,
      customer_email,
      customer_name,
      stripe_checkout_session_id
    `)
    .eq("id", orderId)
    .single();

  if (lookupError || !order) {
    throw lookupError ?? new Error("Order not found.");
  }

  // Reject a payment belonging to another order/session.
  if (order.stripe_checkout_session_id !== session.id) {
    throw new Error(
      `Checkout Session mismatch for order #${order.order_number}.`
    );
  }

  // Never turn a refunded or cancelled order back into paid.
  if (order.status === "paid") {
    console.log("Order already paid:", order.order_number);
    return;
  }

  if (
    order.status !== "pending" &&
    order.status !== "payment_failed"
  ) {
    throw new Error(
      `Cannot mark order with status ${order.status} as paid.`
    );
  }

  const expectedCurrency = String(order.currency).toLowerCase();
  const expectedAmount = Math.round(
    Number(order.total_amount) * 100
  );

  if (session.currency?.toLowerCase() !== expectedCurrency) {
    throw new Error("Stripe currency does not match the order.");
  }

  if (session.amount_total !== expectedAmount) {
    throw new Error(
      `Order amount mismatch. Expected ${expectedAmount} cents; ` +
      `Stripe reported ${session.amount_total}.`
    );
  }

  const savedAddress = order.shipping_address as {
    name?: string | null;
  } | null;

  const customerEmail =
    session.customer_details?.email ??
    session.customer_email ??
    order.customer_email ??
    null;

  const customerName =
    session.customer_details?.name ??
    savedAddress?.name ??
    order.customer_name ??
    null;

  const update: Record<string, unknown> = {
    status: "paid",
    stripe_payment_intent_id: getPaymentIntentId(session),
    stripe_checkout_session_id: session.id,
    customer_email: customerEmail,
    customer_name: customerName,
    paid_at: new Date().toISOString(),
  };

  if (session.customer_details?.address) {
    update.billing_address = session.customer_details.address;
  }

  // Deliberately DO NOT update:
  // shipping_address, shipping_amount, subtotal, total_amount
  // or fulfilment_status.

  const { data: updated, error: updateError } = await db
    .from("orders")
    .update(update)
    .eq("id", order.id)
    .in("status", ["pending", "payment_failed"])
    .select(`
      id,
      order_number,
      status,
      shipping_amount,
      total_amount,
      fulfilment_status,
      stripe_payment_intent_id
    `)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updated) {
    console.log(
      "Order was already processed or changed:",
      order.order_number
    );
    return;
  }

  console.log("ORDER MARKED PAID:", {
    orderNumber: updated.order_number,
    status: updated.status,
    shipping: updated.shipping_amount,
    total: updated.total_amount,
    fulfilment: updated.fulfilment_status,
    paymentIntent: updated.stripe_payment_intent_id,
  });
}

async function handleFailedSession(
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    return;
  }

  const db = createAdminClient();

  const { data: order, error: lookupError } = await db
    .from("orders")
    .select("id, order_number, status, stripe_checkout_session_id")
    .eq("id", orderId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!order || order.stripe_checkout_session_id !== session.id) {
    throw new Error("Failed-payment session does not match order.");
  }

  // A late failed-payment event must never undo a paid order.
  if (order.status !== "pending") {
    return;
  }

  const { error } = await db
    .from("orders")
    .update({ status: "payment_failed" })
    .eq("id", order.id)
    .eq("status", "pending");

  if (error) {
    throw error;
  }

  console.log("ORDER PAYMENT FAILED:", order.order_number);
}
