"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import {
  useCart,
} from "@/app/components/CartProvider";

export type ShopPrintVariant = {
  id: string;

  name: string;

  size_label:
    | string
    | null;

  width_mm:
    | number
    | null;

  height_mm:
    | number
    | null;

  price:
    | number
    | null;

  currency: string;

  paper:
    | string
    | null;

  finish:
    | string
    | null;

  framed: boolean;

  frame_style:
    | string
    | null;

  framing_details:
    | string
    | null;

  active: boolean;
};

type ArtworkForCart = {
  id: string;
  slug: string;
  title: string;

  image_url:
    | string
    | null;
};

export default function PrintConfigurator({
  artwork,
  variants,
}: {
  artwork:
    ArtworkForCart;

  variants:
    ShopPrintVariant[];
}) {
  const {
    addItem,
  } = useCart();

  const [
    added,
    setAdded,
  ] = useState(false);

  const activeVariants =
    useMemo(
      () =>
        variants.filter(
          (
            variant
          ) =>
            variant.active
        ),
      [variants]
    );

  const sizes =
    useMemo(() => {
      const values =
        activeVariants
          .map(
            (
              variant
            ) =>
              variant.size_label
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          );

      return Array.from(
        new Set(
          values
        )
      );
    }, [
      activeVariants,
    ]);

  const [
    selectedSize,
    setSelectedSize,
  ] = useState<
    string | null
  >(
    sizes[0] ??
      activeVariants[0]
        ?.size_label ??
      null
  );

  const variantsForSize =
    useMemo(() => {
      if (
        !selectedSize
      ) {
        return activeVariants;
      }

      return activeVariants.filter(
        (
          variant
        ) =>
          variant.size_label ===
          selectedSize
      );
    }, [
      activeVariants,
      selectedSize,
    ]);

  const [
    selectedVariantId,
    setSelectedVariantId,
  ] = useState<
    string | null
  >(
    variantsForSize[0]
      ?.id ??
      activeVariants[0]
        ?.id ??
      null
  );

  const selectedVariant =
    useMemo(() => {
      const direct =
        activeVariants.find(
          (
            variant
          ) =>
            variant.id ===
            selectedVariantId
        );

      if (
        direct &&
        (
          !selectedSize ||
          direct.size_label ===
            selectedSize
        )
      ) {
        return direct;
      }

      return (
        variantsForSize[0] ??
        activeVariants[0] ??
        null
      );
    }, [
      activeVariants,
      selectedSize,
      selectedVariantId,
      variantsForSize,
    ]);

  function chooseSize(
    size: string
  ) {
    setSelectedSize(
      size
    );

    const first =
      activeVariants.find(
        (
          variant
        ) =>
          variant.size_label ===
          size
      );

    setSelectedVariantId(
      first?.id ??
        null
    );

    setAdded(
      false
    );
  }

  function chooseVariant(
    id: string
  ) {
    setSelectedVariantId(
      id
    );

    setAdded(
      false
    );
  }

  function handleAddToCart() {
    if (
      !selectedVariant ||
      selectedVariant.price ===
        null
    ) {
      return;
    }

    addItem({
      artworkId:
        artwork.id,

      artworkSlug:
        artwork.slug,

      artworkTitle:
        artwork.title,

      artworkImageUrl:
        artwork.image_url,

      variantId:
        selectedVariant.id,

      variantName:
        selectedVariant.name,

      sizeLabel:
        selectedVariant.size_label,

      framed:
        selectedVariant.framed,

      frameStyle:
        selectedVariant.frame_style,

      price:
        selectedVariant.price,

      currency:
        selectedVariant.currency,
    });

    setAdded(
      true
    );
  }

  if (
    activeVariants.length ===
    0
  ) {
    return (
      <div className="border border-dashed border-black/15 p-8">
        <p className="text-sm leading-6 text-black/40">
          Print options are
          currently being
          prepared.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* SIZE */}

      {sizes.length >
        0 && (
        <section>
          <div className="flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
              Select size
            </p>

            {selectedVariant
              ?.width_mm &&
              selectedVariant
                ?.height_mm && (
              <p className="text-[9px] text-black/35">
                {
                  selectedVariant.width_mm
                }{" "}
                ×{" "}
                {
                  selectedVariant.height_mm
                }{" "}
                mm
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {sizes.map(
              (
                size
              ) => {
                const active =
                  selectedSize ===
                  size;

                return (
                  <button
                    key={
                      size
                    }
                    type="button"
                    onClick={() =>
                      chooseSize(
                        size
                      )
                    }
                    className={`border px-5 py-3 text-xs transition ${
                      active
                        ? "border-black bg-black text-white"
                        : "border-black/15 hover:border-black"
                    }`}
                  >
                    {
                      size
                    }
                  </button>
                );
              }
            )}
          </div>
        </section>
      )}

      {/* PRESENTATION */}

      <section className="mt-8 border-t border-black/10 pt-8">
        <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
          Presentation
        </p>

        <div className="mt-4 space-y-3">
          {variantsForSize.map(
            (
              variant
            ) => {
              const active =
                selectedVariant
                  ?.id ===
                variant.id;

              return (
                <button
                  key={
                    variant.id
                  }
                  type="button"
                  onClick={() =>
                    chooseVariant(
                      variant.id
                    )
                  }
                  className={`w-full border p-5 text-left transition ${
                    active
                      ? "border-black bg-black text-white"
                      : "border-black/15 hover:border-black"
                  }`}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <p className="font-medium">
                        {variant.framed
                          ? variant.frame_style ||
                            "Framed"
                          : "Print only"}
                      </p>

                      <p
                        className={`mt-2 text-xs leading-5 ${
                          active
                            ? "text-white/60"
                            : "text-black/45"
                        }`}
                      >
                        {
                          variant.name
                        }
                      </p>
                    </div>

                    {variant.price !==
                      null && (
                      <p className="shrink-0 text-sm font-medium">
                        {formatMoney(
                          variant.price,
                          variant.currency
                        )}
                      </p>
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* DETAILS */}

      {selectedVariant && (
        <section className="mt-8 border-t border-black/10 pt-8">
          <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
            Details
          </p>

          <div className="mt-5 space-y-4">
            {selectedVariant.paper && (
              <DetailRow
                label="Paper"
                value={
                  selectedVariant.paper
                }
              />
            )}

            {selectedVariant.finish && (
              <DetailRow
                label="Print"
                value={
                  selectedVariant.finish
                }
              />
            )}

            <DetailRow
              label="Presentation"
              value={
                selectedVariant.framed
                  ? selectedVariant.frame_style ||
                    "Framed"
                  : "Print only"
              }
            />

            {selectedVariant.framed &&
              selectedVariant.framing_details && (
                <DetailRow
                  label="Frame details"
                  value={
                    selectedVariant.framing_details
                  }
                />
              )}
          </div>
        </section>
      )}

      {/* PRICE + CART */}

      {selectedVariant && (
        <section className="mt-8 border-t border-black/15 pt-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
                Price
              </p>

              <p className="mt-3 text-3xl font-medium tracking-[-0.04em]">
                {selectedVariant.price !==
                null
                  ? formatMoney(
                      selectedVariant.price,
                      selectedVariant.currency
                    )
                  : "Price on request"}
              </p>
            </div>

            <p className="max-w-[180px] text-right text-[9px] leading-5 text-black/35">
              Shipping calculated
              separately at
              checkout.
            </p>
          </div>

          <button
            type="button"
            disabled={
              selectedVariant.price ===
              null
            }
            onClick={
              handleAddToCart
            }
            className="mt-7 flex w-full items-center justify-between bg-black px-6 py-5 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span>
              {added
                ? "Added to cart"
                : "Add to cart"}
            </span>

            <span>
              {added
                ? "✓"
                : "+"}
            </span>
          </button>

          {added && (
            <Link
              href="/cart"
              className="mt-3 flex w-full items-center justify-center border border-black px-6 py-4 text-[10px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
            >
              View cart
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-8 border-b border-black/10 pb-4">
      <span className="text-xs text-black/40">
        {label}
      </span>

      <span className="max-w-[65%] text-right text-xs">
        {value}
      </span>
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