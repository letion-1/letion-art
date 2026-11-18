"use client";

import Link from "next/link";

import {
  useEffect,
  useRef,
} from "react";

import {
  useCart,
} from "@/app/components/CartProvider";

type Props = {
  paid: boolean;

  orderNumber:
    | number
    | string
    | null;

  customerEmail:
    | string
    | null;

  amount:
    | number
    | null;

  currency:
    | string
    | null;
};

export default function CheckoutSuccessClient({
  paid,
  orderNumber,
  customerEmail,
  amount,
  currency,
}: Props) {
  const {
    clearCart,
  } = useCart();

  const cleared =
    useRef(false);

  useEffect(() => {
    if (
      !paid ||
      cleared.current
    ) {
      return;
    }

    cleared.current =
      true;

    clearCart();
  }, [
    paid,
    clearCart,
  ]);

  return (
    <main className="min-h-screen text-[#111111]">
      {/* HEADER */}

      <header className="px-6 py-7 md:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.25em]"
          >
            LETION KETIENYA
          </Link>

          <Link
            href="/shop"
            className="text-[10px] uppercase tracking-[0.2em] text-black/40 transition hover:text-black"
          >
            Prints
          </Link>
        </div>
      </header>

      {/* CONFIRMATION */}

      <section className="border-t border-black/10 px-6 py-20 md:px-10 md:py-32">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/35">
            {paid
              ? "Order confirmed"
              : "Order received"}
          </p>

          <h1 className="mt-6 max-w-[850px] text-6xl font-medium tracking-[-0.065em] md:text-8xl">
            {paid
              ? "Thank you."
              : "Almost there."}
          </h1>

          <p className="mt-8 max-w-[620px] text-base leading-8 text-black/50">
            {paid
              ? "Your payment has been confirmed and your order is now in the studio system."
              : "Your checkout was received, but the payment confirmation is still being processed."}
          </p>

          {/* ORDER DETAILS */}

          <div className="mt-16 grid border-y border-black/10 md:grid-cols-3">
            <Detail
              label="Order"
              value={
                orderNumber
                  ? `#${orderNumber}`
                  : "Processing"
              }
            />

            <Detail
              label="Total"
              value={
                amount !== null &&
                currency
                  ? formatMoney(
                      amount,
                      currency
                    )
                  : "Processing"
              }
            />

            <Detail
              label="Email"
              value={
                customerEmail ??
                "Processing"
              }
            />
          </div>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-black px-7 py-5 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-75"
            >
              Continue browsing
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center border border-black/15 px-7 py-5 text-xs uppercase tracking-[0.2em] transition hover:bg-black hover:text-white"
            >
              Return home
            </Link>
          </div>
        </div>
      </section>

      {/* AFTER PURCHASE */}

      <section className="bg-[#111111] px-6 py-24 text-white md:px-10 md:py-32">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
            What happens next
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            <NextStep
              number="01"
              title="Order confirmation"
              text="Your order is recorded and linked to the payment received through Stripe."
            />

            <NextStep
              number="02"
              title="Production"
              text="The selected print and framing configuration will move into the fulfilment process."
            />

            <NextStep
              number="03"
              title="Delivery"
              text="Shipping and fulfilment updates will follow as the artwork moves through production."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-black/10 py-7 last:border-b-0 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0">
      <p className="text-[9px] uppercase tracking-[0.2em] text-black/30">
        {label}
      </p>

      <p className="mt-3 break-words text-sm">
        {value}
      </p>
    </div>
  );
}

function NextStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="border-t border-white/15 pt-6">
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
        {number}
      </p>

      <h2 className="mt-5 text-xl font-medium">
        {title}
      </h2>

      <p className="mt-4 max-w-sm text-sm leading-7 text-white/45">
        {text}
      </p>
    </div>
  );
}

function formatMoney(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-IE",
      {
        style:
          "currency",

        currency:
          currency.toUpperCase(),

        maximumFractionDigits:
          2,
      }
    ).format(
      amount
    );
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(
      2
    )}`;
  }
}