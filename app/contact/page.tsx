import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact | Letion Ketienya",
  description: "Contact the artist about original artworks, prints, exhibitions and collaborations.",
};

const email = "letionketienya@gmail.com";

export default function ContactPage() {
  return (
    <main className="relative min-h-[75vh] bg-[#f3f0e9] px-6 py-10 text-[#111111] md:px-10 md:py-16">
      <div className="mx-auto max-w-[1600px]">
        <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.14em]">
          <Link href="/" className="py-2 hover:opacity-60">LETION KETIENYA</Link>
          <Link href="/works" className="border-b border-[#111111] py-2 hover:opacity-60">Explore works</Link>
        </nav>

        <div className="mt-20 grid gap-12 border-t border-[#111111]/15 pt-10 md:mt-28 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#111111]/65">Contact the artist</p>
            <h1 className="mt-6 max-w-3xl text-[clamp(3rem,9vw,8rem)] font-medium leading-[0.95] tracking-[-0.06em]">
              Let's talk<br/>art.
            </h1>
          </div>
          <div className="lg:pt-16">
            <p className="max-w-lg text-lg leading-8 text-[#111111]/80">
              For original artworks, editions, private commissions, exhibitions,
              collaborations and press enquiries, reach out by email.
            </p>
            <a
              href={`mailto:${email}?subject=Artwork%20enquiry`}
              className="mt-9 inline-flex min-h-12 items-center bg-[#111111] px-6 py-4 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#333333] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
            >
              Email the artist
            </a>
            <p className="mt-5 break-all text-base font-semibold">{email}</p>
            <p className="mt-8 text-sm leading-7 text-[#111111]/65">
              Based in Germany. Enquiries from collectors, curators and creative partners worldwide are welcome.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
