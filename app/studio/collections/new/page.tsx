import Link from "next/link";
import NewCollectionForm from "./NewCollectionForm";

export default function NewCollectionPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
      <div className="mb-10 border-b border-black/10 pb-6">
        <Link
          href="/studio/collections"
          className="text-xs uppercase tracking-[0.2em] text-black/45 transition hover:text-black"
        >
          ← Collections
        </Link>
      </div>

      <NewCollectionForm />
    </main>
  );
}