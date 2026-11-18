import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import ArtworkEditor from "./ArtworkEditor";

export default async function EditArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const [
    artworkResult,
    collectionsResult,
    variantsResult,
  ] = await Promise.all([
    supabase
      .from("artworks")
      .select("*")
      .eq("id", id)
      .single(),

    supabase
      .from("collections")
      .select("id, title, slug")
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("print_variants")
      .select("*")
      .eq("artwork_id", id)
      .order("sort_order", {
        ascending: true,
      }),
  ]);

  if (
    artworkResult.error ||
    !artworkResult.data
  ) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
      <div className="mb-10 flex items-center justify-between border-b border-black/10 pb-6">
        <Link
          href="/studio/artworks"
          className="text-xs uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
        >
          ← Artworks
        </Link>

        <Link
          href={`/works/${artworkResult.data.slug}`}
          target="_blank"
          className="text-xs uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
        >
          View public page ↗
        </Link>
      </div>

      <ArtworkEditor
        artwork={artworkResult.data}
        collections={
          collectionsResult.data ?? []
        }
        initialVariants={
          variantsResult.data ?? []
        }
      />
    </main>
  );
}