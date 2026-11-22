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
type ImportResult = { artworkId: string; createdPrintOptions: number; remoteVariants: number; unusableSupplierVariants: number };

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
    setBusy(true); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch(`/api/studio/creativehub/drafts?productId=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Creativehub HTTP ${response.status}`);
      setSelected(body.product as ProductDetail);
      setConfirmation("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not inspect supplier product."); }
    finally { setBusy(false); }
  }

  async function importDraft() {
    if (!selected || busy) return;
    setBusy(true); setError(""); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/studio/creativehub/drafts", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id, confirmation,
          existingArtworkId: mode === "link" ? existingId : null,
          collectionId: mode === "create" ? collectionId : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Import failed (HTTP ${response.status})`);
      setResult(body.result as ImportResult);
      setMessage("Imported successfully. The artwork is unpublished, all new print options are disabled, and original supplier data is preserved.");
      setConfirmation("");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-12 text-[#111] md:px-10">
      <Link href="/studio/prints" className="text-xs uppercase tracking-widest text-black/50 hover:text-black">← Manage Prints</Link>
      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-black/45">LETION / STUDIO · CREATIVEHUB</p>
      <h1 className="mt-3 text-4xl tracking-[-0.05em] md:text-6xl">Import product drafts</h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-black/55">Browse existing Creativehub products, review their images, certificate configuration and exact supplier variants, then import each into LETION ART as an unpublished draft. Imports are deduplicated by Creativehub product and variant IDs. No supplier products or orders are created.</p>
      <p className="mt-2 max-w-3xl text-xs leading-6 text-amber-800">Creativehub’s product list does not guarantee a Draft status field. Only select the supplier products you intend to import. Imported website artwork is always unpublished and print sales are off.</p>
      {error && <p role="alert" className="mt-6 border border-red-300 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-6 border border-green-800/20 p-4 text-sm text-green-900">{message}</p>}
      {result && <p className="mt-2 text-sm"><Link className="underline" href={`/studio/artworks/${result.artworkId}/edit`}>Open imported artwork</Link> · {result.createdPrintOptions} print options added · {result.unusableSupplierVariants} incomplete supplier variants retained in snapshot only</p>}
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
              <p className="mb-3 text-sm font-medium">Import destination</p>
              {selected.linkedArtworkId && <p className="mb-4 border border-amber-700/25 p-3 text-xs text-amber-800">Already imported. Re-importing refreshes the stored supplier snapshot; existing artwork retail prices are not changed.</p>}
              <label className="mb-3 flex items-center gap-2 text-sm"><input type="radio" checked={mode === "create"} onChange={() => setMode("create")} /> Create an unpublished artwork</label>
              <label className="mb-4 flex items-center gap-2 text-sm"><input type="radio" checked={mode === "link"} onChange={() => setMode("link")} /> Attach to an existing artwork</label>
              {mode === "create" ? <select aria-label="Collection for imported artwork" className="w-full border border-black/20 bg-transparent p-3 text-sm" value={collectionId} onChange={e => setCollectionId(e.target.value)}>
                <option value="">Choose website collection</option>
                {collections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select> : <select aria-label="Existing artwork" className="w-full border border-black/20 bg-transparent p-3 text-sm" value={existingId} onChange={e => setExistingId(e.target.value)}>
                <option value="">Choose existing artwork</option>
                {artworks.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>}
              <label className="mt-5 block text-xs">Type IMPORT CREATIVEHUB DRAFT to authorize this local import</label>
              <input className="mt-2 w-full border border-black/20 bg-transparent px-4 py-3 text-sm" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="IMPORT CREATIVEHUB DRAFT" />
              <button type="button" disabled={busy || confirmation !== "IMPORT CREATIVEHUB DRAFT" || (!selected.linkedArtworkId && (mode === "create" ? !collectionId : !existingId))} onClick={importDraft} className="mt-4 bg-black px-6 py-4 text-xs uppercase tracking-widest text-white disabled:opacity-40">{busy ? "Importing…" : "Import supplier product as draft"}</button>
              <p className="mt-4 text-xs leading-6 text-black/50">Imports all metadata returned by Creativehub, including certificate settings and product-shot URLs, into a private supplier snapshot. The website preview uses a supplier image URL; it does not copy the full-resolution print master or certificate PDF into Supabase. Customer retail prices remain blank until you set them.</p>
            </div>
          </>}
        </section>
      </div>
    </main>
  );
}
