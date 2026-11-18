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
  sort_order: number;
};

export default async function StudioCollectionsPage() {
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
      published,
      sort_order
    `)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <p className="text-xs uppercase tracking-[0.25em] text-red-700">
          Could not load collections
        </p>

        <p className="mt-4 text-sm text-black/60">
          {error.message}
        </p>
      </main>
    );
  }

  const collections: Collection[] =
    data ?? [];

  const publishedCount =
    collections.filter(
      (collection) =>
        collection.published
    ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
      {/* HEADER */}
      <section className="border-b border-black/10 pb-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/40">
              Studio / Catalogue
            </p>

            <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
              Collections
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-black/50">
              Build and manage the
              bodies of work that
              shape your catalogue.
            </p>
          </div>

          <Link
            href="/studio/collections/new"
            className="inline-flex w-fit items-center justify-center border border-black bg-black px-6 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:bg-transparent hover:text-black"
          >
            + Add Collection
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="grid border-b border-black/10 sm:grid-cols-2">
        <Stat
          label="Collections"
          value={collections.length}
        />

        <Stat
          label="Published"
          value={publishedCount}
        />
      </section>

      {/* COLLECTIONS */}
      {collections.length > 0 ? (
        <section className="py-12">
          <div className="space-y-4">
            {collections.map(
              (collection, index) => (
                <article
                  key={collection.id}
                  className="group grid gap-6 border-b border-black/10 py-6 md:grid-cols-[70px_160px_1fr_auto] md:items-center"
                >
                  {/* NUMBER */}
                  <div className="text-xs text-black/30">
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </div>

                  {/* HERO */}
                  <Link
                    href={`/studio/collections/${collection.id}/edit`}
                    className="block aspect-[4/3] overflow-hidden bg-black/5"
                  >
                    {collection.hero_image_url ? (
                      <img
                        src={
                          collection.hero_image_url
                        }
                        alt={
                          collection.title
                        }
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center">
                        <span className="text-[9px] uppercase tracking-[0.18em] text-black/25">
                          No hero image
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* INFO */}
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/studio/collections/${collection.id}/edit`}
                        className="text-2xl font-medium tracking-[-0.035em] transition hover:opacity-50 md:text-3xl"
                      >
                        {collection.title}
                      </Link>

                      <span
                        className={`px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] ${
                          collection.published
                            ? "bg-black text-white"
                            : "border border-black/20 text-black/45"
                        }`}
                      >
                        {collection.published
                          ? "Published"
                          : "Draft"}
                      </span>
                    </div>

                    {collection.period && (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-black/35">
                        {collection.period}
                      </p>
                    )}

                    {collection.introduction && (
                      <p className="mt-4 max-w-2xl line-clamp-2 text-sm leading-6 text-black/50">
                        {
                          collection.introduction
                        }
                      </p>
                    )}
                  </div>

                  {/* EDIT */}
                  <Link
                    href={`/studio/collections/${collection.id}/edit`}
                    className="text-[10px] uppercase tracking-[0.2em] text-black/40 transition hover:text-black"
                  >
                    Edit →
                  </Link>
                </article>
              )
            )}
          </div>
        </section>
      ) : (
        <section className="py-24 text-center">
          <p className="text-sm text-black/45">
            No collections yet.
          </p>

          <Link
            href="/studio/collections/new"
            className="mt-6 inline-block text-xs uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Create your first
            collection
          </Link>
        </section>
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
    <div className="border-black/10 py-7 sm:border-r sm:px-6 first:pl-0">
      <p className="text-3xl font-medium tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-black/40">
        {label}
      </p>
    </div>
  );
}