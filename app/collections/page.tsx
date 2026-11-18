import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Collection = {
  id: string;
  slug: string;
  title: string;
  period: string | null;
  introduction: string | null;
  description: string | null;
  hero_image_url: string | null;
  published: boolean;
};

export default async function CollectionsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collections")
    .select(`
      id,
      slug,
      title,
      period,
      introduction,
      description,
      hero_image_url,
      published
    `)
    .eq("published", true)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Could not load collections:",
      error
    );
  }

  const collections: Collection[] =
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
            <Link
              href="/works"
              className="transition hover:opacity-50"
            >
              Works
            </Link>

            <Link
              href="/collections"
              className="font-semibold"
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

            <Link
              href="/shop"
              className="transition hover:opacity-50"
            >
              Prints
            </Link>

            <Link
              href="/#contact"
              className="transition hover:opacity-50"
            >
              Contact
            </Link>
          </nav>
        </div>
      </header>

      {/* INTRO */}
      <section className="px-6 pb-16 pt-20 md:px-10 md:pb-24 md:pt-28">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
            Archive / Bodies of work
          </p>

          <h1 className="mt-5 max-w-5xl text-6xl font-medium tracking-[-0.06em] sm:text-7xl md:text-8xl lg:text-[9rem] lg:leading-[0.85]">
            Collections
          </h1>

          <p className="mt-10 max-w-xl text-base leading-7 text-black/55 md:text-lg md:leading-8">
            Bodies of work,
            evolving visual
            languages and
            recurring worlds.
          </p>
        </div>
      </section>

      {/* COLLECTIONS */}
      <section className="px-6 pb-28 md:px-10 md:pb-40">
        <div className="mx-auto max-w-[1600px]">
          {collections.length > 0 ? (
            <div className="space-y-24 md:space-y-36">
              {collections.map(
                (
                  collection,
                  index
                ) => (
                  <CollectionCard
                    key={
                      collection.id
                    }
                    collection={
                      collection
                    }
                    index={
                      index
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="border-t border-black/10 py-24">
              <p className="text-sm text-black/40">
                No published
                collections yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function CollectionCard({
  collection,
  index,
}: {
  collection: Collection;
  index: number;
}) {
  const reverse =
    index % 2 !== 0;

  return (
    <article
      className={`grid items-center gap-8 md:gap-14 lg:grid-cols-2 lg:gap-20 ${
        reverse
          ? "lg:[&>*:first-child]:order-2"
          : ""
      }`}
    >
      {/* IMAGE */}
      <Link
        href={`/collections/${collection.slug}`}
        className="group block"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-black/5">
          {collection.hero_image_url ? (
            <img
              src={
                collection.hero_image_url
              }
              alt={
                collection.title
              }
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-black/25">
                Collection
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-black/0 transition duration-500 group-hover:bg-black/5" />
        </div>
      </Link>

      {/* TEXT */}
      <div
        className={
          reverse
            ? "lg:pr-10"
            : "lg:pl-2"
        }
      >
        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-black/30">
            {String(
              index + 1
            ).padStart(
              2,
              "0"
            )}
          </span>

          {collection.period && (
            <>
              <span className="h-px w-8 bg-black/15" />

              <span className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                {
                  collection.period
                }
              </span>
            </>
          )}
        </div>

        <Link
          href={`/collections/${collection.slug}`}
        >
          <h2 className="mt-6 text-4xl font-medium uppercase tracking-[-0.05em] transition hover:opacity-50 sm:text-5xl md:text-6xl">
            {
              collection.title
            }
          </h2>
        </Link>

        {collection.introduction && (
          <p className="mt-7 max-w-xl text-sm leading-7 text-black/55 md:text-base md:leading-8">
            {
              collection.introduction
            }
          </p>
        )}

        <Link
          href={`/collections/${collection.slug}`}
          className="mt-8 inline-block border-b border-black pb-1 text-[10px] uppercase tracking-[0.22em] transition hover:opacity-45"
        >
          Enter collection
        </Link>
      </div>
    </article>
  );
}