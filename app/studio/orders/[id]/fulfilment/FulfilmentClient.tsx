
"use client";

import { useState } from "react";

type Quote = {
  currency?: string;
  production_cost?: number | string;
  delivery_cost?: number | string;
  addon_cost?: number | string | null;
  total_vat?: number | string;
  total_incl_vat?: number | string;
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

function format(value: unknown, currency: string) {
  const number = Number(value);

  if (value == null || !Number.isFinite(number)) {
    return "Not available";
  }

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(number);
  } catch {
    return `${currency} ${number.toFixed(2)}`;
  }
}

async function parse(response: Response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    throw new Error(
      "Server returned an unexpected response. Check Vercel logs."
    );
  }
}

export default function FulfilmentClient(props: Props) {
  const [quote, setQuote] = useState<Quote | null>(
    props.initialQuote &&
      typeof props.initialQuote === "object"
      ? (props.initialQuote as Quote)
      : null
  );

  const [status, setStatus] = useState(props.fulfilmentStatus);
  const [providerId, setProviderId] = useState(
    props.providerOrderId
  );
  const [providerStatus, setProviderStatus] = useState(
    props.providerStatus
  );

  const [tracking, setTracking] = useState<{
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
  } | null>(null);

  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(props.lastError || "");
  const [message, setMessage] = useState("");

  async function run(
    action: "quote" | "submit" | "refresh" | "recover"
  ) {
    if (busy) return;

    setBusy(action);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/studio/orders/${props.orderId}/creativehub`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            confirmation,
          }),
        }
      );

      const result = await parse(response);

      if (!response.ok || result.success === false) {
        throw new Error(
          result.error ||
            result.message ||
            `Request failed (${response.status}).`
        );
      }

      if (action === "quote") {
        setQuote(result.quote);
        setMessage(
          "Live Creativehub quote received. Nothing was sent to production."
        );
      }

      if (action === "submit" || action === "recover") {
        setStatus("submitted");
        setProviderId(result.providerOrderId || null);
        setConfirmation("");
        setMessage(
          `Creativehub order linked: ${result.providerOrderId}`
        );
      }

      if (action === "refresh") {
        setStatus(result.status);
        setProviderStatus(result.status);
        setTracking({
          carrier: result.carrier,
          tracking_number: result.tracking_number,
          tracking_url: result.tracking_url,
        });
        setMessage("Creativehub production status refreshed.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Request failed."
      );
    } finally {
      setBusy(null);
    }
  }

  const supplierCurrency = quote?.currency || "GBP";

  const canSubmit =
    props.productionUnlocked &&
    props.status === "paid" &&
    status === "not_submitted" &&
    !providerId &&
    confirmation === "PLACE PRINT ORDER" &&
    !!quote;

  return (
    <div className="mt-12 space-y-8">
      <section className="grid gap-px bg-black/10 sm:grid-cols-3">
        <Metric
          label="Payment"
          value={props.status.toUpperCase()}
        />
        <Metric
          label="Fulfilment"
          value={status.replaceAll("_", " ").toUpperCase()}
        />
        <Metric
          label="Customer paid"
          value={format(props.total, props.currency)}
        />
      </section>

      <section className="border border-black/10 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
              CREATIVEHUB / THEPRINTSPACE
            </p>
            <h2 className="mt-3 text-2xl">
              Production quotation
            </h2>
          </div>

          <button
            type="button"
            disabled={!!busy}
            onClick={() => run("quote")}
            className="bg-black px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-white disabled:opacity-40"
          >
            {busy === "quote"
              ? "Calculating..."
              : "Get live quote"}
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-black/50">
          Quotes use the exact Creativehub variant IDs saved on
          this order, with its original delivery country.
          Quotes do not charge your account.
        </p>

        {quote && (
          <div className="mt-7 grid gap-4 sm:grid-cols