"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/works", label: "Works" },
  { href: "/collections", label: "Collections" },
  { href: "/mr-dreamer", label: "Mr. Dreamer" },
  { href: "/about", label: "About" },
  { href: "/shop", label: "Prints" },
  { href: "/contact", label: "Contact" },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="letion-mobile-menu"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 min-w-11 items-center justify-center border border-white/60 bg-black/35 px-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <nav
          id="letion-mobile-menu"
          aria-label="Mobile navigation"
          className="absolute right-0 top-full z-50 mt-3 w-[min(84vw,310px)] border border-black/10 bg-[#f3f0e9] p-3 text-[#111111] shadow-2xl"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block min-h-12 border-b border-black/10 px-3 py-4 text-xs font-semibold uppercase tracking-[0.17em] last:border-b-0 hover:bg-black/5 focus-visible:bg-black/10"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="mailto:letionketienya@gmail.com?subject=Artwork%20enquiry"
            className="mt-3 block bg-[#111111] px-3 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white"
          >
            Email the artist
          </a>
        </nav>
      )}
    </div>
  );
}
