import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import PrintConfigurator, {
  type ShopPrintVariant,
} from "./PrintConfigurator";

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

export default async function ShopArtworkPage({
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
    .eq(
      "prints_available",
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
      size_label,
      width_mm,
      height_mm,
      price,
      currency,
      paper,
      finish,
      framed,
      frame_style,
      framing_details,
      active,
      sort_order
    `)
    .eq(
      "artwork_id",
      artwork.id
    )
    .eq(
      "active",
      true
    )
    .eq(
      "currency",
      "EUR"
    )
    .gt(
      "price",
      0
    )
    .order(
      "sort_order",
      {
        ascending:
          true,
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

  const variants =
    (variantData ??
      []) as ShopPrintVariant[];

  return (
    <main className="min-h-screen text-[#111111]">
      {/* HEADER */}

      <header className="px-6 py-7 md:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[0.25em]"
          >
            LETION KETIENYA
          </Link>

          <Link
            href="/shop"
            className="text-[10px] uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
          >
            ← All prints
          </Link>
        </div>
      </header>

      {/* PRODUCT */}

      <section className="border-t border-black/10 px-6 pb-28 pt-12 md:px-10 md:pb-40 md:pt-20">
        <div className="mx-auto grid max-w-[1600px] gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24">
          {/* ARTWORK */}

          <div>
            <div className="flex min-h-[65vh] items-center justify-center bg-black/[0.025] p-6 md:p-10">
              {artwork.image_url ? (
                <img
                  src={
                    artwork.image_url
                  }
                  alt={
                    artwork.title
                  }
                  className="max-h-[82vh] max-w-full object-contain"
                />
              ) : (
                <div className="flex aspect-[4/5] w-full items-center justify-center">
                  <span className="text-xs uppercase tracking-[0.2em] text-black/25">
                    Artwork
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PRODUCT INFORMATION */}

          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="text-[10px] uppercase tracking-[0.25em] text-black/40">
              Fine art edition
            </p>

            <h1 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl">
              {
                artwork.title
              }
            </h1>

            {collection && (
              <Link
                href={`/collections/${collection.slug}`}
                className="mt-4 inline-block text-[10px] uppercase tracking-[0.2em] text-black/40 transition hover:text-black"
              >
                {
                  collection.title
                }
              </Link>
            )}

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-black/45">
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
            </div>

            {(artwork.edition_type ||
              artwork.edition_size !==
                null) && (
              <div className="mt-8 border-t border-black/10 pt-6">
                <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">
                  Edition
                </p>

                <p className="mt-3 text-sm">
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
              </div>
            )}

            {artwork.description && (
              <p className="mt-8 whitespace-pre-line text-sm leading-7 text-black/55">
                {
                  artwork.description
                }
              </p>
            )}

            {/* CONFIGURATOR */}

            <div className="mt-12 border-t border-black/15 pt-8">
              <div className="mb-8">
                <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">
                  Configure
                </p>

                <h2 className="mt-3 text-2xl font-medium">
                  Choose your edition
                </h2>
              </div>

              <PrintConfigurator
                artwork={{
                  id:
                    artwork.id,

                  slug:
                    artwork.slug,

                  title:
                    artwork.title,

                  image_url:
                    artwork.image_url,
                }}
                variants={
                  variants
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* PRINT INFORMATION */}

      <section className="bg-[#111111] px-6 py-28 text-white md:px-10 md:py-36">
        <div className="mx-auto grid max-w-[1600px] gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">
              The edition
            </p>

            <h2 className="mt-5 text-5xl font-medium tracking-[-0.055em] md:text-6xl">
              Made to
              <br />
              live with.
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:pt-12">
            <InfoBlock
              title="Fine art printing"
              text="Produced as a fine art print using the selected paper and finish."
            />

            <InfoBlock
              title="Made to order"
              text="Your selected configuration is produced after purchase rather than held as mass inventory."
            />

            <InfoBlock
              title="Framing"
              text="Framed editions are produced using the frame style selected at checkout."
            />

            <InfoBlock
              title="Delivery"
              text="Shipping cost and delivery destination will be confirmed during checkout."
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}

      <footer className="border-t border-white/10 bg-[#111111] px-6 py-8 text-white md:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 text-[9px] uppercase tracking-[0.18em] text-white/35 md:flex-row md:items-center md:justify-between">
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

            <Link href="/shop">
              Prints
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function InfoBlock({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="border-t border-white/15 pt-5">
      <h3 className="text-sm font-medium">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-white/45">
        {text}
      </p>
    </div>
  );
}