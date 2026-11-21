"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Variant = {
  id: string;
  name: string;
  width_mm: number | null;
  height_mm: number | null;
  framed: boolean;
  frame_style: string | null;
  paper: string | null;
  currency: string;
  price: number | null;
  creativehub_variant_id: string | null;
  creativehub_product_id: string | null;
};
type Preview = {
  artwork: { id: string; title: string };
  variants: Variant[];
  sync: { state: string; hasMaster: boolean; productId: string | null; error: string | null } | null;
};
type ResponseResult = {
  error?: string;
  message?: string;
  success?: boolean;
  productId?: string;
  path?: string;
  token?: string;
  artwork?: Preview["artwork"];
  variants?: Variant[];
  sync?: Preview["sync"];
};

async function readResponse(response: Response): Promise<ResponseResult> {
  const raw = await response.text();
  let parsed: ResponseResult;
  try { parsed = JSON.parse(raw) as ResponseResult; }
  catch { throw new Error(`Server returned invalid JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(parsed.error || `Request failed (HTTP ${response.status}).`);
  return parsed;
}

export default function SyncClient({ artworkId }: { artworkId: string }) {
  const [data, setData] = useState<Preview | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [productId, setProductId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [border, setBorder] = useState<"none" | "small" | "large">("small");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/studio/creativehub/catalog-sync", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkId, ...payload }),
    });
    return readResponse(response);
  }, [artworkId]);

  const refresh = useCallback(async () => {
    const result = await request({ action: "preview" });
    if (!result.artwork || !result.variants) throw new Error("Missing catalogue data.");
    const preview: Preview = { artwork: result.artwork, variants: result.variants, sync: result.sync || null };
    setData(preview);
    setSelectedIds((current) => current.filter((id) =>
      preview.variants.some((v) => v.id === id && !v.creativehub_variant_id)
    ));
  }, [request]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed."));
  }, [refresh]);

  async function act(name: string, work: () => Promise<string>) {
    if (busy) return;
    setBusy(name);
    setError("");
    setMessage("");
    try {
      setMessage(await work());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    } finally { setBusy(""); }
  }

  const available = data?.variants.filter((v) => !v.creativehub_variant_id && !v.creativehub_product_id) || [];
  const selected = available.filter((v) => selectedIds.includes(v.id));
  const linkedCount = data?.variants.filter((v) => v.creativehub_variant_id).length || 0;

  return (
    <div className="mt-10 space-y-7">
      <div className="border border-black/10 p-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">Artwork and sync status</p>
        <h2 className="mt-3 text-2xl">{data?.artwork.title || "Loading..."}</h2>
        <p className="mt-2 text-sm text-black/55">State: {data?.sync?.state || "Not started"} · Linked variants: {linkedCount}</p>
        {data?.sync?.productId && <p className="mt-2 break-all text-xs text-black/50">Product ID: {data.sync.productId}</p>}
        {data?.sync?.state === "needs_review" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-700">A previous creation may have succeeded partially. Inspect your Creativehub account before trying again. Do not create a duplicate.</p>
            {data.sync.productId && (
              <button type="button" disabled={!!busy}
                className="border border-black px-5 py-3 text-xs uppercase tracking-wider disabled:opacity-40"
                onClick={() => act("recover", async () => {
                  const result = await request({ action: "recover" });
                  return result.message || "Recovered.";
                })}>
                {busy === "recover" ? "Checking..." : "Recover saved Creativehub product mapping"}
              </button>
            )}
          </div>
        )}
      </div>

      <section className="border border-black/10 p-6">
        <h2 className="text-xl">1. Choose the print variants</h2>
        <p className="mt-2 text-sm text-black/50">Create your print options in the Artwork Editor, then click Save variant for each one. The paper displayed below comes from the database, not unsaved editor fields. Unlinked options without a supported saved paper cannot be selected.</p>
        <div className="mt-5 space-y-3">
          {(data?.variants || []).map((v) => {
            const mapped = Boolean(v.creativehub_variant_id);
            const selectedNow = selectedIds.includes(v.id);
            const supportedPaper = /etching|photo\s*rag|bamboo|baryta|pearl/i.test(v.paper || "");
            return (
              <label key={v.id} className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 border px-4 py-4 text-sm transition-colors focus-within:ring-2 focus-within:ring-black/30 ${selectedNow ? "border-black bg-[#e8dfc8] ring-1 ring-black/30" : "border-black/10 bg-transparent hover:bg-black/[0.025]"} ${mapped ? "opacity-60" : ""}`}>
                <span className="flex items-start gap-3">
                  <input type="checkbox" disabled={mapped || !!busy || !supportedPaper}
                    className="mt-1 h-4 w-4 accent-black"
                    checked={selectedNow}
                    onChange={(e) => setSelectedIds((old) => e.target.checked ? [...old, v.id] : old.filter((x) => x !== v.id))} />
                  <span className="space-y-1">
                    <span className="block font-medium">{v.name} · {v.width_mm && v.height_mm ? `${v.width_mm / 10} × ${v.height_mm / 10} cm` : "Size missing"}
                      {v.framed ? ` · ${v.frame_style || "Framed"}` : " · Print only"}</span>
                    <span className={`block text-xs ${supportedPaper ? "text-black/55" : "text-red-700"}`}>
                      {supportedPaper ? `Saved paper: ${v.paper}` : `Saved paper: ${v.paper || "NONE"}. Set a supported paper in Edit Artwork, click Save variant, then return here.`}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-black/55">{mapped ? "Already linked" : selectedNow ? "Selected ✓" : `${v.currency} ${v.price ?? "price missing"}`}</span>
              </label>
            );
          })}
          {data && available.length === 0 && <p className="text-sm text-black/50">No unmapped variants. Add another print variant in the Artwork Editor if needed.</p>}
        </div>
      </section>

      <section className="border border-black/10 p-6">
        <h2 className="text-xl">2A. Link an existing Creativehub product</h2>
        <p className="mt-2 text-sm text-black/50">For products you already created in Creativehub, such as SELFIE. This does not create a product or change supplier variants.</p>
        <input className="mt-4 w-full border border-black/20 bg-transparent px-4 py-3 text-sm" placeholder="Creativehub product UUID" value={productId} onChange={(e) => setProductId(e.target.value)} />
        <button className="mt-4 border border-black px-5 py-3 text-xs uppercase tracking-wider disabled:opacity-40" type="button"
          disabled={!!busy || selected.length === 0 || !productId.trim()}
          onClick={() => act("link", async () => {
            const result = await request({ action: "link", selectedIds, productId: productId.trim() });
            return result.message || "Linked.";
          })}>
          {busy === "link" ? "Linking..." : "Link selected variants"}
        </button>
      </section>

      <section className="border border-black/10 p-6">
        <h2 className="text-xl">2B. Create a new Creativehub product</h2>
        <p className="mt-2 text-sm leading-6 text-black/55">Upload the high-resolution print master here once. It goes into a private Supabase bucket and Creativehub fetches it using a temporary signed link. Never use a compressed gallery preview as a print master.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <input type="file" accept="image/jpeg,image/png,image/tiff,.tif,.tiff"
            disabled={!!busy || (data?.sync?.state !== undefined && data?.sync?.state !== "ready")}
            onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-full text-sm" />
          <button className="bg-black px-5 py-3 text-xs uppercase tracking-wider text-white disabled:opacity-40" type="button"
            disabled={!file || !!busy || Boolean(data?.sync && data.sync.state !== "ready")}
            onClick={() => act("upload", async () => {
              if (!file) throw new Error("Choose a file.");
              if (file.size > 50 * 1024 * 1024) throw new Error("Print master must be under 50 MB on this storage plan.");
              const mime = file.type || (file.name.toLowerCase().endsWith(".tif") || file.name.toLowerCase().endsWith(".tiff") ? "image/tiff" : "");
              const ticket = await request({ action: "upload_ticket", mimeType: mime, filename: file.name });
              if (!ticket.path || !ticket.token) throw new Error("Upload token missing.");
              const supabase = createClient();
              const { error: uploadError } = await supabase.storage.from("print-masters")
                .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: mime, upsert: false });
              if (uploadError) throw new Error(uploadError.message);
              setFile(null);
              return "Print master uploaded to private storage. Ready to create product.";
            })}>
            {busy === "upload" ? "Uploading..." : "Upload print master"}
          </button>
        </div>
        <p className="mt-3 text-xs text-black/45">Master in storage: {data?.sync?.hasMaster ? "Recorded" : "Not yet uploaded"}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {selected.map((v) => (
            <label key={v.id} className="block text-xs text-black/60">
              Creativehub retail price for {v.name} (GBP)
              <input type="number" min="1" step="0.01" value={prices[v.id] || ""}
                onChange={(e) => setPrices((old) => ({ ...old, [v.id]: e.target.value }))}
                className="mt-2 w-full border border-black/20 bg-transparent px-4 py-3 text-sm" placeholder="Enter GBP price" />
            </label>
          ))}
        </div>
        <label className="mt-6 block text-xs text-black/60">Print border
          <select value={border} onChange={(e) => setBorder(e.target.value as typeof border)}
            className="mt-2 block w-full border border-black/20 bg-transparent px-4 py-3 text-sm">
            <option value="small">Small border</option>
            <option value="none">No border</option>
            <option value="large">Large border</option>
          </select>
        </label>
        <p className="mt-3 text-xs text-black/50">Creativehub requires GBP retail prices. These do not change your website's EUR prices. No automatic FX rate is assumed.</p>
        <label className="mt-6 block text-xs text-black/60">Type CREATE CREATIVEHUB PRODUCT to authorize creation
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
            className="mt-2 w-full border border-black/20 bg-transparent px-4 py-3 text-sm" />
        </label>
        <button className="mt-5 bg-black px-6 py-4 text-xs uppercase tracking-wider text-white disabled:opacity-40" type="button"
          disabled={!!busy || selected.length === 0 || confirmation !== "CREATE CREATIVEHUB PRODUCT" || !data?.sync?.hasMaster || data.sync.state !== "ready"}
          onClick={() => act("create", async () => {
            if (!window.confirm("Create a real product and draft drop in your Creativehub account? This does NOT place a customer production order.")) return "Creation cancelled.";
            const gbpPrices = Object.fromEntries(selected.map((v) => [v.id, Number(prices[v.id])]));
            const result = await request({ action: "create", selectedIds, gbpPrices, border, confirmation });
            return result.message || "Created.";
          })}>
          {busy === "create" ? "Creating in Creativehub..." : "Create and map product"}
        </button>
        <p className="mt-4 text-xs text-black/45">The new product remains linked but all website variants are disabled until you review their Creativehub IDs and test a supplier quote.</p>
      </section>
      {(message || error) && (
        <div aria-live="polite" className={`sticky bottom-4 z-20 border p-4 shadow-sm ${error ? "border-red-300 bg-[#fff2ed]" : "border-green-300 bg-[#eff8ee]"}`}>
          {message && <p role="status" className="text-sm text-green-800">{message}</p>}
          {error && <p role="alert" className="text-sm font-medium text-red-800">{error}</p>}
        </div>
      )}
    </div>
  );
}
