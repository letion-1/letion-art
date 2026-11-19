"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const email = "letionketienya@gmail.com";

export default function PublicContactFooter() {
  const pathname = usePathname();

  // Keep storefront navigation out of the private CMS and private tracking pages.
  if (/^\/(studio|api|auth|track)(?:\/|$)/.test(pathname || "")) return null;

  return (
    <footer className="relative border-t border-[#111111]/15 bg-[#f3f0e9] px-6 py-9 text-[#111111] md:px-10">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-7 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/" className="text-sm font-semibold tracking-[0.2em]">LETION KETIENYA</Link>
          <p className="mt-2 max-w-md text-sm text-[#111111]/65">
            Artworks, editions, exhibitions and collaborations.
          </p>
          <a
            href={`mailto:${email}?subject=Artwork%20enquiry`}
            className="mt-3 inline-block break-all border-b border-[#111111] pb-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {email}
          </a>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-4 text-xs font-semibold uppercase tracking-[0.12em]">
          <Link href="/works" className="py-2">Works</Link>
          <Link href="/collections" className="py-2">Collections</Link>
          <Link href="/shop" className="py-2">Prints</Link>
          <Link href="/contact" className="py-2">Contact</Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-[1600px] border-t border-[#111111]/10 pt-5 text-xs text-[#111111]/55">
        © {new Date().getFullYear()} Letion Ketienya
      </p>
    </footer>
  );
}
