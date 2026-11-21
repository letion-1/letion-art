
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function StudioLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/studio/login");
  }

  const { data: admin } = await supabase
    .from("studio_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/studio/login?error=unauthorized");
  }

  return (
    <div className="min-h-screen bg-[#f3f0e9] text-[#111111]">
      <header className="border-b border-black/10 px-6 py-5 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5">
          <Link
            href="/studio"
            className="text-sm font-semibold tracking-[0.25em]"
          >
            LETION / STUDIO
          </Link>

          <nav
            aria-label="Studio navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs uppercase tracking-[0.18em]"
          >
            <Link
              href="/studio/artworks"
              className="text-black/50 transition hover:text-black"
            >
              Artworks
            </Link>

            <Link
              href="/studio/collections"
              className="text-black/50 transition hover:text-black"
            >
              Collections
            </Link>

            <Link
              href="/studio/prints"
              className="text-black/50 transition hover:text-black"
            >
              Manage prints
            </Link>

            <Link
              href="/studio/orders"
              className="text-black/50 transition hover:text-black"
            >
              Orders
            </Link>

            <Link
              href="/"
              className="text-black/50 transition hover:text-black"
            >
              View site
            </Link>
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
