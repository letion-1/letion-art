import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import NewArtworkForm from "./NewArtworkForm";

export default async function NewArtworkPage() {
  const supabase = await createClient();

  const { data: collections, error } =
    await supabase
      .from("collections")
      .select("id, title, slug")
      .order("sort_order", {
        ascending: true,
      });

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <p className="text-sm text-red-700">
          Could not load collections: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
      <div className="mb-10 border-b border-black/10 pb-6">
        <Link
          href="/studio/artworks"
          className="text-xs uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
        >
          ← Artworks
        </Link>
      </div>

      <NewArtworkForm
        collections={collections ?? []}
      />
    </main>
  );
}