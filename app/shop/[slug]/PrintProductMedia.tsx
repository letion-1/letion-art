"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { printDimension, printText } from "@/lib/print-display-text";
import type { ShopPrintVariant } from "./PrintConfigurator";

export type SupplierPhoto = {
  photo_key: string;
  image_url: string;
  caption: string | null;
  supplier_variant_id?: string | null;
};

type Selection = {
  selectedVariantId: string | null;
  selectVariant: (id: string) => void;
  showArtwork: boolean;
  setShowArtwork: (value: boolean) => void;
};
const SelectionContext = createContext<Selection | null>(null);

export function useShopPrintSelection(): Selection {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("Shop print selector must be wrapped in PrintProductMediaProvider");
  return context;
}

export function PrintProductMediaProvider({ children, variants }: {
  children: ReactNode;
  variants: ShopPrintVariant[];
}) {
  const first = [...variants].sort((a, b) =>
    (Number(a.width_mm || Infinity) * Number(a.height_mm || Infinity)) -
    (Number(b.width_mm || Infinity) * Number(b.height_mm || Infinity)) ||
    Number(a.framed) - Number(b.framed)
  )[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(first?.id ?? null);
  const [showArtwork, setShowArtwork] = useState(false);
  function selectVariant(id: string) { setSelectedVariantId(id); setShowArtwork(false); }
  return (
    <SelectionContext.Provider value={{ selectedVariantId, selectVariant, showArtwork, setShowArtwork }}>
      {children}
    </SelectionContext.Provider>
  );
}

function variantPicture(variant: ShopPrintVariant | null, photos: SupplierPhoto[]): SupplierPhoto | undefined {
  if (!variant?.creativehub_variant_id) return undefined;
  return photos.find(photo =>
    photo.supplier_variant_id === variant.creativehub_variant_id ||
    photo.photo_key === `variant:${variant.creativehub_variant_id}`
  );
}

export function printPictureForVariant(variant: ShopPrintVariant | null, photos: SupplierPhoto[]): SupplierPhoto | undefined {
  return variantPicture(variant, photos);
}

export default function PrintProductMedia({ title, artworkImage, variants, photos }: {
  title: string;
  artworkImage: string | null;
  variants: ShopPrintVariant[];
  photos: SupplierPhoto[];
}) {
  const { selectedVariantId, selectVariant, showArtwork, setShowArtwork } = useShopPrintSelection();
  const selected = variants.find(v => v.id === selectedVariantId) ?? variants[0] ?? null;
  const photo = useMemo(() => variantPicture(selected, photos), [selected, photos]);
  const artworkPhoto = photos.find(p => p.photo_key === "artwork-preview");
  const fallback = artworkImage || artworkPhoto?.image_url || null;
  const shownUrl = !showArtwork && photo?.image_url ? photo.image_url : fallback;
  const imageIsMockup = !!photo && !showArtwork && shownUrl === photo.image_url;
  const frame = selected?.framed ? `${printText(selected.frame_style) || "Framed"} frame` : "Unframed print";
  const dimension = selected ? printDimension(selected.width_mm, selected.height_mm) || printText(selected.size_label) : "";
  const mockupVariants = photos.filter(p => p.supplier_variant_id && variants.some(v => v.creativehub_variant_id === p.supplier_variant_id));

  return (
    <div className="lg:sticky lg:top-8 lg:self-start">
      <div className="flex aspect-[4/5] max-h-[780px] min-h-[340px] items-center justify-center overflow-hidden bg-[#eae8e3] p-5 sm:p-9">
        {shownUrl ? (
          <img key={shownUrl} src={shownUrl} alt={imageIsMockup ? `${title}, ${dimension}, ${frame}` : `${title}, artwork preview`}
            className="h-full max-h-[720px] w-full object-contain" loading="eager" />
        ) : <span className="text-sm text-black/35">Artwork preview unavailable</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs text-black/55">
        <span>{imageIsMockup ? `Creativehub product preview · ${frame}` : "Artwork preview"}</span>
        {dimension && <span className="tabular-nums">{dimension}</span>}
      </div>
      {!photo && selected && <p className="mt-2 text-xs text-black/40">Creativehub has not provided a separate image for this exact option.</p>}
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Product photo views">
        {fallback && <button type="button" onClick={() => setShowArtwork(true)} aria-pressed={!imageIsMockup}
          className={`flex items-center gap-2 border px-3 py-2 text-xs ${!imageIsMockup ? "border-black" : "border-black/15"}`}>
          <img src={fallback} alt="" className="h-10 w-10 object-contain" /> Artwork
        </button>}
        {photo && <button type="button" onClick={() => setShowArtwork(false)} aria-pressed={imageIsMockup}
          className={`flex items-center gap-2 border px-3 py-2 text-xs ${imageIsMockup ? "border-black" : "border-black/15"}`}>
          <img src={photo.image_url} alt="" className="h-10 w-10 object-contain" /> Selected print
        </button>}
      </div>
      {mockupVariants.length > 1 && (
        <details className="mt-5 border-t border-black/10 pt-4">
          <summary className="cursor-pointer text-xs text-black/60">Browse Creativehub product photos ({mockupVariants.length})</summary>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {mockupVariants.map(p => {
              const variant = variants.find(v => v.creativehub_variant_id === p.supplier_variant_id);
              if (!variant) return null;
              const selectedPhoto = selected?.id === variant.id && imageIsMockup;
              return <button type="button" key={p.photo_key} onClick={() => { selectVariant(variant.id); setShowArtwork(false); }}
                aria-label={`View ${printText(variant.name)} product photo`}
                aria-pressed={selectedPhoto} className={`shrink-0 border p-1 ${selectedPhoto ? "border-black" : "border-black/15"}`}>
                <img src={p.image_url} alt="" loading="lazy" className="h-16 w-16 object-contain" />
              </button>;
            })}
          </div>
        </details>
      )}
    </div>
  );
}
