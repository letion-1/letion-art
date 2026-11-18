import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type CollectionInfo = {
  slug: string;
  title: string;
};

type PrintVariant = {
  id: string;

  name: string;

  price:
    | number
    | null;

  currency:
    | string
    | null;

  sort_order: number;
};

type ShopArtwork = {
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

  edition_type:
    | string
    | null;

  edition_size:
    | number
    | null;

  collections:
    | CollectionInfo
    | CollectionInfo[]
    | null;

  print_variants:
    | PrintVariant[]
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

  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function getLowestPrice(
  variants:
    | PrintVariant[]
    | null
) {
  if (!variants) {
    return null;
  }

  const priced =
    variants.filter(
      (variant) =>
        variant.price !== null
    );

  if (priced.length === 0) {
    return null;
  }

  return priced.reduce(
    (lowest, current) => {
      if (
        current.price === null
      ) {
        return lowest;
      }

      if (
        lowest.price === null ||
        current.price <
          lowest.price
      ) {
        return current;
      }

      return lowest;
    }
  );
}

function formatPrice(
  value: number,
  currency = "EUR"
) {
  try {
    return new Intl.NumberFormat(
      "en-IE",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export default async function ShopPage() {
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
      edition_type,
      edition_size,

      collections:collections!artworks_collection_id_fkey (
        slug,
        title
      ),

      print_variants (
        id,
        name,
        price,
        currency,
        sort_order
      )
    `)
    .eq(
      "published",
      true
    )
    .eq(
      "prints_available",
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
      "Could not load shop:",
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
      []) as unknown as ShopArtwork[];

  return (
    <main className="min-h-screen text-[#111111]">
      {/* =====================================
          HEADER
      ====================================== */}

      <header className="px-6 py-7 md:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.25em]"
          >
            LETION KETIENYA
          </Link>

          <nav className="hidden items-center gap-7 text-[10px] uppercase tracking-[0.18em] md:flex">
            <Link
              href="/works"
              className="transition hover:opacity-50"
            >
              Works
            </Link>

            <Link
              href="/collections"
              className="transition hover:opacity-50"
            >
              Collections
            </Link>

            <Link
              href="/mr-dreamer"
              className="transition hover:opacity-50"
            >
              Mr. Dreamer
            </Link>

            <Link
              href="/about"
              className="transition hover:opacity-50"
            >
              About
            </Link>

            <Link href="/shop">
              Prints
            </Link>
          </nav>
        </div>
      </header>

      {/* =====================================
          INTRO
      ====================================== */}

      <section className="border-t border-black/10 px-6 py-24 md:px-10 md:py-36">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
            Fine art editions
          </p>

          <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_0.55fr] lg:items-end">
            <h1 className="text-6xl font-medium tracking-[-0.06em] sm:text-7xl md:text-8xl lg:text-9xl">
              Prints.
            </h1>

            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-8 text-black/55">
                Selected works available
                as fine art editions.
                Created for collectors,
                interiors and spaces where
                the work can continue its
                story.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          SHOP GRID
      ====================================== */}

      {artworks.length >
      0 ? (
        <section className="px-6 pb-32 md:px-10">
          <div className="mx-auto grid max-w-[1600px] gap-x-6 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">
            {artworks.map(
              (artwork) => {
                const collection =
                  getCollection(
                    artwork.collections
                  );

                const lowestPrice =
                  getLowestPrice(
                    artwork.print_variants
                  );

                return (
                  <Link
                    key={
                      artwork.id
                    }
                    href={`/shop/${artwork.slug}`}
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

                      <div className="absolute bottom-4 left-4 bg-white px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-black">
                        Fine art print
                      </div>
                    </div>

                    <div className="mt-5">
                      {collection && (
                        <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">
                          {
                            collection.title
                          }
                        </p>
                      )}

                      <div className="mt-2 flex items-start justify-between gap-6">
                        <div>
                          <h2 className="text-lg font-medium tracking-[-0.02em]">
                            {
                              artwork.title
                            }
                          </h2>

                          {(artwork.edition_type ||
                            artwork.edition_size !==
                              null) && (
                            <p className="mt-2 text-xs leading-5 text-black/45">
                              {
                                artwork.edition_type
                              }

                              {artwork.edition_type &&
                                artwork.edition_size !==
                                  null &&
                                " · "}

                              {artwork.edition_size !==
                                null &&
                                `Edition of ${artwork.edition_size}`}
                            </p>
                          )}
                        </div>

                        {lowestPrice?.price !==
                          null &&
                          lowestPrice && (
                          <p className="shrink-0 text-sm">
                            From{" "}
                            {formatPrice(
                              lowestPrice.price!,
                              lowestPrice.currency ??
                                "EUR"
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        </section>
      ) : (
        <section className="px-6 pb-32 md:px-10">
          <div className="mx-auto max-w-[1600px] border-t border-black/10 py-24">
            <p className="text-sm text-black/40">
              Print editions will
              appear here soon.
            </p>
          </div>
        </section>
      )}

      {/* =====================================
          SHOP STATEMENT
      ====================================== */}

      <section className="bg-[#111111] px-6 py-28 text-white md:px-10 md:py-40">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Collecting
          </p>

          <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_0.55fr] lg:items-end">
            <h2 className="max-w-5xl text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
              Art should live
              beyond the screen.
            </h2>

            <p className="max-w-md text-base leading-8 text-white/55">
              Each edition is an
              extension of the original
              work, created to bring the
              image into a new space and
              a new story.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================
          FOOTER
      ====================================== */}

      <footer className="bg-[#111111] px-6 pb-8 text-white md:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 border-t border-white/10 pt-8 text-[9px] uppercase tracking-[0.18em] text-white/35 md:flex-row md:items-center md:justify-between">
          <p>
            ©{" "}
            {new Date().getFullYear()}{" "}
            Letion Ketienya
          </p>

          <div className="flex gap-5">
            <Link href="/works">
              Works
            </Link>

            <Link href="/collections">
              Collections
            </Link>

            <Link href="/about">
              About
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}