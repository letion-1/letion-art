"use client";

import { useState } from "react";

type Item = {
  id: string; name: string; sku: string; size: string; framed: boolean; frame: string | null;
  gbpRetail: number | null; supplierCurrency: string; priceEur: number | null;
  active: boolean; issue: string | null; match: boolean;
};
type Catalogue = {
  artwork: { id: string; title: string; published: boolean; prints_available: boolean };
  productId: string;
  rows: Item[];
};
function format(amount: number | null, currency: string) {
  return amount === null ? "Not set" : new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}
async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}
export default function CreativehubPricingReview({ artworkId }: { artworkId: string }) {
  const [opened, setOpened] = useState(false);
  const [catalog, setCatalog] = useState<Catalogue | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [draftEur, setDraftEur] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verified, setVerified] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [mode, setMode] = useState<"prices" | "enable">("prices");
  function initialize(c: Catalogue, exchange: number | null, kind: "prices" | "enable") {
    setCatalog(c);
    setSelected(Object.fromEntries(c.rows.map(row => [row.id,
      !row.issue && row.match && row.gbpRetail !== null &&
      (kind === "prices" ? row.priceEur === null && !row.active : row.priceEur !== null && !row.active),
    ])));
    setDraftEur(Object.fromEntries(c.rows.map(row => [row.id,
      row.priceEur !== null ? String(row.priceEur) :
      exchange !== null && row.gbpRetail !== null ? (Math.round(exchange * row.gbpRetail * 100) / 100).toFixed(2) : "",
    ])));
  }
  async function load(kind: "prices" | "enable" = mode) {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/studio/creativehub/price-review?artworkId=${encodeURIComponent(artworkId)}`, { cache: "no-store" });
      const data = await readJson(res) as Catalogue;
      let fx = rate;
      if (fx === null) {
        try {
          const result = await readJson(await fetch("/api/studio/creativehub/fx?from=GBP&to=EUR", { cache: "no-store" }));
          const candidate = Number(result.rate);
          if (Number.isFinite(candidate) && candidate > 0) {
            fx = candidate; setRate(candidate); setRateDate(typeof result.date === "string" ? result.date : null);
          }
        } catch { setNotice("FX reference service unavailable. You can enter a verified GBP → EUR rate manually before saving prices."); }
      }
      setMode(kind); initialize(data, fx, kind); setOpened(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load price review"); }
    finally { setBusy(false); }
  }
  function changeRate(value: string) {
    const parsed = Number(value);
    const fx = value !== "" && Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 3 ? parsed : null;
    setRate(fx); setRateDate(null);
    if (catalog) initialize(catalog, fx, mode);
  }
  function changeMode(kind: "prices" | "enable") {
    if (!catalog) return;
    setMode(kind); setNotice(""); setError(""); initialize(catalog, rate, kind);
  }
  async function save() {
    if (!catalog) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = mode === "prices" ? {
        action: "prices", artworkId, title: catalog.artwork.title,
        prices: catalog.rows.filter(row => selected[row.id]).map(row => ({
          id: row.id, expectedGbp: row.gbpRetail, eur: Number(draftEur[row.id]),
        })),
      } : {
        action: "enable", artworkId, title: catalog.artwork.title,
        variantIds: catalog.rows.filter(row => selected[row.id]).map(row => row.id),
        verified, confirmation,
      };
      if (mode === "prices" && (!rate || !Number.isFinite(rate))) throw new Error("Enter the current GBP → EUR reference rate first.");
      if (mode === "prices" && payload.prices?.length === 0) throw new Error("Select at least one unpriced variant.");
      if (mode === "enable" && payload.variantIds?.length === 0) throw new Error("Select at least one reviewed variant.");
      const result = await readJson(await fetch("/api/studio/creativehub/price-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      setNotice(mode === "prices" ? `Saved ${result.saved} EUR draft prices. Print selling remains off.` :
        `Enabled ${result.enabled} print options. No Creativehub production order was created.`);
      const refreshed = await readJson(await fetch(`/api/studio/creativehub/price-review?artworkId=${encodeURIComponent(artworkId)}`, { cache: "no-store" })) as Catalogue;
      initialize(refreshed, rate, mode);
      setVerified(false); setConfirmation("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save changes"); }
    finally { setBusy(false); }
  }
  return (
    <section className="border-b border-black/10 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.18em] text-black/40">CREATIVEHUB GBP → EUR PRICING</p>
          <p className="mt-1 text-xs text-black/60">Review actual supplier retail prices before enabling print sales.</p></div>
        <button type="button" onClick={() => opened ? setOpened(false) : void load("prices")}
          disabled={busy} className="border border-black/30 px-4 py-3 text-[10px] uppercase tracking-wide hover:bg-black hover:text-white disabled:opacity-40">
          {busy ? "Working..." : opened ? "Close price review" : "Review / import GBP prices"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 text-xs text-emerald-800">{notice}</p>}
      {opened && catalog && <div className="mt-5 space-y-5">
        <p className="text-xs text-black/60">Creativehub product: <span className="font-mono">{catalog.productId}</span>. GBP amounts are Creativehub <strong>retail</strong> values, not production costs. They are a suggested reference only, not an automatic margin or VAT calculation.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => changeMode("prices")}
            className={`px-4 py-2 text-xs ${mode === "prices" ? "bg-black text-white" : "border border-black/20"}`}>1. Save EUR draft prices</button>
          <button type="button" onClick={() => changeMode("enable")}
            className={`px-4 py-2 text-xs ${mode === "enable" ? "bg-black text-white" : "border border-black/20"}`}>2. Enable reviewed prints</button>
          <button type="button" disabled={busy} onClick={() => void load(mode)} className="border border-black/20 px-4 py-2 text-xs">Refresh</button>
        </div>
        {mode === "prices" && <div className="flex flex-wrap items-center gap-3 text-sm">
          <label htmlFor={`fx-${artworkId}`}>GBP → EUR rate</label>
          <input id={`fx-${artworkId}`} type="number" min="0.5" max="3" step="0.0001"
            value={rate ?? ""} onChange={(e: {target: {value: string}}) => changeRate(e.target.value)}
            className="w-32 border border-black/20 bg-transparent px-3 py-2" />
          <span className="text-xs text-black/50">{rateDate ? `Reference date: ${rateDate}` : "Check rate before saving"}</span>
        </div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs">
          <thead><tr className="border-b border-black/15 text-black/50"><th className="py-3 pr-2">Select</th><th className="py-3 pr-2">Option / SKU</th><th className="py-3 pr-2">Creativehub GBP retail</th><th className="py-3 pr-2">Website EUR</th><th className="py-3 pr-2">Status</th></tr></thead>
          <tbody>{catalog.rows.map(row => {
            const selectable = !row.issue && row.match && row.gbpRetail !== null &&
              (mode === "prices" ? row.priceEur === null && !row.active : row.priceEur !== null && !row.active);
            return <tr key={row.id} className="border-b border-black/10 align-top">
              <td className="py-3 pr-2"><input type="checkbox" checked={!!selected[row.id] && selectable} disabled={!selectable}
                onChange={(e: {target: {checked: boolean}}) => setSelected(s => ({ ...s, [row.id]: e.target.checked }))} aria-label={`Select ${row.name} ${row.sku}`} /></td>
              <td className="py-3 pr-2"><div className="font-medium">{row.name}</div><div className="font-mono text-[10px] text-black/45">{row.sku}</div></td>
              <td className="py-3 pr-2 tabular-nums">{format(row.gbpRetail, "GBP")}</td>
              <td className="py-3 pr-2 tabular-nums">{mode === "prices" && row.priceEur === null && selectable ?
                <input type="number" min="1" max="100000" step="0.01" aria-label={`EUR retail price for ${row.name}`}
                  value={draftEur[row.id] ?? ""} onChange={(e: {target: {value: string}}) => setDraftEur(s => ({ ...s, [row.id]: e.target.value }))}
                  className="w-28 border border-black/20 bg-transparent px-2 py-1" /> : format(row.priceEur, "EUR")}</td>
              <td className="max-w-[210px] py-3 pr-2">{row.issue ? <span className="text-amber-800">Review: {row.issue}</span> :
                row.active ? <span className="text-emerald-800">Live option</span> : row.priceEur !== null ? "Priced draft" : "Unpriced draft"}</td>
            </tr>;
          })}</tbody>
        </table></div>
        {mode === "enable" && <div className="space-y-3 border border-amber-700/20 p-4 text-xs">
          <p><strong>Final sales confirmation:</strong> Check every selected variant's Creativehub availability, SKU, sizing, framing, EUR retail margin, taxes and shipping. This action changes storefront selling flags, but never sends a supplier production order.</p>
          {!catalog.artwork.published && <p className="font-medium text-amber-800">This artwork is not published on LETION ART. Publish it in Artwork Editor first.</p>}
          <label className="flex items-start gap-2"><input type="checkbox" checked={verified} onChange={(e: {target: {checked: boolean}}) => setVerified(e.target.checked)} /> I verified these supplier variants and approved their EUR retail prices.</label>
          <label className="block">Type <strong>ENABLE {catalog.artwork.title} PRINTS</strong> to confirm:
            <input type="text" value={confirmation} onChange={(e: {target: {value: string}}) => setConfirmation(e.target.value)}
              className="mt-2 block w-full max-w-lg border border-black/20 bg-transparent px-3 py-2" /></label>
        </div>}
        <button type="button" disabled={busy || (mode === "enable" && (!verified || confirmation !== `ENABLE ${catalog.artwork.title} PRINTS`))}
          onClick={() => void save()} className="bg-black px-5 py-3 text-xs uppercase tracking-wider text-white disabled:opacity-40">
          {busy ? "Saving..." : mode === "prices" ? "Save selected EUR draft prices" : "Enable selected print sales"}
        </button>
        <p className="text-[11px] text-black/50">No automatic markup or price overwrite. The 60×80 cm PATRIOT inconsistency is flagged for separate supplier review. Print selling remains disabled until the second, explicit approval.</p>
      </div>}
    </section>
  );
}
