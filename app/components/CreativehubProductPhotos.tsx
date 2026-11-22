"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
type Photo={photo_key:string;image_url:string;caption:string};
export default function CreativehubProductPhotos(){
  const params=useParams();const slug=typeof params.slug==="string"?params.slug:"";
  const [photos,setPhotos]=useState<Photo[]>([]);const [index,setIndex]=useState(0);
  useEffect(()=>{if(!slug)return;let cancelled=false;
    fetch(`/api/artwork-product-photos?slug=${encodeURIComponent(slug)}`,{cache:"no-store"})
      .then(r=>r.ok?r.json():{photos:[]})
      .then(body=>{if(!cancelled){setPhotos(Array.isArray(body.photos)?body.photos:[]);setIndex(0);}})
      .catch(()=>{if(!cancelled)setPhotos([]);});
    return()=>{cancelled=true;};
  },[slug]);
  if(!photos.length)return null;
  const shown=photos[Math.min(index,photos.length-1)];
  return <section aria-label="Print product photographs" className="mx-auto w-full max-w-6xl border-t border-black/10 px-6 py-12 md:px-10 md:py-20">
    <p className="text-[10px] uppercase tracking-[0.24em] text-black/45">Print presentation</p>
    <h2 className="mt-3 text-3xl tracking-tight md:text-5xl">Product photos</h2>
    <figure className="mt-8"><div className="flex min-h-[280px] items-center justify-center bg-black/5 p-4 sm:min-h-[400px]">
      <img src={shown.image_url} alt={shown.caption||"Artwork print photo"} className="max-h-[680px] w-full object-contain" loading="lazy"/>
    </div><figcaption className="mt-3 text-xs text-black/55">{shown.caption}</figcaption></figure>
    {photos.length>1&&<div className="mt-5 flex gap-3 overflow-x-auto pb-3">{photos.map((p,i)=><button key={p.photo_key} type="button" aria-label={`Show ${p.caption||`product photo ${i+1}`}`} aria-pressed={index===i} onClick={()=>setIndex(i)} className={`h-24 w-20 shrink-0 overflow-hidden border p-1 ${index===i?"border-black":"border-black/15"}`}><img src={p.image_url} alt="" className="h-full w-full object-contain" loading="lazy"/></button>)}</div>}
  </section>;
}
