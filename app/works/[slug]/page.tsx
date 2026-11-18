import Link from "next/link";

import { notFound } from "next/navigation";

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

  description:
    | string
    | null;

  image_url:
    | string
    | null;

  original_available: boolean;

  original_dimensions:
    | string
    | null;

  original_price:
    | number
    | null;

  original_currency:
    | string
    | null;

  original_status:
    | string
    | null;

  prints_available: boolean;

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

  paper:
    | string
    | null;

  finish:
    | string
    | null;

  framed: boolean;

  framing_details:
    | string
    | null;

  sort_order: number;
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

function formatPrice(
  value: number,
  currency = "EUR"
) {
  try {
    return new Intl.NumberFormat(
      "en-IE",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          2,
      }
    ).format(
      value
    );
  } catch {
    return `${currency} ${value.toFixed(
      2
    )}`;
  }
}

export default async function ArtworkPage({
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
      description,
      image_url,

      original_available,
      original_dimensions,
      original_price,
      original_currency,
      original_status,

      prints_available,
      edition_type,
      edition_size,

      collections:collections!artworks_collection_id_fkey (
        slug,
        title
      )
    `)
    .eq(
      "slug",
      slug
    )
    .eq(
      "published",
      true
    )
    .single();

  if (
    error ||
    !data
  ) {
    notFound();
  }

  const artwork =
    data as unknown as Artwork;

  const collection =
    getCollection(
      artwork.collections
    );

  let variants:
    PrintVariant[] = [];

  if (
    artwork.prints_available
  ) {
    const {
      data:
        variantData,

      error:
        variantError,
    } = await supabase
      .from(
        "print_variants"
      )
      .select(`
        id,
        name,
        price,
        currency,
        paper,
        finish,
        framed,
        framing_details,
        sort_order
      `)
      .eq(
        "artwork_id",
        artwork.id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

    if (
      variantError
    ) {
      console.error(
        "Could not load print variants:",
        {
          message:
            variantError.message,

          details:
            variantError.details,

          hint:
            variantError.hint,

          code:
            variantError.code,
        }
      );
    }

    variants =
      (variantData ??
        []) as PrintVariant[];
  }

  return (
    <main className="min-h-screen px-6 pb-24 pt-8 text-[#111111] md:px-10">
      <header className="mx-auto flex max-w-[1600px] items-center justify-between py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.25em]"
        >
          LETION KETIENYA
        </Link>

        <Link
          href="/works"
          className="text-[10px] uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
        >
          ← All works
        </Link>
      </header>

      <section className="mx-auto mt-12 grid max-w-[1600px] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <div className="overflow-hidden bg-black/5">
            {artwork.image_url ? (
              <img
                src={
                  artwork.image_url
                }
                alt={
                  artwork.title
                }
                className="h-auto w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center text-xs uppercase tracking-[0.2em] text-black/25">
                Artwork
              </div>
            )}
          </div>
        </div>

        <div className="lg:pt-8">
          {collection && (
            <Link
              href={`/collections/${collection.slug}`}
              className="text-[10px] uppercase tracking-[0.25em] text-black/40 transition hover:text-black"
            >
              {
                collection.title
              }
            </Link>
          )}

          <h1 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
            {
              artwork.title
            }
          </h1>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-black/45">
            {artwork.year && (
              <span>
                {
                  artwork.year
                }
              </span>
            )}

            {artwork.medium && (
              <span>
                {
                  artwork.medium
                }
              </span>
            )}

            {artwork.original_dimensions && (
              <span>
                {
                  artwork.original_dimensions
                }
              </span>
            )}
          </div>

          {artwork.description && (
            <p className="mt-10 max-w-xl whitespace-pre-line text-base leading-8 text-black/60">
              {
                artwork.description
              }
            </p>
          )}

          <OriginalPanel
            artwork={
              artwork
            }
          />

          <PrintPanel
            artwork={
              artwork
            }
            variants={
              variants
            }
          />
        </div>
      </section>
    </main>
  );
}

function OriginalPanel({
  artwork,
}: {
  artwork: Artwork;
}) {
  const status =
    artwork.original_status ??
    "not_for_sale";

  const shouldShow =
    artwork.original_available ||
    status === "sold" ||
    status === "reserved";

  if (
    !shouldShow
  ) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-black/15 pt-8">
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        Original
      </p>

      {status ===
        "sold" && (
        <>
          <h2 className="mt-4 text-2xl font-medium">
            Sold
          </h2>

          <p className="mt-3 text-sm leading-6 text-black/50">
            The original artwork
            is no longer available.
          </p>
        </>
      )}

      {status ===
        "reserved" && (
        <>
          <h2 className="mt-4 text-2xl font-medium">
            Reserved
          </h2>

          <p className="mt-3 text-sm leading-6 text-black/50">
            The original artwork
            is currently reserved.
          </p>
        </>
      )}

      {artwork.original_available &&
        status ===
          "available" && (
          <>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl font-medium">
                  Original available
                </h2>

                {artwork.original_price !==
                  null && (
                  <p className="mt-3 text-lg">
                    {formatPrice(
                      artwork.original_price,
                      artwork.original_currency ??
                        "EUR"
                    )}
                  </p>
                )}
              </div>

              <a
                href="#contact"
                className="border border-black px-5 py-3 text-[10px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
              >
                Enquire
              </a>
            </div>
          </>
        )}
    </section>
  );
}

function PrintPanel({
  artwork,
  variants,
}: {
  artwork: Artwork;

  variants:
    PrintVariant[];
}) {
  if (
    !artwork.prints_available
  ) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-black/15 pt-8">
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        Prints
      </p>

      <div className="mt-4">
        <h2 className="text-2xl font-medium">
          Fine art editions
        </h2>

        {(artwork.edition_type ||
          artwork.edition_size !==
            null) && (
          <p className="mt-3 text-sm text-black/50">
            {artwork.edition_type}

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

      {variants.length >
        0 && (
        <div className="mt-8 space-y-4">
          {variants.map(
            (variant) => (
              <div
                key={
                  variant.id
                }
                className="border border-black/10 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="font-medium">
                      {
                        variant.name
                      }
                    </p>

                    {(variant.paper ||
                      variant.finish) && (
                      <p className="mt-2 text-xs leading-5 text-black/45">
                        {
                          variant.paper
                        }

                        {variant.paper &&
                          variant.finish &&
                          " · "}

                        {
                          variant.finish
                        }
                      </p>
                    )}

                    {variant.framed && (
                      <p className="mt-2 text-xs leading-5 text-black/45">
                        Framed

                        {variant.framing_details &&
                          ` · ${variant.framing_details}`}
                      </p>
                    )}
                  </div>

                  {variant.price !==
                    null && (
                    <p className="text-sm font-medium">
                      {formatPrice(
                        variant.price,
                        variant.currency ??
                          "EUR"
                      )}
                    </p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <a
        href="#contact"
        className="mt-6 inline-flex border border-black px-5 py-3 text-[10px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
      >
        Enquire about print
      </a>
    </section>
  );
}