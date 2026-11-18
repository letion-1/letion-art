import Link from "next/link";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import CollectionEditor from "./CollectionEditor";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const supabase =
    await createClient();

  const [
    collectionResult,
    artworkResult,
  ] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .single(),

    supabase
      .from("artworks")
      .select(`
        id,
        title,
        slug,
        image_url,
        published,
        sort_order
      `)
      .eq(
        "collection_id",
        id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),
  ]);

  if (
    collectionResult.error ||
    !collectionResult.data
  ) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
      <div className="mb-10 flex items-center justify-between border-b border-black/10 pb-6">
        <Link
          href="/studio/collections"
          className="text-xs uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
        >
          ← Collections
        </Link>

        <span className="text-[10px] uppercase tracking-[0.2em] text-black/30">
          {
            artworkResult
              .data?.length ?? 0
          }{" "}
          artworks
        </span>
      </div>

      <CollectionEditor
        collection={
          collectionResult.data
        }
        artworks={
          artworkResult.data ?? []
        }
      />
    </main>
  );
}