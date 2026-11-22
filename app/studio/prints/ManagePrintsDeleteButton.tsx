"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManagePrintsDeleteButton({ artworkId, title }: { artworkId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    const entered = window.prompt(
      `Delete ${title} from LETION ART Studio?\n\nThis does not delete the Creativehub product or original files.\n\nTo confirm, type the exact artwork title:`
    );
    if (entered === null) return;
    if (entered !== title) { setError("The title did not match; nothing was deleted."); return; }
    if (!window.confirm(`Permanently delete the local artwork \"${title}\" and its unsold print options?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/studio/artworks/safe-delete", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId, confirmation: title }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Delete failed (HTTP ${response.status}).`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Artwork could not be deleted.");
    } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={remove} disabled={busy} className="border border-red-800/25 px-4 py-3 text-[10px] uppercase tracking-wider text-red-800 hover:bg-red-800 hover:text-white disabled:opacity-40">
        {busy ? "Deleting…" : "Delete artwork"}
      </button>
      {error && <span role="alert" className="max-w-[260px] text-xs text-red-800">{error}</span>}
    </span>
  );
}
