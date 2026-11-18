import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function StudioPage() {
  const supabase =
    await createClient();

  const [
    { count: artworkCount },
    { count: collectionCount },
    { count: printCount },
  ] = await Promise.all([
    supabase
      .from("artworks")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("collections")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("print_variants")
      .select("*", {
        count: "exact",
        head: true,
      }),
  ]);

  return (
    <main className="px-6 py-12 md:px-10 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-black/45">
            Private workspace
          </p>

          <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
            Studio
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-black/55">
            Manage your artwork, collections, editions and
            print information without touching the code.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <div className="border border-black/10 p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-black/45">
              Artworks
            </p>

            <p className="mt-5 text-5xl font-medium">
              {artworkCount ?? 0}
            </p>
          </div>

          <div className="border border-black/10 p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-black/45">
              Collections
            </p>

            <p className="mt-5 text-5xl font-medium">
              {collectionCount ?? 0}
            </p>
          </div>

          <div className="border border-black/10 p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-black/45">
              Print variants
            </p>

            <p className="mt-5 text-5xl font-medium">
              {printCount ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <Link
            href="/studio/artworks/new"
            className="border border-black bg-black px-7 py-6 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-transparent hover:text-black"
          >
            + New artwork
          </Link>

          <Link
            href="/studio/artworks"
            className="border border-black/15 px-7 py-6 text-sm uppercase tracking-[0.18em] transition hover:border-black"
          >
            Manage artworks
          </Link>

          <Link
            href="/studio/collections"
            className="border border-black/15 px-7 py-6 text-sm uppercase tracking-[0.18em] transition hover:border-black"
          >
            Manage collections
          </Link>
        </div>
      </div>
    </main>
  );
}