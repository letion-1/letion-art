import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mr. Dreamer | Letion Ketienya",
  description:
    "Explore the Mr. Dreamer series across Melatonia City, Photoshoot, Point of View, and Thinking Out Loud.",
};

type Artwork = {
  title: string;
  src: string;
  note?: string;
};

type Chapter = {
  id: string;
  index: string;
  heading: string;
  collection: string;
  description: string;
  artworks: Artwork[];
};

// These chapter names describe the exhibition layout, not official season titles.
// Paths match the existing filenames inside public/artwork, including capitalization.
const chapters: Chapter[] = [
  {
    id: "melatonia-city",
    index: "01",
    heading: "The character takes shape",
    collection: "Melatonia City",
    description:
      "Three appearances of Mr. Dreamer from Melatonia City. Different moments, one continuing character.",
    artworks: [
      {
        title: "Mr. Dreamer",
        src: "/artwork/Melatonia%20City/mr-dreamer.jpg",
      },
      {
        title: "Money BAG-YO",
        src: "/artwork/Melatonia%20City/Money-BAG-YO.png",
      },
      {
        title: "Graduation",
        src: "/artwork/Melatonia%20City/GRADUATION.png",
      },
    ],
  },
  {
    id: "photoshoot",
    index: "02",
    heading: "A day at the photoshoot",
    collection: "Photoshoot",
    description:
      "A complete seven-artwork sequence following Mr. Dreamer through his photoshoot. Presented together as one visual story.",
    artworks: [
      { title: "Photoshoot · Frame 01", src: "/artwork/Photoshoot/photoshoot.png" },
      { title: "Photoshoot · Frame 02", src: "/artwork/Photoshoot/photoshoot-2.png" },
      { title: "Photoshoot · Frame 03", src: "/artwork/Photoshoot/photoshoot-3.png" },
      { title: "Photoshoot · Frame 04", src: "/artwork/Photoshoot/photoshoot-4.0.png" },
      { title: "Photoshoot · Frame 05", src: "/artwork/Photoshoot/photoshoot-5.png" },
      { title: "Photoshoot · Frame 06", src: "/artwork/Photoshoot/photoshoot-6.png" },
      { title: "Photoshoot · Frame 07", src: "/artwork/Photoshoot/photoshoot-7.png" },
    ],
  },
  {
    id: "point-of-view",
    index: "03",
    heading: "A shift in perspective",
    collection: "Point of View",
    description:
      "Burning Bridges, presented as part of Mr. Dreamer's wider visual narrative.",
    artworks: [
      { title: "Burning Bridges", src: "/artwork/Point-Of-View/burning%20bridges.jpg" },
    ],
  },
  {
    id: "thinking-out-loud",
    index: "04",
    heading: "The inner world",
    collection: "Thinking Out Loud",
    description:
      "Four more appearances of Mr. Dreamer, brought together from the Thinking Out Loud collection.",
    artworks: [
      { title: "Mother Nature", src: "/artwork/Thinking-Out-Loud/MOTHER%20NATURE.jpg" },
      { title: "Tough Day", src: "/artwork/Thinking-Out-Loud/Tough%20Day.jpg" },
      { title: "I Hate Mondays", src: "/artwork/Thinking-Out-Loud/i-hate-mondays.png" },
      { title: "Scream", src: "/artwork/Thinking-Out-Loud/scream.jpg" },
    ],
  },
];

const artworkCount = chapters.reduce(
  (total, chapter) => total + chapter.artworks.length,
  0,
);

export default function MrDreamerPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f3f0e9] text-[#171717]">
      {/* Always-visible navigation works on both desktop and mobile. */}
      <header className="relative z-20 border-b border-black/15 bg-[#f3f0e9] px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#171717] sm:text-sm"
          >
            LETION KETIENYA
          </Link>
          <nav
            aria-label="Mr. Dreamer page navigation"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[10px] font-medium uppercase tracking-[0.16em]"
          >
            <Link href="/works" className="hover:underline hover:underline-offset-4">Works</Link>
            <Link href="/collections" className="hover:underline hover:underline-offset-4">Collections</Link>
            <Link href="/shop" className="hover:underline hover:underline-offset-4">Shop</Link>
            <a href="mailto:letionketienya@gmail.com?subject=Mr.%20Dreamer%20enquiry" className="hover:underline hover:underline-offset-4">Contact</a>
          </nav>
        </div>
      </header>

      {/* The main image and title introduce the recurring character. */}
      <section className="relative px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:px-12">
        <div className="mx-auto grid max-w-[1500px] items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <p className="mb-5 text-[10px] font-medium uppercase tracking-[0.28em] text-black/55">
              A recurring character · A growing universe
            </p>
            <h1 className="text-[clamp(4.4rem,13vw,12rem)] font-medium leading-[0.78] tracking-[-0.08em]">
              MR.
              <br />
              DREAMER
            </h1>
            <p className="mt-9 max-w-xl text-base leading-8 text-black/70 sm:text-lg">
              A character who travels between collections, moods and imagined worlds.
              Explore his appearances, variations and stories across the artworks.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#chapters"
                className="inline-flex min-h-12 items-center justify-center bg-[#171717] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.17em] text-white transition hover:bg-[#454545]"
              >
                Explore the series
              </a>
              <Link
                href="/shop"
                className="inline-flex min-h-12 items-center justify-center border border-[#171717] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.17em] text-[#171717] transition hover:bg-[#171717] hover:text-white"
              >
                Shop prints
              </Link>
            </div>
            <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-black/50">
              {artworkCount} artworks · {chapters.length} chapters · One character
            </p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden bg-[#e7e0d5] sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image
              src="/artwork/Melatonia%20City/mr-dreamer.jpg"
              alt="Mr. Dreamer artwork from Melatonia City"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-contain"
            />
            <div className="absolute bottom-0 left-0 bg-[#f3f0e9]/95 px-4 py-3 text-[10px] uppercase tracking-[0.17em] text-[#171717]">
              Mr. Dreamer · Melatonia City
            </div>
          </div>
        </div>
      </section>

      {/* Chapter navigation: editorial groupings, not invented official seasons. */}
      <div id="chapters" className="scroll-mt-6 border-y border-black/15 bg-[#eae5db] px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-7 gap-y-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">Explore chapters</span>
          {chapters.map((chapter) => (
            <a
              key={chapter.id}
              href={`#${chapter.id}`}
              className="text-[11px] uppercase tracking-[0.11em] text-black/70 underline-offset-4 transition hover:text-black hover:underline"
            >
              {chapter.index} / {chapter.collection}
            </a>
          ))}
        </div>
      </div>

      {chapters.map((chapter, chapterIndex) => (
        <section
          id={chapter.id}
          key={chapter.id}
          className={`scroll-mt-8 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 ${
            chapterIndex % 2 === 1 ? "bg-[#171717] text-white" : "bg-[#f3f0e9] text-[#171717]"
          }`}
        >
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-12 grid gap-8 border-b border-current/20 pb-10 md:grid-cols-[0.6fr_1.4fr] md:items-end">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] opacity-60">
                  Chapter {chapter.index} · {chapter.collection}
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.15em] opacity-60">
                  {chapter.artworks.length} {chapter.artworks.length === 1 ? "artwork" : "artworks"}
                </p>
              </div>
              <div>
                <h2 className="max-w-4xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[1.02] tracking-[-0.055em]">
                  {chapter.heading}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 opacity-70">
                  {chapter.description}
                </p>
              </div>
            </div>

            <div className={`grid gap-x-5 gap-y-12 sm:grid-cols-2 ${
              chapter.artworks.length === 1 ? "lg:grid-cols-2" : "lg:grid-cols-3"
            }`}>
              {chapter.artworks.map((artwork, imageIndex) => (
                <figure key={artwork.src} className="min-w-0">
                  <a
                    href={artwork.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View full image of ${artwork.title} (opens in a new tab)`}
                    className={`group relative block aspect-[4/5] overflow-hidden ${
                      chapterIndex % 2 === 1 ? "bg-[#2c2c2c]" : "bg-[#e7e0d5]"
                    }`}
                  >
                    <Image
                      src={artwork.src}
                      alt={`${artwork.title}, a Mr. Dreamer series artwork`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-contain p-2 transition-transform duration-500 group-hover:scale-[1.025]"
                      loading="lazy"
                    />
                    <span className="absolute bottom-3 right-3 bg-black/75 px-3 py-2 text-[9px] font-medium uppercase tracking-[0.13em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      View image
                    </span>
                  </a>
                  <figcaption className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-medium tracking-[-0.03em]">{artwork.title}</h3>
                      <p className="mt-1 text-xs opacity-55">{chapter.collection}</p>
                    </div>
                    <span className="pt-1 text-[10px] tabular-nums opacity-50">
                      {String(imageIndex + 1).padStart(2, "0")}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="border-t border-black/15 bg-[#eae5db] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-black/50">Keep exploring</p>
            <h2 className="mt-4 text-5xl font-medium tracking-[-0.06em] sm:text-7xl">
              The story continues.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-black/65">
              Discover more artwork, enquire about the series or explore available prints.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/works" className="inline-flex min-h-12 items-center border border-black px-5 py-3 text-[10px] uppercase tracking-[0.16em] hover:bg-black hover:text-white">View all works</Link>
            <a href="mailto:letionketienya@gmail.com?subject=Mr.%20Dreamer%20series" className="inline-flex min-h-12 items-center bg-black px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white hover:bg-[#444]">Enquire</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/15 bg-[#f3f0e9] px-5 py-7 text-[#171717] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-[0.15em]">
          <span>© {new Date().getFullYear()} Letion Ketienya</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/" className="hover:underline">Home</Link>
            <Link href="/shop" className="hover:underline">Shop</Link>
            <a href="mailto:letionketienya@gmail.com" className="hover:underline">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
