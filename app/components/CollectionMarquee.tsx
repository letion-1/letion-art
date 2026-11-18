"use client";

import Link from "next/link";

export type MarqueeArtwork = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  year: string | null;
  sort_order?: number;
};

type Props = {
  artworks: MarqueeArtwork[];
  reverse?: boolean;
};

export default function CollectionMarquee({
  artworks,
  reverse = false,
}: Props) {
  if (artworks.length === 0) {
    return null;
  }

  /*
   * Duplicate the artwork sequence so
   * the CSS animation can loop continuously.
   */
  const repeated = [
    ...artworks,
    ...artworks,
  ];

  return (
    <div className="overflow-hidden py-5 md:py-7">
      <div className="overflow-hidden">
        <div
          className={
            reverse
              ? "marquee-track marquee-track-reverse"
              : "marquee-track"
          }
        >
          {repeated.map(
            (artwork, index) => (
              <Link
                key={`${artwork.id}-${index}`}
                href={`/works/${artwork.slug}`}
                className="marquee-card group"
              >
                <div className="h-[280px] w-[220px] overflow-hidden bg-black/5 sm:h-[340px] sm:w-[270px] md:h-[430px] md:w-[340px]">
                  {artwork.image_url ? (
                    <img
                      src={artwork.image_url}
                      alt={artwork.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-black/25">
                        Artwork
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-start justify-between gap-4">
                  <p className="max-w-[220px] text-sm font-medium tracking-[-0.015em]">
                    {artwork.title}
                  </p>

                  {artwork.year && (
                    <span className="shrink-0 text-[9px] text-black/35">
                      {artwork.year}
                    </span>
                  )}
                </div>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}