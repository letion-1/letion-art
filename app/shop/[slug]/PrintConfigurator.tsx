"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/app/components/CartProvider";
import { printDimension, printText } from "@/lib/print-display-text";
import { printPictureForVariant, useShopPrintSelection, type SupplierPhoto } from "./PrintProductMedia";

export type ShopPrintVariant = {
  id: string;
  name: string;
  size_label: string | null;
  width_mm: number | null;
  height_mm: number | null;
  price: number | null;
  currency: string;
  paper: string | null;
  finish: string | null;
  framed: boolean;
  frame_style: string | null;
  framing_details: string | null;
  active: boolean;
  creativehub_variant_id?: string | null;
  creativehub_sku?: string | null;
  edition_size?: number | null;
  border?: string | null;
};

type ArtworkForCart = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
};

type SizeGroup = {
  key: string;
  exact: string;
  area: number;
  variants: ShopPrintVariant[];
};

function sizeDetails(variant: ShopPrintVariant) {
  const exact = printDimension(variant.width_mm, variant.height_mm);
  if (exact) return { key: `${Number(variant.width_mm).toFixed(1)}:${Number(variant.height_mm).toFixed(1)}`, exact,
    area: Number(variant.width_mm) * Number(variant.height_mm) };
  const supplied = printText(variant.size_label || variant.name);
  const m = supplied.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (m) {
    const w = Number(m[1].replace(",", "."));
    const h = Number(m[2].replace(",", "."));
    if (w > 0 && h > 0) return { key: `label:${w}:${h}`, exact: `${w} × ${h} cm`, area: w * h };
  }
  return { key: `other:${supplied}`, exact: supplied || "Size not specified", area: Number.POSITIVE_INFINITY };
}

function sizeTier(index: number, total: number): string {
  if (total === 1) return "Size";
  if (total === 2) return index === 0 ? "Small" : "Statement";
  if (total === 3) return ["Small", "Medium", "Statement"][index];
  if (total > 4) {
    if (index === 0) return "Small";
    if (index === 1) return "Medium";
    if (index === total - 2) return "Large";
    if (index === total - 1) return "Statement";
    return `Size ${index + 1}`;
  }
  return ["Small", "Medium", "Large", "Statement"][index];
}

function money(amount: number | null, currency: string): string {
  if (amount === null || !Number.isFinite(Number(amount))) return "Price on request";
  try { return new Intl.NumberFormat("en-IE", { style: "currency", currency: currency || "EUR" }).format(Number(amount)); }
  catch { return `${currency || "EUR"} ${Number(amount).toFixed(2)}`; }
}

function presentation(v: ShopPrintVariant) {
  return v.framed ? `${printText(v.frame_style) || "Framed"} frame` : "Unframed";
}

function BorderText({ value }: { value: string }) {
  const cleaned = printText(value);
  const pieces = Object.fromEntries([...cleaned.matchAll(/\b([TBLR])(\d+(?:\.\d+)?)\b/g)].map(m => [m[1], m[2]]));
  const display = Object.keys(pieces).length === 4
    ? `Top ${pieces.T} · Bottom ${pieces.B} · Left ${pieces.L} · Right ${pieces.R}`
    : cleaned;
  return <span>{display}</span>;
}

function Attribute({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-black/10 py-3 text-sm">
    <dt className="text-black/50">{label}</dt><dd className="text-right text-black/85">{children}</dd>
  </div>;
}

export default function PrintConfigurator({ artwork, variants, photos = [] }: {
  artwork: ArtworkForCart;
  variants: ShopPrintVariant[];
  photos?: SupplierPhoto[];
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const { selectedVariantId, selectVariant } = useShopPrintSelection();
  const ready = useMemo(() => variants.filter(v => v.active && v.currency === "EUR" && Number(v.price) > 0), [variants]);
  const groups = useMemo(() => {
    const seen = new Map<string, SizeGroup>();
    for (const variant of ready) {
      const size = sizeDetails(variant);
      if (!seen.has(size.key)) seen.set(size.key, { ...size, variants: [] });
      seen.get(size.key)!.variants.push(variant);
    }
    return [...seen.values()].sort((a, b) => a.area - b.area || a.exact.localeCompare(b.exact));
  }, [ready]);
  const selected = ready.find(v => v.id === selectedVariantId) || groups[0]?.variants[0] || null;
  const activeKey = selected ? sizeDetails(selected).key : null;
  const selectedGroup = groups.find(g => g.key === activeKey) || groups[0] || null;
  const selectedPicture = printPictureForVariant(selected, photos);

  function choose(v: ShopPrintVariant) { selectVariant(v.id); setAdded(false); }
  function addToCart() {
    if (!selected || selected.price === null) return;
    addItem({
      artworkId: artwork.id, artworkSlug: artwork.slug, artworkTitle: artwork.title,
      artworkImageUrl: selectedPicture?.image_url || artwork.image_url,
      variantId: selected.id, variantName: selected.name,
      sizeLabel: selected.size_label, framed: selected.framed,
      frameStyle: selected.frame_style, price: selected.price,
      currency: selected.currency,
    });
    setAdded(true);
  }

  if (!ready.length) {
    return <p className="border border-black/15 px-6 py-7 text-sm text-black/55">
      This artwork has no print editions ready to purchase yet.
    </p>;
  }

  return <div className="space-y-8">
    {/* STEP 1: CHOOSE ACTUAL AVAILABLE SIZE */}
    <section aria-labelledby="size-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="size-heading" className="text-xs font-semibold uppercase tracking-[0.18em]">1. Choose size</h3>
        {selectedGroup && <span className="text-xs text-black/50">{selectedGroup.exact}</span>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Print size">
        {groups.map((group, index) => {
          const on = activeKey === group.key;
          return <button type="button" key={group.key} aria-pressed={on}
            onClick={() => choose(group.variants.find(v => !v.framed) || group.variants[0])}
            className={`min-h-[76px] border px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${on ? "border-black bg-black text-white" : "border-black/20 hover:border-black"}`}>
            <span className="block text-sm font-semibold">{sizeTier(index, groups.length)}</span>
            <span className={`mt-1 block text-[11px] ${on ? "text-white/75" : "text-black/50"}`}>{group.exact}</span>
          </button>;
        })}
      </div>
      {selectedGroup && <p className="mt-3 text-xs text-black/55">Selected print size: <strong className="font-medium text-black">{selectedGroup.exact}</strong></p>}
    </section>

    {/* STEP 2: ONLY PRESENTATIONS OFFERED FOR THAT SIZE */}
    {selectedGroup && <section aria-labelledby="frame-heading" className="border-t border-black/10 pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="frame-heading" className="text-xs font-semibold uppercase tracking-[0.18em]">2. Choose frame</h3>
        <span className="text-xs text-black/45">Options for {selectedGroup.exact}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Frame options">
        {[...selectedGroup.variants].sort((a, b) => Number(a.framed) - Number(b.framed) || presentation(a).localeCompare(presentation(b)))
          .map(v => {
            const on = selected?.id === v.id;
            const picture = printPictureForVariant(v, photos);
            return <button key={v.id} type="button" onClick={() => choose(v)} aria-pressed={on}
              className={`flex min-h-[92px] items-center gap-3 border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${on ? "border-black bg-black text-white" : "border-black/20 hover:border-black"}`}>
              {picture ? <img src={picture.image_url} alt="" loading="lazy" className="h-16 w-14 shrink-0 bg-white/70 object-contain" />
                : <div aria-hidden="true" className={`flex h-16 w-14 shrink-0 items-center justify-center border text-xl ${on ? "border-white/30" : "border-black/10"}`}>{v.framed ? "▣" : "□"}</div>}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{presentation(v)}</span>
                <span className={`mt-1 block text-xs ${on ? "text-white/75" : "text-black/55"}`}>{money(v.price, v.currency)}</span>
                {!picture && <span className={`mt-1 block text-[10px] ${on ? "text-white/60" : "text-black/40"}`}>Artwork preview</span>}
              </span>
              {on && <span aria-hidden="true" className="text-lg">✓</span>}
            </button>;
          })}
      </div>
    </section>}

    {/* SELECTED OPTION'S REAL SUPPLIER DETAILS */}
    {selected && <section aria-labelledby="details-heading" className="border-t border-black/10 pt-7">
      <h3 id="details-heading" className="text-xs font-semibold uppercase tracking-[0.18em]">Your print details</h3>
      <dl className="mt-3">
        <Attribute label="Exact size">{selectedGroup?.exact || printText(selected.size_label)}</Attribute>
        <Attribute label="Presentation">{presentation(selected)}</Attribute>
        {selected.paper && <Attribute label="Fine art paper">{printText(selected.paper)}</Attribute>}
        {selected.finish && <Attribute label="Finish">{printText(selected.finish)}</Attribute>}
        {selected.framing_details && selected.framed && <Attribute label="Frame material">{printText(selected.framing_details)}</Attribute>}
        {selected.border && <Attribute label="Border"><BorderText value={selected.border} /></Attribute>}
        {selected.edition_size != null && <Attribute label="Edition">{selected.edition_size} copies</Attribute>}
      </dl>
    </section>}

    {selected && <section className="border-t border-black/15 pt-7">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-xs text-black/50">Total print price · EUR</p>
          <p className="mt-2 text-3xl font-medium tabular-nums">{money(selected.price, selected.currency)}</p></div>
        <p className="max-w-[175px] text-right text-[11px] text-black/45">Shipping calculated at checkout.</p>
      </div>
      <button type="button" onClick={addToCart} disabled={selected.price === null}
        className="mt-6 flex w-full items-center justify-between bg-black px-6 py-5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black/80 disabled:opacity-40">
        <span>{added ? "Added to cart" : "Add selected print to cart"}</span><span aria-hidden="true">{added ? "✓" : "+"}</span>
      </button>
      {added && <Link href="/cart" className="mt-3 block border border-black px-5 py-4 text-center text-xs uppercase tracking-widest hover:bg-black hover:text-white">View cart</Link>}
      <p className="mt-3 text-[11px] leading-5 text-black/45">Your website price is in EUR. Creativehub supplier retail prices are recorded in GBP and converted when prices are synchronized. Original artwork files remain private.</p>
    </section>}
  </div>;
}
