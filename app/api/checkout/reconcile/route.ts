
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Local sandbox recovery only.
    if (
      process.env.NODE_ENV !== "development" ||
      !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
    ) {
      return NextResponse.json(
        { error: "Sandbox recovery is disabled." },
        { status: 403 }
      );
    }

    // Verify Studio administrator.
    const auth = await createClient();

    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to Studio first." },
        { status: 401 }
      );
    }

    const { data: admin, error: adminError } = await auth
      .from("studio_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "Studio administrator access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const orderNumber = body?.orderNumber;

    if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) {
      return NextResponse.json(
        { error: "Valid orderNumber required." },
        { status: 400 }
      );
    }

    const db = createAdminClient();

    const { data: order, error: orderError } = await db
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
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        message: "Order is already paid.",
        orderNumber,
      });
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: `Order status is ${order.status}.` },
        { status: 409 }
      );
    }

    const sessionId = order.stripe_checkout_session_id;

    if (!sessionId || !sessionId.startsWith("cs_test_")) {
      return NextResponse.json(
        { error: "Order has no sandbox Checkout Session." },
        { status: 409 }
      );
    }

    // Retrieve the real payment state from Stripe.
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.id !== sessionId ||
      session.metadata?.order_id !== order.id ||
      session.mode !== "payment"
    ) {
      return NextResponse.json(
        { error: "Stripe session does not match this order." },
        { status: 409 }
      );
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        success: false,
        message: "Stripe has not confirmed payment.",
        paymentStatus: session.payment_status,
      });
    }

    const expectedAmount = Math.round(
      Number(order.total_amount) * 100
    );

    if (
      session.amount_total !== expectedAmount ||
      session.currency?.toUpperCase() !==
        String(order.currency).toUpperCase()
    ) {
      return NextResponse.json(
        { error: "Stripe amount or currency mismatch." },
        { status: 409 }
      );
    }

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const savedAddress = order.shipping_address as {
      name?: string;
    } | null;

    const update: Record<string, unknown> = {
      status: "paid",
      stripe_payment_intent_id: paymentIntent,
      customer_email:
        session.customer_details?.email ??
        session.customer_email ??
        order.customer_email,
      customer_name:
        session.customer_details?.name ??
        savedAddress?.name ??
        order.customer_name,
      paid_at: new Date().toISOString(),
    };

    if (session.customer_details?.address) {
      update.billing_address = session.customer_details.address;
    }

    // Preserve the existing shipping address and shipping charge.
    // Only a still-pending order may be updated.
    const { data: updated, error: updateError } = await db
      .from("orders")
      .update(update)
      .eq("id", order.id)
      .eq("status", "pending")
      .select(`
        order_number,
        status,
        subtotal,
        shipping_amount,
        total_amount,
        stripe_payment_intent_id,
        paid_at,
        fulfilment_status
      `)
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Order changed during reconciliation. Refresh and check." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Stripe payment verified. Order reconciled.",
      order: updated,
    });
  } catch (error) {
    console.error("Payment reconciliation failed:", error);

    return NextResponse.json(
      { error: "Payment reconciliation failed. Check the server terminal." },
      { status: 500 }
    );
  }
}
 