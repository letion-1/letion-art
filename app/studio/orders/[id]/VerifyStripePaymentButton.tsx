"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyStripePaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function verify() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/studio/orders/reconcile-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Stripe payment verification did not succeed.");
      }
      setMessage(result.message ?? "Verified. Refreshing order...");
      router.refresh();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Payment check failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7 border-t border-black/10 pt-5">
      <p className="text-sm text-black/60">
        This order is awaiting payment confirmation in Studio. Verify its
        existing Checkout Session directly with Stripe. No supplier order
        will be placed.
      </p>
      <button
        type="button"
        onClick={verify}
        disabled={busy}
        className="mt-4 bg-black px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
      >
        {busy ? "Verifying with Stripe..." : "Verify payment with Stripe"}
      </button>
      {message && (
        <p role="status" className={`mt-3 text-xs ${error ? "text-red-700" : "text-green-800"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
