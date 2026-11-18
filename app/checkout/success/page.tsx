import Link from "next/link";

import {
  stripe,
} from "@/lib/stripe";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import CheckoutSuccessClient from "./CheckoutSuccessClient";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    session_id?:
      | string
      | string[];
  }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const rawSessionId =
    params.session_id;

  const sessionId =
    typeof rawSessionId ===
    "string"
      ? rawSessionId
      : null;

  /*
   * Somebody manually visiting
   * /checkout/success without a
   * Stripe session should not see
   * a fake order confirmation.
   */

  if (!sessionId) {
    return (
      <InvalidCheckout />
    );
  }

  try {
    /*
     * Verify the session directly
     * with Stripe.
     */

    const session =
      await stripe.checkout.sessions.retrieve(
        sessionId
      );

    const orderId =
      session.metadata
        ?.order_id;

    if (!orderId) {
      return (
        <InvalidCheckout />
      );
    }

    /*
     * Verify that the Stripe
     * session belongs to an order
     * in our database.
     */

    const supabase =
      createAdminClient();

    const {
      data:
        order,

      error:
        orderError,
    } = await supabase
      .from(
        "orders"
      )
      .select(`
        id,
        order_number,
        status,
        currency,
        total_amount,
        customer_email,
        stripe_checkout_session_id
      `)
      .eq(
        "id",
        orderId
      )
      .eq(
        "stripe_checkout_session_id",
        session.id
      )
      .single();

    if (
      orderError ||
      !order
    ) {
      console.error(
        "Success page order lookup failed:",
        orderError
      );

      return (
        <InvalidCheckout />
      );
    }

    /*
     * Stripe is the authoritative
     * payment confirmation here.
     *
     * The webhook should also mark
     * the Supabase order paid.
     */

    const paid =
      session.payment_status ===
      "paid";

    /*
     * Stripe amount_total is in
     * minor units:
     *
     * 35000 -> 350.00 EUR
     */

    const amount =
      session.amount_total !==
      null
        ? session.amount_total /
          100
        : order.total_amount !==
            null
          ? Number(
              order.total_amount
            )
          : null;

    const currency =
      session.currency ??
      order.currency ??
      null;

    const customerEmail =
      session
        .customer_details
        ?.email ??
      session.customer_email ??
      order.customer_email ??
      null;

    return (
      <CheckoutSuccessClient
        paid={
          paid
        }
        orderNumber={
          order.order_number
        }
        customerEmail={
          customerEmail
        }
        amount={
          amount
        }
        currency={
          currency
        }
      />
    );
  } catch (error) {
    console.error(
      "Could not verify Stripe Checkout session:",
      error
    );

    return (
      <InvalidCheckout />
    );
  }
}

function InvalidCheckout() {
  return (
    <main className="min-h-screen px-6 py-16 text-[#111111] md:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-[900px] items-center justify-center">
        <div className="w-full border border-black/10 p-8 text-center md:p-14">
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/35">
            Checkout
          </p>

          <h1 className="mt-6 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
            We couldn&apos;t verify this order.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-black/50">
            This confirmation page requires a valid Stripe Checkout session.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/shop"
              className="bg-black px-6 py-4 text-xs uppercase tracking-[0.2em] text-white"
            >
              Return to prints
            </Link>

            <Link
              href="/cart"
              className="border border-black/15 px-6 py-4 text-xs uppercase tracking-[0.2em]"
            >
              View cart
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}