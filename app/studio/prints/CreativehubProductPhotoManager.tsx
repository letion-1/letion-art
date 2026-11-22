"use client";
import { useState } from "react";
type Photo={photo_key:string;photo_type:string;image_url:string;caption:string;is_public:boolean;sort_order:number};
export default function CreativehubProductPhotoManager({artworkId}:{artworkId:string}){
  const [open,setOpen]=useState(false);const [productId,setProductId]=useState<string|null>(null);
  const [photos,setPhotos]=useState<Photo[]>([]);const [selected,setSelected]=useState<string[]>([]);
  const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");const [error,setError]=useState("");
  async function request(action:"load"|"sync"|"save",keys?:string[]){
    setBusy(true);setError("");setMessage("");try{
      const response=await fetch(action==="load"?`/api/studio/creativehub/product-photos?artworkId=${encodeURIComponent(artworkId)}`:"/api/studio/creativehub/product-photos",{
        method:action==="load"?"GET":"POST",cache:"no-store",credentials:"same-origin",
        ...(action!=="load"?{headers:{"Content-Type":"application/json"},body:JSON.stringify({artworkId,action,selectedKeys:keys})}:{})
      });
      const body=await response.json();if(!response.ok)throw Error(body.error||`HTTP ${response.status}`);
      const list=Array.isArray(body.photos)?body.photos as Photo[]:[];
      setProductId(body.productId??productId);setPhotos(list);setLoaded(true);
      setSelected(action==="save"?(keys??[]):list.filter(x=>x.is_public).sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.photo_key));
      if(action==="sync")setMessage(list.length?`Found ${list.length} supplier photo(s). Choose which appear publicly, then Save photos.`:"No product photos available from Creativehub yet. Product mockups may require supplier generation.");
      if(action==="save")setMessage("Public product photo selection saved.");
    }catch(e){setError(e instanceof Error?e.message:"Could not load product photos.");}finally{setBusy(false);}
  }
  function toggle(key:string){setSelected(current=>current.includes(key)?current.filter(x=>x!==key):[...current,key]);}
  function move(key:string,by:number){setSelected(current=>{const next=[...current],i=next.indexOf(key),j=i+by;if(i<0||j<0||j>=next.length)return next;[next[i],next[j]]=[next[j],next[i]];return next;});}
  const sorted=[...photos].sort((a,b)=>{
    const ai=selected.indexOf(a.photo_key),bi=selected.indexOf(b.photo_key);
    if(ai>=0&&bi>=0)return ai-bi;if(ai>=0)return -1;if(bi>=0)return 1;return a.sort_order-b.sort_order;
  });
  return <div className="border-b border-black/10 px-5 py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-black/45">Creativehub photo gallery</p><p className="mt-1 text-xs text-black/50">Choose mockups to show on public artwork and shop pages.</p></div>
    <button type="button" onClick={()=>{setOpen(v=>!v);if(!open&&!loaded)void request("load");}} className="border border-black/20 px-4 py-3 text-[10px] uppercase tracking-wider">{open?"Close photos":"Manage product photos"}</button></div>
    {open&&<div className="mt-5"><div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={()=>request("sync")} className="bg-black px-4 py-3 text-xs text-white disabled:opacity-40">{busy?"Working…":"Import / refresh from Creativehub"}</button>
      <button type="button" disabled={busy||!loaded} onClick={()=>request("save",selected)} className="border border-black px-4 py-3 text-xs disabled:opacity-40">Save selected photos</button>
    </div>
    {productId&&<p className="mt-3 break-all text-xs text-black/40">Supplier product: {productId}</p>}
    {message&&<p role="status" className="mt-3 text-sm text-green-800">{message}</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {!photos.length&&<p className="mt-4 text-sm text-black/50">No imported photos yet. Click Import / refresh to fetch Creativehub previews and available mockups.</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sorted.map(p=><div key={p.photo_key} className={`border p-3 ${selected.includes(p.photo_key)?"border-black bg-stone-100":"border-black/10"}`}>
      <img src={p.image_url} alt={p.caption||"Supplier preview"} className="h-44 w-full bg-black/5 object-contain" loading="lazy"/>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(p.photo_key)} onChange={()=>toggle(p.photo_key)} />Show publicly</label>
      <p className="mt-2 text-xs text-black/60">{p.caption}</p>
      {selected.includes(p.photo_key)&&<div className="mt-3 flex gap-2"><button type="button" disabled={selected.indexOf(p.photo_key)===0} onClick={()=>move(p.photo_key,-1)} className="border px-3 py-1 text-xs disabled:opacity-30">Earlier</button><button type="button" disabled={selected.indexOf(p.photo_key)===selected.length-1} onClick={()=>move(p.photo_key,1)} className="border px-3 py-1 text-xs disabled:opacity-30">Later</button></div>}
    </div>)}</div><p className="mt-4 text-xs leading-6 text-black/45">These are Creativehub-hosted display-image links. They do not include your full-resolution print master. Unavailable mockups are never fabricated. If the supplier changes a URL, use Refresh and save again.</p></div>}
  </div>;
}
