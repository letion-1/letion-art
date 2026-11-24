import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function POST(request:Request){
  const __letionMfa = await requireStudioMfa();
  if (!__letionMfa.ok) {
    return NextResponse.json(
      { error: __letionMfa.error },
      { status: __letionMfa.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try{
    const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Invalid origin"},{status:403});
    const session=await createClient();const {data:{user},error}=await session.auth.getUser();if(error||!user)return NextResponse.json({error:"Sign in to Studio."},{status:401});
    const db=createAdminClient();const member=await db.from("studio_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if(member.error||!member.data)return NextResponse.json({error:"Admin access required."},{status:403});
    const body=await request.json() as { artworkId?:unknown;action?:unknown;title?:unknown };
    const id=typeof body.artworkId==="string"?body.artworkId:"";
    if(!uuid.test(id))return NextResponse.json({error:"Invalid artwork ID"},{status:400});
    if(body.action!=="hide"&&body.action!=="restore")return NextResponse.json({error:"Unsupported action"},{status:400});
    const result=body.action==="hide"
      ?await db.rpc("studio_hide_print_listing",{p_artwork_id:id,p_title:body.title})
      :await db.rpc("studio_restore_print_listing",{p_artwork_id:id});
    if(result.error)return NextResponse.json({error:result.error.message},{status:409});
    return NextResponse.json({ok:result.data===true,action:body.action},{headers:{"Cache-Control":"private, no-store"}});
  }catch(e){console.error("Manage Prints listing update failed",e);return NextResponse.json({error:"Print listing could not be updated."},{status:500});}
}
