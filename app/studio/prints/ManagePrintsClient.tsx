"use client";

import Link from "next/link";
import CreativehubMappingAudit from "./CreativehubMappingAudit";
import CreativehubSupplierPlanner from "./CreativehubSupplierPlanner";
import { useMemo, useState } from "react";

type Variant = {
  id: string;
  artwork_id: string;
  name: string;
  size_label: string | null;
  width_mm: number | null;
  height_mm: number | null;
  paper: string | null;
  framed: boolean;
  frame_style: string | null;
  price: number | null;
  currency: string;
  active: boolean;
  creativehub_product_id: string | null;
  creativehub_variant_id: string | null;
  creativehub_sku: string | null;
};

type Artwork = {
  id: string;
  title: string;
  image_url: string | null;
  prints_available: boolean;
  published: boolean;
  variants: Variant[];
  sync: { state: string; productId: string | null; hasMaster: boolean; error: string | null } | null;
};

type RemoteProduct = { id: string; name: string; variantCount: number };
type Filter = "all" | "unlinked" | "review" | "enabled";

function isLinked(variant: Variant) {
  return Boolean(variant.creativehub_product_id && variant.creativehub_variant_id && variant.creativehub_sku);
}

function status(variant: Variant): Filter {
  if (!isLinked(variant)) return "unlinked";
  if (!variant.active) return "review";
  return "enabled";
}

function price(variant: Variant) {
  if (variant.price === null) return "Price missing";
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency", currency: variant.currency || "EUR",
      maximumFractionDigits: 2,
    }).format(Number(variant.price));
  } catch {
    return `${variant.currency} ${variant.price}`;
  }
}

export default function ManagePrintsClient({ artworks, truncated }: { artworks: Artwork[]; truncated: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [remote, setRemote] = useState<RemoteProduct[] | null>(null);
  const [remoteError, setRemoteError] = useState("");
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [showRemote, setShowRemote] = useState(false);
  const [copied, setCopied] = useState("");
  const [nextRemoteOffset, setNextRemoteOffset] = useState<number | null>(null);

  const variants = artworks.flatMap((artwork) => artwork.variants);
  const counts = {
    all: variants.length,
    unlinked: variants.filter((v) => status(v) === "unlinked").length,
    review: variants.filter((v) => status(v) === "review").length,
    enabled: variants.filter((v) => status(v) === "enabled").length,
  };

  const visible = useMemo(() => artworks
    .map((artwork) => {
      const matching = artwork.variants.filter((variant) => {
        const needle = query.trim().toLowerCase();
        const haystack = [artwork.title, variant.name, variant.size_label, variant.paper, variant.creativehub_sku].join(" ").toLowerCase();
        return (filter === "all" || status(variant) === filter) && (!needle || haystack.includes(needle));
      });
      const showEmpty = !artwork.variants.length && filter === "all" && (!query.trim() || artwork.title.toLowerCase().includes(query.trim().toLowerCase()));
      return { artwork, matching, showEmpty };
    })
    .filter((entry) => entry.matching.length || entry.showEmpty), [artworks, query, filter]);

  async function loadRemote(more = false) {
    if (remoteBusy) return;
    setShowRemote(true);
    setRemoteBusy(true);
    setRemoteError("");
    try {
      const offset = more ? nextRemoteOffset : 0;
      if (offset === null) return;
      const response = await fetch(`/api/studio/creativehub/products?offset=${offset}`, {
        credentials: "same-origin", cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Creativehub HTTP ${response.status}`);
      const incoming = json.products as RemoteProduct[];
      if (!Array.isArray(incoming)) throw new Error("Creativehub returned an unexpected product list.");
      setRemote((previous) => {
        if (!more) return incoming;
        const merged = new Map((previous ?? []).map((item) => [item.id, item]));
        for (const item of incoming) merged.set(item.id, item);
        return [...merged.values()];
      });
      setNextRemoteOffset(typeof json.nextOffset === "number" ? json.nextOffset : null);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : "Could not load Creativehub catalog.");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function copyProductId(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setRemoteError("Clipboard unavailable. Select and copy the product ID manually.");
    }
  }

  const pill = (kind: Filter) => kind === "unlinked"
    ? "border-amber-700/20 bg-amber-50 text-amber-900"
    : kind === "review"
      ? "border-black/10 bg-stone-200 text-stone-700"
      : "border-emerald-800/15 bg-emerald-50 text-emerald-900";

  return (
    <main className="w-full min-w-0 pb-24 text-[#121212]">
      <div className="mx-auto max-w-[1500px] px-5 py-10 md:px-10">
        <Link href="/studio" className="text-[10px] uppercase tracking-[0.18em] text-black/50 hover:text-black">← Studio dashboard</Link>
        <header className="mt-10 border-b border-black/10 pb-10">
          <p className="text-[10px] uppercase tracking-[0.25em] text-black/40">LETION ART / STUDIO · COMMERCE</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-medium tracking-[-0.06em] md:text-7xl">Manage prints</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-black/50">Review print options, compare Creativehub mappings, connect products and keep print sales under your control. Product syncing never submits a customer production order.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/studio/artworks" className="border border-black px-5 py-3 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white">Artworks</Link>
              <Link href="/studio/creativehub/quotes" className="bg-black px-5 py-3 text-[10px] uppercase tracking-widest text-white hover:opacity-75">Supplier quotes</Link>
            </div>
          </div>
        </header>

        {truncated && <p role="alert" className="mt-6 border border-amber-700/30 p-4 text-sm text-amber-800">Showing the first 1,000 records per source. Pagination is required for larger catalogs.</p>}
        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["all", "unlinked", "review", "enabled"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}
              className={`border p-5 text-left transition ${filter === item ? "border-black bg-black text-white" : "border-black/10 hover:border-black/50"}`}>
              <span className="text-3xl font-medium tabular-nums">{counts[item]}</span>
              <span className="mt-3 block text-[10px] uppercase tracking-[0.18em]">{item === "all" ? "All print options" : item === "unlinked" ? "Not linked" : item === "review" ? "Linked / review" : "Enabled locally"}</span>
            </button>
          ))}
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl tracking-tight">Print catalogue</h2>
            <input className="w-full border border-black/15 bg-transparent px-4 py-3 text-sm outline-none focus:border-black sm:max-w-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artwork, size, paper or SKU" aria-label="Search print options" />
          </div>

          <div className="mt-5 space-y-5">
            {visible.length === 0 && <div className="border border-dashed border-black/20 p-10 text-sm text-black/50">No print options match this view. For a new artwork, open Artwork Editor and enable prints.</div>}
            {visible.map(({ artwork, matching, showEmpty }) => (
              <article key={artwork.id} className="border border-black/10">
                <div className="flex flex-col gap-5 border-b border-black/10 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    {artwork.image_url ? <img src={artwork.image_url} alt="" className="h-20 w-16 shrink-0 bg-black/5 object-contain" /> : <div className="h-20 w-16 shrink-0 bg-black/5" />}
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-medium">{artwork.title}</h3>
                      <p className="mt-1 text-xs text-black/45">{artwork.variants.length} option(s) · {artwork.prints_available ? "Print selling enabled" : "Print selling off"} · {artwork.published ? "Artwork published" : "Artwork hidden"}</p>
                      <p className="mt-1 text-xs text-black/45">Creativehub: {artwork.sync?.state || "Not started"}{artwork.sync?.hasMaster ? " · Master recorded" : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/studio/artworks/${artwork.id}/edit`} className="border border-black/20 px-4 py-3 text-[10px] uppercase tracking-wider hover:border-black">Edit options</Link>
                    <Link href={`/studio/artworks/${artwork.id}/creativehub`} className="bg-black px-4 py-3 text-[10px] uppercase tracking-wider text-white hover:opacity-75">Create / Link in Creativehub</Link>
                  </div>
                </div>
                <CreativehubMappingAudit artworkId={artwork.id} />
                <CreativehubSupplierPlanner artworkId={artwork.id} />
                {artwork.sync?.error && <p role="alert" className="border-b border-black/10 px-5 py-3 text-xs text-red-800">Sync needs review: {artwork.sync.error}</p>}
                {showEmpty && <p className="p-5 text-sm text-black/45">No variants yet. Use <Link className="underline" href={`/studio/artworks/${artwork.id}/edit`}>Edit options</Link> to add your print sizes.</p>}
                {matching.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-black/10 text-[10px] uppercase tracking-widest text-black/40"><th className="px-5 py-4 font-medium">Print / size</th><th className="px-5 py-4 font-medium">Paper / frame</th><th className="px-5 py-4 font-medium">Store price</th><th className="px-5 py-4 font-medium">Creativehub</th><th className="px-5 py-4 font-medium">Status</th></tr></thead>
                  <tbody>{matching.map((v) => <tr key={v.id} className="border-b border-black/5 last:border-0"><td className="px-5 py-4"><div className="font-medium">{v.name}</div><div className="mt-1 text-xs text-black/40">{v.size_label || (v.width_mm && v.height_mm ? `${v.width_mm / 10} × ${v.height_mm / 10} cm` : "Size not set")}</div></td><td className="px-5 py-4 text-black/60">{v.paper || "Paper not set"}<div className="mt-1 text-xs">{v.framed ? `Framed · ${v.frame_style || "Style missing"}` : "Unframed"}</div></td><td className="px-5 py-4 tabular-nums">{price(v)}</td><td className="px-5 py-4"><div className="max-w-[170px] truncate text-xs">{v.creativehub_sku || "No SKU"}</div>{v.creativehub_product_id && <div className="mt-1 text-[10px] text-black/40">Product mapped locally</div>}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-wider ${pill(status(v))}`}>{status(v) === "unlinked" ? "Not linked" : status(v) === "review" ? "Review first" : "Enabled"}</span></td></tr>)}</tbody>
                </table></div>}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 border border-black/10 p-6 md:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl tracking-tight">Creativehub products in your account</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-black/50">Read-only lookup of products already in your Creativehub space. Copy a product ID, then choose the artwork above and use “Create / Link in Creativehub.”</p>
            </div>
            <button type="button" onClick={() => loadRemote(false)} disabled={remoteBusy} className="shrink-0 bg-black px-5 py-3 text-[10px] uppercase tracking-widest text-white disabled:opacity-40">{remoteBusy ? "Loading..." : remote ? "Refresh products" : "Load Creativehub products"}</button>
          </div>
          {remoteError && <p role="alert" className="mt-4 text-sm text-red-700">{remoteError}</p>}
          {showRemote && remote && <div className="mt-6 space-y-3">{remote.length === 0 ? <p className="text-sm text-black/50">No products returned by Creativehub.</p> : remote.map((item) => <div key={item.id} className="flex flex-col gap-3 border-b border-black/10 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-1 break-all font-mono text-xs text-black/45">{item.id}</p><p className="mt-1 text-xs text-black/40">{item.variantCount} remote variant(s)</p></div><button type="button" onClick={() => copyProductId(item.id)} className="shrink-0 border border-black/30 px-4 py-2 text-xs hover:bg-black hover:text-white">{copied === item.id ? "Copied" : "Copy product ID"}</button></div>)}</div>}
          {showRemote && remote && nextRemoteOffset !== null && (
            <button type="button" onClick={() => loadRemote(true)} disabled={remoteBusy}
              className="mt-4 border border-black/25 px-5 py-3 text-xs uppercase tracking-wider disabled:opacity-40">
              {remoteBusy ? "Loading..." : `Load more Creativehub products (${remote.length} shown)`}
            </button>
          )}

        </section>
        <p className="mt-8 max-w-3xl text-xs leading-6 text-black/45">Safety: These statuses describe your local Studio mappings. They are not proof of current Creativehub inventory. Creating or linking requires the existing protected sync flow, and customer orders still require separate approval before production. Never overwrite existing variants in bulk: Creativehub can regenerate variant IDs and SKUs.</p>
      </div>
    </main>
  );
}
