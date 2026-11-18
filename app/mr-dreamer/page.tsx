import Link from "next/link";

export default function MrDreamerPage() {
  return (
    <main className="min-h-screen text-[#111111]">

      {/* NAVIGATION */}
      <nav className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="text-sm font-semibold tracking-[0.25em]"
        >
          LETION KETIENYA
        </Link>

        <div className="flex gap-6 text-xs uppercase tracking-[0.2em]">
          <Link
            href="/works"
            className="transition hover:opacity-50"
          >
            Works
          </Link>

          <span className="text-white/40">
            Mr. Dreamer
          </span>
        </div>
      </nav>


      {/* HERO */}
      <section className="relative flex min-h-screen items-end overflow-hidden">

        {/* IMAGE */}
        <div className="absolute inset-0">
          <img
            src="/artwork/mr-dreamer.jpg"
            alt="Mr. Dreamer"
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-black/35" />
        </div>


        {/* TITLE */}
        <div className="relative z-10 w-full px-6 pb-14 md:px-10 md:pb-20">

          <p className="mb-6 text-xs uppercase tracking-[0.3em] text-white/60">
            The character / The journey
          </p>

          <h1 className="text-[18vw] font-medium leading-[0.78] tracking-[-0.07em] md:text-[14vw]">
            MR.
            <br />
            DREAMER
          </h1>

          <div className="mt-10 flex max-w-xl items-start justify-between gap-10">

            <p className="text-sm leading-6 text-white/70 md:text-base">
              A recurring figure moving through imagined worlds,
              places, memories and stories.
            </p>

            <span className="hidden text-xs uppercase tracking-[0.2em] text-white/40 md:block">
              01
            </span>

          </div>

        </div>

      </section>


      {/* INTRO */}
      <section className="bg-[#f3f0e9] px-6 py-28 text-[#111111] md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          <p className="text-xs uppercase tracking-[0.25em] text-black/40 md:col-span-3">
            About Mr. Dreamer
          </p>

          <div className="md:col-span-7 md:col-start-5">

            <h2 className="max-w-4xl text-4xl font-medium leading-tight tracking-[-0.04em] md:text-6xl">
              Mr. Dreamer is not simply a character.
              He is a way of seeing.
            </h2>

            <div className="mt-10 max-w-2xl space-y-6 text-base leading-8 text-black/60">

              <p>
                He appears across my work as a recurring figure,
                moving between reality and imagination.
              </p>

              <p>
                Sometimes he is travelling. Sometimes he is
                observing. Sometimes he is simply dreaming.
              </p>

              <p>
                His world continues to grow through paintings,
                digital works, photography, places, people and
                stories.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* FEATURED WORK */}
      <section className="bg-[#111111] px-6 py-28 md:px-10 md:py-40">

        <div className="mb-16 flex items-end justify-between">

          <div>

            <p className="text-xs uppercase tracking-[0.25em] text-white/40">
              The Archive
            </p>

            <h2 className="mt-5 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
              One character.
              <br />
              Many worlds.
            </h2>

          </div>

          <span className="hidden text-xs uppercase tracking-[0.2em] text-white/30 md:block">
            02 / 04
          </span>

        </div>


        <Link
          href="/works/mr-dreamer"
          className="group block"
        >

          <div className="overflow-hidden bg-[#222222]">

            <img
              src="/artwork/mr-dreamer.jpg"
              alt="Mr. Dreamer artwork"
              className="block h-auto w-full transition duration-700 group-hover:scale-[1.02]"
            />

          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-5">

            <div>

              <h3 className="text-xl font-medium">
                MR. DREAMER
              </h3>

              <p className="mt-2 text-xs uppercase tracking-[0.15em] text-white/40">
                Digital artwork · 2025
              </p>

            </div>

            <span className="text-xs uppercase tracking-[0.2em] text-white/40 transition group-hover:text-white">
              View artwork →
            </span>

          </div>

        </Link>

      </section>


      {/* THE WORLD */}
      <section className="bg-[#d9d0c2] px-6 py-28 text-[#111111] md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          <div className="md:col-span-3">

            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              The World
            </p>

          </div>


          <div className="md:col-span-8 md:col-start-5">

            <h2 className="text-5xl font-medium leading-[0.95] tracking-[-0.05em] md:text-8xl">
              He travels
              <br />
              through stories.
            </h2>

            <p className="mt-10 max-w-xl text-base leading-8 text-black/60">
              Mr. Dreamer creates a bridge between the imagined
              and the real. His world can begin inside a painting
              and continue into a photograph, a building, a city
              or a completely different story.
            </p>

          </div>

        </div>


        {/* CHAPTERS */}
        <div className="mt-24 grid gap-5 md:grid-cols-3">

          <div className="border-t border-black/20 pt-5">

            <span className="text-xs uppercase tracking-[0.2em] text-black/40">
              Chapter 01
            </span>

            <h3 className="mt-8 text-3xl font-medium">
              Arrival
            </h3>

            <p className="mt-4 text-sm leading-6 text-black/60">
              New places. New perspectives. The beginning of a
              journey.
            </p>

          </div>


          <div className="border-t border-black/20 pt-5">

            <span className="text-xs uppercase tracking-[0.2em] text-black/40">
              Chapter 02
            </span>

            <h3 className="mt-8 text-3xl font-medium">
              Somewhere Else
            </h3>

            <p className="mt-4 text-sm leading-6 text-black/60">
              Reality begins to blur with imagination.
            </p>

          </div>


          <div className="border-t border-black/20 pt-5">

            <span className="text-xs uppercase tracking-[0.2em] text-black/40">
              Chapter 03
            </span>

            <h3 className="mt-8 text-3xl font-medium">
              The Dream
            </h3>

            <p className="mt-4 text-sm leading-6 text-black/60">
              The world becomes whatever the dreamer sees.
            </p>

          </div>

        </div>

      </section>


      {/* COLLABORATIONS */}
      <section className="bg-[#f3f0e9] px-6 py-28 text-[#111111] md:px-10 md:py-40">

        <div className="grid gap-16 md:grid-cols-12">

          <p className="text-xs uppercase tracking-[0.25em] text-black/40 md:col-span-3">
            Beyond the canvas
          </p>

          <div className="md:col-span-7 md:col-start-5">

            <h2 className="text-4xl font-medium leading-tight tracking-[-0.04em] md:text-6xl">
              The story can leave the studio.
            </h2>

            <p className="mt-10 max-w-2xl text-base leading-8 text-black/60">
              Mr. Dreamer is designed to move between mediums.
              Paintings, photography, architecture, cities and
              physical spaces can become part of the same universe.
            </p>

            <p className="mt-6 max-w-2xl text-base leading-8 text-black/60">
              Future collaborations will explore what happens
              when the character enters real places and real
              environments.
            </p>

          </div>

        </div>

      </section>


      {/* CTA */}
      <section className="bg-[#111111] px-6 py-28 md:px-10 md:py-40">

        <div className="mx-auto max-w-5xl text-center">

          <p className="text-xs uppercase tracking-[0.3em] text-white/40">
            Continue exploring
          </p>

          <h2 className="mt-8 text-5xl font-medium tracking-[-0.05em] md:text-8xl">
            Where does
            <br />
            he go next?
          </h2>

          <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">

            <Link
              href="/works"
              className="border border-white px-8 py-4 text-xs uppercase tracking-[0.25em] transition hover:bg-white hover:text-black"
            >
              Explore the works
            </Link>

            <Link
              href="/"
              className="px-8 py-4 text-xs uppercase tracking-[0.25em] text-white/50 transition hover:text-white"
            >
              Back to studio
            </Link>

          </div>

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
            Back to home →
          </Link>

        </div>

      </footer>

    </main>
  );
}