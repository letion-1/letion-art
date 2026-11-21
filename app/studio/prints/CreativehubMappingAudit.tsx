"use client";

import { useState } from "react";

type AuditRow = {
  id: string; name: string; state: "match" | "unverified" | "mismatch" | "retired" | "unlinked" | "product_missing";
  active: boolean; issues: string[]; localSku: string | null;
  remoteSku: string | null; candidateSku: string | null;
};
type AuditResult = {
  artworkId: string; checkedAt: string; issueCount: number; remoteProductCount: number;
  variants: AuditRow[]; note: string;
};

function label(state: AuditRow["state"]) {
  switch (state) {
    case "match": return "Verified";
    case "unverified": return "Review details";
    case "mismatch": return "Mismatch";
    case "retired": return "Variant missing";
    case "unlinked": return "Not linked";
    case "product_missing": return "Product missing";
  }
}

export default function CreativehubMappingAudit({ artworkId }: { artworkId: string }) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  async function check() {
    if (busy) return;
    setOpen(true);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/studio/creativehub/reconcile?artworkId=${encodeURIComponent(artworkId)}`, {
        credentials: "same-origin", cache: "no-store",
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || `Creativehub verification failed (HTTP ${response.status})`);
      setResult(value as AuditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creativehub comparison failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-black/10 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-black/55">Supplier mapping verification (read-only)</p>
        <div className="flex gap-3">
          {open && <button type="button" onClick={() => setOpen(false)} className="text-xs underline">Close</button>}
          <button type="button" onClick={check} disabled={busy}
            className="border border-black/25 px-4 py-2 text-[10px] uppercase tracking-wider transition hover:border-black disabled:opacity-40">
            {busy ? "Comparing..." : result ? "Compare again" : "Compare with Creativehub"}
          </button>
        </div>
      </div>
      {open && error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      {open && result && <div className="mt-4">
        <p className="text-sm font-medium">{result.issueCount === 0
          ? `All ${result.variants.length} local options match the supplier data available.`
          : `${result.issueCount} of ${result.variants.length} print options need attention.`}</p>
        <p className="mt-2 text-xs text-black/45">Checked {new Date(result.checkedAt).toLocaleString()} · {result.remoteProductCount} linked supplier product(s)</p>
        <div className="mt-4 space-y-3">
          {result.variants.length === 0 && <p className="text-xs text-black/50">No print options for this artwork.</p>}
          {result.variants.map((row) => <div key={row.id} className="flex flex-col gap-2 border border-black/10 p-4 sm:flex-row sm:justify-between">
            <div>
              <p className="text-sm font-medium">{row.name}</p>
              {row.issues.map((issue) => <p key={issue} className="mt-1 text-xs text-amber-800">{issue}</p>)}
              {row.localSku && <p className="mt-2 break-all font-mono text-[11px] text-black/45">Studio SKU: {row.localSku}</p>}
              {row.remoteSku && row.remoteSku !== row.localSku && <p className="mt-1 break-all font-mono text-[11px] text-black/45">Supplier SKU: {row.remoteSku}</p>}
              {row.candidateSku && <p className="mt-1 break-all text-xs text-black/50">Possible replacement SKU: {row.candidateSku} (not linked)</p>}
            </div>
            <span className={`h-fit shrink-0 border px-3 py-1 text-[10px] uppercase tracking-wide ${row.state === "match" ? "border-green-700/25 text-green-800" : "border-amber-800/25 text-amber-900"}`}>
              {label(row.state)}
            </span>
          </div>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-black/45">{result.note} If a mapping is stale, disable the affected print option in Artwork Editor and review it before re-linking. Past paid orders may still reference its original supplier variant ID.</p>
      </div>}
    </section>
  );
}
