import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Rec=Record<string,unknown>;
function rec(v:unknown):Rec {return v&&typeof v==="object"&&!Array.isArray(v)?v as Rec:{};}
function str(v:unknown){return typeof v==="string"?v.trim():"";}
function url(v:unknown){const x=str(v);try {const u=new URL(x);return u.protocol==="https:"&&u.username===""&&u.password===""?u.toString():null;}catch{return null;}}
function reply(error:string,status:number){return NextResponse.json({error},{status,headers:{"Cache-Control":"private, no-store"}});}
async function authorize(request:Request){
  const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)throw Error("origin");
  const session=await createClient();const {data:{user},error}=await session.auth.getUser();if(error||!user)throw Error("sign-in");
  const db=createAdminClient();const member=await db.from("studio_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(member.error||!member.data)throw Error("admin");return db;
}
async function findProduct(db:ReturnType<typeof createAdminClient>,artworkId:string){
  const art=await db.from("artworks").select("id,title").eq("id",artworkId).maybeSingle();
  if(art.error||!art.data)throw Error("Artwork not found");
  const [sync,mirror]=await Promise.all([
    db.from("artwork_creativehub_sync").select("product_id").eq("artwork_id",artworkId).maybeSingle(),
    db.from("creativehub_draft_imports").select("product_id").eq("linked_artwork_id",artworkId).maybeSingle(),
  ]);
  if(sync.error||mirror.error)throw Error("Creativehub mapping data unavailable. Apply Phase 7 migration first.");
  const a=str(sync.data?.product_id),b=str(mirror.data?.product_id);
  if(a&&b&&a!==b)throw Error("Conflicting Creativehub product mappings. Resolve before importing photos.");
  const id=a||b;
  return {id:UUID.test(id)?id:null,title:art.data.title};
}
async function readSupplier(path:string):Promise<Rec>{
  const token=process.env.ESCHER_API_TOKEN;if(!token)throw Error("Creativehub API token is not configured");
  const base=(process.env.ESCHER_API_BASE_URL||"https://escher-v2.creativehub.io/v1").replace(/\/$/,"");
  const response=await fetch(base+path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Creativehub returned HTTP ${response.status}`);
  return rec(await response.json());
}
async function existing(db:ReturnType<typeof createAdminClient>,id:string){
  const result=await db.from("studio_creativehub_product_photos")
    .select("photo_key,photo_type,image_url,caption,is_public,sort_order,product_id")
    .eq("artwork_id",id).order("sort_order",{ascending:true});
  if(result.error)throw Error("Photo library unavailable. Apply Phase 8 SQL migration first.");
  return result.data??[];
}
export async function GET(request:Request){
  try{const db=await authorize(request);const id=new URL(request.url).searchParams.get("artworkId")||"";
    if(!UUID.test(id))return reply("Invalid artwork ID",400);
    const product=await findProduct(db,id);const photos=await existing(db,id);
    return NextResponse.json({productId:product.id,photos,note:"Only supplier preview and mockup URLs are used. Print masters stay private."},{headers:{"Cache-Control":"private, no-store"}});
  }catch(e){return reply(e instanceof Error?e.message:"Photos unavailable",403);}
}
export async function POST(request:Request){
  try{const db=await authorize(request);const body=rec(await request.json());const artworkId=str(body.artworkId);
    if(!UUID.test(artworkId))return reply("Invalid artwork ID",400);
    const product=await findProduct(db,artworkId);
    if(body.action==="save"){
      if(!Array.isArray(body.selectedKeys)||body.selectedKeys.length>60||body.selectedKeys.some(v=>typeof v!=="string"||v.length>128))return reply("Invalid photo selection",400);
      const result=await db.rpc("studio_set_print_photo_selection",{p_artwork_id:artworkId,p_keys:body.selectedKeys});
      if(result.error)return reply(result.error.message,409);
      return NextResponse.json({saved:true,photos:await existing(db,artworkId)},{headers:{"Cache-Control":"private, no-store"}});
    }
    if(body.action!=="sync")return reply("Unsupported action",400);
    if(!product.id)return reply("Link an existing Creativehub product before importing photos.",409);
    const [productData,variantData]=await Promise.all([
      readSupplier(`/products/${encodeURIComponent(product.id)}`),
      readSupplier(`/products/${encodeURIComponent(product.id)}/variants`),
    ]);
    const p=str(productData.id)===product.id?productData:rec(productData.product);
    if(str(p.id)!==product.id||!Array.isArray(variantData.variants))return reply("Unexpected Creativehub product or variant response",502);
    const saved=await existing(db,artworkId);const previous=new Map(saved.map(x=>[x.photo_key,x]));
    const candidates:{photo_key:string;photo_type:string;image_url:string;caption:string;variantId:string|null}[]=[];
    const artworkPreview=url(p.artwork_preview_medium_url)||url(p.artwork_thumbnail_url);
    // Never import artwork_url: it may point to the full-resolution supplier master.
    if(artworkPreview)candidates.push({photo_key:"artwork-preview",photo_type:"artwork_preview",image_url:artworkPreview,caption:"Artwork preview",variantId:null});
    for(const raw of variantData.variants){const v=rec(raw);const id=str(v.id);const image=url(v.visualised_product_url);
      if(!UUID.test(id)||!image)continue;
      const size=str(v.size)||str(v.size_label)||[v.print_width_mm,v.print_height_mm].join(" × ")+" mm";
      const frame=v.is_framed===true?`Framed ${str(v.frame_color)||"print"}`:"Unframed print";
      candidates.push({photo_key:`variant:${id}`,photo_type:"supplier_mockup",image_url:image,caption:`${size} · ${frame}`,variantId:id});
    }
    const dedupe=[...new Map(candidates.map(x=>[x.photo_key,x])).values()];
    if(dedupe.length>100)return reply("Too many photos returned; review manually",409);
    if(dedupe.length){const rows=dedupe.map((p,i)=>{
      const old=previous.get(p.photo_key);
      return {artwork_id:artworkId,product_id:product.id,photo_key:p.photo_key,photo_type:p.photo_type,
        supplier_variant_id:p.variantId,image_url:p.image_url,caption:p.caption,is_public:old?.is_public??false,
        sort_order:old?.sort_order??i+1,refreshed_at:new Date().toISOString()};
    });
    const result=await db.from("studio_creativehub_product_photos").upsert(rows,{onConflict:"artwork_id,photo_key"});
    if(result.error)return reply(result.error.message,409);}
    return NextResponse.json({synced:true,found:dedupe.length,photos:await existing(db,artworkId),note:dedupe.length===0?"Creativehub has not supplied any usable display photos for this product yet.":null},{headers:{"Cache-Control":"private, no-store"}});
  }catch(e){return reply(e instanceof Error?e.message:"Unable to update product photos",500);}
}
