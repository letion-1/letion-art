
"use client";

import { useState } from "react";

type Quote = {
  currency?: string;
  production_cost?: number | string | null;
  delivery_cost?: number | string | null;
  addon_cost?: number | string | null;
  total_vat?: number | string | null;
  total_incl_vat?: number | string | null;
};

type Props = {
  orderId: string;
  orderNumber: number;
  status: string;
  fulfilmentStatus: string;
  providerOrderId: string | null;
  providerStatus: string | null;
  total: number;
  shipping: number;
  currency: string;
  initialQuote: unknown;
  lastError: string | null;
  productionUnlocked: boolean;
};

type Action = "quote" | "submit" | "refresh" | "recover";

type ApiResult = {
  success?: boolean;
  error?: string;
  message?: string;
  quote?: Quote;
  providerOrderId?: string;
  status?: string;
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
};

function money(value: unknown, currency: string): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Not available";
  }

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(number);
  } catch {
    return `${currency} ${number.toFixed(2)}`;
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
    <div className="border border-black/10 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-black/40">
        {label}
      </p>
      <p className="mt-2 break-words text-lg">{value}</p>
    </div>
  );
}

function savedQuote(value: unknown): Quote | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Quote;
  }

  return null;
}

export default function FulfilmentClient(props: Props) {
  const [quote, setQuote] = useState<Quote | null>(
    savedQuote(props.initialQuote)
  );

  const [fulfilment, setFulfilment] = useState(
    props.fulfilmentStatus
  );

  const [providerId, setProviderId] = useState(
    props.providerOrderId
  );

  const [providerStatus, setProviderStatus] = useState(
    props.providerStatus
  );

  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState(props.lastError ?? "");
  const [message, setMessage] = useState("");

  const [tracking, setTracking] = useState<{
    carrier?: string;
    number?: string;
    url?: string;
  }>({});

  const canSubmit =
    props.productionUnlocked &&
    props.status === "paid" &&
    fulfilment === "not_submitted" &&
    !providerId &&
    quote !== null &&
    confirmation === "PLACE PRINT ORDER";

  async function run(action: Action) {
    if (busy) return;

    setBusy(action);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/studio/orders/${encodeURIComponent(
          props.orderId
        )}/creativehub`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, confirmation }),
        }
      );

      const raw = await response.text();

      let result: ApiResult;

      try {
        result = JSON.parse(raw) as ApiResult;
      } catch {
        throw new Error(
          "Unexpected server response. Check Vercel function logs."
        );
      }

      if (!response.ok || result.success === false) {
        throw new Error(
          result.error ||
            result.message ||
            `Request failed (${response.status}).`
        );
      }

      if (action === "quote") {
        if (!result.quote) {
          throw new Error("Creativehub returned no quote.");
        }

        setQuote(result.quote);
        setMessage(
          "Live quote received. No production order was placed."
        );
      } else if (
        action === "submit" ||
        action === "recover"
      ) {
        if (!result.providerOrderId) {
          throw new Error("No Creativehub order ID returned.");
        }

        setProviderId(result.providerOrderId);
        setFulfilment("submitted");
        setProviderStatus("submitted");
        setConfirmation("");

        setMessage(
          `Creativehub order linked: ${result.providerOrderId}`
        );
      } else if (action === "refresh") {
        setFulfilment(result.status || fulfilment);
        setProviderStatus(result.status || providerStatus);

        setTracking({
          carrier: result.carrier,
          number: result.tracking_number,
          url: result.tracking_url,
        });

        setMessage("Creativehub order status refreshed.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Action failed."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-10 space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Detail
          label="Payment"
          value={props.status.toUpperCase()}
        />

        <Detail
          label="Fulfilment"
          value={fulfilment
            .replaceAll("_", " ")
            .toUpperCase()}
        />

        <Detail
          label="Customer total"
          value={money(props.total, props.currency)}
        />
      </div>

      <section className="border border-black/10 p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
          CREATIVEHUB / THEPRINTSPACE
        </p>

        <h2 className="mt-3 text-2xl">
          Live fulfilment quote
        </h2>

        <p className="mt-3 text-sm leading-6 text-black/55">
          Uses the Creativehub variant IDs saved with this
          order and the customer's delivery country.
          Requesting a quote never sends an order
          to production.
        </p>

        <button
          type="button"
          onClick={() => run("quote")}
          disabled={busy !== null}
          className="mt-5 bg-black px-5 py-3 text-xs uppercase tracking-wider text-white disabled:opacity-40"
        >
          {busy === "quote"
            ? "Calculating..."
            : "Get live quote"}
        </button>

        {quote && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Detail
              label="Production"
              value={money(
                quote.production_cost,
                quote.currency || "GBP"
              )}
            />

            <Detail
              label="Supplier delivery"
              value={money(
                quote.delivery_cost,
                quote.currency || "GBP"
              )}
            />

            <Detail
              label="Supplier VAT"
              value={money(
                quote.total_vat,
                quote.currency || "GBP"
              )}
            />

            <Detail
              label="Supplier total"
              value={money(
                quote.total_incl_vat,
                quote.currency || "GBP"
              )}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-black/50">
          Shipping charged to customer:{" "}
          {money(props.shipping, props.currency)}.
          Supplier and retail currencies can differ.
        </p>
      </section>

      <section className="border border-black/10 p-6 md:p-8">
        <h2 className="text-2xl">Review draft and approve production</h2>
        <p className="mt-3 text-sm leading-6 text-black/55">
          Paid orders are held as drafts in LETION ART Studio, not in Creativehub.
          No production or supplier charge happens until you approve below.
          Verify the customer address and exact print options on the order details page first.
        </p>

        {providerId ? (
          <div className="mt-5 space-y-3">
            <p className="break-all text-sm">
              Creativehub order: {providerId}
            </p>

            <p className="text-sm">
              Supplier status: {providerStatus || fulfilment}
            </p>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("refresh")}
              className="border border-black px-5 py-3 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              {busy === "refresh"
                ? "Refreshing..."
                : "Refresh production status"}
            </button>
          </div>
        ) : fulfilment === "queued" ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-amber-800">
              This order is locked after a submission
              attempt. Do not send a second production
              order without checking whether Creativehub
              accepted the first.
            </p>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("recover")}
              className="border border-black px-5 py-3 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Find existing Creativehub order
            </button>
          </div>
        ) : !props.productionUnlocked ? (
          <p className="mt-4 text-sm leading-6 text-black/60">
            Real production is locked while Stripe is
            in test mode. You can still request a
            safe supplier quote.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-black/60">
              This submits a real print order and
              charges your Creativehub account.
            </p>

            <label
              htmlFor="production-confirm"
              className="block text-xs uppercase tracking-wider"
            >
              Type PLACE PRINT ORDER to confirm
            </label>

            <input
              id="production-confirm"
              type="text"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value)
              }
              placeholder="PLACE PRINT ORDER"
              className="w-full border border-black/20 px-4 py-3 text-sm"
            />

            <button
              type="button"
              disabled={!canSubmit || busy !== null}
              onClick={() => run("submit")}
              className="bg-black px-5 py-4 text-xs uppercase tracking-wider text-white disabled:opacity-35"
            >
              {busy === "submit"
                ? "Submitting..."
                : "Submit approved production order"}
            </button>
          </div>
        )}
      </section>

      {(tracking.carrier ||
        tracking.number ||
        tracking.url) && (
        <section className="border border-black/10 p-6 md:p-8">
          <h2 className="text-2xl">
            Shipment tracking
          </h2>

          {tracking.carrier && (
            <p className="mt-3 text-sm">
              Carrier: {tracking.carrier}
            </p>
          )}

          {tracking.number && (
            <p className="mt-2 text-sm">
              Tracking: {tracking.number}
            </p>
          )}

          {tracking.url && (
            <a
              href={tracking.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm underline"
            >
              View carrier tracking
            </a>
          )}
        </section>
      )}

      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
