
import FeaturedArtworks from "@/app/components/FeaturedArtworks";
import Link from "next/link";
import HeroVideo from "./components/HeroVideo";
import CollectionMarquee, {
  type MarqueeArtwork,
} from "./components/CollectionMarquee";
import { createClient } from "@/lib/supabase/server";

type HomepageArtwork = MarqueeArtwork & {
  sort_order?: number;
};

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  artworks: HomepageArtwork[] | null;
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collections")
    .select(`
      id,
      slug,
      title,
      sort_order,
      artworks:artworks!artworks_collection_id_fkey (
        id,
        slug,
        title,
        image_url,
        year,
        published,
        sort_order
      )
    `)
    .eq("published", true)
    .eq("artworks.published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Could not load homepage artworks:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  }

  const collections =
    (data ?? []) as unknown as CollectionRow[];

  const orderedCollections = [...collections].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const allArtworks: HomepageArtwork[] = [];

  for (const collection of orderedCollections) {
    const orderedArtworks = [
      ...(collection.artworks ?? []),
    ].sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    allArtworks.push(...orderedArtworks);
  }

  const rowOneArtworks = allArtworks.filter(
    (_, index) => index % 2 === 0
  );

  const rowTwoArtworks = allArtworks.filter(
    (_, index) => index % 2 !== 0
  );

  return (
    <main className="relative text-[#111111]">

      {/* =====================================
          HERO
      ====================================== */}

      <section className="relative min-h-screen overflow-hidden bg-black text-white">
        <HeroVideo />

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
                className="transition hover:opacity-60"
              >
                Works
              </Link>

              <Link
                href="/collections"
                className="transition hover:opacity-60"
              >
                Collections
              </Link>

              <Link
                href="/mr-dreamer"
                className="transition hover:opacity-60"
              >
                Mr. Dreamer
              </Link>

              <Link
                href="/about"
                className="transition hover:opacity-60"
              >
                About
              </Link>

              <Link
                href="/shop"
                className="transition hover:opacity-60"
              >
                Prints
              </Link>

              <Link
                href="#contact"
                className="transition hover:opacity-60"
              >
                Contact
              </Link>
            </nav>
          </div>
        </header>

        <div className="relative z-20 flex min-h-[calc(100vh-90px)] items-end px-6 pb-12 md:px-10 md:pb-16">
          <div className="mx-auto w-full max-w-[1600px]">
            <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-white/60">
              Artist · Painter · Visual Storyteller
            </p>

            <h1 className="max-w-6xl text-6xl font-medium tracking-[-0.065em] sm:text-7xl md:text-8xl lg:text-[9rem] lg:leading-[0.82]">
              LETION
              <br />
              KETIENYA
            </h1>

            {/* HERO BUTTONS */}

            <div className="mt-10 flex flex-wrap items-start gap-5">
              <div className="flex flex-col gap-3">

                <Link
                  href="/works"
                  className="inline-flex min-h-12 items-center justify-center border border-white bg-white px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white"
                >
                  Explore works
                </Link>

                <Link
                  href="/shop"
                  className="inline-flex min-h-12 items-center justify-center border border-white/70 bg-black/30 px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white hover:text-black"
                >
                  Shop now
                </Link>

              </div>

              <Link
                href="/collections"
                className="inline-flex min-h-12 items-center justify-center border border-white/50 px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white hover:text-black"
              >
                Collections
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================
          INTRO
      ====================================== */}

      <section className="relative border-b border-black/10 px-6 py-24 md:px-10 md:py-36">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-14 lg:grid-cols-[1.25fr_0.55fr] lg:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
                Welcome to my world
              </p>

              <h2 className="mt-7 max-w-5xl text-5xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-6xl md:text-7xl lg:text-8xl">
                “Your Vision Is
                Your Passport,
                <br />
                and Your Passion
                Is Your Plane.”
              </h2>
            </div>

            <div className="lg:justify-self-end lg:pb-2">
              <p className="max-w-md text-base leading-8 text-black/55">
                Welcome to a world shaped by imagination,
                colour, character and visual storytelling.
                This space brings together my paintings,
                evolving narratives, experiments and the
                worlds that continue to grow around them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          THE WORK
      ====================================== */}

      <FeaturedArtworks />
      <section className="relative py-24 md:py-32">
        <div className="mx-auto max-w-[1600px] px-6 pb-12 md:px-10 md:pb-16">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
                Selected bodies of work
              </p>

              <h2 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
                The work
              </h2>
            </div>

            <div className="lg:justify-self-end">
              <p className="max-w-[480px] text-base leading-8 text-black/55">
                An evolving archive of paintings,
                characters, experiments and visual
                narratives.
              </p>

              <Link
                href="/works"
                className="mt-7 inline-block border-b border-black pb-1 text-[10px] uppercase tracking-[0.2em]"
              >
                View all works
              </Link>
            </div>
          </div>
        </div>

        {allArtworks.length > 0 ? (
          <div>
            <CollectionMarquee
              artworks={rowOneArtworks}
            />

            {rowTwoArtworks.length > 0 && (
              <CollectionMarquee
                artworks={rowTwoArtworks}
                reverse
              />
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-[1600px] px-6 md:px-10">
            <div className="border-t border-black/10 py-20">
              <p className="text-sm text-black/40">
                Published works will appear here.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* =====================================
          MR DREAMER
      ====================================== */}

      <section className="relative border-t border-white/10 bg-[#111111] px-6 py-28 text-white md:px-10 md:py-40">
        <div className="mx-auto grid max-w-[1600px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Recurring character
            </p>

            <h2 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
              Mr.
              <br />
              Dreamer
            </h2>

            <p className="mt-8 max-w-md text-base leading-8 text-white/60">
              A recurring figure moving through imagined
              worlds, personal narratives and shifting
              visual environments.
            </p>

            <Link
              href="/mr-dreamer"
              className="mt-8 inline-block border-b border-white pb-1 text-[10px] uppercase tracking-[0.2em]"
            >
              Meet Mr. Dreamer
            </Link>
          </div>

          <Link
            href="/mr-dreamer"
            className="group"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
              <img
                src="/artwork/Melatonia%20City/mr-dreamer.jpg"
                alt="Mr. Dreamer"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
              />
            </div>
          </Link>
        </div>
      </section>

      {/* =====================================
          ABOUT
      ====================================== */}

      <section className="relative border-t border-black/10 px-6 py-28 md:px-10 md:py-40">
        <div className="mx-auto grid max-w-[1600px] gap-12 lg:grid-cols-2 lg:gap-24">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
              The artist
            </p>

            <h2 className="mt-5 text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
              Letion
              <br />
              Ketienya
            </h2>
          </div>

          <div className="flex flex-col justify-end">
            <p className="max-w-xl text-xl leading-9 tracking-[-0.015em] text-black/65 md:text-2xl md:leading-10">
              A Kenyan artist working across painting,
              mixed media, photography and digital
              image-making.
            </p>

            <Link
              href="/about"
              className="mt-8 w-fit border-b border-black pb-1 text-[10px] uppercase tracking-[0.2em]"
            >
              About the artist
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================
          PRINTS
      ====================================== */}

      <section className="relative border-t border-black/10 bg-[#111111] px-6 py-28 text-white md:px-10 md:py-40">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            Editions
          </p>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_0.55fr] lg:items-end">
            <h2 className="text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl lg:text-8xl">
              Collect
              <br />
              the work.
            </h2>

            <div>
              <p className="max-w-md text-base leading-8 text-white/55">
                Fine art editions and selected works
                available for collectors.
              </p>

              <Link
                href="/shop"
                className="mt-8 inline-flex border border-white px-6 py-4 text-[10px] uppercase tracking-[0.2em] transition hover:bg-white hover:text-black"
              >
                Explore prints
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          EXHIBITIONS + CONTACT
      ====================================== */}

      <section
        id="contact"
        className="relative bg-[#f3f0e9] px-6 py-28 md:px-10 md:py-40"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-20 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
                Exhibitions
              </p>

              <h2 className="mt-6 text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
                Selected
                <br />
                exhibitions.
              </h2>
            </div>

            <div className="lg:pt-14">
              <div className="border-t border-black/15">
                <div className="grid gap-3 border-b border-black/15 py-7 md:grid-cols-[100px_1fr]">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                    2024
                  </span>

                  <p className="text-base leading-7">
                    Rosslyn Rivera Group Exhibition,
                    Nairobi, Kenya
                  </p>
                </div>

                <div className="grid gap-3 border-b border-black/15 py-7 md:grid-cols-[100px_1fr]">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                    2022
                  </span>

                  <p className="text-base leading-7">
                    Solo Online Exhibition,
                    Nairobi, Kenya
                  </p>
                </div>

                <div className="grid gap-3 border-b border-black/15 py-7 md:grid-cols-[100px_1fr]">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-black/35">
                    2018
                  </span>

                  <p className="text-base leading-7">
                    Tree House Gallery,
                    Nairobi, Kenya
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-28 border-t border-black/15 pt-16 md:mt-36 md:pt-20">
            <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
              Contact
            </p>

            <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_0.55fr] lg:items-end">
              <h2 className="max-w-5xl text-5xl font-medium tracking-[-0.055em] sm:text-6xl md:text-7xl">
                Exhibitions,
                collaborations &
                collecting.
              </h2>

              <div className="lg:justify-self-end">
                <p className="max-w-md text-base leading-8 text-black/55">
                  For enquiries regarding original works,
                  prints, exhibitions and collaborations,
                  get in touch.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          FOOTER
      ====================================== */}

      <footer className="relative border-t border-black/10 bg-[#f3f0e9] px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 text-[9px] uppercase tracking-[0.18em] text-black/35 md:flex-row md:items-center md:justify-between">
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
