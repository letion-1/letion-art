"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManagePrintsRemoveButton({ artworkId, title }: { artworkId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function removeListing() {
    if (busy) return;
    const entered = window.prompt(
      `Remove the print listing for "${title}" from Manage Prints?\n\nThe portfolio artwork and Creativehub product will stay. Print selling will be disabled.\n\nType the artwork title to confirm:`
    );
    if (entered === null) return;
    if (entered !== title) { setError("The title did not match. Nothing changed."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/studio/prints/listing", {
        method:"POST", credentials:"same-origin", cache:"no-store", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ artworkId, title, action:"hide" })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Unable to remove listing (HTTP ${response.status})`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to remove print listing."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-start gap-1">
    <button type="button" disabled={busy} onClick={removeListing}
      className="border border-amber-800/35 px-4 py-3 text-[10px] uppercase tracking-wider text-amber-900 hover:bg-amber-900 hover:text-white disabled:opacity-40">
      {busy ? "Removing…" : "Remove from prints"}
    </button>
    {error && <span role="alert" className="max-w-[240px] text-xs text-red-800">{error}</span>}
  </span>;
}
