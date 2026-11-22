import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function FeaturedArtworks() {
  const db = await createClient();
  const { data, error } = await db
    .from("artworks")
    .select("id,title,slug,image_url,year,medium")
    .eq("published", true)
    .eq("featured", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Featured artworks could not be loaded:", error.message);
    return null;
  }
  const artworks = data ?? [];
  if (artworks.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="mx-auto w-full max-w-[1500px] px-6 pb-20 pt-10 md:px-10 md:pb-28">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-black/15 pb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-black/45">Selected artworks</p>
          <h2 id="featured-heading" className="mt-3 text-4xl font-medium tracking-[-0.05em] md:text-6xl">Featured</h2>
        </div>
        <Link href="/works" className="border-b border-black pb-1 text-[10px] uppercase tracking-[0.15em]">View all works</Link>
      </div>
      <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {artworks.map((artwork) => (
          <Link key={artwork.id} href={`/works/${artwork.slug}`} className="group block min-w-0">
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-black/5">
              {artwork.image_url ? (
                <img src={artwork.image_url} alt={artwork.title} loading="lazy" className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.025]" />
              ) : <span className="text-xs uppercase tracking-widest text-black/30">Artwork</span>}
            </div>
            <div className="mt-4 flex items-start justify-between gap-5">
              <h3 className="text-lg font-medium tracking-tight">{artwork.title}</h3>
              <span className="text-xs text-black/45">{artwork.year ?? ""}</span>
            </div>
            {artwork.medium && <p className="mt-1 text-xs text-black/45">{artwork.medium}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}
