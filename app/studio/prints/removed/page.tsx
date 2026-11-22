import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RestorePrintListingButton from "./RestorePrintListingButton";
export const dynamic="force-dynamic";
export default async function RemovedPrintsPage(){
  const session=await createClient(); const {data:{user}}=await session.auth.getUser(); if(!user)redirect("/studio/login");
  const db=createAdminClient(); const member=await db.from("studio_admins").select("user_id").eq("user_id",user.id).maybeSingle(); if(member.error||!member.data)notFound();
  const hidden=await db.from("studio_print_catalog_hidden").select("artwork_id,hidden_at").order("hidden_at",{ascending:false}).limit(1000);
  if(hidden.error)throw Error("Print listing visibility data unavailable. Apply Phase 8 SQL first.");
  const ids=(hidden.data??[]).map(x=>x.artwork_id);
  const artworks=ids.length?await db.from("artworks").select("id,title,image_url").in("id",ids):{data:[],error:null};
  if(artworks.error)throw Error("Could not load removed artwork titles.");
  const byId=new Map((artworks.data??[]).map(x=>[x.id,x]));
  return <main className="mx-auto max-w-5xl px-6 py-12 md:px-10"><Link href="/studio/prints" className="text-xs underline">← Manage Prints</Link><h1 className="mt-8 text-4xl">Removed print listings</h1><p className="mt-4 text-sm text-black/60">Portfolio artworks, images, supplier mappings and historical orders remain untouched. Restoring a listing does not re-enable selling.</p><div className="mt-8 space-y-3">{(hidden.data??[]).length===0&&<p className="border p-6 text-sm">Nothing has been removed.</p>}{(hidden.data??[]).map(item=>{const artwork=byId.get(item.artwork_id);return <div key={item.artwork_id} className="flex flex-wrap items-center justify-between gap-4 border border-black/10 p-4"><div className="flex items-center gap-4">{artwork?.image_url&&<img src={artwork.image_url} alt="" className="h-20 w-16 object-contain"/>}<div><p className="font-medium">{artwork?.title??"Unknown artwork"}</p><p className="text-xs text-black/50">Removed from print management</p></div></div><RestorePrintListingButton artworkId={item.artwork_id}/></div>})}</div></main>;
}
