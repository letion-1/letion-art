
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuotesClient from "./QuotesClient";

type ArtworkRow = {
  id: string;
  title: string;
};

type VariantRow = {
  id: string;
  artwork_id: string;
  name: string;
  size_label: string | null;
  framed: boolean;
  frame_style: string | null;
  price: number | null;
  currency: string;
  creativehub_sku: string | null;
};

export default async function CreativehubQuotesPage() {
  const supabase = await createClient();

  const [artworkResult, variantResult] =
    await Promise.all([
      supabase
        .from("artworks")
        .select("id, title")
        .order("title", { ascending: true }),

      supabase
        .from("print_variants")
        .select(`
          id,
          artwork_id,
          name,
          size_label,
          framed,
          frame_style,
          price,
          currency,
          creativehub_sku
        `)
        .not("creativehub_variant_id", "is", null)
        .not("creativehub_product_id", "is", null)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);

  if (artworkResult.error) {
    throw new Error(
      `Could not load artworks: ${artworkResult.error.message}`
    );
  }

  if (variantResult.error) {
    throw new Error(
      `Could not load mapped variants: ${variantResult.error.message}`
    );
  }

  const artworks =
    (artworkResult.data ?? []) as ArtworkRow[];

  const variants =
    (variantResult.data ?? []) as VariantRow[];

  const artworkMap = new Map(
    artworks.map((artwork) => [
      artwork.id,
      artwork.title,
    ])
  );

  const options = variants
    .map((variant) => ({
      id: variant.id,

      artworkTitle:
        artworkMap.get(variant.artwork_id) ??
        "Unknown artwork",

      name: variant.name,
      sizeLabel: variant.size_label,
      framed: variant.framed,
      frameStyle: variant.frame_style,

      price:
        variant.price === null
          ? null
          : Number(variant.price),

      currency: variant.currency,
      sku: variant.creativehub_sku,
    }))
    .sort(
      (a, b) =>
        a.artworkTitle.localeCompare(
          b.artworkTitle
        )
    );

  return (
    <main className="w-full min-w-0 pb-20">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-8">
        <div className="mb-8">
          <Link
            href="/studio/orders"
            className="text-[9px] uppercase tracking-[0.18em] text-black/40 transition hover:text-black"
          >
            ← Studio orders
          </Link>
        </div>

        <section className="mb-8 border-b border-black/10 pb-8">
          <p className="text-[9px] uppercase tracking-[0.28em] text-black/35">
            Studio · Creativehub
          </p>

          <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">
            Fulfilment quotes
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-black/45">
            Calculate production and delivery costs
            for your mapped artworks before submitting
            them to theprintspace.
          </p>

          <p className="mt-3 text-xs text-black/35">
            {options.length} mapped, active print
            {options.length === 1 ? " variant" : " variants"}
          </p>
        </section>

        <QuotesClient variants={options} />
      </div>
    </main>
  );
}
