import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type Collection = {
  id: string;
  slug: string;
  title: string;
  period: string | null;
  introduction: string | null;
  description: string | null;
  hero_image_url: string | null;
};

type Artwork = {
  id: string;
  slug: string;
  title: string;
  year: string | null;
  medium: string | null;
  image_url: string | null;
  original_available: boolean;
  original_status: string | null;
  prints_available: boolean;
};

export default async function CollectionPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } =
    await params;

  const supabase =
    await createClient();

  /*
   * Public collection.
   */
  const {
    data: collection,
    error: collectionError,
  } = await supabase
    .from("collections")
    .select(`
      id,
      slug,
      title,
      period,
      introduction,
      description,
      hero_image_url
    `)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (
    collectionError ||
    !collection
  ) {
    notFound();
  }

  /*
   * Only published artworks
   * belonging to this collection.
   */
  const {
    data,
    error: artworkError,
  } = await supabase
    .from("artworks")
    .select(`
      id,
      slug,
      title,
      year,
      medium,
      image_url,
      original_available,
      original_status,
      prints_available
    `)
    .eq(
      "collection_id",
      collection.id
    )
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

  if (artworkError) {
    console.error(
      "Could not load collection artworks:",
      artworkError
    );
  }

  const artworks: Artwork[] =
    data ?? [];

  return (
    <main className="relative min-h-screen text-[#111111]">
      {/* NAV */}
      <header className="relative z-30 px-6 py-7 md:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
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

            <Link
              href="/collections"
              className="font-semibold"
            >
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
        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pb-12 pt-16 md:px-10 md:pb-20 md:pt-24">
        <div className="mx-auto max-w-[1600px]">
          <Link
            href="/collections"
            className="text-[10px] uppercase tracking-[0.22em] text-black/40 transition hover:text-black"
          >
            ← Collections
          </Link>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-black/35">
                Collection
              </p>

              <h1 className="mt-5 max-w-5xl text-5xl font-medium uppercase tracking-[-0.06em] sm:text-7xl md:text-8xl lg:text-[7rem] lg:leading-[0.88]">
                {
                  collection.title
                }
              </h1>
            </div>

            <div className="lg:pb-2">
              {collection.period && (
                <p className="text-xs uppercase tracking-[0.2em] text-black/35">
                  {
                    collection.period
                  }
                </p>
              )}

              {collection.introduction && (
                <p className="mt-5 max-w-xl text-base leading-8 text-black/55">
                  {
                    collection.introduction
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* HERO IMAGE */}
      {collection.hero_image_url && (
        <section className="px-6 md:px-10">
          <div className="mx-auto max-w-[1600px]">
            <div className="relative aspect-[16/8] overflow-hidden bg-black/5">
              <img
                src={
                  collection.hero_image_url
                }
                alt={
                  collection.title
                }
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* STORY */}
      {collection.description && (
        <section className="px-6 py-20 md:px-10 md:py-28">
          <div className="mx-auto grid max-w-[1600px] gap-8 lg:grid-cols-[0.4fr_1fr]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-black/35">
              About the collection
            </p>

            <p className="max-w-3xl whitespace-pre-line text-xl leading-9 tracking-[-0.015em] text-black/70 md:text-2xl md:leading-10">
              {
                collection.description
              }
            </p>
          </div>
        </section>
      )}

      {/* ARTWORKS */}
      <section className="px-6 pb-32 pt-12 md:px-10 md:pb-40">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-12 flex items-end justify-between border-b border-black/10 pb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-black/35">
                Works
              </p>

              <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] md:text-4xl">
                {
                  collection.title
                }
              </h2>
            </div>

            <span className="text-[10px] uppercase tracking-[0.18em] text-black/30">
              {
                artworks.length
              }{" "}
              works
            </span>
          </div>

          {artworks.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
              {artworks.map(
                (
                  artwork,
                  index
                ) => (
                  <ArtworkCard
                    key={
                      artwork.id
                    }
                    artwork={
                      artwork
                    }
                    index={
                      index
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="py-20">
              <p className="text-sm text-black/40">
                No published
                works in this
                collection yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ArtworkCard({
  artwork,
  index,
}: {
  artwork: Artwork;
  index: number;
}) {
  return (
    <article className="group">
      <Link
        href={`/works/${artwork.slug}`}
        className="block"
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
              <span className="text-xs uppercase tracking-[0.2em] text-black/25">
                Artwork
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="mt-5">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-black/30">
              {String(
                index + 1
              ).padStart(
                2,
                "0"
              )}
            </p>

            <Link
              href={`/works/${artwork.slug}`}
            >
              <h3 className="mt-2 text-xl font-medium tracking-[-0.025em] transition hover:opacity-50">
                {
                  artwork.title
                }
              </h3>
            </Link>
          </div>

          {artwork.year && (
            <span className="text-xs text-black/35">
              {
                artwork.year
              }
            </span>
          )}
        </div>

        {artwork.medium && (
          <p className="mt-2 text-xs text-black/40">
            {
              artwork.medium
            }
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {artwork.original_available &&
            artwork.original_status ===
              "available" && (
              <Tag>
                Original available
              </Tag>
            )}

          {artwork.original_status ===
            "sold" && (
            <Tag>
              Original sold
            </Tag>
          )}

          {artwork.prints_available && (
            <Tag>
              Prints available
            </Tag>
          )}
        </div>
      </div>
    </article>
  );
}

function Tag({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span className="border border-black/15 px-2.5 py-1 text-[8px] uppercase tracking-[0.16em] text-black/45">
      {children}
    </span>
  );
}