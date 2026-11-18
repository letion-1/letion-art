
"use client";

import { useState } from "react";

type VariantOption = {
  id: string;
  artworkTitle: string;
  name: string;
  sizeLabel: string | null;
  framed: boolean;
  frameStyle: string | null;
  price: number | null;
  currency: string;
  sku: string | null;
};

type QuoteResult = {
  quoteSuccessful: true;

  artwork: {
    title: string;
  };

  variant: {
    name: string;
    size: string | null;
    sku: string | null;
    paper: string | null;
    framed: boolean;
    frameStyle: string | null;
  };

  request: {
    quantity: number;
    country: string;
  };

  website: {
    unitRetailPrice: number | null;
    currency: string;
  };

  creativehub: {
    currency: string | null;
    productionCost: number | null;
    deliveryCost: number | null;
    addonCost: number | null;
    vat: number | null;
    totalExcludingVat: number | null;
    totalIncludingVat: number | null;
    ddpTotal: number | null;
  };

  message: string;
};

function money(
  amount: number | null,
  currency: string | null
) {
  if (amount === null || !currency) {
    return "Not quoted";
  }

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/10 py-3 text-sm">
      <span className="text-black/45">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function QuotesClient({
  variants,
}: {
  variants: VariantOption[];
}) {
  const [variantId, setVariantId] = useState(
    variants[0]?.id ?? ""
  );

  const [quantity, setQuantity] = useState(1);
  const [country, setCountry] = useState("DE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quote, setQuote] =
    useState<QuoteResult | null>(null);

  const selected = variants.find(
    (variant) => variant.id === variantId
  );

  async function getQuote() {
    if (!variantId || loading) return;

    setLoading(true);
    setError(null);
    setQuote(null);

    try {
      const response = await fetch(
        "/api/studio/creativehub/quote",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studioVariantId: variantId,
            quantity,
            country,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.quoteSuccessful) {
        throw new Error(
          result.error ??
            "Creativehub could not calculate the quote."
        );
      }

      setQuote(result as QuoteResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not retrieve the quote."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
      {/* QUOTE CONFIGURATION */}

      <section className="min-w-0 border border-black/10 bg-white/40 p-5 md:p-7">
        <p className="text-[10px] uppercase tracking-[0.22em] text-black/35">
          New quotation
        </p>

        <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
          Print configuration
        </h2>

        <div className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="quote-variant"
              className="block text-xs font-medium"
            >
              Artwork and print variant
            </label>

            <select
              id="quote-variant"
              value={variantId}
              onChange={(event) => {
                setVariantId(event.target.value);
                setQuote(null);
              }}
              disabled={variants.length === 0}
              className="mt-3 w-full min-w-0 border border-black/15 bg-white px-4 py-4 text-sm outline-none focus:border-black"
            >
              {variants.length === 0 && (
                <option value="">
                  No mapped print variants
                </option>
              )}

              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.artworkTitle} / {variant.name}
                  {variant.sizeLabel
                    ? ` / ${variant.sizeLabel}`
                    : ""}
                  {variant.framed
                    ? ` / ${variant.frameStyle || "Framed"}`
                    : " / Print only"}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="border border-black/10 bg-black/[0.025] p-4">
              <p className="text-sm font-medium">
                {selected.artworkTitle}
              </p>

              <p className="mt-2 text-xs text-black/50">
                {selected.name}
                {selected.sizeLabel
                  ? ` · ${selected.sizeLabel}`
                  : ""}
                {selected.framed
                  ? ` · ${selected.frameStyle || "Framed"}`
                  : " · Print only"}
              </p>

              <p className="mt-3 break-all font-mono text-[11px] text-black/40">
                SKU: {selected.sku ?? "Not assigned"}
              </p>

              <p className="mt-3 text-sm">
                Website retail:{" "}
                {money(selected.price, selected.currency)}
              </p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="quote-quantity"
                className="block text-xs font-medium"
              >
                Quantity
              </label>

              <input
                id="quote-quantity"
                type="number"
                min={1}
                max={50}
                step={1}
                value={quantity}
                onChange={(event) => {
                  setQuantity(Number(event.target.value));
                  setQuote(null);
                }}
                className="mt-3 w-full border border-black/15 bg-white px-4 py-4 text-sm outline-none focus:border-black"
              />
            </div>

            <div>
              <label
                htmlFor="quote-country"
                className="block text-xs font-medium"
              >
                Delivery country
              </label>

              <select
                id="quote-country"
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setQuote(null);
                }}
                className="mt-3 w-full border border-black/15 bg-white px-4 py-4 text-sm outline-none focus:border-black"
              >
                <option value="DE">Germany</option>
                <option value="GB">United Kingdom</option>
                <option value="FR">France</option>
                <option value="NL">Netherlands</option>
                <option value="BE">Belgium</option>
                <option value="AT">Austria</option>
                <option value="CH">Switzerland</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="KE">Kenya</option>
              </select>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="border border-red-300 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={getQuote}
            disabled={
              loading ||
              variants.length === 0 ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > 50
            }
            className="flex w-full items-center justify-between bg-black px-6 py-5 text-xs uppercase tracking-[0.18em] text-white transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>
              {loading
                ? "Calculating..."
                : "Get fulfilment quote"}
            </span>

            <span>→</span>
          </button>

          <p className="text-[11px] leading-5 text-black/40">
            This requests a quotation only. No order is
            submitted and no production charge is created.
          </p>
        </div>
      </section>

      {/* QUOTE RESULT */}

      <section className="min-w-0 border border-black/10 p-5 md:p-7">
        <p className="text-[10px] uppercase tracking-[0.22em] text-black/35">
          Creativehub
        </p>

        <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
          Fulfilment costs
        </h2>

        {!quote ? (
          <div className="mt-10 border-t border-black/10 py-10">
            <p className="max-w-xs text-sm leading-7 text-black/40">
              Select a print and delivery country to see
              production costs, shipping and VAT.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-xs text-black/45">
              {quote.artwork.title} · {quote.variant.name}
            </p>

            <p className="mt-2 text-xs text-black/40">
              {quote.request.quantity} print(s) ·
              Delivery to {quote.request.country}
            </p>

            <p className="mt-8 text-[9px] uppercase tracking-[0.2em] text-black/40">
              Total fulfilment quote
            </p>

            <p className="mt-3 break-words text-4xl font-medium tracking-[-0.05em]">
              {money(
                quote.creativehub.totalIncludingVat,
                quote.creativehub.currency
              )}
            </p>

            <div className="mt-8 border-t border-black/10">
              <Detail
                label="Production"
                value={money(
                  quote.creativehub.productionCost,
                  quote.creativehub.currency
                )}
              />

              <Detail
                label="Delivery"
                value={money(
                  quote.creativehub.deliveryCost,
                  quote.creativehub.currency
                )}
              />

              <Detail
                label="Add-ons"
                value={money(
                  quote.creativehub.addonCost,
                  quote.creativehub.currency
                )}
              />

              <Detail
                label="VAT"
                value={money(
                  quote.creativehub.vat,
                  quote.creativehub.currency
                )}
              />

              <Detail
                label="Total excluding VAT"
                value={money(
                  quote.creativehub.totalExcludingVat,
                  quote.creativehub.currency
                )}
              />
            </div>

            <div className="mt-8 border-t border-black/10 pt-6">
              <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">
                Your website
              </p>

              <Detail
                label="Unit retail price"
                value={money(
                  quote.website.unitRetailPrice,
                  quote.website.currency
                )}
              />

              <Detail
                label="Retail total"
                value={
                  quote.website.unitRetailPrice === null
                    ? "Not configured"
                    : money(
                        quote.website.unitRetailPrice *
                          quote.request.quantity,
                        quote.website.currency
                      )
                }
              />
            </div>

            {quote.website.currency.toUpperCase() !==
              (quote.creativehub.currency ?? "").toUpperCase() && (
              <p className="mt-6 text-xs leading-6 text-black/45">
                Your retail price and fulfilment quote use
                different currencies. Currency conversion,
                payment fees and applicable sales taxes
                must be considered before calculating profit.
              </p>
            )}

            <p className="mt-6 border-t border-black/10 pt-5 text-[10px] uppercase tracking-[0.16em] text-black/40">
              Quotation only · No order placed
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
