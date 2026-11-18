import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen text-[#111111]">

      {/* NAVIGATION */}
      <nav className="flex items-center justify-between border-b border-black/10 px-6 py-5 md:px-10">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.25em]"
        >
          LETION KETIENYA
        </Link>

        <div className="flex gap-6 text-xs uppercase tracking-[0.2em]">
          <Link href="/works" className="hover:opacity-50">
            Works
          </Link>

          <Link href="/mr-dreamer" className="hover:opacity-50">
            Mr. Dreamer
          </Link>

          <span className="text-black/40">
            About
          </span>
        </div>
      </nav>


      {/* HERO IMAGE */}
      <section className="px-4 pt-4 md:px-8 md:pt-8">

        <div className="relative overflow-hidden bg-[#d8d3ca]">

          <img
            src="/about/about-hero.jpg"
            alt="Letion Ketienya artwork"
            className="h-[60vh] w-full object-cover md:h-[78vh]"
          />

          <div className="absolute inset-0 bg-black/10" />

          <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10">
            <p className="text-xs uppercase tracking-[0.3em] text-white">
              Artist · Painter · Dreamer
            </p>
          </div>

        </div>

      </section>


      {/* NAME INTRO */}
      <section className="px-6 pb-24 pt-28 md:px-10 md:pb-36 md:pt-40">

        <div className="grid gap-12 md:grid-cols-12">

          <div className="md:col-span-3">
            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              02 / About
            </p>
          </div>

          <div className="md:col-span-8 md:col-start-5">

            <h1 className="text-6xl font-medium leading-[0.85] tracking-[-0.06em] md:text-[10vw]">
              LETION
              <br />
              KETIENYA
            </h1>

            <p className="mt-10 max-w-2xl text-lg leading-8 text-black/60 md:text-2xl">
              Artist, painter and visual storyteller working
              across painting, digital art, photography and
              narrative image-making.
            </p>

          </div>

        </div>

      </section>


      {/* PROFILE SECTION */}
      <section className="border-t border-black/10 px-6 py-24 md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          {/* PROFILE PHOTO */}
          <div className="md:col-span-5">

            <div className="overflow-hidden bg-[#ddd8cf]">

              <img
                src="/about/profile.png"
                alt="Portrait of Letion Ketienya"
                className="block h-auto w-full object-cover"
              />

            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-black/40">
              Letion Ketienya
            </p>

          </div>


          {/* TEXT */}
          <div className="md:col-span-6 md:col-start-7">

            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              The artist
            </p>

            <h2 className="mt-6 text-4xl font-medium leading-tight tracking-[-0.04em] md:text-6xl">
              Making images.
              <br />
              Building worlds.
            </h2>

            <div className="mt-10 space-y-6 text-base leading-8 text-black/60 md:text-lg">

              <p>
                My work moves between painting, digital art,
                photography and visual storytelling.
              </p>

              <p>
                I am interested in characters, places, memory,
                identity and the space between what we experience
                and what we imagine.
              </p>

              <p>
                Rather than treating every artwork as an isolated
                object, I often think of my work as part of a
                larger visual world.
              </p>

              <p>
                Characters can return. Stories can continue.
                Places can become part of another image.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* PRACTICE */}
      <section className="bg-[#111111] px-6 py-28 text-[#f3f0e9] md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          <div className="md:col-span-3">

            <p className="text-xs uppercase tracking-[0.25em] text-white/40">
              The practice
            </p>

          </div>

          <div className="md:col-span-8 md:col-start-5">

            <h2 className="text-5xl font-medium leading-[0.95] tracking-[-0.05em] md:text-8xl">
              One practice.
              <br />
              Many forms.
            </h2>

            <div className="mt-20 grid gap-10 sm:grid-cols-2">

              <div className="border-t border-white/15 pt-5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                  01
                </span>

                <h3 className="mt-7 text-3xl font-medium">
                  Painting
                </h3>

                <p className="mt-4 text-sm leading-7 text-white/50">
                  Physical surfaces, colour, gesture and figures
                  become spaces for stories to unfold.
                </p>
              </div>


              <div className="border-t border-white/15 pt-5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                  02
                </span>

                <h3 className="mt-7 text-3xl font-medium">
                  Digital Art
                </h3>

                <p className="mt-4 text-sm leading-7 text-white/50">
                  Digital compositions allow imagined worlds and
                  characters to take on new forms.
                </p>
              </div>


              <div className="border-t border-white/15 pt-5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                  03
                </span>

                <h3 className="mt-7 text-3xl font-medium">
                  Photography
                </h3>

                <p className="mt-4 text-sm leading-7 text-white/50">
                  Real places, buildings and environments can
                  become part of the narrative.
                </p>
              </div>


              <div className="border-t border-white/15 pt-5">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                  04
                </span>

                <h3 className="mt-7 text-3xl font-medium">
                  Storytelling
                </h3>

                <p className="mt-4 text-sm leading-7 text-white/50">
                  Recurring characters and ideas connect individual
                  works into larger visual stories.
                </p>
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* MR DREAMER */}
      <section className="bg-[#d9d0c2] px-6 py-28 text-[#111111] md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          <div className="md:col-span-3">

            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              The recurring figure
            </p>

          </div>

          <div className="md:col-span-8 md:col-start-5">

            <h2 className="text-5xl font-medium leading-[0.95] tracking-[-0.05em] md:text-8xl">
              Meet
              <br />
              Mr. Dreamer.
            </h2>

            <p className="mt-10 max-w-2xl text-base leading-8 text-black/60 md:text-lg">
              Mr. Dreamer is a recurring character within my work.
              He moves through different environments, stories and
              imagined situations, becoming a way to explore ideas
              that extend beyond a single artwork.
            </p>

            <Link
              href="/mr-dreamer"
              className="mt-10 inline-block border border-black/30 px-7 py-4 text-xs uppercase tracking-[0.25em] transition hover:bg-black hover:text-white"
            >
              Enter his world →
            </Link>

          </div>

        </div>

      </section>


      {/* STUDIO */}
      <section className="px-6 py-28 md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          <div className="md:col-span-3">

            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              The studio
            </p>

          </div>

          <div className="md:col-span-8 md:col-start-5">

            <h2 className="text-4xl font-medium leading-tight tracking-[-0.04em] md:text-6xl">
              The studio is an evolving place.
            </h2>

            <div className="mt-10 max-w-2xl space-y-7 text-base leading-8 text-black/60 md:text-lg">

              <p>
                Some works begin with a painting. Others begin with
                an image, a place, a character or an idea.
              </p>

              <p>
                I am interested in what happens when those things
                begin to overlap.
              </p>

              <p>
                A painting can become a story. A character can
                enter a photograph. A real building can become part
                of an imagined world.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* NAVIGATION CARDS */}
      <section className="border-t border-black/10 bg-[#111111] px-6 py-24 text-[#f3f0e9] md:px-10 md:py-32">

        <div className="grid gap-6 md:grid-cols-3">

          <Link
            href="/works"
            className="group border border-white/15 p-7 transition hover:bg-white hover:text-black"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-white/40 group-hover:text-black/40">
              Explore
            </span>

            <h3 className="mt-12 text-3xl font-medium">
              Works →
            </h3>
          </Link>


          <Link
            href="/mr-dreamer"
            className="group border border-white/15 p-7 transition hover:bg-white hover:text-black"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-white/40 group-hover:text-black/40">
              Character
            </span>

            <h3 className="mt-12 text-3xl font-medium">
              Mr. Dreamer →
            </h3>
          </Link>


          <Link
            href="/#contact"
            className="group border border-white/15 p-7 transition hover:bg-white hover:text-black"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-white/40 group-hover:text-black/40">
              Connect
            </span>

            <h3 className="mt-12 text-3xl font-medium">
              Contact →
            </h3>
          </Link>

        </div>

      </section>


      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-black px-6 py-8 text-xs uppercase tracking-[0.2em] text-white/30 md:px-10">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <span>
            © 2026 Letion Ketienya
          </span>

          <Link
            href="/"
            className="transition hover:text-white"
          >
            Back to studio →
          </Link>

        </div>

      </footer>

    </main>
  );
}