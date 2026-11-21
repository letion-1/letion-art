
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StatCardProps = {
  label: string;
  value: number | null;
  description?: string;
};

function StatCard({
  label,
  value,
  description,
}: StatCardProps) {
  return (
    <div className="border border-black/10 p-7">
      <p className="text-xs uppercase tracking-[0.2em] text-black/45">
        {label}
      </p>

      <p className="mt-5 text-5xl font-medium">
        {value ?? "—"}
      </p>

      {description && (
        <p className="mt-3 text-xs leading-5 text-black/40">
          {description}
        </p>
      )}
    </div>
  );
}

export default async function StudioPage() {
  const supabase = await createClient();

  const [
    artworkResult,
    collectionResult,
    printResult,
    orderResult,
    paidResult,
    pendingResult,
    fulfilmentResult,
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

    supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "paid"),

    supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending"),

    supabase
      .from("orders")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "paid")
      .in("fulfilment_status", [
        "not_submitted",
        "queued",
        "failed",
      ]),
  ]);

  function countOf(result: {
    count: number | null;
    error: unknown;
  }): number | null {
    return result.error ? null : result.count ?? 0;
  }

  const artworkCount = countOf(artworkResult);
  const collectionCount = countOf(collectionResult);
  const printCount = countOf(printResult);
  const orderCount = countOf(orderResult);
  const paidCount = countOf(paidResult);
  const pendingCount = countOf(pendingResult);
  const fulfilmentCount = countOf(fulfilmentResult);

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

          <p className="mt-5 max-w-2xl text-lg leading-8 text-black/55">
            Manage your artwork, collections, editions,
            orders and print fulfilment from one workspace.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <StatCard
            label="Artworks"
            value={artworkCount}
            description="Artwork catalogue"
          />

          <StatCard
            label="Collections"
            value={collectionCount}
            description="Curated collections"
          />

          <StatCard
            label="Print variants"
            value={printCount}
            description="Print configurations"
          />
        </div>

        <div className="mt-14 border-t border-black/10 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-black/45">
                Studio commerce
              </p>

              <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
                Orders overview
              </h2>
            </div>

            <Link
              href="/studio/orders"
              className="border border-black px-6 py-4 text-xs uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
            >
              View all orders
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total orders"
              value={orderCount}
              description="All recorded orders"
            />

            <StatCard
              label="Paid"
              value={paidCount}
              description="Payment confirmed"
            />

            <StatCard
              label="Pending payment"
              value={pendingCount}
              description="Awaiting payment"
            />

            <StatCard
              label="Needs fulfilment"
              value={fulfilmentCount}
              description="Paid orders requiring fulfilment attention"
            />
          </div>

          <div className="mt-8 border border-black/10 p-7 md:p-9">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                  Creativehub / Theprintspace
                </p>

                <h3 className="mt-3 text-2xl tracking-tight">
                  Print production & fulfilment
                </h3>

                <p className="mt-3 text-sm leading-7 text-black/55">
                  Review paid orders, calculate supplier costs,
                  approve production and monitor fulfilment
                  through your order management workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/studio/orders"
                  className="bg-black px-6 py-4 text-xs uppercase tracking-[0.16em] text-white transition hover:opacity-75"
                >
                  Manage orders
                </Link>

                <Link
                  href="/studio/prints"
                  className="border border-black/20 px-6 py-4 text-xs uppercase tracking-[0.16em] transition hover:border-black"
                >
                  Manage prints
                </Link>

                <Link
                  href="/studio/creativehub/quotes"
                  className="border border-black/20 px-6 py-4 text-xs uppercase tracking-[0.16em] transition hover:border-black"
                >
                  Supplier quotes
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

          <Link
            href="/studio/prints"
            className="border border-black/15 px-7 py-6 text-sm uppercase tracking-[0.18em] transition hover:border-black"
          >
            Manage prints
          </Link>

          <Link
            href="/studio/orders"
            className="border border-black/15 px-7 py-6 text-sm uppercase tracking-[0.18em] transition hover:border-black"
          >
            Manage orders
          </Link>
        </div>
      </div>
    </main>
  );
}
