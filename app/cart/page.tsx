"use client";

import Link from "next/link";

import {
  useMemo,
} from "react";

import CartLink from "@/app/components/CartLink";

import {
  useCart,
} from "@/app/components/CartProvider";

import CheckoutButton from "./CheckoutButton";

export default function CartPage() {
  const {
    items,
    setQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const currency =
    items[0]?.currency ??
    "EUR";

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) => {
            if (
              item.currency !==
              currency
            ) {
              return total;
            }

            return (
              total +
              item.price *
                item.quantity
            );
          },
          0
        ),
      [
        items,
        currency,
      ]
    );

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

          <CartLink />
        </div>
      </header>

      {/* TITLE */}

      <section className="border-t border-black/10 px-6 pb-16 pt-20 md:px-10 md:pb-24 md:pt-28">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
            Your selection
          </p>

          <h1 className="mt-5 text-6xl font-medium tracking-[-0.06em] md:text-8xl">
            Cart.
          </h1>
        </div>
      </section>

      {items.length ===
      0 ? (
        <section className="px-6 pb-32 md:px-10">
          <div className="mx-auto max-w-[1600px] border-t border-black/10 py-20">
            <p className="text-lg text-black/45">
              Your cart is
              currently empty.
            </p>

            <Link
              href="/shop"
              className="mt-8 inline-flex bg-black px-6 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-75"
            >
              Explore prints
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-6 pb-32 md:px-10">
          <div className="mx-auto grid max-w-[1600px] gap-16 border-t border-black/10 pt-10 lg:grid-cols-[1fr_420px]">
            {/* ITEMS */}

            <div>
              {items.map(
                (
                  item
                ) => (
                  <article
                    key={
                      item.cartKey
                    }
                    className="grid gap-6 border-b border-black/10 py-8 sm:grid-cols-[160px_1fr]"
                  >
                    <Link
                      href={`/shop/${item.artworkSlug}`}
                      className="block aspect-[4/5] overflow-hidden bg-black/5"
                    >
                      {item.artworkImageUrl ? (
                        <img
                          src={
                            item.artworkImageUrl
                          }
                          alt={
                            item.artworkTitle
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.2em] text-black/25">
                          Artwork
                        </div>
                      )}
                    </Link>

                    <div className="flex flex-col justify-between gap-8">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <Link
                            href={`/shop/${item.artworkSlug}`}
                            className="text-xl font-medium tracking-[-0.025em] transition hover:opacity-50"
                          >
                            {
                              item.artworkTitle
                            }
                          </Link>

                          <p className="mt-3 text-xs text-black/45">
                            {
                              item.variantName
                            }
                          </p>

                          {item.sizeLabel && (
                            <p className="mt-1 text-xs text-black/35">
                              {
                                item.sizeLabel
                              }
                            </p>
                          )}

                          <p className="mt-1 text-xs text-black/35">
                            {item.framed
                              ? item.frameStyle ||
                                "Framed"
                              : "Print only"}
                          </p>
                        </div>

                        <p className="shrink-0 text-sm font-medium">
                          {formatMoney(
                            item.price *
                              item.quantity,
                            item.currency
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-5">
                        <div className="flex items-center border border-black/15">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${item.artworkTitle}`}
                            onClick={() =>
                              setQuantity(
                                item.cartKey,
                                item.quantity -
                                  1
                              )
                            }
                            className="h-10 w-10 text-sm transition hover:bg-black hover:text-white"
                          >
                            −
                          </button>

                          <span className="flex h-10 min-w-10 items-center justify-center border-x border-black/15 px-3 text-xs">
                            {
                              item.quantity
                            }
                          </span>

                          <button
                            type="button"
                            aria-label={`Increase quantity of ${item.artworkTitle}`}
                            onClick={() =>
                              setQuantity(
                                item.cartKey,
                                item.quantity +
                                  1
                              )
                            }
                            className="h-10 w-10 text-sm transition hover:bg-black hover:text-white"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(
                              item.cartKey
                            )
                          }
                          className="text-[9px] uppercase tracking-[0.18em] text-black/35 underline underline-offset-4 transition hover:text-black"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )}

              <button
                type="button"
                onClick={
                  clearCart
                }
                className="mt-8 text-[9px] uppercase tracking-[0.18em] text-black/35 transition hover:text-black"
              >
                Clear cart
              </button>
            </div>

            {/* ORDER SUMMARY */}

            <aside className="lg:sticky lg:top-10 lg:self-start">
              <div className="border border-black/15 p-7">
                <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
                  Order summary
                </p>

                <div className="mt-8 flex items-center justify-between border-b border-black/10 pb-5 text-sm">
                  <span>
                    Subtotal
                  </span>

                  <span>
                    {formatMoney(
                      subtotal,
                      currency
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-black/10 py-5 text-sm">
                  <span>
                    Shipping
                  </span>

                  <span className="text-black/40">
                    Calculated later
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-black/10 py-5 text-sm">
                  <span>
                    Taxes
                  </span>

                  <span className="text-black/40">
                    Calculated later
                  </span>
                </div>

                <div className="flex items-end justify-between gap-6 pt-7">
                  <span className="text-xs uppercase tracking-[0.18em]">
                    Total
                  </span>

                  <span className="text-3xl font-medium tracking-[-0.04em]">
                    {formatMoney(
                      subtotal,
                      currency
                    )}
                  </span>
                </div>

                <p className="mt-3 text-[10px] leading-5 text-black/35">
                  Final shipping
                  and applicable
                  taxes are confirmed
                  during checkout.
                </p>

                <div className="mt-8">
                  <CheckoutButton />
                </div>

                <div className="mt-6 border-t border-black/10 pt-5">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-black/30">
                    Secure payment
                  </p>

                  <p className="mt-2 text-[10px] leading-5 text-black/40">
                    Your order price
                    is verified
                    server-side before
                    Stripe Checkout is
                    created.
                  </p>
                </div>
              </div>

              <Link
                href="/shop"
                className="mt-5 block text-center text-[9px] uppercase tracking-[0.18em] text-black/40 transition hover:text-black"
              >
                Continue collecting
              </Link>
            </aside>
          </div>
        </section>
      )}
    </main>
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

        currency,

        maximumFractionDigits:
          2,
      }
    ).format(
      amount
    );
  } catch {
    return `${currency} ${amount.toFixed(
      2
    )}`;
  }
}