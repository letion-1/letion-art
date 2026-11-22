"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function RestorePrintListingButton({ artworkId }: { artworkId:string }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function restore(){setBusy(true);setError("");try{
    const r=await fetch("/api/studio/prints/listing",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({artworkId,action:"restore"})});
    const j=await r.json();if(!r.ok)throw Error(j.error||"Unable to restore print listing.");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to restore.");}finally{setBusy(false);}}
  return <span className="inline-flex flex-col gap-2"><button type="button" disabled={busy} onClick={restore} className="border border-black px-4 py-2 text-xs hover:bg-black hover:text-white disabled:opacity-40">{busy?"Restoring…":"Restore to Manage Prints"}</button>{error&&<span role="alert" className="text-xs text-red-800">{error}</span>}</span>;
}
