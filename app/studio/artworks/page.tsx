import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type Collection = {
  id: string;
  title: string;
  slug: string;
};

type Artwork = {
  id: string;
  title: string;
  slug: string;
  year: string | null;
  medium: string | null;
  image_url: string | null;
  published: boolean;
  featured: boolean;
  original_available: boolean;
  prints_available: boolean;
  created_at: string;

  collections:
    | Collection
    | Collection[]
    | null;
};

function getCollection(
  relation:
    | Collection
    | Collection[]
    | null
) {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

export default async function StudioArtworksPage() {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("artworks")
    .select(`
      id,
      title,
      slug,
      year,
      medium,
      image_url,
      published,
      featured,
      original_available,
      prints_available,
      created_at,

      collections:collections!artworks_collection_id_fkey (
        id,
        title,
        slug
      )
    `)
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <p className="text-xs uppercase tracking-[0.25em] text-red-700">
          Could not load artworks
        </p>

        <p className="mt-4 max-w-xl text-sm leading-6 text-black/60">
          {error.message}
        </p>

        {error.details && (
          <p className="mt-3 max-w-xl text-xs leading-6 text-black/40">
            {error.details}
          </p>
        )}

        {error.hint && (
          <p className="mt-3 max-w-xl text-xs leading-6 text-black/40">
            {error.hint}
          </p>
        )}
      </main>
    );
  }

  const artworks =
    (data ??
      []) as unknown as Artwork[];

  const publishedCount =
    artworks.filter(
      (artwork) =>
        artwork.published
    ).length;

  const originalsCount =
    artworks.filter(
      (artwork) =>
        artwork.original_available
    ).length;

  const printsCount =
    artworks.filter(
      (artwork) =>
        artwork.prints_available
    ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
      {/* PAGE HEADER */}

      <section className="border-b border-black/10 pb-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/40">
              Studio / Catalogue
            </p>

            <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
              Artworks
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-black/50">
              Manage your artwork catalogue,
              availability, publishing and
              print editions.
            </p>
          </div>

          <Link
            href="/studio/artworks/new"
            className="inline-flex w-fit items-center justify-center border border-black bg-black px-6 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:bg-transparent hover:text-black"
          >
            + New Artwork
          </Link>
        </div>
      </section>

      {/* STATS */}

      <section className="grid border-b border-black/10 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total works"
          value={
            artworks.length
          }
        />

        <Stat
          label="Published"
          value={
            publishedCount
          }
        />

        <Stat
          label="Originals available"
          value={
            originalsCount
          }
        />

        <Stat
          label="Prints enabled"
          value={
            printsCount
          }
        />
      </section>

      {/* ARTWORK GRID */}

      {artworks.length >
      0 ? (
        <section className="grid grid-cols-1 gap-x-6 gap-y-14 py-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {artworks.map(
            (artwork) => {
              const collection =
                getCollection(
                  artwork.collections
                );

              return (
                <article
                  key={
                    artwork.id
                  }
                  className="group"
                >
                  {/* IMAGE */}

                  <Link
                    href={`/studio/artworks/${artwork.id}/edit`}
                    className="relative block aspect-[4/5] overflow-hidden bg-black/5"
                  >
                    {artwork.image_url ? (
                      <img
                        src={
                          artwork.image_url
                        }
                        alt={
                          artwork.title
                        }
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-xs uppercase tracking-[0.2em] text-black/25">
                          No image
                        </span>
                      </div>
                    )}

                    {/* TOP BADGES */}

                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <StatusBadge
                        active={
                          artwork.published
                        }
                        activeLabel="Published"
                        inactiveLabel="Draft"
                      />

                      {artwork.featured && (
                        <span className="bg-white px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-black">
                          Featured
                        </span>
                      )}
                    </div>

                    {/* EDIT OVERLAY */}

                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-black px-4 py-3 text-white transition duration-300 group-hover:translate-y-0">
                      <span className="text-[10px] uppercase tracking-[0.2em]">
                        Edit artwork →
                      </span>
                    </div>
                  </Link>

                  {/* INFORMATION */}

                  <div className="mt-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/studio/artworks/${artwork.id}/edit`}
                          className="block truncate text-lg font-medium tracking-[-0.02em] transition hover:opacity-50"
                        >
                          {
                            artwork.title
                          }
                        </Link>

                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-black/40">
                          {collection?.title ??
                            "No collection"}
                        </p>
                      </div>

                      {artwork.year && (
                        <span className="shrink-0 text-xs text-black/35">
                          {
                            artwork.year
                          }
                        </span>
                      )}
                    </div>

                    {artwork.medium && (
                      <p className="mt-3 truncate text-xs text-black/45">
                        {
                          artwork.medium
                        }
                      </p>
                    )}

                    {/* AVAILABILITY */}

                    <div className="mt-5 grid grid-cols-2 border-y border-black/10">
                      <Availability
                        label="Original"
                        active={
                          artwork.original_available
                        }
                      />

                      <Availability
                        label="Prints"
                        active={
                          artwork.prints_available
                        }
                        right
                      />
                    </div>

                    {/* EDIT LINK */}

                    <Link
                      href={`/studio/artworks/${artwork.id}/edit`}
                      className="mt-4 inline-block text-[10px] uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
                    >
                      Edit →
                    </Link>
                  </div>
                </article>
              );
            }
          )}
        </section>
      ) : (
        <section className="py-24 text-center">
          <p className="text-sm text-black/45">
            No artworks found.
          </p>

          <Link
            href="/studio/artworks/new"
            className="mt-6 inline-block text-xs uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Add your first artwork
          </Link>
        </section>
      )}

      {/* FOOTER COUNT */}

      {artworks.length >
        0 && (
        <div className="border-t border-black/10 py-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/30">
            {
              artworks.length
            }{" "}
            artworks in catalogue
          </p>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border-black/10 py-7 first:pl-0 sm:border-r sm:px-6">
      <p className="text-3xl font-medium tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-black/40">
        {label}
      </p>
    </div>
  );
}

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={`px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] ${
        active
          ? "bg-black text-white"
          : "bg-white text-black"
      }`}
    >
      {active
        ? activeLabel
        : inactiveLabel}
    </span>
  );
}

function Availability({
  label,
  active,
  right = false,
}: {
  label: string;
  active: boolean;
  right?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${
        right
          ? "border-l border-black/10 pl-4"
          : "pr-4"
      }`}
    >
      <span className="text-[9px] uppercase tracking-[0.16em] text-black/40">
        {label}
      </span>

      <span
        className={`h-2 w-2 rounded-full ${
          active
            ? "bg-black"
            : "border border-black/25"
        }`}
      />
    </div>
  );
}