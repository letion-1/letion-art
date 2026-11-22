"use client";

import { useState } from "react";

type SupplierOption = {
  id: string;
  sku: string;
  sizeLabel: string | null;
  widthMm: number | null;
  heightMm: number | null;
  framed: boolean;
  frameColor: string | null;
  paper: string | null;
  border: string | null;
  supplierRetail: number | null;
  supplierRetailCurrency: string | null;
  localVariantId: string | null;
  localPrice: number | null;
  localCurrency: string | null;
  localActive: boolean;
};
type Inspection = {
  artworkTitle: string;
  hasProduct: boolean;
  syncState: string;
  productId?: string;
  dropId?: string | null;
  supplierProductName?: string;
  recommendationRequested?: boolean;
  canRequestRecommendations?: boolean;
  variantCount?: number;
  variants: SupplierOption[];
};
type Quote = {
  quoteOnly: boolean;
  currency: string;
  country: string;
  quantity: number;
  productionCost: number | null;
  deliveryCost: number | null;
  addonCost: number | null;
  vat: number | null;
  totalInclVat: number | null;
  totalExclVat: number | null;
  ddpTotal: number | null;
};
function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || !currency) return "Not supplied";
  try { return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount); }
  catch { return `${amount.toFixed(2)} ${currency}`; }
}
export default function CreativehubSupplierPlanner({ artworkId }: { artworkId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [country, setCountry] = useState("DE");
  const [quantity, setQuantity] = useState("1");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirmation, setConfirmation] = useState("");

  async function load() {
    if (busy) return;
    setOpen(true); setBusy(true); setError(""); setNotice(""); setQuote(null);
    try {
      const response = await fetch(`/api/studio/creativehub/supplier-planner?artworkId=${encodeURIComponent(artworkId)}`, { credentials: "same-origin", cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Creativehub HTTP ${response.status}`);
      setInspection(json as Inspection);
      const options = (json.variants ?? []) as SupplierOption[];
      setSelectedVariant(old => options.some(v => v.id === old) ? old : options[0]?.id || "");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not inspect supplier product."); }
    finally { setBusy(false); }
  }
  async function action(body: object) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/studio/creativehub/supplier-planner", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artworkId, ...body }), cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Supplier HTTP ${response.status}`);
      if ("quoteOnly" in json) setQuote(json as Quote);
      else {
        setQuote(null); setNotice(json.message || "Supplier request accepted. Inspect before trying again.");
        setInspection(old => old ? { ...old, recommendationRequested: true, canRequestRecommendations: false } : old);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Supplier request failed. Inspect before retrying."); }
    finally { setBusy(false); }
  }
  const chosen = inspection?.variants.find(v => v.id === selectedVariant);
  const quoteComparable = Boolean(quote && chosen && chosen.localPrice !== null && chosen.localCurrency === quote.currency && quote.totalInclVat !== null);
  const margin = quoteComparable && quote && chosen ? (chosen.localPrice ?? 0) * quote.quantity - (quote.totalInclVat ?? 0) : null;
  return (
    <div className="border-b border-black/10 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">Creativehub supplier calculator</p>
          <p className="mt-1 text-xs leading-5 text-black/55">Supplier sizes and costs, without standardised artwork prices or production orders.</p>
        </div>
        <button type="button" onClick={() => open ? setOpen(false) : void load()} className="border border-black/25 px-4 py-2.5 text-[10px] uppercase tracking-widest hover:border-black" aria-expanded={open}>
          {open ? "Close" : "Inspect supplier sizes & costs"}
        </button>
      </div>
      {open && <div className="mt-5 space-y-5">
        <button type="button" disabled={busy} onClick={() => void load()} className="border border-black/20 px-4 py-2 text-xs disabled:opacity-50">{busy ? "Working..." : "Refresh Creativehub data"}</button>
        {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="border border-black/20 p-3 text-sm">{notice}</p>}
        {inspection && !inspection.hasProduct && <p className="border border-black/10 p-4 text-sm text-black/60">This artwork has no saved Creativehub product. Use the existing Create / Link workflow first; the supplier calculator does not create duplicate products.</p>}
        {inspection?.hasProduct && <div className="border border-black/10 p-4 md:p-5">
          <p className="text-sm font-medium">{inspection.supplierProductName}</p>
          <p className="mt-1 break-all text-[11px] text-black/45">Product: {inspection.productId} · {inspection.variantCount ?? 0} supplier variants · Sync: {inspection.syncState}</p>
          {inspection.variantCount === 0 && <div className="mt-4 space-y-3">
            <p className="text-sm text-amber-900">Creativehub has no configured variants yet. That is why a production quote is unavailable.</p>
            <p className="text-xs leading-6 text-black/60">Supplier recommendations may modify this draft product and run asynchronously. They are separate from the Studio image-resolution estimates and do not submit any customer order.</p>
            {inspection.recommendationRequested ? <p className="text-sm text-black/70">Supplier recommendations were requested previously. Inspect the draft in Creativehub and refresh here; do not request them repeatedly.</p> : inspection.canRequestRecommendations ? <div className="space-y-2">
              <label htmlFor={`confirm-${artworkId}`} className="block text-xs">Type <strong>REQUEST CREATIVEHUB RECOMMENDATIONS</strong> to authorize a change to this supplier draft.</label>
              <input id={`confirm-${artworkId}`} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full border border-black/20 bg-transparent px-3 py-2 text-sm" />
              <button type="button" disabled={busy || confirmation !== "REQUEST CREATIVEHUB RECOMMENDATIONS"} onClick={() => void action({ action: "recommend", confirmation })}
                className="bg-black px-5 py-3 text-xs uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-35">Request Creativehub suggestions</button>
            </div> : <p className="text-sm text-black/60">Supplier recommendations are locked for this product until its current mappings and sync state have been reviewed.</p>}
          </div>}
          {(inspection.variants?.length ?? 0) > 0 && <div className="mt-5 space-y-4">
            <p className="text-xs text-black/55">These sizes and frame options come from Creativehub itself. Your independent Studio retail prices are not changed.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-xs"><thead><tr className="border-b border-black/10 text-black/45"><th className="py-2 pr-3">Supplier size</th><th className="py-2 pr-3">Presentation</th><th className="py-2 pr-3">Supplier retail</th><th className="py-2 pr-3">Studio retail</th><th className="py-2">Mapping</th></tr></thead><tbody>
              {inspection.variants.map(v => <tr key={v.id} className="border-b border-black/10"><td className="py-3 pr-3">{v.sizeLabel || "Size"}<div className="text-black/45">{v.widthMm !== null && v.heightMm !== null ? `${v.widthMm / 10} × ${v.heightMm / 10} cm` : "Dimensions unavailable"}</div></td><td className="py-3 pr-3">{v.framed ? `Framed ${v.frameColor || ""}` : "Print only"}<div className="text-black/45">{v.paper || "Paper unknown"}</div></td><td className="py-3 pr-3">{money(v.supplierRetail, v.supplierRetailCurrency)}</td><td className="py-3 pr-3">{money(v.localPrice, v.localCurrency)}</td><td className="py-3">{v.localVariantId ? "Mapped" : "Review / map"}</td></tr>)}
            </tbody></table></div>
            <div className="border-t border-black/10 pt-4">
              <h4 className="text-sm font-medium">Get a real Creativehub fulfilment quote</h4>
              <p className="mt-2 text-xs leading-5 text-black/60">Choose a supplier variant and destination. Returns production, shipping and VAT without ordering anything. Quotes may depend on quantity and country.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs">Print variant<select className="mt-2 w-full border border-black/20 bg-transparent p-2" value={selectedVariant} onChange={e => { setSelectedVariant(e.target.value); setQuote(null); }}>{inspection.variants.map(v => <option key={v.id} value={v.id}>{v.sizeLabel || `${v.widthMm} × ${v.heightMm} mm`} · {v.framed ? "Framed" : "Print only"}</option>)}</select></label>
                <label className="text-xs">Delivery country (ISO 2-letter)<input className="mt-2 w-full border border-black/20 bg-transparent p-2 uppercase" maxLength={2} value={country} onChange={e => { setCountry(e.target.value.toUpperCase()); setQuote(null); }} /></label>
                <label className="text-xs">Quantity<input className="mt-2 w-full border border-black/20 bg-transparent p-2" type="number" min={1} max={50} value={quantity} onChange={e => { setQuantity(e.target.value); setQuote(null); }} /></label>
              </div>
              <button type="button" disabled={busy || !selectedVariant || !/^[A-Z]{2}$/.test(country) || !Number.isInteger(Number(quantity)) || Number(quantity)<1 || Number(quantity)>50}
                className="mt-3 bg-black px-5 py-3 text-xs uppercase tracking-wider text-white disabled:opacity-35" onClick={() => void action({ action: "quote", variantId: selectedVariant, country, quantity: Number(quantity) })}>Calculate supplier cost (no order)</button>
              {quote && <div role="status" className="mt-4 border border-black/15 p-4 text-sm"><p className="font-medium">Creativehub quotation · {quote.country} · {quote.quantity} unit(s)</p>
                <dl className="mt-3 grid grid-cols-2 gap-2"><dt>Production</dt><dd className="text-right">{money(quote.productionCost,quote.currency)}</dd><dt>Delivery</dt><dd className="text-right">{money(quote.deliveryCost,quote.currency)}</dd><dt>VAT</dt><dd className="text-right">{money(quote.vat,quote.currency)}</dd><dt>Total incl. VAT</dt><dd className="text-right font-semibold">{money(quote.totalInclVat,quote.currency)}</dd></dl>
                {margin !== null ? <p className="mt-3 text-xs">Studio retail less quoted supplier total, before payment fees and other expenses: <strong>{money(margin, quote.currency)}</strong></p> : <p className="mt-3 text-xs text-black/60">Margin is not shown because the Studio price is missing or uses a different currency. No guessed FX conversion is applied.</p>}
              </div>}
            </div>
          </div>}
        </div>}
        <p className="text-[11px] leading-5 text-black/50">Supplier suggestions and quotes do not publish your prints or approve fulfilment. Print-option activation and customer production approval remain separate steps.</p>
      </div>}
    </div>
  );
}
