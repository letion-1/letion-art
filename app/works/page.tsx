import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type CollectionInfo = {
  slug: string;
  title: string;
};

type Artwork = {
  id: string;
  slug: string;
  title: string;

  year:
    | string
    | null;

  medium:
    | string
    | null;

  image_url:
    | string
    | null;

  featured: boolean;

  original_available: boolean;

  original_status:
    | string
    | null;

  prints_available: boolean;

  collections:
    | CollectionInfo
    | CollectionInfo[]
    | null;
};

function getCollection(
  relation:
    | CollectionInfo
    | CollectionInfo[]
    | null
) {
  if (!relation) {
    return null;
  }

  if (
    Array.isArray(
      relation
    )
  ) {
    return (
      relation[0] ??
      null
    );
  }

  return relation;
}

export default async function WorksPage() {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("artworks")
    .select(`
      id,
      slug,
      title,
      year,
      medium,
      image_url,
      featured,
      original_available,
      original_status,
      prints_available,

      collections:collections!artworks_collection_id_fkey (
        slug,
        title
      )
    `)
    .eq(
      "published",
      true
    )
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (error) {
    console.error(
      "Could not load works:",
      {
        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        code:
          error.code,
      }
    );
  }

  const artworks =
    (data ??
      []) as unknown as Artwork[];

  return (
    <main className="min-h-screen px-6 pb-24 pt-8 text-[#111111] md:px-10">
      <header className="mx-auto flex max-w-[1600px] items-center justify-between py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.25em]"
        >
          LETION KETIENYA
        </Link>

        <nav className="hidden items-center gap-7 text-[10px] uppercase tracking-[0.18em] md:flex">
          <Link href="/works">
            Works
          </Link>

          <Link href="/collections">
            Collections
          </Link>

          <Link href="/mr-dreamer">
            Mr. Dreamer
          </Link>

          <Link href="/about">
            About
          </Link>

          <Link href="/shop">
            Prints
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-[1600px] border-t border-black/10 pt-20 md:pt-28">
        <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
          Archive
        </p>

        <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_0.55fr] lg:items-end">
          <h1 className="text-6xl font-medium tracking-[-0.06em] sm:text-7xl md:text-8xl">
            Works
          </h1>

          <p className="max-w-lg text-base leading-8 text-black/55">
            Paintings, characters,
            visual experiments and
            evolving narratives.
          </p>
        </div>
      </section>

      {artworks.length >
      0 ? (
        <section className="mx-auto mt-20 grid max-w-[1600px] grid-cols-1 gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {artworks.map(
            (artwork) => {
              const collection =
                getCollection(
                  artwork.collections
                );

              return (
                <Link
                  key={
                    artwork.id
                  }
                  href={`/works/${artwork.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-black/5">
                    {artwork.image_url ? (
                      <img
                        src={
                          artwork.image_url
                        }
                        alt={
                          artwork.title
                        }
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-black/25">
                          Artwork
                        </span>
                      </div>
                    )}

                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      {artwork.original_status ===
                        "sold" && (
                        <span className="bg-black px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-white">
                          Sold
                        </span>
                      )}

                      {artwork.original_available &&
                        artwork.original_status ===
                          "available" && (
                          <span className="bg-white px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-black">
                            Original
                          </span>
                        )}

                      {artwork.prints_available && (
                        <span className="bg-white px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-black">
                          Prints
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-5">
                      <h2 className="text-lg font-medium tracking-[-0.02em]">
                        {
                          artwork.title
                        }
                      </h2>

                      {artwork.year && (
                        <span className="shrink-0 text-[10px] text-black/35">
                          {
                            artwork.year
                          }
                        </span>
                      )}
                    </div>

                    {(collection ||
                      artwork.medium) && (
                      <p className="mt-2 text-xs leading-5 text-black/40">
                        {collection?.title}

                        {collection &&
                          artwork.medium &&
                          " · "}

                        {
                          artwork.medium
                        }
                      </p>
                    )}
                  </div>
                </Link>
              );
            }
          )}
        </section>
      ) : (
        <section className="mx-auto mt-20 max-w-[1600px] border-t border-black/10 py-20">
          <p className="text-sm text-black/40">
            No published artworks yet.
          </p>
        </section>
      )}
    </main>
  );
}