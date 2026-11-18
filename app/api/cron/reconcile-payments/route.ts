
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = createAdminClient();

  const { data: orders, error: lookupError } = await db
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      currency,
      total_amount,
      shipping_address,
      customer_name,
      customer_email,
      stripe_checkout_session_id
    `)
    .in("status", ["pending", "payment_failed"])
    .not("stripe_checkout_session_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (lookupError) {
    console.error("Payment recovery lookup failed:", lookupError);

    return NextResponse.json(
      { error: "Could not load orders." },
      { status: 500 }
    );
  }

  const results: Array<{
    orderNumber: number;
    result: string;
  }> = [];

  for (const order of orders ?? []) {
    try {
      const sessionId = order.stripe_checkout_session_id;

      if (
        !sessionId ||
        !/^cs_(test|live)_/.test(sessionId)
      ) {
        throw new Error("Invalid Checkout Session ID.");
      }

      // Retrieve the actual payment state directly from Stripe.
      const session =
        await stripe.checkout.sessions.retrieve(sessionId);

      if (
        session.id !== sessionId ||
        session.metadata?.order_id !== order.id ||
        session.mode !== "payment"
      ) {
        throw new Error("Session does not belong to this order.");
      }

      if (session.payment_status !== "paid") {
        results.push({
          orderNumber: Number(order.order_number),
          result: "Payment not settled",
        });
        continue;
      }

      const expectedAmount =
        Math.round(Number(order.total_amount) * 100);

      const expectedCurrency =
        String(order.currency).toLowerCase();

      if (
        session.amount_total !== expectedAmount ||
        session.currency?.toLowerCase() !== expectedCurrency
      ) {
        throw new Error("Stripe amount or currency mismatch.");
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      const savedAddress = order.shipping_address as
        | { name?: string | null }
        | null;

      const update: Record<string, unknown> = {
        status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        customer_email:
          session.customer_details?.email ??
          session.customer_email ??
          order.customer_email ??
          null,
        customer_name:
          session.customer_details?.name ??
          savedAddress?.name ??
          order.customer_name ??
          null,
        paid_at: new Date().toISOString(),
      };

      if (session.customer_details?.address) {
        update.billing_address = session.customer_details.address;
      }

      // Preserve customer shipping amount, delivery address,
      // total amount and Creativehub fulfilment status.
      const { data: updated, error: updateError } = await db
        .from("orders")
        .update(update)
        .eq("id", order.id)
        .eq("status", order.status)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      results.push({
        orderNumber: Number(order.order_number),
        result: updated ? "Recovered as paid" : "Already processed",
      });
    } catch (error) {
      console.error(
        `Order #${order.order_number} recovery failed:`,
        error
      );

      results.push({
        orderNumber: Number(order.order_number),
        result: "Recovery failed; review server logs",
      });
    }
  }

  return NextResponse.json({
    success: true,
    checked: results.length,
    results,
  });
}
