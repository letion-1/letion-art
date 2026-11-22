import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){
  const slug=new URL(request.url).searchParams.get("slug")||"";
  if(!/^[a-z0-9-]{1,160}$/.test(slug))return NextResponse.json({photos:[]},{headers:{"Cache-Control":"no-store"}});
  try{
    const db=createAdminClient();
    const art=await db.from("artworks").select("id").eq("slug",slug).eq("published",true).maybeSingle();
    if(art.error||!art.data)return NextResponse.json({photos:[]},{headers:{"Cache-Control":"no-store"}});
    const photos=await db.from("studio_creativehub_product_photos")
      .select("photo_key,image_url,caption")
      .eq("artwork_id",art.data.id).eq("is_public",true)
      .order("sort_order",{ascending:true}).limit(40);
    if(photos.error)throw Error("Photo lookup failed");
    return NextResponse.json({photos:photos.data??[]},{headers:{"Cache-Control":"no-store"}});
  }catch(e){console.error("Public product photo lookup failed",e);return NextResponse.json({photos:[]},{headers:{"Cache-Control":"no-store"}});}
}
