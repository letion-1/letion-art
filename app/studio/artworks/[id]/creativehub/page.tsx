import Link from "next/link";
import SyncClient from "./SyncClient";

type Props = { params: Promise<{ id: string }> };

export default async function ArtworkCreativehubPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-[#111] md:px-10">
      <Link href={`/studio/artworks/${id}/edit`} className="text-xs uppercase tracking-[0.18em] text-black/45 hover:text-black">
        ← Back to artwork editor
      </Link>
      <p className="mt-12 text-[10px] uppercase tracking-[0.22em] text-black/40">LETION / STUDIO · PRINT PRODUCTION</p>
      <h1 className="mt-4 text-4xl tracking-[-0.05em] md:text-6xl">Creativehub sync</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-black/55">
        Upload one print-ready master, connect an existing product or create a draft Creativehub product,
        then verify the exact size and frame mappings before enabling sales.
      </p>
      <SyncClient artworkId={id} />
    </main>
  );
}
