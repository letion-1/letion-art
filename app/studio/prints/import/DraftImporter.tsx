"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Option = { id: string; title: string };
type ProductBrief = { id: string; name: string; thumbnailUrl: string | null; variantCount: number; linkedArtworkId: string | null };
type ProductVariant = {
  id: string; sku: string; size: string; widthMm: number | null; heightMm: number | null;
  paper: string | null; framed: boolean; frameColor: string | null; frameType: string | null;
  supplierRetail: unknown; supplierCurrency: string | null; editionSize: unknown;
  productShotUrl: string | null; border: string | null;
};
type ProductDetail = {
  id: string; name: string; description: string; artworkUrl: string | null;
  thumbnailUrl: string | null; previewUrl: string | null; coaType: unknown;
  coaTemplate: string | null; printInsertId: string | null; linkedArtworkId: string | null;
  variants: ProductVariant[];
};
type ImportResult = { artworkId: string; createdPrintOptions: number; updatedPrintOptions?: number;
  disabledUnavailableOptions?: number; relinkedPrintSetup?: boolean;
  remoteVariants: number; unusableSupplierVariants: number };

export default function DraftImporter({ artworks, collections }: { artworks: Option[]; collections: Option[] }) {
  const [products, setProducts] = useState<ProductBrief[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [mode, setMode] = useState<"create" | "link">("create");
  const [collectionId, setCollectionId] = useState("");
  const [existingId, setExistingId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [availableCount, setAvailableCount] = useState<number | null>(null);

  async function refresh(offset = 0) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/studio/creativehub/drafts?offset=${offset}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Creativehub HTTP ${response.status}`);
      setProducts(old => offset === 0 ? body.products as ProductBrief[] : [...old, ...body.products as ProductBrief[]]);
      setNextOffset(typeof body.nextOffset === "number" ? body.nextOffset : null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load supplier products."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function inspect(id: string) {
    setBusy(true); setError(""); setMessage(""); setResult(null); setAvailableCount(null);
    try {
      const response = await fetch(`/api/studio/creativehub/drafts?productId=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Creativehub HTTP ${response.status}`);
      const next = body.product as ProductDetail;
      setSelected(next);
      // Avoid creating another website artwork when one already has this name.
      const matches = artworks.filter(a => a.title.trim().toLowerCase() === next.name.trim().toLowerCase());
      if (!next.linkedArtworkId && matches.length === 1) {
        setMode("link"); setExistingId(matches[0].id);
      } else if (!next.linkedArtworkId) {
        setMode("create"); setExistingId("");
      }
      setConfirmation("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not inspect supplier product."); }
    finally { setBusy(false); }
  }

  async function importDraft(syncExisting = false) {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/studio/creativehub/drafts", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          confirmation: syncExisting ? "IMPORT CREATIVEHUB DRAFT" : confirmation,
          existingArtworkId: syncExisting ? selected.linkedArtworkId : mode === "link" ? existingId : null,
          collectionId: syncExisting ? null : mode === "create" ? collectionId : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Import failed (HTTP ${response.status})`);
      setResult(body.result as ImportResult);
      if (body.product) setSelected(body.product as ProductDetail);
      const pricing = body.priceSync as { pricesFilled?: number; shopOptions?: number } | null;
      setMessage((syncExisting ? "Creativehub details refreshed." : "Creativehub product imported.") +
        ` ${Number(body.result?.createdPrintOptions ?? 0)} new and ${Number(body.result?.updatedPrintOptions ?? 0)} updated print variants.` +
        ` ${pricing ? `${Number(pricing.pricesFilled ?? 0)} missing EUR prices filled. ${Number(pricing.shopOptions ?? 0)} currently sale-ready options.` : "EUR pricing requires attention."}` +
        (body.photoWarning ? ` ${body.photoWarning}` : "") +
        (body.priceWarning ? ` ${body.priceWarning}` : ""));
      setConfirmation("");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setBusy(false); }
  }

  async function makeAvailable() {
    if (!selected?.linkedArtworkId || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/studio/creativehub/drafts", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enableShop", productId: selected.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setAvailableCount(Number(body.activeOptions ?? 0));
      setMessage(`${Number(body.activeOptions ?? 0)} print variants are available in the customer Shop. Your original gallery artwork and Creativehub products are unchanged.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not enable print availability."); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-12 text-[#111] md:px-10">
      <Link href="/studio/prints" className="text-xs uppercase tracking-widest text-black/50 hover:text-black">← Manage Prints</Link>
      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-black/45">LETION / STUDIO · CREATIVEHUB</p>
      <h1 className="mt-3 text-4xl tracking-[-0.05em] md:text-6xl">Import & sync Creativehub</h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-black/55">Import once, then Sync whenever you edit the product in Creativehub. Studio brings across the real framed/unframed variants, specifications, images and GBP retail prices, preparing missing EUR prices for your Shop. When you mark a published artwork Available as Print, its priced variants appear to customers. Your existing EUR prices stay unchanged.</p>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-amber-800">Creativehub does not reliably identify draft status. Newly created website artworks are unpublished and print sales start disabled. Existing artwork visibility is never changed by a sync.</p>
      {error && <p role="alert" className="mt-6 border border-red-300 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-6 border border-green-800/20 p-4 text-sm text-green-900">{message}</p>}
      {result && <p className="mt-2 text-sm"><Link className="underline" href={`/studio/artworks/${result.artworkId}/edit`}>Open imported artwork</Link> · {result.createdPrintOptions} new print options · {result.updatedPrintOptions ?? 0} updated · {result.unusableSupplierVariants} incomplete variants skipped</p>}
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.2fr)]">
        <section className="border border-black/10 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg">Creativehub products</h2>
            <button type="button" disabled={busy} onClick={() => void refresh()} className="border border-black/20 px-3 py-2 text-xs disabled:opacity-40">Refresh</button>
          </div>
          <div className="mt-5 space-y-3">
            {products.map(product => <button type="button" key={product.id} onClick={() => void inspect(product.id)} disabled={busy} className={`flex w-full items-center gap-4 border p-3 text-left disabled:opacity-40 ${selected?.id===product.id ? "border-black bg-black/5" : "border-black/10 hover:border-black/40"}`}>
              {product.thumbnailUrl ? <img src={product.thumbnailUrl} alt="" className="h-16 w-14 object-contain bg-black/5" /> : <span className="h-16 w-14 bg-black/5" />}
              <span className="min-w-0"><strong className="block truncate text-sm">{product.name}</strong><span className="mt-1 block text-xs text-black/50">{product.variantCount} supplier variant(s)</span><span className="mt-1 block text-xs text-black/50">{product.linkedArtworkId ? "Already imported" : "Not imported"}</span></span>
            </button>)}
          </div>
          {nextOffset !== null && <button type="button" onClick={() => void refresh(nextOffset)} disabled={busy} className="mt-5 w-full border border-black/20 p-3 text-xs uppercase tracking-wider disabled:opacity-40">{busy ? "Loading…" : "Load more products"}</button>}
        </section>
        <section className="border border-black/10 p-5 md:p-8">
          {!selected && <p className="text-sm text-black/50">Select a Creativehub product to inspect all available import fields.</p>}
          {selected && <>
            <h2 className="text-2xl tracking-tight">{selected.name}</h2>
            <p className="mt-2 break-all font-mono text-xs text-black/40">{selected.id}</p>
            <div className="mt-6 flex flex-wrap gap-4">
              {selected.previewUrl && <img src={selected.previewUrl} alt="Artwork preview" className="h-44 w-36 bg-black/5 object-contain" />}
              {selected.artworkUrl && <a className="self-end text-xs underline" href={selected.artworkUrl} target="_blank" rel="noreferrer">View supplier artwork image</a>}
            </div>
            {selected.description && <p className="mt-5 text-sm leading-6 text-black/60">{selected.description}</p>}
            <div className="mt-6 grid gap-3 border-y border-black/10 py-5 text-sm sm:grid-cols-2">
              <p>Certificate type: <strong>{String(selected.coaType ?? "Not specified")}</strong></p>
              <p>Certificate design: <strong>{selected.coaTemplate ?? "Not specified"}</strong></p>
              <p>Letter insert: <strong>{selected.printInsertId ?? "None"}</strong></p>
              <p>Configured supplier variants: <strong>{selected.variants.length}</strong></p>
            </div>
            <div className="mt-6 space-y-3">
              {selected.variants.length === 0 && <p className="text-sm text-amber-800">This draft has no configured supplier variants yet. Importing it will preserve the product, but cannot create sale-ready print options.</p>}
              {selected.variants.map(v => <div className="border border-black/10 p-3" key={v.id}>
                <div className="flex gap-4">
                  {v.productShotUrl && <img src={v.productShotUrl} alt="Creativehub product shot" className="h-28 w-24 object-contain bg-black/5" />}
                  <div className="min-w-0 text-xs leading-6">
                    <p className="text-sm font-medium">{v.size || "Print"} · {v.widthMm} × {v.heightMm} mm</p>
                    <p>Paper: {v.paper || "Not supplied"} · {v.framed ? `Framed ${v.frameColor || ""}` : "Unframed"}</p>
                    <p>Supplier retail: {String(v.supplierRetail ?? "Not supplied")} {v.supplierCurrency || ""}</p>
                    <p>Edition: {String(v.editionSize ?? "Not supplied")} · Border: {v.border || "Not supplied"}</p>
                    <p className="break-all text-black/50">SKU: {v.sku || "Not assigned"}</p>
                  </div>
                </div>
              </div>)}
            </div>
            <div className="mt-8 border-t border-black/10 pt-7">
              {selected.linkedArtworkId ? <>
                <p className="mb-3 text-sm font-medium">Already imported into LETION ART</p>
                <p className="mb-4 text-sm text-black/60">Changed something in Creativehub? Sync it here. This refreshes prices, paper, frames, sizes and mockup URLs without duplicate prints or replacing your EUR retail prices.</p>
                <button type="button" disabled={busy} onClick={() => void importDraft(true)}
                  className="bg-black px-6 py-4 text-xs uppercase tracking-widest text-white disabled:opacity-40">
                  {busy ? "Syncing…" : "Sync latest from Creativehub"}
                </button>
                <button type="button" disabled={busy} onClick={() => void makeAvailable()}
                  className="ml-2 mt-3 border border-black px-6 py-4 text-xs uppercase tracking-widest hover:bg-black hover:text-white disabled:opacity-40">
                  {busy ? "Working…" : "Available as Print · Show in Shop"}
                </button>
                {availableCount === 0 && <p className="mt-3 text-xs text-amber-800">No EUR-priced variants are available yet. Sync again and check the supplier GBP prices or FX warning before trying to sell.</p>}
                <p className="mt-3 text-xs text-black/50">This does not publish an unpublished artwork. If necessary, publish it first in Artwork Editor. No Creativehub production order will be submitted.</p>
              </> : <>
                <p className="mb-3 text-sm font-medium">Import to LETION ART</p>
                <label className="mb-3 flex items-center gap-2 text-sm"><input type="radio" checked={mode === "link"} onChange={() => setMode("link")} /> Use an existing artwork in my gallery</label>
                <label className="mb-4 flex items-center gap-2 text-sm"><input type="radio" checked={mode === "create"} onChange={() => setMode("create")} /> Create a new unpublished artwork</label>
                {mode === "create" ? <select aria-label="Collection for imported artwork" className="w-full border border-black/20 bg-transparent p-3 text-sm" value={collectionId} onChange={e => setCollectionId(e.target.value)}>
                  <option value="">Choose website collection</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select> : <select aria-label="Existing artwork" className="w-full border border-black/20 bg-transparent p-3 text-sm" value={existingId} onChange={e => setExistingId(e.target.value)}>
                  <option value="">Choose existing artwork</option>
                  {artworks.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>}
                <p className="mt-3 text-xs leading-5 text-black/60">If you previously removed this artwork from Manage Prints, importing a replacement product will restore its print setup only when no customer orders depend on the old variants.</p>
                <label className="mt-5 block text-xs">Type IMPORT CREATIVEHUB DRAFT to confirm</label>
                <input className="mt-2 w-full border border-black/20 bg-transparent px-4 py-3 text-sm" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="IMPORT CREATIVEHUB DRAFT" />
                <button type="button" disabled={busy || confirmation !== "IMPORT CREATIVEHUB DRAFT" || (mode === "create" ? !collectionId : !existingId)} onClick={() => void importDraft(false)} className="mt-4 bg-black px-6 py-4 text-xs uppercase tracking-widest text-white disabled:opacity-40">{busy ? "Importing…" : "Import Creativehub product"}</button>
              </>}
              <p className="mt-4 text-xs leading-6 text-black/50">Supplier prices stay in GBP metadata; your retail EUR prices are never silently overwritten. No orders or supplier products are created.</p>
            </div>
          </>}
        </section>
      </div>
    </main>
  );
}
